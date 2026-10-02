/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import ts from "typescript";

export const PROJECT_FILE_NAME = "tsconfig.json";

const absoluteProjectPath = (system: ts.System, projectPath: string): string => {
    const resolved = system.resolvePath(projectPath);
    if (!path.isAbsolute(resolved)) {
        // The virtual system resolves the current directory to "."
        return system.resolvePath(path.join(system.getCurrentDirectory(), projectPath));
    }
    return resolved;
};

/**
 * Maps a `--project` path to its tsconfig file the way `tsc -p` does: a directory becomes `<directory>/tsconfig.json`,
 * any other path is returned as absolute path. The mapping is idempotent and does not look into parent directories.
 *
 * @param system The system to check the path with
 * @param projectPath Path to a tsconfig file or to a directory containing a 'tsconfig.json'
 * @returns The absolute path of the tsconfig file, which may not exist
 */
export const resolveProjectFile = (system: ts.System, projectPath: string): string => {
    const resolved = absoluteProjectPath(system, projectPath);
    if (!system.fileExists(resolved) && system.directoryExists(resolved)) {
        return path.join(resolved, PROJECT_FILE_NAME);
    }
    return resolved;
};

/**
 * Returns the error `tsc -p` reports for an explicitly given project path that names no tsconfig file, or undefined if
 * it does. A directory without 'tsconfig.json' is error 5057, any other missing path is error 5058. Call it only with
 * the path the user passed, not with the default project, which may be missing without error.
 *
 * @param system The system to check the path with
 * @param projectPath The path as given, to a tsconfig file or to a directory containing a 'tsconfig.json'
 */
export const projectFileDiagnostic = (system: ts.System, projectPath: string): ts.Diagnostic | undefined => {
    const resolved = absoluteProjectPath(system, projectPath);
    if (system.fileExists(resolveProjectFile(system, projectPath))) {
        return undefined;
    }
    const isDirectory = system.directoryExists(resolved);
    return {
        category: ts.DiagnosticCategory.Error,
        code: isDirectory ? 5057 : 5058,
        file: undefined,
        start: undefined,
        length: undefined,
        messageText: isDirectory
            ? `Cannot find a tsconfig.json file at the specified directory: '${resolved}'.`
            : `The specified path does not exist: '${resolved}'.`,
    };
};
