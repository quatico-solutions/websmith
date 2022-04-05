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
