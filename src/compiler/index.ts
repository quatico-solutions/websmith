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
import { AddonRegistry, CustomStyleTransformers } from "./addon-registry";
import { Compiler } from "./Compiler";
import { parseProjectConfig } from "./Config";
import { DefaultReporter } from "./DefaultReporter";
import { tsDefaults, tsLibDefaults } from "./defaults";
import { createParser, Parser, ParserOptions, Project } from "./Parser";
import type { CompilerOptions } from "./CompilerOptions";
import type { CompilationContext } from "./CompilationContext";
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
    parseProjectConfig,
    createParser,
    CustomStyleTransformers,
    DefaultReporter,
    Parser,
    ParserOptions,
    Project,
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
