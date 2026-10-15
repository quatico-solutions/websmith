/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter, type WebpackLoaderOptions } from "@quatico/websmith-api";
import { AddonRegistry, ModuleCompiler } from "@quatico/websmith-core";
import path from "node:path";
import ts from "typescript";
import type { createFilter, ResolvedConfig, Rollup } from "vite";
import { AddonOutputs } from "./addon-outputs";
import { checkModuleFormat, checkTargetModule, selectConfigErrors } from "./config-errors";
import { DiagnosticReporter } from "./diagnostic-reporter";
import { formatDiagnostic, getDiagnosticKey, partitionDiagnostics, toRollupError, toRollupWarning } from "./diagnostics";
import { isCompiledId } from "./module-ids";
import { createModuleFilter, resolveViteOptions, selectProfile, type ResolvedViteOptions, type WebsmithViteOptions } from "./options";
import { pickOutput } from "./output";
import { ViteAddonContext } from "./vite-addon-context";
import { createDeduplicatingSystem } from "./write-record";

/** The part of Vite's logger of an environment the hooks use, in serve mode only. */
export type EnvironmentLogger = {
    error(msg: string, options?: { timestamp?: boolean }): void;
    warn(msg: string, options?: { timestamp?: boolean }): void;
};

/**
 * The part of Vite's environment the hooks use: its name, which keys the plugin's state, its resolved config and its
 * logger. Vite passes the same object to every hook of one build; a worker bundle gets a new object, named like its
 * environment.
 */
export type EnvironmentInfo = {
    name: string;
    config: { root: string; build: { outDir: string } };
    logger: EnvironmentLogger;
};

/** The part of Rollup's plugin context the hooks use, with the Vite environment the hook runs in. */
export type HookContext = Pick<Rollup.PluginContext, "error" | "warn" | "addWatchFile" | "emitFile" | "getModuleIds"> & {
    environment: EnvironmentInfo;
};

/**
 * The part of the module compiler the hooks use, so a spec can stub it, and the names of the addons of its profile
 * that need type information.
 */
export type HookCompiler = Pick<
    ModuleCompiler,
    | "build"
    | "getConfigErrors"
    | "runResultProcessors"
    | "getOptions"
    | "getProfile"
    | "getOptionsFiles"
    | "refreshOptions"
    | "refreshAddons"
    | "resetCompilationCaches"
    | "keepCachesPerCompilation"
> & { getTypeInfoAddons: () => string[] };

/** The hooks of the websmith plugin, called with Rollup's plugin context as `this`. */
export type WebsmithHooks = {
    configResolved: (config: Pick<ResolvedConfig, "root" | "command">) => void;
    buildStart: (this: HookContext) => void;
    transformHandler: (this: HookContext, code: string, id: string) => Rollup.TransformResult;
    buildEnd: (this: HookContext, error?: Error) => void;
    generateBundle: (this: HookContext, options: unknown, bundle: Record<string, unknown>) => void;
    findVirtualFile: (url: string, base: string) => VirtualFile | undefined;
};

/** A virtual file an addon added, by its bundle file name. */
export type VirtualFile = { fileName: string; content: string };

const LOG_PREFIX = "[plugin websmith] ";

// The environment whose virtual files the dev server serves to the browser
const CLIENT_ENVIRONMENT = "client";

/** The dependencies of the hooks that need Vite or the file system, injected so a spec can stub them. */
export type HookDependencies = {
    createFilter: typeof createFilter;
    createCompiler?: (loaderOptions: Partial<WebpackLoaderOptions>, reporter: Reporter, outputs: AddonOutputs) => HookCompiler;
};

// Keeps JSX for Vite's own JSX handling, in the fragment returned to Vite only
const TARGET_COMPILER_OPTIONS: ts.CompilerOptions = { jsx: ts.JsxEmit.Preserve, sourceMap: true, inlineSourceMap: false };

/**
 * Creates the module compiler of a plugin instance, with the addons of its `AddonRegistry`, reporting to `reporter`.
 * The addons of its profile get a `ViteAddonContext` that maps to `outputs`, and identical rewrites of a file are skipped.
 * An addon needs type information unless it sets `needsTypeInfo` to false.
 */
export const createModuleCompiler = (loaderOptions: Partial<WebpackLoaderOptions>, reporter: Reporter, outputs: AddonOutputs): HookCompiler => {
    const addons = new AddonRegistry({ reporter, system: ts.sys });
    const compiler = new ModuleCompiler(
        { reporter, cliArgs: { options: {}, fileNames: [], errors: [] } },
        loaderOptions,
        createDeduplicatingSystem(ts.sys),
        {
            addons,
            targetCompilerOptions: TARGET_COMPILER_OPTIONS,
            createContext: options => new ViteAddonContext(options, outputs),
        }
    );
    return Object.assign(compiler, {
        getTypeInfoAddons: () =>
            addons
                .getAvailableAddons(compiler.getProfile())
                .filter(cur => cur.needsTypeInfo !== false)
                .map(cur => cur.getName()),
    });
};

/** The target profile, its merged tsConfig, with module and target as enums, and whether the profile itself sets esm. */
type ProfileModule = { profile?: string; tsConfig: ts.CompilerOptions; hasEsm: boolean };

// Reads the tsconfig.json of the profile and discovers its files, so an environment's build calls it once
const getProfileModule = (compiler: HookCompiler): ProfileModule => {
    const profile = compiler.getProfile();
    const options = compiler.getOptions();
    const hasEsm = profile !== undefined && options.config?.profiles?.[profile]?.esm !== undefined;
    return { profile, tsConfig: options.getOptions(profile).tsConfig ?? {}, hasEsm };
};

const checkProfileModule = ({ profile, tsConfig, hasEsm }: ProfileModule): ts.Diagnostic[] => {
    const error = checkTargetModule(profile, tsConfig, hasEsm);
    return error ? [error] : [];
};

/**
 * The state of one Vite environment, never shared with another: its resolved options, its compiler, reporter and
 * addon outputs, the output files of its modules, the diagnostics its build raised, and the profile selection error.
 */
type EnvironmentState = {
    resolved: ResolvedViteOptions;
    compiler?: HookCompiler;
    // The profile module of the compiler's current options, looked up once per build and again after a refresh
    profileModule?: ProfileModule;
    // The environment object of the build between its buildStart and buildEnd, which a nested build does not share
    building?: EnvironmentInfo;
    reporter: DiagnosticReporter;
    outputs: AddonOutputs;
    // The output files of each compiled module, which the result processors receive for the modules of the build
    outputFiles: Map<string, string[]>;
    // The configuration errors buildStart raised, which buildEnd does not raise again
    raisedKeys: Set<string>;
    // The warnings of the current build, which later modules do not warn again, e.g. the missing addons every lookup reports
    warnedKeys: Set<string>;
    profileError?: ts.Diagnostic;
    // The errors the addons reported while they activated, kept for every module of the dev server
    activationErrors: ts.Diagnostic[];
    // Whether the dev server started the environment, i.e. logged its configuration errors
    serving: boolean;
    // The configuration errors that fail every module of the environment in the dev server
    serveErrors: ts.Diagnostic[];
    // The errors logged to the environment's logger, which are not logged again
    loggedKeys: Set<string>;
    // The package.json files that decide the module format under node16 and nodenext, cleared for every build
    packageJsonCache: ts.PackageJsonInfoCache;
};

/**
 * Creates the hooks of the websmith plugin for `options`. Each Vite environment, by `this.environment.name`, gets its
 * own state on its first `buildStart` or `transform`, with the profile selected for it and its `build.outDir`, since
 * Vite may share one plugin object between environments, and the dev server runs no `buildStart` for `ssr`. A build
 * that starts while another build of the same name runs, e.g. a worker that `worker.plugins` bundles with the same
 * plugin object as environment `client`, gets a state of its own, keyed by its environment object.
 * `configResolved` keeps what the environments share: the command and the module id filter. `buildStart` creates the
 * environment's compiler and raises its configuration errors, `transformHandler` compiles one module, `buildEnd`
 * raises the file-less TypeScript errors the modules returned and runs the result processors, and `generateBundle`
 * applies the virtual files and removals of the addons to the bundle.
 */
export const createWebsmithHooks = (
    options: WebsmithViteOptions,
    { createFilter, createCompiler = createModuleCompiler }: HookDependencies
): WebsmithHooks => {
    let filter: (id: string) => boolean = () => false;
    let command: "build" | "serve" = "build";
    const environments = new Map<string, EnvironmentState>();
    // The state of each environment object a build started with, including those of nested builds
    const instances = new WeakMap<EnvironmentInfo, EnvironmentState>();

    const report = (context: HookContext, state: EnvironmentState, diagnostics: readonly ts.Diagnostic[]): ts.Diagnostic[] => {
        const { errors, warnings } = partitionDiagnostics(diagnostics, state.resolved.loaderOptions.debug ?? false);
        warnings
            .filter(cur => !state.warnedKeys.has(getDiagnosticKey(cur)))
            .forEach(cur => {
                state.warnedKeys.add(getDiagnosticKey(cur));
                context.warn(toRollupWarning(cur));
            });
        return errors;
    };

    // Moves the errors the addons reported while they activated out of the reporter buffer, so every module of the dev
    // server raises them, not only the first; their warnings stay in the buffer
    const keepActivationErrors = (state: EnvironmentState): void => {
        const taken = state.reporter.take();
        state.activationErrors = taken.filter(cur => cur.category === ts.DiagnosticCategory.Error);
        taken.filter(cur => cur.category !== ts.DiagnosticCategory.Error).forEach(cur => state.reporter.reportDiagnostic(cur));
    };

    // Logs the errors to the environment's logger, each once per environment
    const logErrors = (context: HookContext, state: EnvironmentState, errors: readonly ts.Diagnostic[]): void =>
        errors
            .filter(cur => cur.category === ts.DiagnosticCategory.Error && !state.loggedKeys.has(getDiagnosticKey(cur)))
            .forEach(cur => {
                state.loggedKeys.add(getDiagnosticKey(cur));
                context.environment.logger.error(LOG_PREFIX + formatDiagnostic(cur), { timestamp: true });
            });

    // Warns once per environment when transpileOnly drops the type information that addons of the profile need
    const warnTranspileOnly = (context: HookContext, state: EnvironmentState, compiler: HookCompiler): void => {
        if (!state.resolved.loaderOptions.transpileOnly) {
            return;
        }
        const addons = compiler.getTypeInfoAddons();
        if (addons.length === 0) {
            return;
        }
        const profile = compiler.getProfile();
        const owner = profile === undefined ? "the default profile" : `profile '${profile}'`;
        context.environment.logger.warn(
            `${LOG_PREFIX}'transpileOnly' drops type information in the Vite dev server for the addons of ${owner} that need it: ` +
                `${addons.join(", ")}. Remove 'transpileOnly', or set needsTypeInfo to false in an addon that needs none.`,
            { timestamp: true }
        );
    };

    // Starts the environment in the dev server, once per state: client in buildStart, any other environment on its
    // first transform. Logs its configuration errors, which fail each of its modules, since raising one here would
    // stop the server.
    const startServing = (context: HookContext, state: EnvironmentState): void => {
        if (state.serving) {
            return;
        }
        state.serving = true;
        const current = state.compiler;
        if (state.profileError || !current) {
            state.serveErrors = state.profileError ? [state.profileError] : [];
            logErrors(context, state, state.serveErrors);
            return;
        }
        state.profileModule = getProfileModule(current);
        warnTranspileOnly(context, state, current);
        state.serveErrors = report(context, state, [
            ...current.getConfigErrors(),
            ...checkProfileModule(state.profileModule),
            ...state.activationErrors,
        ]);
        logErrors(context, state, state.serveErrors);
    };

    // Resolves the options for the environment and points its outputs to its build.outDir, which a later build() with
    // the same plugin object may change
    const configureEnvironment = ({ name, config }: EnvironmentInfo, outputs: AddonOutputs): ResolvedViteOptions => {
        outputs.configure({ outDir: path.resolve(config.root, config.build.outDir), command });
        return resolveViteOptions(options, config.root, name, createFilter);
    };

    // Creates the state of the environment the hook runs in and its compiler; addons activate here, as their addon. An
    // environment the profile map does not name gets no compiler.
    const createEnvironmentState = (context: HookContext): EnvironmentState => {
        const { name, config } = context.environment;
        const reporter = new DiagnosticReporter();
        const outputs = new AddonOutputs(reporter);
        const state: EnvironmentState = {
            resolved: configureEnvironment(context.environment, outputs),
            reporter,
            outputs,
            outputFiles: new Map(),
            raisedKeys: new Set(),
            warnedKeys: new Set(),
            profileError: selectProfile(options.profile, name).error,
            activationErrors: [],
            serving: false,
            serveErrors: [],
            loggedKeys: new Set(),
            packageJsonCache: ts.createModuleResolutionCache(config.root, cur => cur).getPackageJsonInfoCache(),
        };
        if (!state.profileError) {
            state.compiler = outputs.runActivation(context, () => {
                const created = createCompiler(state.resolved.loaderOptions, reporter, outputs);
                created.keepCachesPerCompilation();
                return created;
            });
            keepActivationErrors(state);
        }
        return state;
    };

    // Returns the state of the build the hook runs in, by its environment object, or else by its environment name,
    // creating it on first use
    const getEnvironmentState = (context: HookContext): EnvironmentState => {
        const { name } = context.environment;
        const existing = instances.get(context.environment) ?? environments.get(name);
        if (existing) {
            return existing;
        }
        const state = createEnvironmentState(context);
        environments.set(name, state);
        return state;
    };

    // Returns the state of the build that starts: a new one for a build nested in a running build of the same name
    const startEnvironmentState = (context: HookContext): { state: EnvironmentState; existing: boolean } => {
        const { environment } = context;
        const named = environments.get(environment.name);
        const nested = named?.building !== undefined && named.building !== environment && !instances.has(environment);
        const existing = nested ? undefined : (instances.get(environment) ?? named);
        const state = existing ?? (nested ? createEnvironmentState(context) : getEnvironmentState(context));
        instances.set(environment, state);
        state.building = environment;
        return { state, existing: existing !== undefined };
    };

    return {
        configResolved(config) {
            filter = createModuleFilter(options, config.root, createFilter);
            command = config.command;
        },
        // Configuration errors fail the environment's build before any module is compiled, including a profile map
        // that does not name the environment. In serve mode nothing is raised, since an error here stops the dev
        // server: the errors go to the environment's logger, and every transform of the environment raises them.
        buildStart() {
            const { state, existing } = startEnvironmentState(this);
            if (existing) {
                state.resolved = configureEnvironment(this.environment, state.outputs);
                state.outputs.startBuild();
                state.packageJsonCache.clear();
                const { compiler } = state;
                if (compiler) {
                    // A rebuild of vite build --watch resolves the options again when one of their files changed, so the
                    // configuration errors raised below are those of the current config, and loads changed addons again
                    state.outputs.runActivation(this, () => {
                        compiler.refreshOptions(() => state.resolved.loaderOptions);
                        compiler.refreshAddons();
                        compiler.resetCompilationCaches();
                    });
                    keepActivationErrors(state);
                }
                state.profileModule = undefined;
            }
            state.raisedKeys = new Set();
            state.warnedKeys = new Set();
            if (command !== "build") {
                startServing(this, state);
                return;
            }
            const current = state.compiler;
            if (!current) {
                if (state.profileError) {
                    state.raisedKeys = new Set([getDiagnosticKey(state.profileError)]);
                    this.error(toRollupError([state.profileError]));
                }
                return;
            }
            const { files, missing } = current.getOptionsFiles();
            [...files, ...missing].forEach(cur => this.addWatchFile(cur));
            state.profileModule = getProfileModule(current);
            const errors = report(this, state, [
                ...current.getConfigErrors(),
                ...checkProfileModule(state.profileModule),
                ...state.activationErrors,
                ...state.reporter.take(),
            ]);
            if (errors.length > 0) {
                state.raisedKeys = new Set(errors.map(getDiagnosticKey));
                this.error(toRollupError(errors));
            }
        },
        // A node16 or nodenext module that TypeScript emits as CommonJS fails before it is compiled, so no generator runs
        // on output Vite rejects; the package.json that decides its format is watched either way. In serve mode, the
        // configuration errors of the environment fail each module before it is compiled, and the TypeScript errors
        // without a file, which exist only after an emit, join the errors of each module. A module without errors then
        // runs the result processors with its output files, keeping what they add under its id.
        transformHandler(_code, id) {
            if (!isCompiledId(id, filter)) {
                return null;
            }
            const state = getEnvironmentState(this);
            const serving = command === "serve";
            if (serving) {
                startServing(this, state);
                if (state.serveErrors.length > 0) {
                    this.error(toRollupError(state.serveErrors));
                }
            } else if (state.profileError) {
                this.error(toRollupError([state.profileError]));
            }
            const current = state.compiler;
            if (!current) {
                return null;
            }
            state.profileModule ??= getProfileModule(current);
            const { profile, tsConfig, hasEsm } = state.profileModule;
            const { error, packageJson } = checkModuleFormat(profile, id, tsConfig, hasEsm, ts.sys, state.packageJsonCache);
            if (packageJson) {
                this.addWatchFile(packageJson);
            }
            if (error) {
                this.error(toRollupError([error]));
            }
            const { outputs, reporter } = state;
            outputs.startModule(id);
            const { fragment, diagnostics, dependencies } = outputs.run(this, id, () => current.build(id, { moduleKind: "esm" }));
            [...dependencies.files, ...dependencies.missing].forEach(cur => this.addWatchFile(cur));
            const files = fragment.files.map(cur => cur.name);
            state.outputFiles.set(id, files);
            const fileLessErrors = serving ? current.getConfigErrors() : [];
            logErrors(this, state, fileLessErrors);
            const errors = report(this, state, [...diagnostics, ...reporter.take(), ...fileLessErrors]);
            if (errors.length > 0) {
                this.error(toRollupError(errors));
            }
            if (serving) {
                const resultErrors = outputs.run(this, id, () => current.runResultProcessors(files));
                const processorErrors = report(this, state, [...resultErrors, ...reporter.take()]);
                if (processorErrors.length > 0) {
                    this.error(toRollupError(processorErrors));
                }
            }
            return pickOutput(fragment);
        },
        // The compiler keeps the TypeScript errors without a file out of the module diagnostics, since every module
        // returns the same option errors. Without webpack's afterCompile, the build raises them once at its end: those
        // of all modules, minus the configuration errors buildStart raised. Anything reported after the last transform
        // is a warning here. A dev server calls buildEnd on close, where raising would abort the closing plugins.
        // A successful build then runs the result processors of the environment's profile once, with the output files
        // of every module of the environment's build, including those Rollup's watch cache did not transform again,
        // and drops the entries of the modules that left the graph.
        buildEnd(error) {
            const state = instances.get(this.environment) ?? environments.get(this.environment.name);
            if (state?.building === this.environment) {
                state.building = undefined;
            }
            const current = state?.compiler;
            if (!state || !current) {
                return;
            }
            const late = report(this, state, state.reporter.take());
            const errors = selectConfigErrors(command, error, [...current.getConfigErrors(), ...late]).filter(
                cur => !state.raisedKeys.has(getDiagnosticKey(cur))
            );
            if (errors.length > 0) {
                this.error(toRollupError(errors));
            }
            if (command !== "build" || error) {
                return;
            }
            const moduleIds = new Set(this.getModuleIds());
            const files = [...moduleIds].flatMap(cur => state.outputFiles.get(cur) ?? []);
            const resultErrors = state.outputs.run(this, undefined, () => current.runResultProcessors(files));
            [...state.outputFiles.keys()].filter(cur => !moduleIds.has(cur)).forEach(cur => state.outputFiles.delete(cur));
            state.outputs.retainModules(moduleIds);
            const processorErrors = report(this, state, [...resultErrors, ...state.reporter.take()]);
            if (processorErrors.length > 0) {
                this.error(toRollupError(processorErrors));
            }
        },
        // Emits the virtual files of the bundle's modules and of the build as assets, then deletes the removed files
        generateBundle(_options, bundle) {
            const state = instances.get(this.environment) ?? environments.get(this.environment.name);
            if (command !== "build" || !state) {
                return;
            }
            state.outputs.generateBundle(this, bundle, this.getModuleIds());
            const errors = report(this, state, state.reporter.take());
            if (errors.length > 0) {
                this.error(toRollupError(errors));
            }
        },
        // Serves the virtual files of the client environment, which serves the browser, at base + their bundle path
        findVirtualFile(url, base) {
            const state = environments.get(CLIENT_ENVIRONMENT);
            let pathname: string;
            try {
                pathname = decodeURIComponent(url.replace(/[?#].*$/s, ""));
            } catch {
                return undefined;
            }
            if (!state || !pathname.startsWith(base)) {
                return undefined;
            }
            const fileName = pathname.slice(base.length);
            const content = state.outputs.getVirtualFile(fileName);
            return content === undefined ? undefined : { fileName, content };
        },
    };
};
