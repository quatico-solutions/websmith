/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type ts from "typescript";
import path from "node:path";

export type CacheFile = { version: number; content?: string; files?: ts.OutputFile[]; snapshot?: ts.IScriptSnapshot; modifiedTime?: Date };

export const getCachedName = (fileName: string): string => {
    return `${path.resolve(fileName)}!!cached`;
};
