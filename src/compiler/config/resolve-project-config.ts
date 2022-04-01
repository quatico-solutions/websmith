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
import { aggregateMessages } from "../../model";

/**
 * Parses tsconfig.json files and creates parsed command line options.
 *
 * @param configFilePath
 * @param system
 */
export const resolveProjectConfig = (configFilePath: string, system: ts.System): ts.ParsedCommandLine | never => {
    let errorMessage: string | ts.DiagnosticMessageChain = "Could not find a valid 'tsconfig.json'.";

    const parseHost: ts.ParseConfigFileHost = {
        ...system,
        onUnRecoverableConfigFileDiagnostic: (diagnostic: ts.Diagnostic) => {
            errorMessage = aggregateMessages(diagnostic.messageText);
        },
    };

    const result = ts.getParsedCommandLineOfConfigFile(
        system.resolvePath(configFilePath),
        {} /* no extra compiler options */,
        parseHost,
        undefined /* no extended config cache */,
        undefined /* no extra watch options */,
        undefined /* no extra file extensions */
    )!;

    if (!result) {
        throw new Error(errorMessage);
    }
    return result;
};
