/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import * as crypto from "crypto";
import { createOptions } from "@quatico/websmith-cli";
import webpack, { LoaderContext } from "webpack";
import { PluginOptions } from "./loader-options";
import { TsCompiler } from "./TsCompiler";
import { addCompilationHooks } from "./webpack-hooks";

// Some loaders (e.g. thread-loader) will limit the access to (loader) context information.
// To ensure that the WeakMap key still works as it expected, we keep a global "marker" object to use and avoid runtime errors.
const marker: webpack.Compiler = {} as webpack.Compiler;
const cache: WeakMap<webpack.Compiler, Map<string, TsCompiler>> = new WeakMap();

export function getInstanceFromCache(key: webpack.Compiler | undefined, loader: webpack.LoaderContext<PluginOptions>): TsCompiler | undefined {
    const compiler = key ?? marker;
    let instances = cache.get(compiler);
    if (!instances) {
        instances = new Map();
        cache.set(compiler, instances);
    }

    return instances.get(getCacheName(loader));
}

export function setInstanceInCache(key: webpack.Compiler | undefined, loader: webpack.LoaderContext<PluginOptions>, instance: TsCompiler) {
    const compiler = key ?? marker;
    const instances = cache.get(compiler) ?? new Map<string, TsCompiler>();
    instances.set(getCacheName(loader), instance);
    cache.set(compiler, instances);
}

export const initializeInstance = (
    loader: LoaderContext<PluginOptions>,
    options: PluginOptions,
    dependencyCallback: (filePath: string) => void
): TsCompiler => {
    const compiler = loader._compiler ?? marker;
    let instance = getInstanceFromCache(compiler, loader);
    if (!instance) {
        instance = new TsCompiler(createOptions(options), dependencyCallback, options);
        if (compiler !== marker) {
            addCompilationHooks(compiler, options, dependencyCallback);
        }
    }
    instance.pluginConfig = options;
    setInstanceInCache(compiler, loader, instance);
    return instance;
};

export const getCacheName = (loader: webpack.LoaderContext<unknown>) => `websmith-${loader._compilation?.hash ?? ""}`;
export const getCacheName1 = (loader: webpack.LoaderContext<PluginOptions>) => {
    const hash = crypto.createHash("sha256");
    Object.entries(loader).forEach(([key, value]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (value !== undefined) {
            const valueString = typeof value === "function" ? value.toString() : JSON.stringify(value);
            hash.update(key + valueString);
        }
    });
    return `websmith_${hash.digest("hex").substring(0, 16)}`;
};
