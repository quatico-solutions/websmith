/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter } from "@quatico/websmith-api";
import { type CompilerOptions, NoReporter, parsedCommandLine, resolveCompilationConfig, resolvePaths, resolveProfile } from "@quatico/websmith-core";
import path from "node:path";
import ts from "typescript";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

// TODO: Resolve compiler options
export const createOptions = (args: WebsmithLoaderConfig, reporter: Reporter = new NoReporter(), system = ts.sys): CompilerOptions => {
    const { config, configFile, debug = false, tsConfigFile = "./tsconfig.json", profile, tsConfig, transpileOnly } = args;

    const cliArgs = parsedCommandLine(tsConfigFile, args, system);
    cliArgs.options = { ...cliArgs.options, ...tsConfig };
    const compilationConfig = configFile ? resolveCompilationConfig(configFile, reporter, system) : undefined;

    const projectDirectory = (configFile && path.dirname(configFile)) ?? (cliArgs.raw?.configFilePath && path.dirname(cliArgs.raw?.configFilePath));
    cliArgs.options.outDir = system.resolvePath(cliArgs.options.outDir ?? "./lib");
    if (projectDirectory) {
        cliArgs.options = resolvePaths(cliArgs.options, projectDirectory, system);
    }

    if (cliArgs.options.sourceMap === false) {
        delete cliArgs.options.inlineSources;
    }

    let mergedConfig = compilationConfig || config ? Object.assign({}, compilationConfig, config) : undefined;
    if (transpileOnly) {
        if (!mergedConfig) {
            mergedConfig = { transpileOnly: true };
        } else {
            mergedConfig.transpileOnly = true;
        }
    }

    return {
        buildDir: system.getCurrentDirectory(),
        cliArgs,
        ...(mergedConfig && { config: mergedConfig }),
        ...(configFile && { configFile }),
        debug,
        reporter,
        profile: resolveProfile(profile, compilationConfig, reporter),
        tsConfig: cliArgs.options,
        watch: false,
    };
};
