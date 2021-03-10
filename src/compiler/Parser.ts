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
import * as ts from "typescript";
import { isProjectFileName, isScriptFileName, isStyleFileName, VALID_STYLE_FILES } from "../elements";

export interface ParserOptions {
    compilerOptions: ts.CompilerOptions;
    system: ts.System;
    filePaths?: string[];
}

export interface Project {
    program: ts.Program;
    stylePaths: string[];
    scriptPaths: string[];
    filePaths: string[];
}

export type Parser = (fileNames?: string[]) => Project;

export const createParser = (options: ParserOptions): Parser => {
    const { compilerOptions } = options;

    return (filePaths?: string[]) => {
        const host = ts.createCompilerHost(compilerOptions);
        const targets = parsePaths(options, filePaths);
        const program = ts.createProgram(targets, compilerOptions, host);
        return {
            filePaths: targets,
            program,
            scriptPaths: targets.filter(cur => isScriptFileName(cur)),
            stylePaths: targets.filter(cur => isStyleFileName(cur)),
        };
    };
};

export const parsePaths = (options: ParserOptions, filePaths?: string[]): string[] => {
    const { filePaths: globalFileNames = [], system } = options;

    const targets =
        filePaths && filePaths.length > 0
            ? filePaths
            : Array.from(
                  new Set([
                      ...globalFileNames,
                      ...system.readDirectory(system.getCurrentDirectory(), VALID_STYLE_FILES),
                  ])
              );

    return targets.filter(cur => isProjectFileName(cur));
};
