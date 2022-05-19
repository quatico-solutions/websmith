/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

/**
 * Generators consume the unmodified source file and can create
 * additional source input or other output files unrelated to the
 * following compilation process. Generators are executed before all
 * other Addon types and thus before the actual compilation.
 *
 * Use this generator function to create additional files, such as
 * documentation based on your source code.
 *
 * @param filePath The path of the source file that is being compiled.
 * @param fileContent The content of the source file.
 */
export type Generator = (filePath: string, fileContent: string) => void;
