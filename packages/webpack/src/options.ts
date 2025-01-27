/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter } from "@quatico/websmith-api";
import {
    type CompilerOptions,
    NoReporter,
    resolveCompilationConfig,
    resolveTargets,
    resolveProjectConfig as resolveTsConfig,
    updateCompilerOptions,
} from "@quatico/websmith-core";
import { dirname } from "path";
import ts from "typescript";
import { type WebsmithLoaderConfig } from "./loader-options";

export const createOptions = (args: WebsmithLoaderConfig, reporter: Reporter = new NoReporter(), system = ts.sys): CompilerOptions => {
    const { buildDir, config, configFile, debug = false, project = "./tsconfig.json", targets = ["*"], tsConfig, transpileOnly } = args;

    const cliArgs = resolveTsConfig(project, system);
    cliArgs.options = { ...cliArgs.options, ...tsConfig };
    const compilationConfig = configFile ? resolveCompilationConfig(configFile, reporter, system) : undefined;

    const projectDirectory = (configFile && dirname(configFile)) ?? (cliArgs.raw?.configFilePath && dirname(cliArgs.raw?.configFilePath));
    cliArgs.options.outDir = system.resolvePath(buildDir ?? cliArgs.options.outDir ?? "./lib");
    if (projectDirectory) {
        cliArgs.options = updateCompilerOptions(cliArgs.options, system, projectDirectory);
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
        buildDir: buildDir ?? system.getCurrentDirectory(),
        cliArgs,
        ...(mergedConfig && { config: mergedConfig }),
        ...(configFile && { configFile }),
        debug,
        reporter,
        targets: resolveTargets(targets, compilationConfig, reporter),
        tsConfig: cliArgs.options,
        watch: false,
    };
};
