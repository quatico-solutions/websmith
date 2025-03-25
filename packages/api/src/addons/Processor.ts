/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

/**
 * Processors consume the unmodified source files, or input files created
 * by Generators. A processor can modify the input files before the actual
 * compilation, i.e., it can change module dependencies or add additional
 * imports/exports.
 *
 * Use this processor function to modify input files before the actual
 * compilation.
 *
 * @param filePath The path of the source file that is being compiled.
 * @param fileContent The content of the source file.
 */
export type Processor = (filePath: string, fileContent: string) => string | never;
