/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilerArguments, type CompilerOptions } from "@quatico/websmith-api";
import ts from "typescript";
import { parsedCommandLine } from "../config";
import { tsDefaults } from "../defaults";
import { NoReporter } from "../NoReporter";
import { resolveCompilerOptions } from "./resolveCompilerOptions";

/**
 * Receives the arguments from the CLI and returns the options for the compiler. All value differences between CLI
 * flags and compiler options are translated.
 *
 * @param args - The arguments from the CLI
 * @param reporter - The reporter to be used for logging
 * @param system - The system to be used for the compiler
 * @returns The options for the compiler
 */
export const createOptions = (args: CompilerArguments, reporter = new NoReporter(), system = ts.sys): CompilerOptions => {
    // Extract Websmith-specific arguments
    const { configFile, debug = false, profile, transpileOnly, watch = false, addons, addonsDir, fileNames, tsConfigFile } = args;

    // Extract TypeScript CLI arguments
    const { project = tsConfigFile || "./tsconfig.json", sourceMap = false } = args;

    // Extract LoaderOptions
    const { config, instanceName, profiles, tsConfig } = args;

    const cliArgs = parsedCommandLine(project, args, system);
    return resolveCompilerOptions(system, {
        cliArgs: {
            ...tsDefaults,
            ...cliArgs,
            // If fileNames is provided, use it; otherwise keep the original fileNames from parsedCommandLine
            ...(fileNames !== undefined && { fileNames: fileNames.split(",").map(it => it.trim()) }),
        },
        reporter,
        configFile,
        debug,
        profile,
        watch,
        tsConfig: {
            ...tsDefaults,
            ...(sourceMap && { sourceMap }),
            ...(project && { project }),
            ...(tsConfig && tsConfig), // Merge any additional TypeScript config
        },
        config: {
            ...(config && config), // Merge any provided config
            ...(transpileOnly && { transpileOnly }),
            ...(addonsDir && { addonsDir }),
            ...(addons !== undefined && { addons: addons && addons.trim() ? addons.split(",") : [] }),
        },
        // Include additional properties that might be used by the compiler
        ...(instanceName && { instanceName }),
        ...(profiles && { profiles }),
    });
};
