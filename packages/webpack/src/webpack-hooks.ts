/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createOptions } from "@quatico/websmith-cli";
import { readFileSync } from "fs";
import { Compilation, Compiler, LoaderContext, Stats } from "webpack";
import { contribute } from "./CompilationQueue";
import { getInstanceFromCache, initializeInstance, setInstanceInCache } from "./instance-cache";
import { PluginOptions } from "./loader-options";
import { TsCompiler } from "./TsCompiler";

const LOADER_NAME = "websmith-loader";

export const addCompilationHooks = (compiler: Compiler, options: PluginOptions) => {
    const makeCompilation = () => {
        return (compilation: Compilation, options: PluginOptions): void => {
            // eslint-disable-next-line @typescript-eslint/ban-types
            // NormalModule.getCompilationHooks(compilation).loader.tap(LOADER_NAME, (ctx: object) => {
            compilation.hooks.normalModuleLoader.tap(LOADER_NAME, (ctx: object) => {
                const context: LoaderContext<PluginOptions> = ctx as LoaderContext<PluginOptions>;

                if (context) {
                    initializeInstance(context, options);
                    const instance = getInstanceFromCache(compilation.compiler, context) ?? new TsCompiler(createOptions(options), options);
                    instance.pluginConfig = JSON.parse(readFileSync(options.config).toString());
                    setInstanceInCache(compilation.compiler, context, instance);
                }
            });
        };
    };

    const cachedMakeCompilation = makeCompilation();
    const makeCompilationCallback = (compilation: Compilation, loaderOptions: PluginOptions) => {
        compilation.hooks.processAssets.tap({ name: LOADER_NAME, stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL }, () => {
            cachedMakeCompilation(compilation, loaderOptions);
        });
    };

    if (compiler.hooks) {
        const compilationQueueContributor = contribute();
        compiler.hooks.beforeRun.tap(LOADER_NAME, () => {
            compilationQueueContributor.inProgress();
        });
        compiler.hooks.watchRun.tap(LOADER_NAME, () => {
            compilationQueueContributor.inProgress();
        });
        compiler.hooks.done.tap(LOADER_NAME, () => {
            compilationQueueContributor.done();
        });

        compiler.hooks.compilation.tap(LOADER_NAME, compilation => makeCompilationCallback(compilation, options));

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
        // eslint-disable-next-line no-console
        console.info(`✨  Done in ${timeInSec}s.\n`);
    }
};
