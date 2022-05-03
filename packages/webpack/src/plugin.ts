/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import { createOptions } from "@websmith/cli";
import { readFileSync } from "fs";
import webpack, { Compiler, Stats, WebpackError } from "webpack";
import { contribute } from "./CompilationQueue";
import { getInstanceFromCache, setInstanceInCache } from "./instance-cache";
import { TsCompiler } from "./TsCompiler";
import uPath from "./Upath";
import Compilation = webpack.Compilation;

export interface PluginArguments {
    addons?: string;
    addonsDir?: string;
    buildDir?: string;
    config: string;
    debug?: boolean;
    project?: string;
    sourceMap?: boolean;
    targets?: string;
    webpackTarget?: string;
}

export type PluginOptions = PluginArguments & {
    warn?: (err: WebpackError) => void;
    error?: (err: WebpackError) => void;
};

export type WebsmithLoaderContext = webpack.LoaderContext<PluginOptions> & { pluginConfig: PluginOptions };

export class WebsmithPlugin {
    public static loader = uPath.join(__dirname, "loader");
    public static PLUGIN_NAME = "WebsmithPlugin";

    constructor(protected config: PluginOptions) {
        this.config = { ...this.config, webpackTarget: this.config.webpackTarget ?? "*" };
    }

    public apply(compiler: Compiler): void {
        const compilationQueueContributor = contribute();
        compiler.hooks.beforeRun.tap(WebsmithPlugin.PLUGIN_NAME, () => {
            compilationQueueContributor.inProgress();
        });
        compiler.hooks.watchRun.tap(WebsmithPlugin.PLUGIN_NAME, () => {
            compilationQueueContributor.inProgress();
        });
        compiler.hooks.done.tap(WebsmithPlugin.PLUGIN_NAME, () => {
            compilationQueueContributor.done();
        });

        compiler.hooks.thisCompilation.tap(WebsmithPlugin.PLUGIN_NAME, compilation => this.tapCompilation(compilation));

        compiler.hooks.done.tapAsync(WebsmithPlugin.PLUGIN_NAME, (stats, callback) => {
            callback();
            if (compiler.options.watch) {
                displayDone(stats);
            }
        });
    }

    private tapCompilation(compilation: Compilation): void {
        // eslint-disable-next-line @typescript-eslint/ban-types
        compilation.hooks.normalModuleLoader.tap(WebsmithPlugin.PLUGIN_NAME, (context: object) => {
            const loaderContext = context as WebsmithLoaderContext;
            const websmithConfig = readFileSync(this.config.config).toString();
            const config = {
                ...JSON.parse(websmithConfig),
                ...this.config,

                ...(loaderContext._module && { warn: (err: WebpackError) => loaderContext._module?.addWarning(err) }),
                ...(loaderContext._module && { error: (err: WebpackError) => loaderContext._module?.addError(err) }),
            };

            loaderContext.pluginConfig = config;

            if (loaderContext) {
                const instance =
                    getInstanceFromCache(compilation.compiler, loaderContext) ??
                    new TsCompiler(createOptions(config), config, this.config.webpackTarget);
                setInstanceInCache(compilation.compiler, loaderContext, instance);
            }
        });
    }
}

const displayDone = (stats: Stats) => {
    if (!stats.hasErrors() && stats.startTime && stats.endTime) {
        const timeInSec = (stats.endTime - stats.startTime) / 1000;
        // eslint-disable-next-line no-console
        console.info(`✨  Done in ${timeInSec}s.\n`);
    }
};
