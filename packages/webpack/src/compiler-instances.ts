/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type LoaderContext } from "webpack";
import { CompilationQueue } from "./CompilationQueue";
import { getInstanceFromCache, setInstanceInCache } from "./instance-cache";
import { createOptions } from "./options";
import { TsCompiler } from "./TsCompiler";
import { addCompilationHooks } from "./webpack-hooks";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

export const getCompilerInstance = (
    options: WebsmithLoaderConfig,
    context: LoaderContext<WebsmithLoaderConfig>,
    dependencyCallback: (filePath: string) => void
): TsCompiler => {
    // Logic to manage and cache compiler instances
    const compiler = context._compiler;
    let instance = getInstanceFromCache(compiler, options.instanceName);
    if (!instance) {
        instance = new TsCompiler(createOptions(options), dependencyCallback, options);
        if (compiler) {
            addCompilationHooks(compiler, options, {
                websmithCompiler: instance,
                dependencyCallback,
                queue: new CompilationQueue(),
            });
        }
        setInstanceInCache(compiler, options.instanceName, instance);
    }
    instance.loaderConfig = options;
    return instance;
};
