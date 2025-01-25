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
import { PluginArguments, PluginOptions } from "./loader-options";

export const DEFAULTS: PluginArguments & { outDir: string; project: string; targets: string[] } = {
    addonsDir: "./addons",
    debug: false,
    outDir: "./lib",
    project: "./tsconfig.json",
    sourceMap: false,
    targets: ["*"],
};

export const createOptions = (args: Partial<PluginOptions>, reporter: Reporter = new NoReporter(), system: ts.System = ts.sys): CompilerOptions => {
    const tsconfig: ts.ParsedCommandLine = resolveTsConfig(args.project ?? DEFAULTS.project, system);
    const compilationConfig = args.configFile ? resolveCompilationConfig(args.configFile, reporter, system) : undefined;

    const projectDirectory =
        (args.configFile && dirname(args.configFile)) ?? (tsconfig.raw && tsconfig.raw.configFilePath && dirname(tsconfig.raw?.configFilePath));
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

    const targets = args.targets ?? DEFAULTS.targets;
    const config = compilationConfig || args.config ? Object.assign({}, compilationConfig, args.config) : undefined;

    return {
        buildDir: args.buildDir ?? system.getCurrentDirectory(),
        ...(config && { config }),
        ...(args.configFile && { configFile: args.configFile }),
        debug: args.debug ?? DEFAULTS.debug,
        tsconfig,
        project: tsconfig.options,
        reporter,
        sourceMap: args.sourceMap ?? DEFAULTS.sourceMap,
        targets: resolveTargets(targets, compilationConfig, reporter),
        transpileOnly: args.transpileOnly ?? compilationConfig?.transpileOnly ?? false,
        watch: false,
    };
};
