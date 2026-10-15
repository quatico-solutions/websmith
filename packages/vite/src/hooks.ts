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
import { checkTargetModule, selectConfigErrors } from "./config-errors";
import { DiagnosticReporter } from "./diagnostic-reporter";
import { getDiagnosticKey, partitionDiagnostics, toRollupError, toRollupWarning } from "./diagnostics";
import { isCompiledId } from "./module-ids";
import { resolveViteOptions, type ResolvedViteOptions, type WebsmithViteOptions } from "./options";
import { pickOutput } from "./output";
import { ViteAddonContext } from "./vite-addon-context";
import { createDeduplicatingSystem } from "./write-record";

/** The part of Rollup's plugin context the hooks use. */
export type HookContext = Pick<Rollup.PluginContext, "error" | "warn" | "addWatchFile" | "emitFile" | "getModuleIds">;

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
    configResolved: (config: Pick<ResolvedConfig, "root" | "command"> & { build: Pick<ResolvedConfig["build"], "outDir"> }) => void;
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

// The target profile's merged tsConfig, with module and target as enums, and whether the profile itself sets esm
const checkProfileModule = (compiler: HookCompiler): ts.Diagnostic[] => {
    const profile = compiler.getProfile();
    const options = compiler.getOptions();
    const hasEsm = profile !== undefined && options.config?.profiles?.[profile]?.esm !== undefined;
    const error = checkTargetModule(profile, options.getOptions(profile).tsConfig ?? {}, hasEsm);
    return error ? [error] : [];
};

/**
 * Creates the hooks of the websmith plugin for `options`: `configResolved` resolves them against Vite's root,
 * `buildStart` creates the compiler and raises its configuration errors, `transformHandler` compiles one module,
 * `buildEnd` raises the file-less TypeScript errors the modules returned and runs the result processors, and
 * `generateBundle` applies the virtual files and removals of the addons to the bundle.
 */
export const createWebsmithHooks = (
    options: WebsmithViteOptions,
    { createFilter, createCompiler = createModuleCompiler }: HookDependencies
): WebsmithHooks => {
    let resolved: ResolvedViteOptions | undefined;
    let filter: (id: string) => boolean = () => false;
    let compiler: HookCompiler | undefined;
    let command: "build" | "serve" = "build";
    const reporter = new DiagnosticReporter();
    const outputs = new AddonOutputs(reporter);
    // The output files of each compiled module, which the result processors receive for the modules of the build
    const outputFiles = new Map<string, string[]>();
    // The configuration errors buildStart raised, which buildEnd does not raise again
    let raisedKeys = new Set<string>();
    // The warnings of the current build, which later modules do not warn again, e.g. the missing addons every lookup reports
    let warnedKeys = new Set<string>();

    const report = (context: HookContext, diagnostics: readonly ts.Diagnostic[]): ts.Diagnostic[] => {
        const { errors, warnings } = partitionDiagnostics(diagnostics, resolved?.loaderOptions.debug ?? false);
        warnings
            .filter(cur => !warnedKeys.has(getDiagnosticKey(cur)))
            .forEach(cur => {
                warnedKeys.add(getDiagnosticKey(cur));
                context.warn(toRollupWarning(cur));
            });
        return errors;
    };

    return {
        configResolved(config) {
            resolved = resolveViteOptions(options, config.root, createFilter);
            filter = resolved.filter;
            command = config.command;
            outputs.configure({ outDir: path.resolve(config.root, config.build.outDir), command });
        },
        // Configuration errors fail the build before any module is compiled. In serve mode nothing is raised, since an
        // error here stops the dev server; the reporter buffer stays for the first transform, and reporting the
        // configuration errors of the dev server belongs to the feature/vite-plugin-dev-server slice.
        buildStart() {
            outputs.startBuild();
            // Addons activate here, as their addon, when the compiler is created or reloads them
            const current = outputs.runActivation(this, () => {
                if (compiler) {
                    // A rebuild of vite build --watch resolves the options again when one of their files changed, so the
                    // configuration errors raised below are those of the current config, and loads changed addons again
                    compiler.refreshOptions(() => resolved?.loaderOptions ?? {});
                    compiler.refreshAddons();
                    compiler.resetCompilationCaches();
                    return compiler;
                }
                const created = createCompiler(resolved?.loaderOptions ?? {}, reporter, outputs);
                created.keepCachesPerCompilation();
                return created;
            });
            compiler = current;
            raisedKeys = new Set();
            warnedKeys = new Set();
            if (command !== "build") {
                return;
            }
            const { files, missing } = current.getOptionsFiles();
            [...files, ...missing].forEach(cur => this.addWatchFile(cur));
            const errors = report(this, [...current.getConfigErrors(), ...checkProfileModule(current), ...reporter.take()]);
            if (errors.length > 0) {
                raisedKeys = new Set(errors.map(getDiagnosticKey));
                this.error(toRollupError(errors));
            }
        },
        transformHandler(_code, id) {
            if (!compiler || !isCompiledId(id, filter)) {
                return null;
            }
            const current = compiler;
            outputs.startModule(id);
            const { fragment, diagnostics, dependencies } = outputs.run(this, id, () => current.build(id, { moduleKind: "esm" }));
            [...dependencies.files, ...dependencies.missing].forEach(cur => this.addWatchFile(cur));
            outputFiles.set(
                id,
                fragment.files.map(cur => cur.name)
            );
            const errors = report(this, [...diagnostics, ...reporter.take()]);
            if (errors.length > 0) {
                this.error(toRollupError(errors));
            }
            return pickOutput(fragment);
        },
        // The compiler keeps the TypeScript errors without a file out of the module diagnostics, since every module
        // returns the same option errors. Without webpack's afterCompile, the build raises them once at its end: those
        // of all modules, minus the configuration errors buildStart raised. Anything reported after the last transform
        // is a warning here. A dev server calls buildEnd on close, where raising would abort the closing plugins.
        // A successful build then runs the result processors of the profile once, with the output files of every module
        // of the build, including those Rollup's watch cache did not transform again.
        buildEnd(error) {
            const current = compiler;
            if (!current) {
                return;
            }
            const late = report(this, reporter.take());
            const errors = selectConfigErrors(command, error, [...current.getConfigErrors(), ...late]).filter(
                cur => !raisedKeys.has(getDiagnosticKey(cur))
            );
            if (errors.length > 0) {
                this.error(toRollupError(errors));
            }
            if (command !== "build" || error) {
                return;
            }
            const files = [...this.getModuleIds()].flatMap(cur => outputFiles.get(cur) ?? []);
            const resultErrors = outputs.run(this, undefined, () => current.runResultProcessors(files));
            const processorErrors = report(this, [...resultErrors, ...reporter.take()]);
            if (processorErrors.length > 0) {
                this.error(toRollupError(processorErrors));
            }
        },
        // Emits the virtual files of the bundle's modules and of the build as assets, then deletes the removed files
        generateBundle(_options, bundle) {
            if (command !== "build") {
                return;
            }
            outputs.generateBundle(this, bundle, this.getModuleIds());
            const errors = report(this, reporter.take());
            if (errors.length > 0) {
                this.error(toRollupError(errors));
            }
        },
    };
};
