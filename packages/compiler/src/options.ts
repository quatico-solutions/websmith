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

const DEFAULTS: CompilerArguments & { outDir: string; project: string } = {
    debug: false,
    outDir: "./lib",
    project: "./tsconfig.json",
    sourceMap: false,
    watch: false,
};

export const createOptions = (args: CompilerArguments, reporter = new NoReporter(), system = ts.sys): CompilerOptions => {
    const tsConfig: ts.ParsedCommandLine = resolveTsConfig(args.project ?? DEFAULTS.project, system);
    const compilationConfig = args.configFile ? resolveCompilationConfig(args.configFile, reporter, system) : undefined;

    const projectDirectory =
        (args?.configFile && dirname(args.configFile)) ?? (tsConfig.raw && tsConfig.raw.configFilePath && dirname(tsConfig.raw?.configFilePath));
    tsConfig.options.outDir = system.resolvePath(args.buildDir ?? tsConfig.options.outDir ?? DEFAULTS.outDir);
    if (projectDirectory) {
        tsConfig.options = updateCompilerOptions(tsConfig.options, system, projectDirectory);
    }

    if (args.sourceMap !== undefined) {
        tsConfig.options.sourceMap = args.sourceMap;
        if (tsConfig.options.sourceMap === false) {
            tsConfig.options.inlineSources = undefined;
        }
    }

    const targets = args.targets?.split(",").map(target => target.trim()) ?? [];
    let config =
        compilationConfig || args.config
            ? Object.assign({}, compilationConfig, args.config, { ...(args.transpileOnly && { transpileOnly: true }) })
            : undefined;
    if (args.transpileOnly) {
        if (!config) {
            config = { transpileOnly: true };
        } else {
            config.transpileOnly = true;
        }
    }

    return {
        buildDir: args.buildDir ?? system.getCurrentDirectory(),
        ...(config && { config }),
        ...(args.configFile && { configFile: args.configFile }),
        debug: args.debug ?? DEFAULTS.debug,
        // TODO: Do we need lib files, or is injecting them into the system sufficient?
        // files?: Record<string, string>;
        cliArgs: tsConfig,
        tsConfig: tsConfig.options,
        reporter,
        sourceMap: args.sourceMap ?? DEFAULTS.sourceMap,
        targets: resolveTargets(targets, compilationConfig, reporter),
        watch: args.watch ?? DEFAULTS.watch,
    };
};
