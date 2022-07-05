/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LoaderContext, WebpackError } from "webpack";
import { PluginOptions } from "./plugin";
import Upath from "./Upath";

export const getLoaderOptions = (loader: LoaderContext<PluginOptions>): PluginOptions => {
    const options: PluginOptions = loader.getOptions();
    const result = {
        ...options,
        ...(loader._module && loader._module.addWarning && { warn: (err: WebpackError) => loader._module!.addWarning(err) }),
        ...(loader._module && loader._module.addError && { error: (err: WebpackError) => loader._module!.addError(err) }),
        config: Upath.resolve(options.config),
        webpackTarget: options.webpackTarget ?? "*",
    };
    return result;
};
