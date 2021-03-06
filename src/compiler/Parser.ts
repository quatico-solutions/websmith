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
