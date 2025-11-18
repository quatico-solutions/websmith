/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { AddonContext } from "./AddonContext";

/**
 * ResultProcessors consume emitted output files from the compilation process
 * and can create additional files. They cannot alter the compiled output files,
 * but have access to the compilation context and can generate supplementary
 * files like documentation, metadata, or reports.
 *
 * ResultProcessors are executed after all other Addon types and the actual
 * compilation is completed. All ResultProcessors are executed in order
 * of their registration once for every profile.
 *
 * When `addonEmitOnly` mode is enabled, only files that were actually emitted
 * (i.e., processed by addons) are passed to the result processor, not all
 * source files.
 *
 * Use this result processor function to create additional output, such as
 * documentation, metadata files, or reports based on the compilation results.
 *
 * @param emittedFiles The paths of the files that were actually emitted during compilation.
 *                     When `addonEmitOnly` is enabled, this only includes addon-processed files.
 *                     When `addonEmitOnly` is disabled, this includes all compiled files.
 * @param ctx The addon context providing access to the compilation environment,
 *            configuration, file system, and utility methods.
 */
export type ResultProcessor = (emittedFiles: string[], ctx: AddonContext) => void;
