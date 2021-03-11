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
import { createCompileHost } from "../environment";

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
    const { compilerOptions, system } = options;

    return (filePaths?: string[]) => {
        const rootNames = parsePaths(options, filePaths);
        const host = createCompileHost(compilerOptions, system);
        // FIXME: Remove is testing is done
        // const host = ts.createCompilerHost(compilerOptions);
        const program = ts.createProgram({
            host,
            options: compilerOptions,
            projectReferences: [],
            rootNames,
        });
        return {
            filePaths: rootNames,
            program,
            scriptPaths: rootNames.filter(cur => isScriptFileName(cur)),
            stylePaths: rootNames.filter(cur => isStyleFileName(cur)),
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
