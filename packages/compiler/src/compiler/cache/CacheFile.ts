import ts from "typescript";
import { resolve } from "path";

export type CacheFile = { version: number; content: string; files: ts.OutputFile[]; snapshot?: ts.IScriptSnapshot };

export const getCachedName = (fileName: string, target: string): string => {
    return `${resolve(fileName)}!!${target}`;
};
