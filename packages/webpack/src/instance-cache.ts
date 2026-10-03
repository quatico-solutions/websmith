/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type webpack from "webpack";
import { type TsCompiler } from "./TsCompiler";

// Some loaders leave the _compiler property undefined; thread-loader passes a new stub without hooks for every module.
// We can't use undefined as a WeakMap key as it will throw an error at runtime, and a stub would key every module
// apart, thus we keep a dummy "marker" object to use as key in those situations.
const marker: webpack.Compiler = {} as webpack.Compiler;
// Each TypeScript instance is cached based on the webpack instance (key of the WeakMap)
// and also the name that was generated or passed via the options (string key of the
// internal Map)
const cache: WeakMap<webpack.Compiler, Map<string, TsCompiler>> = new WeakMap();

export const getInstanceFromCache = (key: webpack.Compiler | undefined, name?: string): TsCompiler | undefined => {
    if (!name) {
        return undefined;
    }
    const compiler = toCacheKey(key);
    let instances = cache.get(compiler);
    if (!instances) {
        instances = new Map();
        cache.set(compiler, instances);
    }

    return instances.get(name);
};

export const setInstanceInCache = (key: webpack.Compiler | undefined, name: string | undefined, instance: TsCompiler) => {
    if (!name) {
        return;
    }

    const compiler = toCacheKey(key);
    const instances = cache.get(compiler) ?? new Map<string, TsCompiler>();

    instances.set(name, instance);
    cache.set(compiler, instances);
};

const toCacheKey = (compiler: webpack.Compiler | undefined): webpack.Compiler => (compiler?.hooks ? compiler : marker);
