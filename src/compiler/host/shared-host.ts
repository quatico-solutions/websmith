import { dirname, join } from "path";
import ts from "typescript";

export const createSharedHost = (sys: ts.System) => ({
    getNewLine: () => sys.newLine,
    getCurrentDirectory: () => sys.getCurrentDirectory(),
    getDefaultLibFileName: (options: ts.CompilerOptions) => join(dirname(ts.getDefaultLibFilePath(options)), ts.getDefaultLibFileName(options)),
    fileExists: sys.fileExists,
    readFile: sys.readFile,
    readDirectory: sys.readDirectory,
    directoryExists: sys.directoryExists,
    getDirectories: sys.getDirectories,
});
