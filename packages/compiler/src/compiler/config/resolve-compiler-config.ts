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
import { Reporter, WarnMessage } from "@websmith/addon-api";
import ts from "typescript";
import { CompilationConfig } from "./CompilationConfig";

export const resolveCompilationConfig = (configFilePath: string, reporter: Reporter, system: ts.System): CompilationConfig | undefined => {
    if (configFilePath) {
        const resolvedPath = system.resolvePath(configFilePath);
        if (!system.fileExists(resolvedPath)) {
            reporter.reportDiagnostic(new WarnMessage(`No configuration file found at ${resolvedPath}.`));
        } else {
            const content = system.readFile(resolvedPath);
            if (content) {
                const config = JSON.parse(content ?? "{}");

                // TODO: Do we need further validation for the config per target?
                return { ...config, configFilePath: resolvedPath };
            }
        }
    }
    return undefined;
};
