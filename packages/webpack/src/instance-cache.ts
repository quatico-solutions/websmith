/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type webpack from "webpack";
import { type LoaderContext } from "webpack";
import { CompilationQueue } from "./CompilationQueue";
import { createOptions } from "./options";
import { TsCompiler } from "./TsCompiler";
import { addCompilationHooks } from "./webpack-hooks";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

// Some loaders (e.g. thread-loader) will limit the access to (loader) context information.
// To ensure that the WeakMap key still works as it expected, we keep a global "marker" object to use and avoid runtime errors.
const marker: webpack.Compiler = {} as webpack.Compiler;
const cache: WeakMap<webpack.Compiler, Map<string, TsCompiler>> = new WeakMap();

export function getInstanceFromCache(key: webpack.Compiler | undefined, loader: webpack.LoaderContext<WebsmithLoaderConfig>): TsCompiler | undefined {
    const compiler = key ?? marker;
    let instances = cache.get(compiler);
    if (!instances) {
        instances = new Map();
        cache.set(compiler, instances);
    }

    return instances.get(getCacheName(loader));
}

export function setInstanceInCache(key: webpack.Compiler | undefined, loader: webpack.LoaderContext<WebsmithLoaderConfig>, instance: TsCompiler) {
    const compiler = key ?? marker;
    const instances = cache.get(compiler) ?? new Map<string, TsCompiler>();
    instances.set(getCacheName(loader), instance);
    cache.set(compiler, instances);
}

export const initializeInstance = (
    loader: LoaderContext<WebsmithLoaderConfig>,
    config: WebsmithLoaderConfig,
    dependencyCallback: (filePath: string) => void
): TsCompiler => {
    const compiler = loader._compiler ?? marker;
    let instance = getInstanceFromCache(compiler, loader);
    if (!instance) {
        instance = new TsCompiler(createOptions(config), dependencyCallback, config);
        if (compiler !== marker) {
            addCompilationHooks(compiler, config, {
                queue: new CompilationQueue(),
                websmithCompiler: instance,
                dependencyCallback,
            });
        }
    }
    instance.loaderConfig = config;
    setInstanceInCache(compiler, loader, instance);
    return instance;
};

export const getCacheName = (loader: webpack.LoaderContext<unknown>) => {
    if (loader._compilation && !loader._compilation.hash) {
        loader._compilation.hash = generateRandomString();
    }
    return `websmith-${loader._compilation?.hash}`;
};

const generateRandomString = () => {
    return Math.floor(Math.random() * Date.now()).toString(36);
};
