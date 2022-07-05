/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { LoaderContext } from "webpack";
import { initializeInstance, setInstanceInCache } from "./instance-cache";
import { getLoaderOptions } from "./loader-options";
import { PluginOptions } from "./plugin";
import { processResultAndFinish } from "./result-handling";
import { TsCompiler } from "./TsCompiler";

function loader(this: LoaderContext<PluginOptions>): void {
    const loaderOptions = getLoaderOptions(this);
    const instance = initializeInstance(this, loaderOptions);
    const fragment = buildTargets(instance, this.resourcePath);

    this.version = instance.version;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    setInstanceInCache(this._compiler!, this, instance);

    processResultAndFinish(this, fragment, instance.targets);
}

const buildTargets = (compiler: TsCompiler, resourcePath: string) => {
    return compiler.build(resourcePath);
};

export default loader;
