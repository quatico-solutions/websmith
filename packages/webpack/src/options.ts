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
import { WebsmithLoaderOptions, WebsmithLoaderConfig } from "./loader-options";

export const DEFAULTS: WebsmithLoaderOptions & { outDir: string; project: string; targets: string[] } = {
    addonsDir: "./addons",
    debug: false,
    outDir: "./lib",
    project: "./tsconfig.json",
    sourceMap: false,
    targets: ["*"],
};

export const createOptions = (
    args: Partial<WebsmithLoaderConfig>,
    reporter: Reporter = new NoReporter(),
    system: ts.System = ts.sys
): CompilerOptions => {
    const { project, targets, debug, sourceMap, configFile, buildDir, config, tsConfig } = { ...DEFAULTS, ...args };

    const cliArgs = resolveTsConfig(project, system);
    cliArgs.options = { ...cliArgs.options, ...tsConfig };
    const compilationConfig = configFile ? resolveCompilationConfig(configFile, reporter, system) : undefined;

    const projectDirectory = (configFile && dirname(configFile)) ?? (cliArgs.raw?.configFilePath && dirname(cliArgs.raw?.configFilePath));
    cliArgs.options.outDir = system.resolvePath(buildDir ?? cliArgs.options.outDir ?? DEFAULTS.outDir);
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
        ...(mergedConfig && { config: mergedConfig }),
        ...(configFile && { configFile }),
        debug,
        cliArgs,
        tsConfig: cliArgs.options,
        reporter,
        sourceMap,
        targets: resolveTargets(targets, compilationConfig, reporter),
        watch: false,
    };
};
