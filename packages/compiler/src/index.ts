/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
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
} from "./compiler";
import { createBrowserSystem, createCompileHost, createSystem, createVersionedFiles, getVersionedFile, readFiles } from "./environment";

export {
    AddonRegistry,
    CompilationConfig,
    Compiler,
    CompilerAddon,
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
};
export type { CompileFragment, CompilerOptions, CompilationContext };
