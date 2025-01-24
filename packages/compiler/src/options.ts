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

const DEFAULTS: CompilerArguments & { outDir: string; project: string; configFile: string } = {
    configFile: "./websmith.config.json",
    debug: false,
    outDir: "./lib",
    project: "./tsconfig.json",
    sourceMap: false,
    watch: false,
};

export const createOptions = (args: CompilerArguments, reporter = new NoReporter(), system = ts.sys): CompilerOptions => {
    const tsconfig: ts.ParsedCommandLine = resolveTsConfig(args.project ?? DEFAULTS.project, system);
    const compilationConfig = resolveCompilationConfig(args.configFile ?? DEFAULTS.configFile, reporter, system);

    const projectDirectory =
        (args?.configFile && dirname(args.configFile)) ?? (tsconfig.raw && tsconfig.raw.configFilePath && dirname(tsconfig.raw?.configFilePath));
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
        // TODO: Do we need lib files, or is injecting them into the system sufficient?
        // files?: Record<string, string>;
        tsconfig,
        project: tsconfig.options,
        reporter,
        sourceMap: args.sourceMap ?? DEFAULTS.sourceMap,
        targets: resolveTargets(args.targets, compilationConfig, reporter),
        transpileOnly: args.transpileOnly ?? compilationConfig?.transpileOnly ?? false,
        watch: args.watch ?? DEFAULTS.watch,
    };
};
