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
import type { TargetConfig } from "@websmith/addon-api";
import { Reporter, WarnMessage } from "@websmith/addon-api";
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
