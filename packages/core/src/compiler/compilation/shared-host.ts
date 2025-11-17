/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import ts from "typescript";

export const createSharedHost = (sys: ts.System = ts.sys) => ({
    getNewLine: () => sys.newLine,
    getCurrentDirectory: () => sys.getCurrentDirectory(),
    getDefaultLibFileName: (tsConfig: ts.CompilerOptions) =>
        path.join(path.dirname(ts.getDefaultLibFilePath(tsConfig)), ts.getDefaultLibFileName(tsConfig)),
    fileExists: (path: string) => sys.fileExists(path),
    readFile: (path: string, encoding?: string) => sys.readFile(path, encoding),
    readDirectory: (path: string, extensions?: readonly string[], exclude?: readonly string[], include?: readonly string[], depth?: number) =>
        sys.readDirectory(path, extensions, exclude, include, depth),
    directoryExists: (path: string) => sys.directoryExists(path),
    getDirectories: (path: string) => sys.getDirectories(path),
    getScriptFileNames: () => [],
    getCompilationSettings: () => <ts.CompilerOptions>{},
    getScriptVersion: () => "0",
    getScriptSnapshot: (fileName: string) => ts.ScriptSnapshot.fromString(sys.readFile(fileName) ?? ""),
});
