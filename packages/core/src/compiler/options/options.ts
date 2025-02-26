/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilerArguments } from "@quatico/websmith-api";
import path from "node:path";
import ts from "typescript";
import { resolveCompilationConfig, resolvePaths, resolveProfile, resolveProjectConfig as resolveTsConfig } from "../config";
import { NoReporter } from "../NoReporter";
import { type CompilerOptions } from "./CompilerOptions";

// TODO: Resolve compiler options
export const createOptions = (args: CompilerArguments, reporter = new NoReporter(), system = ts.sys): CompilerOptions => {
    const { configFile, debug = false, project = "./tsconfig.json", sourceMap = false, profile, transpileOnly, watch = false } = args;

    const cliArgs = resolveTsConfig(project, system);
    cliArgs.options = { ...cliArgs.options };
    const compilationConfig = configFile ? resolveCompilationConfig(configFile, reporter, system) : undefined;

    const projectDirectory = (configFile && path.dirname(configFile)) ?? (cliArgs.raw?.configFilePath && path.dirname(cliArgs.raw?.configFilePath));
    cliArgs.options.outDir = system.resolvePath(cliArgs.options.outDir ?? system.getCurrentDirectory());
    if (projectDirectory) {
        cliArgs.options = resolvePaths(cliArgs.options, projectDirectory, system);
    }

    if (sourceMap !== undefined) {
        cliArgs.options.sourceMap = sourceMap;
        if (cliArgs.options.sourceMap === false) {
            delete cliArgs.options.inlineSources;
        }
    }

    let config = compilationConfig;
    if (transpileOnly) {
        if (!config) {
            config = { transpileOnly: true };
        } else {
            config.transpileOnly = true;
        }
    }

    return {
        buildDir: cliArgs.options.outDir!,
        ...(config && { config }),
        ...(configFile && { configFile }),
        debug,
        // TODO: Do we need lib files, or is injecting them into the system sufficient?
        // files?: Record<string, string>;
        cliArgs,
        tsConfig: cliArgs.options,
        reporter,
        profile: resolveProfile(profile, compilationConfig, reporter),
        watch,
    };
};
