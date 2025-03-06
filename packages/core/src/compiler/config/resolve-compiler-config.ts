/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { parse } from "comment-json";
import type { CompilationProfile } from "@quatico/websmith-api";
import { ErrorMessage, type Reporter, WarnMessage } from "@quatico/websmith-api";
import path from "node:path";
import type ts from "typescript";
import { type CompilationConfig } from "./CompilationConfig";

const updatePaths = (config: CompilationConfig, basePath: string, system: ts.System): CompilationConfig => {
    return {
        ...config,
        ...(config.addonsDir && { addonsDir: resolvePath(config.addonsDir, basePath, system) }),
        ...(config.profiles && {
            profiles: Object.fromEntries(Object.entries(config.profiles).map(([name, profile]) => [name, updateProfile(profile, basePath, system)])),
        }),
    };
};

const updateProfile = (profile: CompilationProfile, basePath: string, system: ts.System): CompilationProfile => {
    return {
        ...profile,
        ...(profile.tsConfig && { tsConfig: resolvePaths(profile.tsConfig, basePath, system) }),
    };
};

export const resolvePaths = (tsConfig: ts.CompilerOptions, basePath: string, system: ts.System): ts.CompilerOptions => {
    return {
        ...tsConfig,
        ...(tsConfig.outDir && { outDir: resolvePath(tsConfig.outDir, basePath, system) }),
        ...(tsConfig.paths && {
            paths: Object.fromEntries(
                Object.entries(tsConfig.paths).map(value => [value[0], value[1].map(cur => resolvePath(cur, basePath, system))])
            ),
        }),
    };
};

const resolvePath = (filePath: string, basePath: string, system: ts.System): string => {
    return path.isAbsolute(filePath) ? filePath : system.resolvePath(path.join(basePath, filePath));
};

export const resolveCompilationConfig = (configFilePath: string | undefined, reporter: Reporter, system: ts.System): CompilationConfig => {
    if (!configFilePath) {
        return {};
    }

    if (configFilePath) {
        const resolvedPath = system.resolvePath(configFilePath);
        if (!system.fileExists(resolvedPath)) {
            reporter.reportDiagnostic(new WarnMessage(`No configuration file found at ${resolvedPath}.`));
        } else {
            const content = system.readFile(resolvedPath);
            if (content) {
                const config = parse(content ?? "{}");
                const result = { ...updatePaths(config.config ?? config, path.dirname(resolvedPath), system) };
                if (result.profiles) {
                    Object.entries(result.profiles).forEach(([_name, profile]) => {
                        if (profile.addons?.length) {
                            profile.addons = [...(profile.addons ?? []), ...(result.addons ?? [])];
                        }
                        if (profile.depends?.length) {
                            profile.depends.forEach(dep => {
                                if (!result.profiles?.[dep]) {
                                    reporter.reportDiagnostic(new ErrorMessage(`Unknown profile '${dep}' in 'depends' of '${configFilePath}'.`));
                                }
                            });
                        }
                    });
                }
                return result;
            }
        }
    }
    return undefined;
};
