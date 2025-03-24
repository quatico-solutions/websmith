/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type WebpackError } from "webpack";
import { type WebpackLoaderOptions } from "@quatico/websmith-core";

export type WebsmithLoaderConfig = WebpackLoaderOptions & {
    warn?: (err: WebpackError) => void;
    error?: (err: WebpackError) => void;
    instanceName?: string;
};
