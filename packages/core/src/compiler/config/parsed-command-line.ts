/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { aggregateMessages, type CompilerArguments } from "@quatico/websmith-api";
import ts from "typescript";

/**
 * Parses tsconfig.json files and creates parsed command line options.
 *
 * @param tsConfigFile
 * @param system
 */
export const parsedCommandLine = (tsConfigFile: string, args: CompilerArguments, system: ts.System): ts.ParsedCommandLine | never => {
    let errorMessage: string | ts.DiagnosticMessageChain = "Could not find a valid 'tsconfig.json'.";

    const parseHost: ts.ParseConfigFileHost = {
        ...system,
        onUnRecoverableConfigFileDiagnostic: (diagnostic: ts.Diagnostic) => {
            errorMessage = aggregateMessages(diagnostic.messageText);
        },
    };

    const argsResult = ts.parseCommandLine(createArgs(args));

    if (tsConfigFile && system.fileExists(tsConfigFile)) {
        const result = ts.getParsedCommandLineOfConfigFile(
            system.resolvePath(tsConfigFile),
            {
                // Apply tsc defaults
                pretty: true,
                declaration: false,
                declarationMap: false,
                emitDecorationOnly: false,
                sourceMap: false,
                noEmit: false,
                allowJs: false,
                checkJs: false,
                removeComments: false,
                strict: false,
                esModuleInterop: false,
                ...argsResult.options,
            },
            parseHost,
            undefined /* no extended config cache */,
            undefined /* no extra watch options */,
            undefined /* no extra file extensions */
        );

        if (!result) {
            throw new Error(errorMessage);
        }
        return result;
    }

    return {
        options: { ...argsResult.options, configFilePath: system.resolvePath(tsConfigFile) },
        fileNames: [],
        errors: [],
        compileOnSave: false,
        raw: {},
        typeAcquisition: { enable: false, exclude: [], include: [] },
        watchOptions: undefined,
        wildcardDirectories: { "": 1 },
        projectReferences: undefined,
    };
};

export const createArgs = (args: CompilerArguments): string[] =>
    Object.entries(args).reduce((acc: string[], [key, value]) => {
        if (typeof value === "boolean") {
            if (value === true) {
                return acc.concat(`--${key}`);
            }
            return acc;
        }
        if (value === undefined) {
            return acc;
        }

        return acc.concat(`--${key}`, value != null ? value.toString() : "");
    }, []);
