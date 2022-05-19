/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { Reporter } from "@quatico/websmith-api";
import { AddonRegistry } from "./addons";
import { CompilationConfig } from "./config";

export interface CompilerOptions {
    addons: AddonRegistry;
    buildDir: string;
    config?: CompilationConfig;
    debug: boolean;
    tsconfig: ts.ParsedCommandLine;
    project: ts.CompilerOptions;
    reporter: Reporter;
    sourceMap: boolean;
    targets: string[];
    watch: boolean;
    additionalArguments?: Map<string, unknown>;
    // TODO: Add support for style processors via addon
    // sassOptions?: sass.Options<"sync">;
}
