/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type WebpackLoaderOptions } from "@quatico/websmith-api";
import { AddonRegistry, DefaultReporter, ModuleCompiler } from "@quatico/websmith-core";
import ts from "typescript";
import type { createFilter, ResolvedConfig, Rollup } from "vite";
import { selectConfigErrors } from "./config-errors";
import { isCompiledId } from "./module-ids";
import { resolveViteOptions, type ResolvedViteOptions, type WebsmithViteOptions } from "./options";
import { pickOutput } from "./output";

/** The part of Rollup's plugin context the hooks use. */
export type HookContext = Pick<Rollup.PluginContext, "error" | "warn" | "addWatchFile">;

/** The part of the module compiler the hooks use, so a spec can stub it. */
export type HookCompiler = Pick<ModuleCompiler, "build" | "getConfigErrors" | "resetCompilationCaches" | "keepCachesPerCompilation">;

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
    createCompiler?: (loaderOptions: Partial<WebpackLoaderOptions>) => HookCompiler;
};

// Keeps JSX for Vite's own JSX handling, in the fragment returned to Vite only
const TARGET_COMPILER_OPTIONS: ts.CompilerOptions = { jsx: ts.JsxEmit.Preserve, sourceMap: true, inlineSourceMap: false };

const formatErrors = (errors: readonly ts.Diagnostic[]): string | undefined =>
    errors.length > 0 ? errors.map(cur => ts.flattenDiagnosticMessageText(cur.messageText, "\n")).join("\n") : undefined;

/** Creates the module compiler of a plugin instance, with the addons of its `AddonRegistry`. */
export const createModuleCompiler = (loaderOptions: Partial<WebpackLoaderOptions>): HookCompiler => {
    const reporter = new DefaultReporter(ts.sys);
    return new ModuleCompiler({ reporter, cliArgs: { options: {}, fileNames: [], errors: [] } }, loaderOptions, ts.sys, {
        addons: new AddonRegistry({ reporter, system: ts.sys }),
        targetCompilerOptions: TARGET_COMPILER_OPTIONS,
    });
};

/**
 * Creates the hooks of the websmith plugin for `options`: `configResolved` resolves them against Vite's root,
 * `buildStart` creates the compiler, `transformHandler` compiles one module, and `buildEnd` reports the
 * configuration errors of the build.
 */
export const createWebsmithHooks = (
    options: WebsmithViteOptions,
    { createFilter, createCompiler = createModuleCompiler }: HookDependencies
): WebsmithHooks => {
    let resolved: ResolvedViteOptions | undefined;
    let filter: (id: string) => boolean = () => false;
    let compiler: HookCompiler | undefined;
    let command: "build" | "serve" = "build";

    return {
        configResolved(config) {
            resolved = resolveViteOptions(options, config.root, createFilter);
            filter = resolved.filter;
            command = config.command;
        },
        buildStart() {
            if (compiler) {
                compiler.resetCompilationCaches();
            } else {
                compiler = createCompiler(resolved?.loaderOptions ?? {});
                compiler.keepCachesPerCompilation();
            }
        },
        transformHandler(_code, id) {
            if (!compiler || !isCompiledId(id, filter)) {
                return null;
            }
            const { fragment, diagnostics } = compiler.build(id, { moduleKind: "esm" });
            const errors = formatErrors(selectConfigErrors("build", undefined, diagnostics));
            if (errors) {
                this.error(errors);
            }
            return pickOutput(fragment);
        },
        // The compiler keeps option errors and TypeScript errors without a file out of the module diagnostics. Without
        // webpack's afterCompile, the build reports them once at its end: getConfigErrors holds those of all modules,
        // where takeUnreportedConfigErrors would leave them on a carrier module a watch rebuild may not transform again.
        // Reporting them in the dev server belongs to the feature/vite-plugin-dev-server slice: its buildEnd runs on close.
        buildEnd(error) {
            const errors = compiler ? formatErrors(selectConfigErrors(command, error, compiler.getConfigErrors())) : undefined;
            if (errors) {
                this.error(errors);
            }
        },
    };
};
