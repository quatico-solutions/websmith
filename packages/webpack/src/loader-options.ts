/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { LoaderContext, WebpackError } from "webpack";
import { DEFAULTS } from "./options";
import { Upath as uPath } from "./Upath";

export interface PluginArguments {
    addons?: string;
    addonsDir?: string;
    buildDir?: string;
    config?: string;
    debug?: boolean;
    project?: string;
    sourceMap?: boolean;
    transpileOnly?: boolean;
    targets?: string;
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
        config: uPath.resolve(options.config ?? DEFAULTS.config),
        transpileOnly: options.transpileOnly ?? false,
        webpackTarget: options.webpackTarget ?? "*",
    };
    return result;
};
