/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationConfig, type CompilationProfile, ErrorMessage, type Reporter } from "@quatico/websmith-api";
import { parse } from "comment-json";
import path from "node:path";
import ts from "typescript";
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

// TypeScript error code for an option value outside its allowed names, e.g. module "NodeLatest"
export const TS_ERROR_CODE_INVALID_OPTION_VALUE = 6046;

/**
 * Converts option names in a profile's tsConfig, e.g. module "NodeNext", to the enum values TypeScript expects, as
 * tsconfig.json parsing does. Drops names TypeScript doesn't know and reports them if a reporter is given.
 */
const convertEnumOptions = (name: string, tsConfig: ts.CompilerOptions, configFilePath: string, reporter?: Reporter): ts.CompilerOptions =>
    Object.fromEntries(
        Object.entries(tsConfig).flatMap(([key, value]): [string, ts.CompilerOptionsValue][] => {
            if (typeof value !== "string") {
                return [[key, value as ts.CompilerOptionsValue]];
            }
            const { options, errors } = ts.convertCompilerOptionsFromJson({ [key]: value }, "");
            const error = errors.find(cur => cur.code === TS_ERROR_CODE_INVALID_OPTION_VALUE);
            if (error) {
                reporter?.reportDiagnostic(
                    new ErrorMessage(
                        `Invalid 'tsConfig.${key}' value '${value}' in profile '${name}' of '${configFilePath}'. ` +
                            ts.flattenDiagnosticMessageText(error.messageText, " ")
                    )
                );
                return [];
            }
            return [[key, typeof options[key] === "number" ? options[key] : value]];
        })
    );

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

/** Returns the given profile and the profiles it depends on, directly or transitively. */
const getUsedProfiles = (profile: string | undefined, config: CompilationConfig, result = new Set<string>()): Set<string> => {
    if (profile && !result.has(profile) && config.profiles?.[profile]) {
        result.add(profile);
        config.profiles[profile].depends?.forEach(dep => getUsedProfiles(dep, config, result));
    }
    return result;
};

const formatPosition = (err: unknown): string => {
    const { line, column } = (err ?? {}) as { line?: unknown; column?: unknown };
    // comment-json reports a 1-based line and a 0-based column.
    return typeof line === "number" && typeof column === "number" ? ` (line ${line}, column ${column + 1})` : "";
};

const formatReason = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err);
    return message.endsWith(".") ? message : `${message}.`;
};

/**
 * Reads the websmith configuration file. Reports configuration errors only for the selected profile and the profiles
 * it depends on, as other profiles don't take part in the compilation.
 */
export const resolveCompilationConfig = (
    configFilePath: string | undefined,
    reporter: Reporter,
    system: ts.System,
    profileName?: string
): CompilationConfig => {
    if (!configFilePath) {
        return {};
    }

    const resolvedPath = system.resolvePath(configFilePath);
    if (!system.fileExists(resolvedPath)) {
        reporter.reportDiagnostic(new ErrorMessage(`No configuration file found at "${resolvedPath}".`));
    } else {
        const content = system.readFile(resolvedPath);
        if (content) {
            let config: CompilationConfig;
            try {
                config = parse(content) as CompilationConfig;
            } catch (err: unknown) {
                reporter.reportDiagnostic(new ErrorMessage(`Invalid JSON in configuration file "${resolvedPath}"${formatPosition(err)}: ${formatReason(err)}`));
                return {};
            }
            const result = { ...updatePaths(config, path.dirname(resolvedPath), system) };
            if (result.profiles) {
                const usedProfiles = getUsedProfiles(profileName, result);
                Object.entries(result.profiles).forEach(([name, profile]) => {
                    const isUsed = usedProfiles.has(name);
                    if (profile.addons?.length) {
                        profile.addons = [...(profile.addons ?? []), ...(result.addons ?? [])];
                    }
                    if (isUsed && profile.depends?.length) {
                        profile.depends.forEach(dep => {
                            if (!result.profiles?.[dep]) {
                                reporter.reportDiagnostic(new ErrorMessage(`Unknown profile '${dep}' in 'depends' of '${configFilePath}'.`));
                            }
                        });
                    }
                    if (isUsed && profile.esm) {
                        validateEsm(name, profile, configFilePath, reporter);
                    }
                    if (profile.tsConfig) {
                        profile.tsConfig = convertEnumOptions(name, profile.tsConfig, configFilePath, isUsed ? reporter : undefined);
                    }
                });
            }
            return result;
        }
    }
    return {};
};
