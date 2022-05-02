/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import { Reporter } from "@websmith/addon-api";
import {
    AddonRegistry,
    CompilerOptions,
    NoReporter,
    resolveCompilationConfig,
    resolveProjectConfig as resolveTsConfig,
    resolveTargets,
    updateCompilerOptions,
} from "@websmith/compiler";
import { dirname, join } from "path";
import ts from "typescript";
import { CompilerArguments } from "./CompilerArguments";

const DEFAULTS = {
    addonsDir: "./addons",
    config: "./websmith.config.json",
    debug: false,
    outDir: "./lib",
    project: "./tsconfig.json",
    sourceMap: false,
    targets: "*",
    watch: false,
};

export const createOptions = (args: CompilerArguments, reporter: Reporter = new NoReporter(), system: ts.System = ts.sys): CompilerOptions => {
    const tsconfig: ts.ParsedCommandLine = resolveTsConfig(args.project ?? DEFAULTS.project, system);
    const compilationConfig = resolveCompilationConfig(args.config ?? DEFAULTS.config, reporter, system);

    const projectDirectory =
        (compilationConfig && dirname(compilationConfig.configFilePath)) ??
        (tsconfig.raw && tsconfig.raw.configFilePath && dirname(tsconfig.raw?.configFilePath));
    tsconfig.options.outDir = args.buildDir ?? tsconfig.options.outDir ?? DEFAULTS.outDir;
    if (projectDirectory) {
        tsconfig.options = updateCompilerOptions(tsconfig.options, system, projectDirectory);
    }

    if (args.sourceMap !== undefined) {
        tsconfig.options.sourceMap = args.sourceMap;
        if (tsconfig.options.sourceMap === false) {
            tsconfig.options.inlineSources = undefined;
        }
    }

    args = {
        ...args,
        ...(args.addonsDir &&
            projectDirectory &&
            args.addonsDir !== DEFAULTS.addonsDir && { addonsDir: system.resolvePath(join(projectDirectory, args.addonsDir)) }),
    };

    return {
        addons: new AddonRegistry({
            addons: args.addons ?? compilationConfig?.addons?.join(","),
            addonsDir: args.addonsDir && args.addonsDir !== DEFAULTS.addonsDir ? args.addonsDir : compilationConfig?.addonsDir ?? DEFAULTS.addonsDir,
            config: compilationConfig,
            reporter,
            system,
        }),
        buildDir: args.buildDir ?? system.getCurrentDirectory(),
        config: compilationConfig,
        debug: args.debug ?? DEFAULTS.debug,
        // FIXME: Do we need lib files, or is injecting them into the system sufficient?
        // files?: Record<string, string>;
        tsconfig,
        project: tsconfig.options,
        reporter,
        sourceMap: args.sourceMap ?? DEFAULTS.sourceMap,
        targets: resolveTargets(args.targets || DEFAULTS.targets, compilationConfig, reporter),
        watch: args.watch ?? DEFAULTS.watch,
    };
};
