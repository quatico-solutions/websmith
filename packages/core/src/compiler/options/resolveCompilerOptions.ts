/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilerOptions, type WebpackLoaderOptions } from "@quatico/websmith-api";
import type ts from "typescript";
import { ResolvedCompilerOptions } from "./ResolvedCompilerOptions";

export const resolveCompilerOptions = (
    system: ts.System,
    options: CompilerOptions,
    loaderOptions?: WebpackLoaderOptions
): ResolvedCompilerOptions => {
    return new ResolvedCompilerOptions(system, options, loaderOptions);
};
