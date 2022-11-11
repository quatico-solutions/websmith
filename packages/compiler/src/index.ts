/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { CompilationContext, CompileFragment, CompilerAddon, CompilerOptions } from "./compiler";
import {
    AddonRegistry,
    CompilationConfig,
    Compiler,
    DefaultReporter,
    NoReporter,
    resolveCompilationConfig,
    resolveProjectConfig,
    resolveTargets,
    tsDefaults,
    tsLibDefaults,
    updateCompilerOptions,
} from "./compiler";
import { createBrowserSystem, createCompileHost, createSystem, createVersionedFiles, getVersionedFile, readFiles } from "./environment";

export {
    AddonRegistry,
    Compiler,
    createBrowserSystem,
    createCompileHost,
    createSystem,
    createVersionedFiles,
    DefaultReporter,
    getVersionedFile,
    NoReporter,
    readFiles,
    resolveCompilationConfig,
    resolveProjectConfig,
    resolveTargets,
    tsDefaults,
    tsLibDefaults,
    updateCompilerOptions,
};
export type { CompilerAddon, CompileFragment, CompilationConfig, CompilerOptions, CompilationContext };
