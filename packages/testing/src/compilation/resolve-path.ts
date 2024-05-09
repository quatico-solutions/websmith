/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { isAbsolute, join } from "path";
import ts from "typescript";

export const resolvePath = (fs: ts.System, ...pathSegments: string[]) => {
    let resolvedPath = join(...pathSegments);
    if (!isAbsolute(resolvedPath)) {
        resolvedPath = join(fs.getCurrentDirectory(), ...pathSegments);
    }
    return resolvedPath;
};
