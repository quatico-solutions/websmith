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
import { recordPackageTypes } from "./package-types";
import { processResultAndFinish } from "./result-handling";
import { type LoaderBuildResult, type TsCompiler } from "./TsCompiler";
import { formatDiagnostic } from "./WebpackAddonService";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

export type WebpackLoaderContext = {
    dependencyCallback?: (filePath: string) => void;
    websmithCompiler: TsCompiler;
    queue: CompilationQueue;
    /** Resolves the loader options again from their files. */
    loadOptions: () => WebsmithLoaderConfig;
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
    registerPackageTypes(this, instance, dependencies);
    // A change of the options files rebuilds the module, also from webpack's persistent cache
    const optionsFiles = instance.getOptionsFiles();
    optionsFiles.files.forEach(cur => this.addDependency(cur));
    optionsFiles.missing.forEach(cur => this.addMissingDependency(cur));
    reportDiagnostics(this, diagnostics, options, instance.getOptions().debug ?? false);
    // Without compilation hooks, e.g. under thread-loader, which passes a compiler stub, the first module reports them
    if (!instance.hasCompilationHooks()) {
        reportDiagnostics(this, instance.takeUnreportedConfigErrors(this.resourcePath, this._compiler?.fsStartTime), options, false);
    }
    keepConfigErrorsOutOfCache(this, instance);
    // The configuration error of the profile fails the build: the module has no output. It stays out of the
    // persistent cache, else the next build restores it without running the loader and reports no error
    if (!instance.isProfileConfigured()) {
        this.cacheable?.(false);
        this.callback(null, "");
        return;
    }

    // Set loader version based on the file's cache version to enable proper cache invalidation
    // This ensures webpack knows when to recompile based on source file changes
    this.version = fragment.version;

    processResultAndFinish(this, fragment, instance.getProfile());
}

/** The compiler instances that marked a module of a compilation as not cacheable for their configuration errors. */
const configErrorCarriers = new WeakMap<object, WeakSet<TsCompiler>>();

/**
 * Keeps configuration errors out of webpack's persistent cache: a build that restores every module runs no loader and
 * reports none. With compilation hooks, the first module of a compilation that the instance builds is not cached, so
 * the next build compiles it again and reports them. Without, e.g. under thread-loader, no module is cached: only the
 * modules a worker builds report them.
 */
const keepConfigErrorsOutOfCache = (context: LoaderContext<WebsmithLoaderConfig>, instance: TsCompiler): void => {
    if (instance.getConfigErrors().length === 0) {
        return;
    }
    const compilation = context._compilation;
    if (instance.hasCompilationHooks() && compilation) {
        const carriers = configErrorCarriers.get(compilation) ?? new WeakSet<TsCompiler>();
        configErrorCarriers.set(compilation, carriers);
        if (carriers.has(instance)) {
            return;
        }
        carriers.add(instance);
    }
    context.cacheable?.(false);
};

/**
 * Lets a module depend on the "type" of its package.json files only: their type is recorded in the module's build info,
 * and the needBuild tap rebuilds the module when it changes. Without compilation hooks or module, e.g. under
 * thread-loader, or with webpack's persistent cache, no websmith code runs in webpack's process before a module is
 * restored, so any edit of such a package.json rebuilds the module.
 */
const registerPackageTypes = (
    context: LoaderContext<WebsmithLoaderConfig>,
    instance: TsCompiler,
    { files, packageTypes }: LoaderBuildResult["dependencies"]
): void => {
    const buildInfo = context._module?.buildInfo;
    const cache = context._compiler?.options?.cache;
    if (instance.hasCompilationHooks() && buildInfo && !(cache && cache.type === "filesystem")) {
        recordPackageTypes(buildInfo, packageTypes);
    } else {
        Object.keys(packageTypes)
            .filter(cur => !files.includes(cur))
            .forEach(cur => context.addDependency(cur));
    }
};

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
