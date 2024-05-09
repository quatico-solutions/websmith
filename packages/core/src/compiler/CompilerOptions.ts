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
    debug: boolean;
    tsconfig: ts.ParsedCommandLine;
    project: ts.CompilerOptions;
    reporter: Reporter;
    sourceMap: boolean;
    targets: string[];
    transpileOnly: boolean;
    watch: boolean;
    additionalArguments?: Map<string, unknown>;
    // TODO: Add support for style processors via addon
    // sassOptions?: sass.Options<"sync">;
}
