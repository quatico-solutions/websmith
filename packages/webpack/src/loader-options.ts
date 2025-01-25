/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { CompilationConfig } from "@quatico/websmith-core";
import ts from "typescript";
import { LoaderContext, WebpackError } from "webpack";
import { Upath as uPath } from "./Upath";

export interface WebsmithLoaderOptions {
    addons?: string[];
    addonsDir?: string;
    buildDir?: string;
    config?: CompilationConfig;
    configFile?: string;
    debug?: boolean;
    project?: string;
    sourceMap?: boolean;
    transpileOnly?: boolean;
    tsConfig?: ts.CompilerOptions;
    targets?: string[];
    webpackTarget?: string;
}

export type WebsmithLoaderConfig = WebsmithLoaderOptions & {
    warn?: (err: WebpackError) => void;
    error?: (err: WebpackError) => void;
};

export const getLoaderOptions = (loader: LoaderContext<WebsmithLoaderConfig>): WebsmithLoaderConfig => {
    const options: WebsmithLoaderConfig = loader.getOptions();
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
