/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

/**
 * This type represents the configuration options for a target. It is used in
 * the `targets` section of the `websmith.config.json` file. You can specify
 *  - the list of addons to apply for this target
 *  - whether output files should be written to disk
 *  - specific configuration properties used by your addon
 *  - a set of compiler options for the TypeScript compiler for this target
 */
export type TargetConfig = {
    addons?: string[];
    writeFile?: boolean;
    config?: unknown;
    options?: ts.CompilerOptions;
};
