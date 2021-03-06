/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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
import path from "path";
import * as ts from "typescript";
import { isScriptFileName, isStyleFileName } from "../elements";

export interface ParserOptions {
    compilerOptions: ts.CompilerOptions;
    system: ts.System;
    fileNames?: string[];
}

export interface Project {
    program: ts.Program;
    stylePaths: string[];
}

export type Parser = (fileNames?: string[]) => Project;

export const createParser = (options: ParserOptions): Parser => {
    const { compilerOptions } = options;

    return (fileNames?: string[]) => {
        const { scriptPaths, stylePaths } = parsePaths(options, fileNames);
        const host = ts.createCompilerHost(compilerOptions);
        return { program: ts.createProgram(scriptPaths, compilerOptions, host), stylePaths };
    };
};

export const parsePaths = (options: ParserOptions, fileNames?: string[]) => {
    const { fileNames: globalFileNames, system } = options;

    let scriptPaths: string[] = [];
    let stylePaths: string[] = [];
    if (fileNames && fileNames.length > 0) {
        scriptPaths = fileNames.filter(cur => isScriptFileName(cur));
        stylePaths = fileNames.filter(cur => isStyleFileName(cur));
    } else {
        scriptPaths = globalFileNames?.filter(cur => isScriptFileName(cur)) || [];
        stylePaths = system
            .readDirectory(system.getCurrentDirectory(), ["scss", "css"])
            .filter(cur => path.basename(cur).startsWith("_"));
    }

    return { scriptPaths, stylePaths };
};
