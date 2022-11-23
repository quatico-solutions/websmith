/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { LoaderContext } from "webpack";
import { initializeInstance, setInstanceInCache } from "./instance-cache";
import { getLoaderOptions, PluginOptions } from "./loader-options";
import { processResultAndFinish } from "./result-handling";
import { TsCompiler } from "./TsCompiler";

function loader(this: LoaderContext<PluginOptions>): void {
    this.cacheable && this.cacheable();
    const loaderOptions = getLoaderOptions(this);
    const instance = initializeInstance(this, loaderOptions, (path: string) => {
        this.addDependency(path);
    });
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

export { Compiler, createBrowserSystem, DefaultReporter, getVersionedFile, NoReporter } from "@quatico/websmith-core";
export type { CompilerOptions } from "@quatico/websmith-core";
