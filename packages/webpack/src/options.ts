/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Reporter } from "@quatico/websmith-api";
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
import { WebsmithLoaderConfig } from "./loader-options";

export const createOptions = (args: WebsmithLoaderConfig, reporter: Reporter = new NoReporter(), system = ts.sys): CompilerOptions => {
    const { buildDir, config, configFile, debug = false, project = "./tsconfig.json", sourceMap = false, targets = ["*"], tsConfig } = args;

    const cliArgs = resolveTsConfig(project, system);
    cliArgs.options = { ...cliArgs.options, ...tsConfig };
    const compilationConfig = configFile ? resolveCompilationConfig(configFile, reporter, system) : undefined;

    const projectDirectory = (configFile && dirname(configFile)) ?? (cliArgs.raw?.configFilePath && dirname(cliArgs.raw?.configFilePath));
    cliArgs.options.outDir = system.resolvePath(buildDir ?? cliArgs.options.outDir ?? "./lib");
    if (projectDirectory) {
        cliArgs.options = updateCompilerOptions(cliArgs.options, system, projectDirectory);
    }

    if (sourceMap !== undefined) {
        cliArgs.options.sourceMap = sourceMap;
        if (cliArgs.options.sourceMap === false) {
            delete cliArgs.options.inlineSources;
        }
    }

    const mergedConfig = compilationConfig || config ? Object.assign({}, compilationConfig, config) : undefined;

    return {
        buildDir: buildDir ?? system.getCurrentDirectory(),
        cliArgs,
        ...(mergedConfig && { config: mergedConfig }),
        ...(configFile && { configFile }),
        debug,
        reporter,
        sourceMap,
        targets: resolveTargets(targets, compilationConfig, reporter),
        tsConfig: cliArgs.options,
        watch: false,
    };
};
