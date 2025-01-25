/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Reporter } from "@quatico/websmith-api";
import ts from "typescript";
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
    sourceMap?: boolean;
    /**
     * List of targets to be compiled. Refers to the `targets` defined in the `config` property.
     * Use `["*"]` to compile with all available addons. No addons will be used if no target is specified.
     */
    targets?: string[];
    /**
     * Whether to only transpile the code without emitting any output.
     * Overrides the `transpileOnly` specified in the `tsconfig.json`.
     * @deprecated use `config.transpileOnly` instead.
     */
    transpileOnly?: boolean;
    watch?: boolean;
    additionalArguments?: Map<string, unknown>;
}
