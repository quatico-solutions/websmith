/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonRegistry, DefaultReporter, ModuleCompiler } from "@quatico/websmith-core";
import ts from "typescript";
import { createFilter, type FilterPattern, type Plugin, type Rollup } from "vite";
import { isCompiledId } from "./module-ids";
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE, resolveViteOptions, type ResolvedViteOptions, type WebsmithViteOptions } from "./options";

export type { WebsmithViteOptions } from "./options";

// JavaScript output of .ts, .tsx, .mts and .cts sources and its source map
const JS_FILE = /\.(?:[cm]?js|jsx)$/i;
const JS_MAP_FILE = /\.(?:[cm]?js|jsx)\.map$/i;

// Keeps JSX for Vite's own JSX handling, in the fragment returned to Vite only
const TARGET_COMPILER_OPTIONS: ts.CompilerOptions = { jsx: ts.JsxEmit.Preserve, sourceMap: true, inlineSourceMap: false };

const formatErrors = (diagnostics: readonly ts.Diagnostic[]): string | undefined => {
    const errors = diagnostics.filter(cur => cur.category === ts.DiagnosticCategory.Error);
    return errors.length > 0 ? errors.map(cur => ts.flattenDiagnosticMessageText(cur.messageText, "\n")).join("\n") : undefined;
};

// Vite's hook filter takes no null and no readonly array
const toHookFilter = (pattern: FilterPattern): string | RegExp | Array<string | RegExp> | undefined =>
    pattern === null || typeof pattern === "string" || pattern instanceof RegExp ? (pattern ?? undefined) : [...pattern];

/**
 * Creates the websmith Vite plugin: it compiles the TypeScript modules of the bundle with websmith and the addons of
 * the selected `profile`, and returns their JavaScript and source map to Vite.
 */
export const websmith = (options: WebsmithViteOptions = {}): Plugin => {
    let resolved: ResolvedViteOptions | undefined;
    let filter: (id: string) => boolean = () => false;
    let compiler: ModuleCompiler | undefined;

    return {
        name: "websmith",
        enforce: "pre",
        configResolved(config) {
            resolved = resolveViteOptions(options, config.root);
            filter = createFilter(resolved.include, resolved.exclude);
        },
        buildStart() {
            if (compiler) {
                compiler.resetCompilationCaches();
            } else {
                const reporter = new DefaultReporter(ts.sys);
                compiler = new ModuleCompiler({ reporter, cliArgs: { options: {}, fileNames: [], errors: [] } }, resolved?.loaderOptions, ts.sys, {
                    addons: new AddonRegistry({ reporter, system: ts.sys }),
                    targetCompilerOptions: TARGET_COMPILER_OPTIONS,
                });
                compiler.keepCachesPerCompilation();
            }
        },
        transform: {
            filter: { id: { include: toHookFilter(options.include ?? DEFAULT_INCLUDE), exclude: toHookFilter(options.exclude ?? DEFAULT_EXCLUDE) } },
            handler(_code, id) {
                if (!compiler || !isCompiledId(id, filter)) {
                    return null;
                }
                const { fragment, diagnostics } = compiler.build(id, { moduleKind: "esm" });
                const errors = formatErrors(diagnostics);
                if (errors) {
                    this.error(errors);
                }
                const outputText = fragment.files.find(cur => JS_FILE.test(cur.name))?.text;
                if (!outputText) {
                    return null;
                }
                const sourceMapText = fragment.files.find(cur => JS_MAP_FILE.test(cur.name))?.text;
                return {
                    code: outputText.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ""),
                    map: sourceMapText ? (JSON.parse(sourceMapText) as Rollup.ExistingRawSourceMap) : null,
                };
            },
        },
        // The compiler keeps option errors and TypeScript errors without a file out of the module diagnostics. Without
        // webpack's afterCompile, the build reports them once at its end: getConfigErrors holds those of all modules,
        // where takeUnreportedConfigErrors would leave them on a carrier module a watch rebuild may not transform again.
        buildEnd(error) {
            const errors = !error && compiler ? formatErrors(compiler.getConfigErrors()) : undefined;
            if (errors) {
                this.error(errors);
            }
        },
    };
};
