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
 *  - `depends`: the list of dependencies to other profiles to be applied
 *  - `addons`: the list of addons to apply for this profile
 *  - `config`: profile specific configuration
 *  - `tsConfig`: compiler options for the TypeScript compiler for this profile
 */
export type CompilationProfile = {
    /** List of dependencies to other profiles to be applied, before this profile is applied. */
    depends?: string[];
    /** List of addons to be loaded. */
    addons?: string[];
    /** Profile specific configuration. */
    config?: unknown;
    /** Compiler options for the TypeScript compiler for this profile. */
    tsConfig?: ts.CompilerOptions;
};
