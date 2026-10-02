/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { DefaultReporter } from "@quatico/websmith-core";
import { type LoaderContext } from "webpack";
import { CompilationQueue } from "./CompilationQueue";
import { getInstanceFromCache, setInstanceInCache } from "./instance-cache";
import { createLoaderOptionsLoader } from "./loader-options";
import { TsCompiler } from "./TsCompiler";
import { addCompilationHooks } from "./webpack-hooks";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";
import ts from "typescript";

export const getCompilerInstance = (
    options: WebsmithLoaderConfig,
    context: LoaderContext<WebsmithLoaderConfig>,
    dependencyCallback?: (filePath: string) => void
): TsCompiler => {
    const compiler = context._compiler;
    let instance = getInstanceFromCache(compiler, options.instanceName);
    // The constructor resolves the options; afterwards only a change of their files does, once per compilation with hooks
    if (instance) {
        if (!instance.hasCompilationHooks()) {
            instance.refreshOptions(() => loadOptions(options, context)());
        }
    } else {
        const system = ts.sys;
        instance = new TsCompiler(
            {
                cliArgs: { options: {}, fileNames: [], errors: [] },
                reporter: new DefaultReporter(system),
            },
            options,
            dependencyCallback,
            context // Pass the loader context
        );
        if (compiler) {
            addCompilationHooks(compiler, options, {
                websmithCompiler: instance,
                dependencyCallback,
                queue: new CompilationQueue(),
                loadOptions: loadOptions(options, context),
            });
        }
        setInstanceInCache(compiler, options.instanceName, instance);
    }
    return instance;
};

// Without the raw loader options, e.g. from a loader context stub, the resolved ones are resolved again
const loadOptions = (options: WebsmithLoaderConfig, context: LoaderContext<WebsmithLoaderConfig>): (() => WebsmithLoaderConfig) =>
    typeof context.getOptions === "function" ? createLoaderOptionsLoader(context) : () => options;
