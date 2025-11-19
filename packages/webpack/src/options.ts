/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { TSC_ARGUMENT_KEYS, type CompilerOptions, type Reporter, type TscArgumentKey } from "@quatico/websmith-api";
import { NoReporter, parsedCommandLine, resolveCompilationConfig, resolvePaths, resolveProfile } from "@quatico/websmith-core";
import path from "node:path";
import ts from "typescript";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";
import { TsConfigAnalyzer } from "./result-handling";

// TODO: Resolve compiler options
export const createOptions = (args: WebsmithLoaderConfig, reporter: Reporter = new NoReporter(), system = ts.sys): CompilerOptions => {
    const { config, configFile, debug = false, tsConfigFile = "./tsconfig.json", profile, tsConfig, transpileOnly, addonEmitOnly } = args;

    const cliArgs = parsedCommandLine(tsConfigFile, args, system);

    // Debug logging removed - rootDir inference working correctly

    // Use TsConfigAnalyzer to automatically infer rootDir if not explicitly set
    const configFilePath = cliArgs.raw?.configFilePath || tsConfigFile;
    if (!cliArgs.options.rootDir && configFilePath) {
        try {
            const tsConfigAnalyzer = new TsConfigAnalyzer();
            const analysis = tsConfigAnalyzer.analyzeConfig(configFilePath);
            if (analysis.rootDirs.length > 0) {
                // Use the first inferred root directory
                const inferredRootDir = analysis.rootDirs[0];
                const projectDir = path.dirname(configFilePath);
                const relativeRootDir = path.relative(projectDir, inferredRootDir);
                cliArgs.options.rootDir = relativeRootDir || ".";
                // Successfully inferred rootDir from tsconfig include patterns
            }
        } catch (_error) {
            // Silently continue if rootDir inference fails
            // rootDir inference failed, continue with default behavior
        }
    }

    cliArgs.options = {
        ...(cliArgs.options &&
            Object.entries(cliArgs.options).reduce((acc: ts.CompilerOptions, [key, value]) => {
                if (!TSC_ARGUMENT_KEYS.includes(key as TscArgumentKey)) {
                    return acc;
                }
                acc[key] = value;
                return acc;
            }, {} as ts.CompilerOptions)),
        ...tsConfig,
    };

    const compilationConfig = configFile ? resolveCompilationConfig(configFile, reporter, system) : undefined;

    const projectDirectory = (configFile && path.dirname(configFile)) ?? (cliArgs.raw?.configFilePath && path.dirname(cliArgs.raw?.configFilePath));
    cliArgs.options.outDir = system.resolvePath(cliArgs.options.outDir ?? "./lib");
    if (projectDirectory) {
        cliArgs.options = resolvePaths(cliArgs.options, projectDirectory, system);
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
    if (addonEmitOnly !== undefined) {
        if (!mergedConfig) {
            mergedConfig = { addonEmitOnly };
        } else {
            mergedConfig.addonEmitOnly = addonEmitOnly;
        }
    }

    return {
        cliArgs,
        ...(mergedConfig && { config: mergedConfig }),
        ...(configFile && { configFile }),
        ...(tsConfigFile && { tsConfigFile }),
        debug,
        reporter,
        profile: resolveProfile(profile, compilationConfig, reporter),
        tsConfig: cliArgs.options,
        watch: false,
    };
};
