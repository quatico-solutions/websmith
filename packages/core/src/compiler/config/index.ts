/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { CompilationConfig } from "./CompilationConfig";
import { resolveCompilationConfig, updateCompilerOptions } from "./resolve-compiler-config";
import { resolveProjectConfig } from "./resolve-project-config";
import { resolveTargets } from "./resolve-targets";

export { resolveProjectConfig, resolveCompilationConfig, resolveTargets, updateCompilerOptions };
export type { CompilationConfig };
