/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type webpack from "webpack";
import { type TsCompiler } from "./TsCompiler";

// Some loaders (e.g. thread-loader) will set the _compiler property to undefined.
// We can't use undefined as a WeakMap key as it will throw an error at runtime,
// thus we keep a dummy "marker" object to use as key in those situations.
const marker: webpack.Compiler = {} as webpack.Compiler;
// Each TypeScript instance is cached based on the webpack instance (key of the WeakMap)
// and also the name that was generated or passed via the options (string key of the
// internal Map)
const cache: WeakMap<webpack.Compiler, Map<string, TsCompiler>> = new WeakMap();

export const getInstanceFromCache = (key: webpack.Compiler | undefined, name?: string): TsCompiler | undefined => {
    if (!name) {
        return undefined;
    }
    const compiler = key ?? marker;
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

    const compiler = key ?? marker;
    const instances = cache.get(compiler) ?? new Map<string, TsCompiler>();

    instances.set(name, instance);
    cache.set(compiler, instances);
};
