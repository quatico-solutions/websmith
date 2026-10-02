/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { resolveProjectFile } from "@quatico/websmith-core";
import ts from "typescript";

export const findConfigFile = (searchPath = "./", system: ts.System = ts.sys): string | never => {
    const configPath = resolveProjectFile(system, searchPath);
    if (!system.fileExists(configPath)) {
        throw new Error("Could not find a valid 'tsconfig.json'.");
    }
    return configPath;
};
