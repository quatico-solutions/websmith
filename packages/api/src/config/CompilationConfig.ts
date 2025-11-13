/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { CompilationProfile } from "./CompilationProfile";

export type CompilationConfig = {
    /** List of addons to be loaded. Overrides the `addons` specified in the configuration file. */
    addons?: string[];
    /** Relative path to the directory containing the addons. Overrides the `addonsDir` specified in the configuration file. */
    addonsDir?: string;
    /** Record of profile specific addons configurations. Overrides the `profiles` specified in the configuration file. */
    profiles?: Record<string, CompilationProfile>;
    /**
     * Whether to only transpile the code without emitting any output.
     * Overrides the `transpileOnly` specified in the `tsconfig.json`.
     */
    transpileOnly?: boolean;
    /**
     * Whether to only emit files that are processed by active addons.
     * When enabled, all files are still compiled for type checking and dependencies,
     * but only files processed by addon callbacks (generators, processors, transformers) are written to disk.
     * Can be combined with `transpileOnly` for fast builds without type checking.
     */
    addonEmitOnly?: boolean;
};
