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
     * Whether to only emit files that are processed by active addons.
     * When enabled, all files are still compiled for dependencies,
     * but only addon-processed files are written to disk.
     * Overrides the `addonEmitOnly` specified in the `config`.
     */
    addonEmitOnly?: boolean;
    /**
     * Instance name for webpack loader.
     */
    instanceName?: string;
    /**
     * Profiles configuration from loader options.
     */
    profiles?: Record<string, CompilationProfile>;
};
