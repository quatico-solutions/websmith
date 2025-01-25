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
    const { project, targets, debug, sourceMap, configFile, buildDir, config, transpileOnly, tsConfig } = { ...DEFAULTS, ...args };

    const tsconfig = resolveTsConfig(project, system);
    tsconfig.options = { ...tsconfig.options, ...tsConfig };
    const compilationConfig = configFile ? resolveCompilationConfig(configFile, reporter, system) : undefined;

    const projectDirectory = (configFile && dirname(configFile)) ?? (tsconfig.raw?.configFilePath && dirname(tsconfig.raw?.configFilePath));
    tsconfig.options.outDir = system.resolvePath(buildDir ?? tsconfig.options.outDir ?? DEFAULTS.outDir);
    if (projectDirectory) {
        tsconfig.options = updateCompilerOptions(tsconfig.options, system, projectDirectory);
    }

    if (sourceMap !== undefined) {
        tsconfig.options.sourceMap = sourceMap;
        if (tsconfig.options.sourceMap === false) {
            delete tsconfig.options.inlineSources;
        }
    }

    const mergedConfig = compilationConfig || config ? Object.assign({}, compilationConfig, config) : undefined;

    return {
        buildDir: buildDir ?? system.getCurrentDirectory(),
        ...(mergedConfig && { config: mergedConfig }),
        ...(configFile && { configFile }),
        debug,
        tsconfig,
        project: tsconfig.options,
        reporter,
        sourceMap,
        targets: resolveTargets(targets, compilationConfig, reporter),
        transpileOnly: transpileOnly ?? compilationConfig?.transpileOnly ?? false,
        watch: false,
    };
};
