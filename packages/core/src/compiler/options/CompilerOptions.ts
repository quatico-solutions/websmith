/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter } from "@quatico/websmith-api";
import type ts from "typescript";
import { type BaseOptions } from "./BaseOptions";

export type CompilerOptions = BaseOptions & {
    // TODO: Not used by the compiler, but for the compilationEnv. Should be moved closer to the compilationEnv.
    buildDir: string;
    /**
     * Command-line arguments passed to the TypeScript compiler.
     * @default false
     */
    cliArgs: ts.ParsedCommandLine;
    /**
     * Reporter to be used for logging.
     */
    reporter: Reporter;
    /**
     * Whether to watch the files for changes and recompile on change
     * @default false
     */
    watch?: boolean;
    /**
     * Additional arguments to be passed to the compiler
     */
    additionalArguments?: Map<string, unknown>;
};
