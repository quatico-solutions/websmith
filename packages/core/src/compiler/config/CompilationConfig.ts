/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { CompilationProfile } from "@quatico/websmith-api";

export type CompilationConfig = {
    /** List of addons to be loaded. Overrides the `addons` specified in the configuration file. */
    addons?: string[];
    /** Relative path to the directory containing the addons. Overrides the `addonsDir` specified in the configuration file. */
    addonsDir?: string;
    /** Record of target specific addons configurations. Overrides the `targets` specified in the configuration file. */
    targets?: Record<string, CompilationProfile>;
    /**
     * Whether to only transpile the code without emitting any output.
     * Overrides the `transpileOnly` specified in the `tsconfig.json`.
     */
    transpileOnly?: boolean;
};
