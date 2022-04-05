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
import { aggregateMessages, ErrorMessage, InfoMessage, messageToString, WarnMessage } from "@websmith/addon-api";
import { AddonRegistry } from "./addons";
import type { CompilationContext } from "./compilation";
import { Compiler } from "./Compiler";
import type { CompilerOptions } from "./CompilerOptions";
import { CompilationConfig, resolveCompilationConfig, resolveProjectConfig, resolveTargets } from "./config";
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
    aggregateMessages,
    CompilationConfig,
    Compiler,
    createParser,
    DefaultReporter,
    ErrorMessage,
    InfoMessage,
    messageToString,
    NoReporter,
    Parser,
    ParserOptions,
    Project,
    resolveCompilationConfig,
    resolveProjectConfig,
    resolveTargets,
    tsDefaults,
    tsLibDefaults,
    WarnMessage,
    // TODO: Add support for style processors via addon
    // createStyleCompiler,
    // parseStyles,
    // StyleCompilerOptions,
    // StyleVisitor,
    // visitNode,
    // writeNode,
};
export type { CompilerOptions, CompilationContext };
