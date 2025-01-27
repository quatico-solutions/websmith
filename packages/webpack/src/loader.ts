/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type LoaderContext } from "webpack";
import { initializeInstance, setInstanceInCache } from "./instance-cache";
import { getLoaderOptions, type WebsmithLoaderConfig } from "./loader-options";
import { processResultAndFinish } from "./result-handling";
import { type TsCompiler } from "./TsCompiler";

export function loader(this: LoaderContext<WebsmithLoaderConfig>): void {
    this.cacheable?.();
    const loaderOptions = getLoaderOptions(this);
    const instance = initializeInstance(this, loaderOptions, (path: string) => {
        this.addDependency(path);
    });
    const fragment = buildTargets(instance, this.resourcePath);

    this.version = instance.version;

    setInstanceInCache(this._compiler, this, instance);

    processResultAndFinish(this, fragment, instance.targets);
}

const buildTargets = (compiler: TsCompiler, resourcePath: string) => {
    return compiler.build(resourcePath);
};
