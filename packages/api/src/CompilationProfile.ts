/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type ts from "typescript";

/**
 * This type represents the configuration options for a profile. It is used in
 * the `profiles` section of the `websmith.config.json` file. You can specify
 *  - the list of addons to apply for this profile
 *  - whether output files should be written to disk
 *  - specific configuration properties used by your addon
 *  - a set of compiler options for the TypeScript compiler for this profile
 */
export type CompilationProfile = {
    addons?: string[];
    config?: unknown;
    options?: ts.CompilerOptions;
};
