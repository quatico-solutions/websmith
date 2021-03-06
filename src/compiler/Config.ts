import * as ts from "typescript";
import { aggregateMessages } from "../model";

/**
 * Parses tsconfig.json files and creates config
 *
 * @param configFilePath
 * @param system
 */
export const createConfig = (configFilePath: string, system: ts.System): ts.ParsedCommandLine | never => {
    let errorMessage: string | ts.DiagnosticMessageChain = "Could not find a valid 'tsconfig.json'.";

    const parseHost: ts.ParseConfigFileHost = {
        ...system,
        onUnRecoverableConfigFileDiagnostic: (diagnostic: ts.Diagnostic) => {
            errorMessage = aggregateMessages(diagnostic.messageText);
        },
    };

    const result = ts.getParsedCommandLineOfConfigFile(
        configFilePath,
        {} /* no extra compiler options */,
        parseHost,
        undefined,
        undefined,
        [
            {
                extension: ".scss",
                isMixedContent: false,
                scriptKind: ts.ScriptKind.Deferred,
            },
            {
                extension: ".css",
                isMixedContent: false,
                scriptKind: ts.ScriptKind.Deferred,
            },
        ]
    )!;

    if (!result) {
        throw new Error(errorMessage);
    }
    return result;
};
