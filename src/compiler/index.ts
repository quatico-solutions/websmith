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
import { AddonRegistry, CustomStyleTransformers } from "./addons";
import type { CompilationContext } from "./compilation";
import { Compiler } from "./Compiler";
import type { CompilerOptions } from "./CompilerOptions";
import { CompilerConfig, resolveCompilerConfig, resolveProjectConfig, resolveTargets } from "./config";
import { DefaultReporter } from "./DefaultReporter";
import { tsDefaults, tsLibDefaults } from "./defaults";
import { NoReporter } from "./NoReporter";
import { createParser, Parser, ParserOptions, Project } from "./Parser";
// TODO: Add support for style processors via addon
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
    Compiler,
    CompilerConfig,
    createParser,
    CustomStyleTransformers,
    DefaultReporter,
    NoReporter,
    Parser,
    ParserOptions,
    Project,
    resolveCompilerConfig,
    resolveProjectConfig,
    resolveTargets,
    tsDefaults,
    tsLibDefaults,
    // TODO: Add support for style processors via addon
    // createStyleCompiler,
    // parseStyles,
    // StyleCompilerOptions,
    // StyleVisitor,
    // visitNode,
    // writeNode,
};
export type { CompilerOptions, CompilationContext };
