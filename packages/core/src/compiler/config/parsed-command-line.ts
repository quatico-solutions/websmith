/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { aggregateMessages, COMPILER_ARGUMENT_KEYS, type CompilerArgumentKey, type CompilerArguments } from "@quatico/websmith-api";
import ts from "typescript";

/**
 * Parses tsconfig.json files and creates parsed command line options.
 *
 * @param tsConfigFile
 * @param system
 */
export const parsedCommandLine = (tsConfigFile: string, args: CompilerArguments, system: ts.System): ts.ParsedCommandLine | never => {
    const { config, tsConfig, fileNames, ...restArgs } = args as any; // TODO: Flatten compiler arguments seems a brittle solution

    const flattenedArgs = { ...restArgs, ...config, ...tsConfig };

    const invalidArgs = Object.keys(flattenedArgs).filter(key => !COMPILER_ARGUMENT_KEYS.includes(key as CompilerArgumentKey));
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

    const {
        transpileOnly,
        configFile,
        tsConfigFile: tsConfigFileArg,
        addons,
        addonsDir,
        debug,
        profile,
        watch,
        instanceName,
        profiles,
        ...rest
    } = flattenedArgs;

    if (tsConfigFileArg && tsConfigFileArg !== tsConfigFile) {
        throw new Error(`The --tsConfigFile argument must be the same as the --project argument.`);
    }

    const extraArgs = {
        // Only pass non-tsconfig options - let tsconfig.json control declaration settings
        ...(transpileOnly ? { transpileOnly: true } : {}),
        ...(configFile ? { configFile: system.resolvePath(configFile) } : {}),
        ...(addons ? { addons } : {}),
        ...(addonsDir ? { addonsDir } : {}),
        ...(debug ? { debug: true, listFiles: true } : {}),
        ...(profile ? { profile } : {}),
        ...(watch ? { watch: true } : {}),
        ...(instanceName ? { instanceName } : {}),
        ...(profiles ? { profiles } : {}),
    };

    // Create command line args and add file arguments if provided
    const commandLineArgs = createArgs(rest);
    if (fileNames && Array.isArray(fileNames)) {
        commandLineArgs.push(...fileNames);
    }
    const tscArgs = ts.parseCommandLine(commandLineArgs);

    if (tsConfigFile && system.fileExists(tsConfigFile)) {
        // If explicit files were provided as CLI arguments, still use tsconfig options but not file discovery
        if (tscArgs.fileNames.length > 0) {
            // Parse tsconfig to get the compiler options but ignore file discovery
            const tsConfigResult = ts.getParsedCommandLineOfConfigFile(
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

            if (!tsConfigResult) {
                throw new Error(errorMessage);
            }

            return {
                ...tsConfigResult,
                options: {
                    ...(configFile ? { configFile: system.resolvePath(configFile) } : {}),
                    ...(watch ? { watch: true } : {}),
                    ...(instanceName ? { instanceName } : {}),
                    ...tsConfigResult.options, // Include all tsconfig options
                },
                // Filter out invalid file paths like "/" that can cause compilation errors
                // Use explicit files instead of tsconfig file discovery
                fileNames: tscArgs.fileNames.filter(fileName => fileName !== "/" && fileName.trim() !== ""),
            };
        }

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
            options: {
                ...(configFile ? { configFile: system.resolvePath(configFile) } : {}),
                ...(watch ? { watch: true } : {}),
                ...(instanceName ? { instanceName } : {}),
                ...result.options,
            },
            // Filter out invalid file paths like "/" that can cause compilation errors
            fileNames: result.fileNames.filter(fileName => fileName !== "/" && fileName.trim() !== ""),
        };
    }

    return {
        options: { ...extraArgs, ...tscArgs.options, configFilePath: system.resolvePath(tsConfigFile) },
        // Filter out invalid file paths like "/" that can cause compilation errors
        fileNames: tscArgs.fileNames.filter(fileName => fileName !== "/" && fileName.trim() !== ""),
        errors: tscArgs.errors,
        compileOnSave: false,
        raw: {},
        typeAcquisition: { enable: false, exclude: [], include: [] },
        watchOptions: undefined,
        wildcardDirectories: { "": 1 },
        projectReferences: undefined,
    };
};

/**
 * Converts a value to its string representation for command-line arguments.
 * @param value The value to convert
 * @returns The string representation of the value
 */
const convertValueToString = (value: unknown): string => {
    if (value === undefined || value === null) {
        return "";
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    if (Array.isArray(value)) {
        return value.length > 0 ? value.map(v => (v === null || v === undefined ? "" : String(v))).join(",") : "";
    }

    return JSON.stringify(value);
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

        return acc.concat(`--${key}`, convertValueToString(value));
    }, []);
