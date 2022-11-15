/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { dirname, join } from "path";
import ts from "typescript";

export const createSharedHost = (sys: ts.System = ts.sys) => ({
    getNewLine: () => sys.newLine,
    getCurrentDirectory: () => sys.getCurrentDirectory(),
    getDefaultLibFileName: (options: ts.CompilerOptions) => join(dirname(ts.getDefaultLibFilePath(options)), ts.getDefaultLibFileName(options)),
    fileExists: sys.fileExists,
    readFile: sys.readFile,
    readDirectory: sys.readDirectory,
    directoryExists: sys.directoryExists,
    getDirectories: sys.getDirectories,
    getScriptFileNames: () => [],
    getCompilationSettings: () => <ts.CompilerOptions>{},
    getScriptVersion: () => "0",
    getScriptSnapshot: (fileName: string) => ts.ScriptSnapshot.fromString(sys.readFile(fileName) ?? ""),
});
