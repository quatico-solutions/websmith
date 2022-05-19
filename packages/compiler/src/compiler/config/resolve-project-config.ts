/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { aggregateMessages } from "@quatico/websmith-api";
import ts from "typescript";

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
    );

    if (!result) {
        throw new Error(errorMessage);
    }
    return result;
};
