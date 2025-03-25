/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type ts from "typescript";
import { type CompilerOptions } from "./CompilerOptions";
import { ResolvedCompilerOptions } from "./ResolvedCompilerOptions";
import { type WebpackLoaderOptions } from "./WebpackLoaderOptions";

export const resolveCompilerOptions = (
    system: ts.System,
    options: Partial<CompilerOptions>,
    addons?: string[],
    loaderOptions?: WebpackLoaderOptions
): ResolvedCompilerOptions => {
    return new ResolvedCompilerOptions(system, options, addons, loaderOptions);
};
