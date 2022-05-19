/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

export const findConfigFile = (searchPath = "./", system: ts.System = ts.sys): string | never => {
    const configPath = ts.findConfigFile(searchPath, system.fileExists, "tsconfig.json");
    if (!configPath) {
        throw new Error("Could not find a valid 'tsconfig.json'.");
    }
    return configPath;
};

export const findSassConfig = (filePath = "sass.config.js", system: ts.System = ts.sys): string | never => {
    const configPath = system.resolvePath(filePath);
    if (!system.fileExists(configPath)) {
        throw new Error("Could not find a valid 'sass.config.js'.");
    }
    return configPath;
};
