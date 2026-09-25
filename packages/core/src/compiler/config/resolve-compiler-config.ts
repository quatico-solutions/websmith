/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationConfig, type CompilationProfile, ErrorMessage, type Reporter } from "@quatico/websmith-api";
import { parse } from "comment-json";
import path from "node:path";
import type ts from "typescript";
import { isEsmModuleKind } from "../esm";

const updatePaths = (config: CompilationConfig, basePath: string, system: ts.System): CompilationConfig => {
    return {
        ...config,
        ...(config.addonsDir && { addonsDir: resolvePath(system, basePath, config.addonsDir) }),
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
        ...(tsConfig.outDir && { outDir: resolvePath(system, basePath, tsConfig.outDir) }),
        ...(tsConfig.rootDir && { rootDir: resolvePath(system, basePath, tsConfig.rootDir) }),
        ...(tsConfig.paths && {
            paths: Object.fromEntries(
                Object.entries(tsConfig.paths).map(value => [value[0], value[1].map(cur => resolvePath(system, basePath, cur))])
            ),
        }),
    };
};

export const resolvePath = (system: ts.System, basePath: string, relativePath = "") => {
    let filePath = basePath;
    if (relativePath) {
        if (path.isAbsolute(relativePath)) {
            filePath = relativePath;
        } else {
            filePath = removeOverlappingSegments(basePath, relativePath);
        }
    }
    return system.resolvePath(filePath);
};

const removeOverlappingSegments = (basePath: string, relativePath: string) => {
    const basePathSegments = basePath.split(path.sep).filter(it => it !== ".");
    const relativePathSegments = relativePath.split(path.sep).filter(it => it !== ".");
    const startIndex = basePathSegments.findIndex(it => it === relativePathSegments[0]);
    const overlappingSegments = [];
    if (startIndex >= 0) {
        for (let i = 0; i < basePathSegments.length - startIndex; i++) {
            if (basePathSegments[i + startIndex] === relativePathSegments[i]) {
                overlappingSegments.push(relativePathSegments[i]);
            } else {
                break;
            }
        }

        return path.join(basePathSegments.slice(0, -overlappingSegments.length).join(path.sep), relativePathSegments.join(path.sep));
    }
    return path.join(basePathSegments.join(path.sep), relativePathSegments.join(path.sep));
};

const ESM_RUNTIMES = ["node", "bundler"];
const ESM_CHECK_LEVELS = ["error", "warn", "off"];

const validateEsm = (name: string, profile: CompilationProfile, configFilePath: string, reporter: Reporter): void => {
    const { runtime, check, ignore } = profile.esm ?? {};
    if (runtime === undefined) {
        reporter.reportDiagnostic(
            new ErrorMessage(`Missing 'esm.runtime' in profile '${name}' of '${configFilePath}'. Expected "node" or "bundler".`)
        );
    } else if (!ESM_RUNTIMES.includes(runtime)) {
        reporter.reportDiagnostic(
            new ErrorMessage(`Unknown 'esm.runtime' value '${runtime}' in profile '${name}' of '${configFilePath}'. Expected "node" or "bundler".`)
        );
    }
    if (check !== undefined && !ESM_CHECK_LEVELS.includes(check)) {
        reporter.reportDiagnostic(
            new ErrorMessage(`Unknown 'esm.check' value '${check}' in profile '${name}' of '${configFilePath}'. Expected "error", "warn" or "off".`)
        );
    }
    if (ignore !== undefined && !(Array.isArray(ignore) && ignore.every(cur => typeof cur === "string"))) {
        reporter.reportDiagnostic(
            new ErrorMessage(`Invalid 'esm.ignore' in profile '${name}' of '${configFilePath}'. Expected an array of glob pattern strings.`)
        );
    }
    const module = profile.tsConfig?.module;
    if (!isEsmModuleKind(module)) {
        reporter.reportDiagnostic(
            new ErrorMessage(
                `Profile '${name}' of '${configFilePath}' sets 'esm', but its 'tsConfig.module' is '${module}'. ` +
                    `Use an ES module format such as "ESNext" or "NodeNext", or remove 'esm'.`
            )
        );
    }
};

export const resolveCompilationConfig = (configFilePath: string | undefined, reporter: Reporter, system: ts.System): CompilationConfig => {
    if (!configFilePath) {
        return {};
    }

    const resolvedPath = system.resolvePath(configFilePath);
    if (!system.fileExists(resolvedPath)) {
        reporter.reportDiagnostic(new ErrorMessage(`No configuration file found at "${resolvedPath}".`));
    } else {
        const content = system.readFile(resolvedPath);
        if (content) {
            const config = parse(content ?? "{}") as CompilationConfig;
            const result = { ...updatePaths(config, path.dirname(resolvedPath), system) };
            if (result.profiles) {
                Object.entries(result.profiles).forEach(([name, profile]) => {
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
                    if (profile.esm) {
                        validateEsm(name, profile, configFilePath, reporter);
                    }
                });
            }
            return result;
        }
    }
    return {};
};
