/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonRegistry, CompilerAddon } from "./addons";
import type { CompilationContext } from "./compilation";
import type { CompileFragment } from "./Compiler";
import { Compiler } from "./Compiler";
import type { CompilerOptions } from "./CompilerOptions";
import { CompilationConfig, resolveCompilationConfig, resolveProjectConfig, resolveTargets, updateCompilerOptions } from "./config";
import { DefaultReporter } from "./DefaultReporter";
import { tsDefaults, tsLibDefaults } from "./defaults";
import { NoReporter } from "./NoReporter";

export {
    AddonRegistry,
    Compiler,
    DefaultReporter,
    NoReporter,
    resolveCompilationConfig,
    resolveProjectConfig,
    resolveTargets,
    tsDefaults,
    tsLibDefaults,
    updateCompilerOptions,
};
export type { CompilerAddon, CompilationConfig, CompileFragment, CompilerOptions, CompilationContext };
