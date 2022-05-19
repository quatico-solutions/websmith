/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/**
 * ResultProcessors consume all output files from the compilation process
 * and can create additional files. They cannot alter the output files,
 * but have access to the transformed source code and compilation results.
 * ResultProcessors are executed after all other Addon types and the actual
 * compilation is completed. All ResultProcessors are executed in order
 * of their registration once for every target.
 *
 * Use this result processor function to create additional output, such as
 * other compilation results or documentation based on your output.
 *
 * @param filePaths The paths of the output files.
 */
export type ResultProcessor = (filePaths: string[]) => void;
