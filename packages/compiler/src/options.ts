/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import {
    CompilerOptions,
    NoReporter,
    resolveCompilationConfig,
    resolveTargets,
    resolveProjectConfig as resolveTsConfig,
    updateCompilerOptions,
} from "@quatico/websmith-core";
import { dirname } from "path";
import ts from "typescript";
import { CompilerArguments } from "./CompilerArguments";

export const createOptions = (args: CompilerArguments, reporter = new NoReporter(), system = ts.sys): CompilerOptions => {
    const { configFile, debug = false, project = "./tsconfig.json", sourceMap = false, targets, transpileOnly, watch = false } = args;

    const cliArgs = resolveTsConfig(project, system);
    cliArgs.options = { ...cliArgs.options };
    const compilationConfig = configFile ? resolveCompilationConfig(configFile, reporter, system) : undefined;

    const projectDirectory = (configFile && dirname(configFile)) ?? (cliArgs.raw?.configFilePath && dirname(cliArgs.raw?.configFilePath));
    cliArgs.options.outDir = system.resolvePath(cliArgs.options.outDir ?? system.getCurrentDirectory());
    if (projectDirectory) {
        cliArgs.options = updateCompilerOptions(cliArgs.options, system, projectDirectory);
    }

    if (sourceMap !== undefined) {
        cliArgs.options.sourceMap = sourceMap;
        if (cliArgs.options.sourceMap === false) {
            delete cliArgs.options.inlineSources;
        }
    }

    const targetNames = targets?.split(",").map(target => target.trim()) ?? [];
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
        targets: resolveTargets(targetNames, compilationConfig, reporter),
        watch,
    };
};
