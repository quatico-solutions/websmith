/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type ts from "typescript";
import type { AddonRegistry } from "../compiler";

export type CompileSystem = {
    fileSystem: ts.System;
    getSourceFile(fileName: string): { entry?: ts.SourceFile; fileSystem: ts.System };
    addons: AddonRegistry;
};
