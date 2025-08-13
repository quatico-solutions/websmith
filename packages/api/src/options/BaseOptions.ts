/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type ts from "typescript";
import type { CompilationConfig } from "../config";

export type BaseOptions = {
    /**
     * Relative file path to the `websmith.config.json` file to be used for compilation.
     */
    configFile?: string;
    /**
     * Websmith configuration to be used for compilation. Overrides the configuration loaded from `websmith.config.json`.
     */
    config?: CompilationConfig;
    /**
     * Enables debug mode for the compilation.
     */
    debug?: boolean;
    /**
     * Relative file path to the `tsconfig.json` file to be used for compilation.
     */
    tsConfigFile?: string;
    /**
     * TypeScript compiler options to be used for compilation. Overrides the options loaded from `tsconfig.json`.
     */
    tsConfig?: ts.CompilerOptions;
    /**
     * Name of the profile to be applied. Refers to the `profiles` defined in the `config` property.
     * No addons will be used if no profile is specified.
     */
    profile?: string;
};
