/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { aggregateMessages, COMPILER_ARGUMENT_KEYS, type CompilerArgumentKey, type CompilerArguments } from "@quatico/websmith-api";
import ts from "typescript";

/**
 * Parses tsconfig.json files and creates parsed command line options.
 *
 * @param tsConfigFile
 * @param system
 */
export const parsedCommandLine = (tsConfigFile: string, args: CompilerArguments, system: ts.System): ts.ParsedCommandLine | never => {
    const invalidArgs = Object.keys(args).filter(key => !COMPILER_ARGUMENT_KEYS.includes(key as CompilerArgumentKey));
    if (invalidArgs.length) {
        throw new Error(`Error using the compiler with invalid arguments: "${invalidArgs.join(", ")}".`);
    }

    let errorMessage: string | ts.DiagnosticMessageChain = "Could not find a valid 'tsconfig.json'.";

    const parseHost: ts.ParseConfigFileHost = {
        ...system,
        onUnRecoverableConfigFileDiagnostic: (diagnostic: ts.Diagnostic) => {
            errorMessage = aggregateMessages(diagnostic.messageText);
        },
    };

    const { transpileOnly, configFile, addons, addonsDir, debug, profile, watch, ...rest } = args;

    const extraArgs = {
        // Only pass non-tsconfig options - let tsconfig.json control declaration settings
        ...(transpileOnly ? { transpileOnly: true } : {}),
        ...(configFile ? { configFile: system.resolvePath(configFile) } : {}),
        ...(addons ? { addons } : {}),
        ...(addonsDir ? { addonsDir } : {}),
        ...(debug ? { debug: true, listFiles: true } : {}),
        ...(profile ? { profile } : {}),
        ...(watch ? { watch: true } : {}),
    };

    const tscArgs = ts.parseCommandLine(createArgs(rest));

    if (tsConfigFile && system.fileExists(tsConfigFile)) {
        const result = ts.getParsedCommandLineOfConfigFile(
            system.resolvePath(tsConfigFile),
            {
                ...extraArgs,
                ...tscArgs.options, // CLI options can override tsconfig.json
            },
            parseHost,
            undefined /* no extended config cache */,
            undefined /* no extra watch options */,
            undefined /* no extra file extensions */
        );

        if (!result) {
            throw new Error(errorMessage);
        }
        return {
            ...result,
            options: { ...(configFile ? { configFile: system.resolvePath(configFile) } : {}), ...(watch ? { watch: true } : {}), ...result.options },
        };
    }

    return {
        options: { ...extraArgs, ...tscArgs.options, configFilePath: system.resolvePath(tsConfigFile) },
        fileNames: tscArgs.fileNames,
        errors: tscArgs.errors,
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
            } else {
                // Include false values explicitly so they aren't lost
                return acc.concat(`--${key}`, "false");
            }
        }
        if (value === undefined) {
            return acc;
        }

        return acc.concat(`--${key}`, value != null ? value.toString() : "");
    }, []);
