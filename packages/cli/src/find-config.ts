/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
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
