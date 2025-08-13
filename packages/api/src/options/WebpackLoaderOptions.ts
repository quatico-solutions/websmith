/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { BaseOptions } from "./BaseOptions";
import type { CompilationProfile } from "../config";

export type WebpackLoaderOptions = BaseOptions & {
    /**
     * Whether to only transpile the code without emitting any output.
     * Overrides the `transpileOnly` specified in the `config`.
     */
    transpileOnly?: boolean;
    /**
     * Instance name for webpack loader.
     */
    instanceName?: string;
    /**
     * Profiles configuration from loader options.
     */
    profiles?: Record<string, CompilationProfile>;
};
