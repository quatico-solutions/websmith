/* eslint-disable no-console */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import { parse } from "comment-json";
import { type Compilation, type Compiler, type LoaderContext, NormalModule, type Stats } from "webpack";
import { type WebpackLoaderContext } from "./loader";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

const LOADER_NAME = "websmith-loader";

// Type guard interface for compilation validation
interface CompilationLike {
    hooks: {
        processAssets: unknown;
        [key: string]: unknown;
    };
    compiler: unknown;
    emitAsset: unknown;
}

/**
 * Validates if an object is a valid webpack Compilation using duck typing.
 * This approach avoids instanceof issues with multiple webpack versions or different module contexts.
 * @internal - Exported for testing purposes
 */
export const isValidCompilation = (compilation: unknown): compilation is CompilationLike => {
    if (!compilation || typeof compilation !== "object" || compilation === null) {
        return false;
    }

    const comp = compilation as Record<string, unknown>;

    return (
        "hooks" in comp &&
        typeof comp.hooks === "object" &&
        comp.hooks !== null &&
        "processAssets" in (comp.hooks as Record<string, unknown>) &&
        "compiler" in comp &&
        "emitAsset" in comp &&
        typeof comp.emitAsset === "function"
    );
};

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

    // Register hooks immediately on compilation, not during processAssets
    cachedMakeCompilation(compilation, loaderOptions);
};

const makeCompilation = (loaderContext: WebpackLoaderContext) => {
    return (compilation: Compilation, options: WebsmithLoaderConfig): void => {
        // Register loader hooks for configuration updates

        // Validate that compilation has required properties using duck typing
        if (isValidCompilation(compilation)) {
            try {
                const hooks = NormalModule.getCompilationHooks(compilation);
                hooks?.loader?.tap(LOADER_NAME, (ctx: object) => {
                    const configContext: LoaderContext<WebsmithLoaderConfig> = ctx as LoaderContext<WebsmithLoaderConfig>;

                    if (configContext) {
                        // TODO: Do we need to cache the compiler instance here?
                        // const instance = getCompilerInstance(options, context, dependencyCallback);
                        if (options.configFile && loaderContext.websmithCompiler) {
                            try {
                                const configContent = fs.readFileSync(options.configFile, "utf8");
                                const parsedConfig = parse(configContent) as WebsmithLoaderConfig;
                                loaderContext.websmithCompiler.updateLoaderConfig(parsedConfig);
                            } catch (error) {
                                const errorMessage = error instanceof Error ? error.message : String(error);

                                if (error instanceof Error) {
                                    // Handle specific Node.js file system errors
                                    if ("code" in error) {
                                        const fsError = error as NodeJS.ErrnoException;
                                        switch (fsError.code) {
                                            case "ENOENT":
                                                console.warn(`${LOADER_NAME}: Config file not found: "${options.configFile}"`);
                                                break;
                                            case "EACCES":
                                                console.warn(`${LOADER_NAME}: Permission denied reading config file: "${options.configFile}"`);
                                                break;
                                            case "EISDIR":
                                                console.warn(`${LOADER_NAME}: Config file path is a directory, not a file: "${options.configFile}"`);
                                                break;
                                            default:
                                                console.warn(
                                                    `${LOADER_NAME}: File system error reading config file "${options.configFile}": ${errorMessage}`
                                                );
                                        }
                                    } else {
                                        // Handle JSON parsing errors
                                        if (errorMessage.includes("JSON") || errorMessage.includes("parse") || errorMessage.includes("Unexpected")) {
                                            console.warn(`${LOADER_NAME}: Invalid JSON in config file "${options.configFile}": ${errorMessage}`);
                                        } else {
                                            console.warn(`${LOADER_NAME}: Error processing config file "${options.configFile}": ${errorMessage}`);
                                        }
                                    }
                                } else {
                                    console.warn(`${LOADER_NAME}: Unknown error reading config file "${options.configFile}": ${errorMessage}`);
                                }
                            }
                        }
                    }
                });
            } catch (error) {
                console.warn(`${LOADER_NAME}: Failed to register compilation hooks:`, error);
            }
        } else {
            console.warn(`${LOADER_NAME}: Invalid compilation object received (missing required properties), skipping hook registration`);
        }
    };
};

const displayDone = (stats: Stats) => {
    if (!stats.hasErrors() && stats.startTime && stats.endTime) {
        const timeInSec = (stats.endTime - stats.startTime) / 1000;

        console.info(`✨  Done in ${timeInSec}s.\n`);
    }
};
