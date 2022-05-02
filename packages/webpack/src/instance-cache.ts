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

import webpack from "webpack";
import { PluginOptions } from "./plugin";
import { TsCompiler } from "./TsCompiler";

const cache: WeakMap<webpack.Compiler, Map<string, TsCompiler>> = new WeakMap();

export function getInstanceFromCache(
    compiler: webpack.Compiler,
    loader: webpack.LoaderContext<PluginOptions>,
): TsCompiler | undefined {
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

export const getCacheName = (loader: webpack.LoaderContext<any>) => `websmith-${loader._compilation?.hash ?? ""}`;
