/* eslint-disable no-console */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import { Compilation, type Compiler, type LoaderContext, NormalModule, type Stats } from "webpack";
import { type WebpackLoaderContext } from "./loader";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

const LOADER_NAME = "websmith-loader";

export const addCompilationHooks = (compiler: Compiler, options: WebsmithLoaderConfig, context: WebpackLoaderContext) => {
    if (compiler.hooks) {
        const compilationQueueContributor = context.queue.contribute();
        compiler.hooks.beforeRun.tap(LOADER_NAME, () => {
            compilationQueueContributor.inProgress();
        });
        compiler.hooks.watchRun.tap(LOADER_NAME, () => {
            compilationQueueContributor.inProgress();
        });
        compiler.hooks.done.tap(LOADER_NAME, () => {
            compilationQueueContributor.done();
        });

        compiler.hooks.compilation.tap(LOADER_NAME, compilation => {
            return makeCompilationCallback(compilation, options, context);
        });

        compiler.hooks.done.tapAsync(LOADER_NAME, (stats, callback) => {
            callback();
            if (compiler.options.watch) {
                displayDone(stats);
            }
        });
    }
};

const makeCompilationCallback = (compilation: Compilation, loaderOptions: WebsmithLoaderConfig, context: WebpackLoaderContext) => {
    const cachedMakeCompilation = makeCompilation(context);

    compilation.hooks.processAssets.tap({ name: LOADER_NAME, stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL }, () => {
        cachedMakeCompilation(compilation, loaderOptions);
    });
};

const makeCompilation = (loaderContext: WebpackLoaderContext) => {
    return (compilation: Compilation, options: WebsmithLoaderConfig): void => {
        // NormalModule.getCompilationHooks(compilation).loader.tap(LOADER_NAME, (ctx: object) => {
        compilation.hooks.processAssets.tap(LOADER_NAME, assets => {
            console.error(`processAssets for ${JSON.stringify(assets)}`);
        });

        NormalModule.getCompilationHooks(compilation)?.loader?.tap(LOADER_NAME, (ctx: object) => {
            const configContext: LoaderContext<WebsmithLoaderConfig> = ctx as LoaderContext<WebsmithLoaderConfig>;

            if (configContext) {
                // TODO: Do we need to cache the compiler instance here?
                // const instance = getCompilerInstance(options, context, dependencyCallback);
                if (options.configFile && loaderContext.websmithCompiler) {
                    loaderContext.websmithCompiler.loaderConfig = JSON.parse(fs.readFileSync(options.configFile).toString());
                }
            }
        });
    };
};

const displayDone = (stats: Stats) => {
    if (!stats.hasErrors() && stats.startTime && stats.endTime) {
        const timeInSec = (stats.endTime - stats.startTime) / 1000;

        console.info(`✨  Done in ${timeInSec}s.\n`);
    }
};
