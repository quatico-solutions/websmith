/* eslint-disable no-console */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Compilation, type Compiler, type Stats, WebpackError } from "webpack";
import { type WebpackLoaderContext } from "./loader";
import { formatDiagnostic } from "./WebpackAddonService";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

const LOADER_NAME = "websmith-loader";

// Config errors already pushed per compilation: instances of several loader rules may share a config file and profile
const reportedConfigErrors = new WeakMap<Compilation, Set<string>>();

export const addCompilationHooks = (compiler: Compiler, options: WebsmithLoaderConfig, context: WebpackLoaderContext) => {
    if (compiler.hooks) {
        const compilationQueueContributor = context.queue.contribute();
        compiler.hooks.beforeRun.tap(LOADER_NAME, () => {
            compilationQueueContributor.inProgress();
        });
        compiler.hooks.watchRun.tap(LOADER_NAME, () => {
            compilationQueueContributor.inProgress();
            // Once per compilation, before any module is built: the options files are module dependencies, so every module
            // they affect is rebuilt with the options resolved again
            const { modifiedFiles, removedFiles } = compiler;
            if (modifiedFiles || removedFiles) {
                context.websmithCompiler?.refreshOptions(context.loadOptions, new Set([...(modifiedFiles ?? []), ...(removedFiles ?? [])]));
            }
        });
        compiler.hooks.done.tap(LOADER_NAME, () => {
            compilationQueueContributor.done();
            context.websmithCompiler?.reportEsmCheckTime();
        });

        // package.json files and packages may change between compilations; child compilations share the parent's memo
        context.websmithCompiler?.keepCachesPerCompilation();
        compiler.hooks.thisCompilation.tap(LOADER_NAME, () => {
            context.websmithCompiler?.resetCompilationCaches();
            context.websmithCompiler?.refreshAddons();
        });

        // Once per compilation, also when no module is rebuilt; child compilers inherit this tap, their compilations skip it
        context.websmithCompiler?.useCompilationHooks();
        compiler.hooks.afterCompile.tap(LOADER_NAME, compilation => {
            const websmithCompiler = context.websmithCompiler;
            if (compilation.compiler !== compiler || !websmithCompiler) {
                return;
            }
            // A missing file is watched until it appears
            const { files, missing } = websmithCompiler.getOptionsFiles();
            files.forEach(cur => compilation.fileDependencies.add(cur));
            missing.forEach(cur => compilation.missingDependencies.add(cur));
            const reported = reportedConfigErrors.get(compilation) ?? new Set<string>();
            reportedConfigErrors.set(compilation, reported);
            websmithCompiler.getConfigErrors().forEach(diagnostic => {
                const message = formatDiagnostic(diagnostic);
                if (!reported.has(message)) {
                    reported.add(message);
                    const webpackError = new WebpackError(message);
                    compilation.errors.push(webpackError);
                    options.error?.(webpackError);
                }
            });
        });

        compiler.hooks.done.tapAsync(LOADER_NAME, (stats, callback) => {
            callback();
            if (compiler.options.watch) {
                displayDone(stats);
            }
        });
    }
};

const displayDone = (stats: Stats) => {
    if (!stats.hasErrors() && stats.startTime && stats.endTime) {
        const timeInSec = (stats.endTime - stats.startTime) / 1000;

        console.info(`✨  Done in ${timeInSec}s.\n`);
    }
};
