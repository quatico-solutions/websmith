/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import webpack from "webpack";
import { PluginOptions } from "./plugin";
import { TsCompiler } from "./TsCompiler";

const cache: WeakMap<webpack.Compiler, Map<string, TsCompiler>> = new WeakMap();

export function getInstanceFromCache(compiler: webpack.Compiler, loader: webpack.LoaderContext<PluginOptions>): TsCompiler | undefined {
    let instances = cache.get(compiler);
    if (!instances) {
        instances = new Map();
        cache.set(compiler, instances);
    }

    return instances.get(getCacheName(loader));
}

export function setInstanceInCache(compiler: webpack.Compiler, loader: webpack.LoaderContext<PluginOptions>, instance: TsCompiler) {
    const instances = cache.get(compiler) ?? new Map<string, TsCompiler>();
    instances.set(getCacheName(loader), instance);
    cache.set(compiler, instances);
}

export const getCacheName = (loader: webpack.LoaderContext<unknown>) => `websmith-${loader._compilation?.hash ?? ""}`;
