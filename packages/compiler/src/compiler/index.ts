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
import { AddonRegistry, CompilerAddon } from "./addons";
import type { CompilationContext } from "./compilation";
import type { CompileFragment } from "./Compiler";
import { Compiler } from "./Compiler";
import type { CompilerOptions } from "./CompilerOptions";
import { CompilationConfig, resolveCompilationConfig, resolveProjectConfig, resolveTargets, updateCompilerOptions } from "./config";
import { DefaultReporter } from "./DefaultReporter";
import { tsDefaults, tsLibDefaults } from "./defaults";
import { NoReporter } from "./NoReporter";
// TODO: Styles: Add support for style processors via addon
// import {
//     createStyleCompiler,
//     parseStyles,
//     StyleCompilerOptions,
//     StyleVisitor,
//     visitNode,
//     writeNode,
// } from "../addons/style-compiler";

export {
    AddonRegistry,
    CompilerAddon,
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
    // TODO: Styles: Add support for style processors via addon
    // createStyleCompiler,
    // parseStyles,
    // StyleCompilerOptions,
    // StyleVisitor,
    // visitNode,
    // writeNode,
};
export type { CompileFragment, CompilerOptions, CompilationContext };
