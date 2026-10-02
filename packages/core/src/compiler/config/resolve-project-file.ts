/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import type ts from "typescript";

export const PROJECT_FILE_NAME = "tsconfig.json";

/**
 * Maps a `--project` path to its tsconfig file the way `tsc -p` does: a directory becomes `<directory>/tsconfig.json`,
 * any other path is returned as absolute path. The mapping is idempotent and does not look into parent directories.
 *
 * @param system The system to check the path with
 * @param projectPath Path to a tsconfig file or to a directory containing a 'tsconfig.json'
 * @returns The absolute path of the tsconfig file, which may not exist
 */
export const resolveProjectFile = (system: ts.System, projectPath: string): string => {
    const resolved = system.resolvePath(projectPath);
    if (!system.fileExists(resolved) && system.directoryExists(resolved)) {
        return path.join(resolved, PROJECT_FILE_NAME);
    }
    return resolved;
};
