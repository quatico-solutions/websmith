/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { CompilationConfig } from "@quatico/websmith-core";
import { LoaderContext, WebpackError } from "webpack";
import { Upath as uPath } from "./Upath";

export interface PluginArguments {
    addons?: string[];
    addonsDir?: string;
    buildDir?: string;
    config?: CompilationConfig;
    configFile?: string;
    debug?: boolean;
    project?: string;
    sourceMap?: boolean;
    transpileOnly?: boolean;
    targets?: string[];
    webpackTarget?: string;
}

export type PluginOptions = PluginArguments & {
    warn?: (err: WebpackError) => void;
    error?: (err: WebpackError) => void;
};

export const getLoaderOptions = (loader: LoaderContext<PluginOptions>): PluginOptions => {
    const options: PluginOptions = loader.getOptions();
    const result = {
        ...options,
        ...(!!loader._module && typeof loader._module.addWarning === "function" && { warn: (err: WebpackError) => loader._module!.addWarning(err) }),
        ...(!!loader._module && typeof loader._module.addError === "function" && { error: (err: WebpackError) => loader._module!.addError(err) }),
        ...(!!options.configFile && { configFile: uPath.resolve(options.configFile) }),
        transpileOnly: options.transpileOnly ?? false,
        webpackTarget: options.webpackTarget ?? "*",
    };
    return result;
};
