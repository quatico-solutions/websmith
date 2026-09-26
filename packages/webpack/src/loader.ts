/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { type LoaderContext, WebpackError } from "webpack";
import { type CompilationQueue } from "./CompilationQueue";
import { getCompilerInstance } from "./compiler-instances";
import { getLoaderOptions } from "./loader-options";
import { processResultAndFinish } from "./result-handling";
import { type TsCompiler } from "./TsCompiler";
import { formatDiagnostic } from "./WebpackAddonService";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

export type WebpackLoaderContext = {
    dependencyCallback?: (filePath: string) => void;
    websmithCompiler: TsCompiler;
    queue: CompilationQueue;
};

export function loader(this: LoaderContext<WebsmithLoaderConfig>): void {
    this.cacheable?.();
    const options = getLoaderOptions(this);
    const instance = getCompilerInstance(options, this, (path: string) => {
        this.addDependency(path);
    });

    // Reports and dependencies go through this call's context: the instance is shared by every module
    const { fragment, diagnostics, dependencies } = instance.build(this.resourcePath, this._module?.type);
    dependencies.files.forEach(cur => this.addDependency(cur));
    dependencies.missing.forEach(cur => this.addMissingDependency(cur));
    reportDiagnostics(this, diagnostics, options, instance.getOptions().debug ?? false);

    // Set loader version based on the file's cache version to enable proper cache invalidation
    // This ensures webpack knows when to recompile based on source file changes
    this.version = fragment.version;

    processResultAndFinish(this, fragment, instance.getProfile());
}

/**
 * Emits errors and warnings on the module, which fails the build for errors; messages and suggestions only with
 * `debug`. The `error` and `warn` loader options receive them afterwards.
 */
const reportDiagnostics = (
    context: LoaderContext<WebsmithLoaderConfig>,
    diagnostics: ts.Diagnostic[],
    { error, warn }: WebsmithLoaderConfig,
    debug: boolean
): void =>
    diagnostics.forEach(diagnostic => {
        const webpackError = new WebpackError(formatDiagnostic(diagnostic));
        if (diagnostic.category === ts.DiagnosticCategory.Error) {
            context.emitError(webpackError);
            error?.(webpackError);
        } else if (diagnostic.category === ts.DiagnosticCategory.Warning || debug) {
            context.emitWarning(webpackError);
            warn?.(webpackError);
        }
    });
