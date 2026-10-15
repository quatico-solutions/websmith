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
import { getDiagnosticKey, partitionDiagnostics, toRollupError, toRollupWarning } from "./diagnostics";
import { isCompiledId } from "./module-ids";
import { createModuleFilter, resolveViteOptions, selectProfile, type ResolvedViteOptions, type WebsmithViteOptions } from "./options";
import { pickOutput } from "./output";
import { ViteAddonContext } from "./vite-addon-context";
import { createDeduplicatingSystem } from "./write-record";

/** The part of Vite's environment the hooks use: its name, which keys the plugin's state, and its resolved config. */
export type EnvironmentInfo = { name: string; config: { root: string; command: "build" | "serve"; build: { outDir: string } } };

/** The part of Rollup's plugin context the hooks use, with the Vite environment the hook runs in. */
export type HookContext = Pick<Rollup.PluginContext, "error" | "warn" | "addWatchFile" | "emitFile" | "getModuleIds"> & {
    environment: EnvironmentInfo;
};

/** The part of the module compiler the hooks use, so a spec can stub it. */
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
>;

/** The hooks of the websmith plugin, called with Rollup's plugin context as `this`. */
export type WebsmithHooks = {
    configResolved: (config: Pick<ResolvedConfig, "root" | "command">) => void;
    buildStart: (this: HookContext) => void;
    transformHandler: (this: HookContext, code: string, id: string) => Rollup.TransformResult;
    buildEnd: (this: HookContext, error?: Error) => void;
    generateBundle: (this: HookContext, options: unknown, bundle: Record<string, unknown>) => void;
};

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
 */
export const createModuleCompiler = (loaderOptions: Partial<WebpackLoaderOptions>, reporter: Reporter, outputs: AddonOutputs): HookCompiler =>
    new ModuleCompiler({ reporter, cliArgs: { options: {}, fileNames: [], errors: [] } }, loaderOptions, createDeduplicatingSystem(ts.sys), {
        addons: new AddonRegistry({ reporter, system: ts.sys }),
        targetCompilerOptions: TARGET_COMPILER_OPTIONS,
        createContext: options => new ViteAddonContext(options, outputs),
    });

// The target profile, its merged tsConfig, with module and target as enums, and whether the profile itself sets esm
const getProfileModule = (compiler: HookCompiler): { profile?: string; tsConfig: ts.CompilerOptions; hasEsm: boolean } => {
    const profile = compiler.getProfile();
    const options = compiler.getOptions();
    const hasEsm = profile !== undefined && options.config?.profiles?.[profile]?.esm !== undefined;
    return { profile, tsConfig: options.getOptions(profile).tsConfig ?? {}, hasEsm };
};

const checkProfileModule = (compiler: HookCompiler): ts.Diagnostic[] => {
    const { profile, tsConfig, hasEsm } = getProfileModule(compiler);
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
    reporter: DiagnosticReporter;
    outputs: AddonOutputs;
    // The output files of each compiled module, which the result processors receive for the modules of the build
    outputFiles: Map<string, string[]>;
    // The configuration errors buildStart raised, which buildEnd does not raise again
    raisedKeys: Set<string>;
    // The warnings of the current build, which later modules do not warn again, e.g. the missing addons every lookup reports
    warnedKeys: Set<string>;
    profileError?: ts.Diagnostic;
    // The package.json files that decide the module format under node16 and nodenext, cleared for every build
    packageJsonCache: ts.PackageJsonInfoCache;
};

/**
 * Creates the hooks of the websmith plugin for `options`. Each Vite environment, by `this.environment.name`, gets its
 * own state on its first `buildStart` or `transform`, with the profile selected for it and its `build.outDir`, since
 * Vite may share one plugin object between environments, and the dev server runs no `buildStart` for `ssr`.
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

    // Resolves the options for the environment and points its outputs to its build.outDir, which a later build() with
    // the same plugin object may change
    const configureEnvironment = ({ name, config }: EnvironmentInfo, outputs: AddonOutputs): ResolvedViteOptions => {
        outputs.configure({ outDir: path.resolve(config.root, config.build.outDir), command });
        return resolveViteOptions(options, config.root, name, createFilter);
    };

    // Returns the state of the environment the hook runs in, creating it and its compiler on first use; addons
    // activate here, as their addon. An environment the profile map does not name gets no compiler.
    const getEnvironmentState = (context: HookContext): EnvironmentState => {
        const { name, config } = context.environment;
        const existing = environments.get(name);
        if (existing) {
            return existing;
        }
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
            packageJsonCache: ts.createModuleResolutionCache(config.root, cur => cur).getPackageJsonInfoCache(),
        };
        if (!state.profileError) {
            state.compiler = outputs.runActivation(context, () => {
                const created = createCompiler(state.resolved.loaderOptions, reporter, outputs);
                created.keepCachesPerCompilation();
                return created;
            });
        }
        environments.set(name, state);
        return state;
    };

    return {
        configResolved(config) {
            filter = createModuleFilter(options, config.root, createFilter);
            command = config.command;
        },
        // Configuration errors fail the environment's build before any module is compiled, including a profile map
        // that does not name the environment. In serve mode nothing is raised, since an error here stops the dev
        // server; the reporter buffer stays for the first transform, and reporting the configuration errors of the dev
        // server belongs to the feature/vite-plugin-dev-server slice.
        buildStart() {
            const existing = environments.get(this.environment.name);
            const state = existing ?? getEnvironmentState(this);
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
                }
            }
            state.raisedKeys = new Set();
            state.warnedKeys = new Set();
            if (command !== "build") {
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
            const errors = report(this, state, [...current.getConfigErrors(), ...checkProfileModule(current), ...state.reporter.take()]);
            if (errors.length > 0) {
                state.raisedKeys = new Set(errors.map(getDiagnosticKey));
                this.error(toRollupError(errors));
            }
        },
        // A node16 or nodenext module that TypeScript emits as CommonJS fails before it is compiled, so no generator runs
        // on output Vite rejects; the package.json that decides its format is watched either way.
        transformHandler(_code, id) {
            if (!isCompiledId(id, filter)) {
                return null;
            }
            const state = getEnvironmentState(this);
            if (state.profileError) {
                this.error(toRollupError([state.profileError]));
            }
            const current = state.compiler;
            if (!current) {
                return null;
            }
            const { profile, tsConfig, hasEsm } = getProfileModule(current);
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
            state.outputFiles.set(
                id,
                fragment.files.map(cur => cur.name)
            );
            const errors = report(this, state, [...diagnostics, ...reporter.take()]);
            if (errors.length > 0) {
                this.error(toRollupError(errors));
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
            const state = environments.get(this.environment.name);
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
            const state = environments.get(this.environment.name);
            if (command !== "build" || !state) {
                return;
            }
            state.outputs.generateBundle(this, bundle, this.getModuleIds());
            const errors = report(this, state, state.reporter.take());
            if (errors.length > 0) {
                this.error(toRollupError(errors));
            }
        },
    };
};
