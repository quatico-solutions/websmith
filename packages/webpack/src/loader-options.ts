/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type CompilationConfig } from "@quatico/websmith-core";
import type ts from "typescript";
import { type LoaderContext, type WebpackError } from "webpack";
import { Upath as uPath } from "./Upath";

export interface WebsmithLoaderOptions {
    addons?: string[];
    addonsDir?: string;
    buildDir?: string;
    configFile?: string;
    config?: CompilationConfig;
    debug?: boolean;
    project?: string;
    targets?: string[];
    transpileOnly?: boolean;
    tsConfig?: ts.CompilerOptions;
    webpackTarget?: string;
}

export type WebsmithLoaderConfig = WebsmithLoaderOptions & {
    warn?: (err: WebpackError) => void;
    error?: (err: WebpackError) => void;
};

export const getLoaderOptions = (loader: LoaderContext<WebsmithLoaderConfig>): WebsmithLoaderConfig => {
    const options = loader.getOptions();
    const { configFile, webpackTarget = "*" } = options;

    const result = {
        ...options,
        ...(!!loader._module && typeof loader._module.addWarning === "function" && { warn: (err: WebpackError) => loader._module!.addWarning(err) }),
        ...(!!loader._module && typeof loader._module.addError === "function" && { error: (err: WebpackError) => loader._module!.addError(err) }),
        ...(!!configFile && { configFile: uPath.resolve(configFile) }),
        webpackTarget,
    };
    return result;
};
