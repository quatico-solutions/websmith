/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

/**
 * Represents an AST for a given file with some additional information like the file name,
 * source text and version number.
 */
export interface VersionedFile extends ts.SourceFile {
    version: number;
}
