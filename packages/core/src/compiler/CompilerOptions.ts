/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter } from "@quatico/websmith-api";
import type ts from "typescript";
import type { CompilationConfig } from "./config";

export interface CompilerOptions {
    // TODO: Not used by the compiler, but for the compilationEnv. Should be moved closer to the compilationEnv.
    buildDir: string;
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
     * Command-line arguments passed to the TypeScript compiler.
     * @default false
     */
    cliArgs: ts.ParsedCommandLine;
    /**
     * Relative file path to the `tsconfig.json` file to be used for compilation.
     */
    tsConfigFile?: string;
    /**
     * TypeScript compiler options to be used for compilation. Overrides the options loaded from `tsconfig.json`.
     */
    tsConfig: ts.CompilerOptions;
    /**
     * Reporter to be used for logging.
     */
    reporter: Reporter;
    /**
     * List of profiles to be compiled. Refers to the `profiles` defined in the `config` property.
     * Use `["*"]` to compile with all available addons. No addons will be used if no profile is specified.
     */
    profiles?: string[];
    /**
     * Whether to watch the files for changes and recompile on change
     * @default false
     */
    watch?: boolean;
    /**
     * Additional arguments to be passed to the compiler
     */
    additionalArguments?: Map<string, unknown>;
}
