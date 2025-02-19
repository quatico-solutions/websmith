/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import type ts from "typescript";

export const resolvePath = (fs: ts.System, ...pathSegments: string[]) => {
    let resolvedPath = path.join(...pathSegments);
    if (!path.isAbsolute(resolvedPath)) {
        resolvedPath = path.join(fs.getCurrentDirectory(), ...pathSegments);
    }
    return resolvedPath;
};
