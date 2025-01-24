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
import { PluginOptions } from "./loader-options";

export const DEFAULTS = {
    addonsDir: "./addons",
    config: "./websmith.config.json",
    debug: false,
    outDir: "./lib",
    project: "./tsconfig.json",
    sourceMap: false,
    targets: "*",
};

export const createOptions = (args: Partial<PluginOptions>, reporter: Reporter = new NoReporter(), system: ts.System = ts.sys): CompilerOptions => {
    const tsconfig: ts.ParsedCommandLine = resolveTsConfig(args.project ?? DEFAULTS.project, system);
    const compilationConfig = resolveCompilationConfig(args.config ?? DEFAULTS.config, reporter, system);

    const projectDirectory =
        (args.config && dirname(args.config)) ?? (tsconfig.raw && tsconfig.raw.configFilePath && dirname(tsconfig.raw?.configFilePath));
    tsconfig.options.outDir = system.resolvePath(args.buildDir ?? tsconfig.options.outDir ?? DEFAULTS.outDir);
    if (projectDirectory) {
        tsconfig.options = updateCompilerOptions(tsconfig.options, system, projectDirectory);
    }

    if (args.sourceMap !== undefined) {
        tsconfig.options.sourceMap = args.sourceMap;
        if (tsconfig.options.sourceMap === false) {
            tsconfig.options.inlineSources = undefined;
        }
    }

    return {
        buildDir: args.buildDir ?? system.getCurrentDirectory(),
        config: compilationConfig,
        debug: args.debug ?? DEFAULTS.debug,
        tsconfig,
        project: tsconfig.options,
        reporter,
        sourceMap: args.sourceMap ?? DEFAULTS.sourceMap,
        targets: resolveTargets(args.targets || DEFAULTS.targets, compilationConfig, reporter),
        transpileOnly: args.transpileOnly ?? compilationConfig?.transpileOnly ?? false,
        watch: false,
    };
};
