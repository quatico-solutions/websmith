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
    buildDir: string;
    config?: CompilationConfig;
    /** Relative path to the `websmith.config.json` configuration file. */
    configFile?: string;
    debug?: boolean;
    cliArgs: ts.ParsedCommandLine;
    tsConfig: ts.CompilerOptions;
    reporter: Reporter;
    /**
     * List of targets to be compiled. Refers to the `targets` defined in the `config` property.
     * Use `["*"]` to compile with all available addons. No addons will be used if no target is specified.
     */
    targets?: string[];
    watch?: boolean;
    additionalArguments?: Map<string, unknown>;
}
