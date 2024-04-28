import { isAbsolute, join } from "path";
import ts from "typescript";

export const resolvePath = (fs: ts.System, ...pathSegments: string[]) => {
    let resolvedPath = join(...pathSegments);
    if (!isAbsolute(resolvedPath)) {
        resolvedPath = join(fs.getCurrentDirectory(), ...pathSegments);
    }
    return resolvedPath;
};
