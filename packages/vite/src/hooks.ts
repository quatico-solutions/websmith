/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter, type WebpackLoaderOptions } from "@quatico/websmith-api";
import { AddonRegistry, ModuleCompiler } from "@quatico/websmith-core";
import ts from "typescript";
import type { createFilter, ResolvedConfig, Rollup } from "vite";
import { checkTargetModule, selectConfigErrors } from "./config-errors";
import { DiagnosticReporter } from "./diagnostic-reporter";
import { getDiagnosticKey, partitionDiagnostics, toRollupError, toRollupWarning } from "./diagnostics";
import { isCompiledId } from "./module-ids";
import { resolveViteOptions, type ResolvedViteOptions, type WebsmithViteOptions } from "./options";
import { pickOutput } from "./output";

/** The part of Rollup's plugin context the hooks use. */
export type HookContext = Pick<Rollup.PluginContext, "error" | "warn" | "addWatchFile">;

/** The part of the module compiler the hooks use, so a spec can stub it. */
export type HookCompiler = Pick<
    ModuleCompiler,
    | "build"
    | "getConfigErrors"
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
};

/** The dependencies of the hooks that need Vite or the file system, injected so a spec can stub them. */
export type HookDependencies = {
    createFilter: typeof createFilter;
    createCompiler?: (loaderOptions: Partial<WebpackLoaderOptions>, reporter: Reporter) => HookCompiler;
};

// Keeps JSX for Vite's own JSX handling, in the fragment returned to Vite only
const TARGET_COMPILER_OPTIONS: ts.CompilerOptions = { jsx: ts.JsxEmit.Preserve, sourceMap: true, inlineSourceMap: false };

/** Creates the module compiler of a plugin instance, with the addons of its `AddonRegistry`, reporting to `reporter`. */
export const createModuleCompiler = (loaderOptions: Partial<WebpackLoaderOptions>, reporter: Reporter): HookCompiler =>
    new ModuleCompiler({ reporter, cliArgs: { options: {}, fileNames: [], errors: [] } }, loaderOptions, ts.sys, {
        addons: new AddonRegistry({ reporter, system: ts.sys }),
        targetCompilerOptions: TARGET_COMPILER_OPTIONS,
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
 * and `buildEnd` raises the file-less TypeScript errors the modules returned.
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
    // The configuration errors buildStart raised, which buildEnd does not raise again
    let raisedKeys = new Set<string>();

    const report = (context: HookContext, diagnostics: readonly ts.Diagnostic[]): ts.Diagnostic[] => {
        const { errors, warnings } = partitionDiagnostics(diagnostics, resolved?.loaderOptions.debug ?? false);
        warnings.forEach(cur => context.warn(toRollupWarning(cur)));
        return errors;
    };

    return {
        configResolved(config) {
            resolved = resolveViteOptions(options, config.root, createFilter);
            filter = resolved.filter;
            command = config.command;
        },
        // Configuration errors fail the build before any module is compiled. In serve mode nothing is raised, since an
        // error here stops the dev server; the reporter buffer stays for the first transform, and reporting the
        // configuration errors of the dev server belongs to the feature/vite-plugin-dev-server slice.
        buildStart() {
            if (compiler) {
                // A rebuild of vite build --watch resolves the options again when one of their files changed, so the
                // configuration errors raised below are those of the current config, and loads changed addons again
                compiler.refreshOptions(() => resolved?.loaderOptions ?? {});
                compiler.refreshAddons();
                compiler.resetCompilationCaches();
            } else {
                compiler = createCompiler(resolved?.loaderOptions ?? {}, reporter);
                compiler.keepCachesPerCompilation();
            }
            raisedKeys = new Set();
            if (command !== "build") {
                return;
            }
            const { files, missing } = compiler.getOptionsFiles();
            [...files, ...missing].forEach(cur => this.addWatchFile(cur));
            const errors = report(this, [...compiler.getConfigErrors(), ...checkProfileModule(compiler), ...reporter.take()]);
            if (errors.length > 0) {
                raisedKeys = new Set(errors.map(getDiagnosticKey));
                this.error(toRollupError(errors));
            }
        },
        transformHandler(_code, id) {
            if (!compiler || !isCompiledId(id, filter)) {
                return null;
            }
            const { fragment, diagnostics } = compiler.build(id, { moduleKind: "esm" });
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
        buildEnd(error) {
            if (!compiler) {
                return;
            }
            const late = report(this, reporter.take());
            const errors = selectConfigErrors(command, error, [...compiler.getConfigErrors(), ...late]).filter(
                cur => !raisedKeys.has(getDiagnosticKey(cur))
            );
            if (errors.length > 0) {
                this.error(toRollupError(errors));
            }
        },
    };
};
