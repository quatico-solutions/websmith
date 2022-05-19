/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { TargetConfig } from "@quatico/websmith-api";
import { Reporter, WarnMessage } from "@quatico/websmith-api";
import { dirname, isAbsolute, join } from "path";
import ts from "typescript";
import { CompilationConfig } from "./CompilationConfig";

export const resolveCompilationConfig = (configFilePath: string, reporter: Reporter, system: ts.System): CompilationConfig | undefined => {
    if (configFilePath) {
        const resolvedPath = system.resolvePath(configFilePath);
        if (!system.fileExists(resolvedPath)) {
            reporter.reportDiagnostic(new WarnMessage(`No configuration file found at ${resolvedPath}.`));
        } else {
            const content = system.readFile(resolvedPath);
            if (content) {
                const config = JSON.parse(content ?? "{}");

                // TODO: Do we need further validation for the config per target?
                return { ...updatePaths(config, system, dirname(resolvedPath)), configFilePath: resolvedPath };
            }
        }
    }
    return undefined;
};

const updatePaths = (config: CompilationConfig, system: ts.System, basePath: string): CompilationConfig => {
    return {
        ...config,
        ...(config.addonsDir && { addonsDir: resolvePath(config.addonsDir, system, basePath) }),
        ...(config.targets && {
            targets: Object.fromEntries(
                Object.entries(config.targets).map(([name, target]) => [name, updateTargetConfigs(target, system, basePath)])
            ),
        }),
    };
};

const updateTargetConfigs = (target: TargetConfig, system: ts.System, basePath: string): TargetConfig => {
    return {
        ...target,
        ...(target.options && { options: updateCompilerOptions(target.options, system, basePath) }),
    };
};

export const updateCompilerOptions = (options: ts.CompilerOptions, system: ts.System, basePath: string): ts.CompilerOptions => {
    return {
        ...options,
        ...(options.outDir && { outDir: resolvePath(options.outDir, system, basePath) }),
        ...(options.paths && {
            paths: Object.fromEntries(
                Object.entries(options.paths).map(value => [value[0], value[1].map(cur => resolvePath(cur, system, basePath))])
            ),
        }),
    };
};

const resolvePath = (path: string, system: ts.System, basePath: string): string => {
    return isAbsolute(path) ? path : system.resolvePath(join(basePath, path));
};
