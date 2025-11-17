/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import {
    TSC_ARGUMENT_KEYS,
    type CompilationConfig,
    type CompilationProfile,
    type CompilerOptions,
    type Reporter,
    type TscArgumentKey,
    type WebpackLoaderOptions,
} from "@quatico/websmith-api";
import deepmerge, { type ArrayMergeOptions } from "deepmerge";
import path from "node:path";
import type ts from "typescript";
import type { CompilerOptionsValue } from "typescript";
import { parsedCommandLine, resolveCompilationConfig, resolvePath, resolvePaths, resolveProfile } from "../config";
import { DefaultReporter } from "../DefaultReporter";
import { tsDefaults } from "../defaults";

const DEFAULT_BUILD_DIR = "./";
const DEFAULT_TSCONFIG_FILE = "tsconfig.json";

type ResolvedPaths = {
    tsConfigFile?: string;
    configFile?: string;
};

/**
 * Resolves buildDir, tsConfigFile, and configFile according to the following rules:
 */
const resolvePathsWithRules = (
    system: ts.System,
    options: {
        tsConfigFile?: string;
        configFile?: string;
    }
): ResolvedPaths => {
    const { tsConfigFile, configFile } = options;

    // Rule 1: Default values when nothing is specified
    if (!tsConfigFile && !configFile) {
        return {
            tsConfigFile: resolvePath(system, DEFAULT_BUILD_DIR, DEFAULT_TSCONFIG_FILE),
        };
    }

    // Rule 2: Only tsConfigFile specified
    if (tsConfigFile && !configFile) {
        const resolvedTsConfigFile = resolvePath(system, tsConfigFile);
        return {
            tsConfigFile: resolvedTsConfigFile,
        };
    }

    // Rule 4: Only configFile specified
    if (!tsConfigFile && configFile) {
        const resolvedConfigFile = resolvePath(system, configFile);
        const configDir = path.dirname(resolvedConfigFile);
        return {
            tsConfigFile: resolvePath(system, configDir, DEFAULT_TSCONFIG_FILE),
            configFile: resolvedConfigFile,
        };
    }

    // For other combinations, start with provided values
    const resolvedTsConfigFile = tsConfigFile ? resolvePath(system, tsConfigFile) : undefined;
    const resolvedConfigFile = configFile ? resolvePath(system, configFile) : undefined;

    return {
        tsConfigFile: resolvedTsConfigFile,
        configFile: resolvedConfigFile,
    };
};

export class ResolvedCompilerOptions implements CompilerOptions {
    /** Path to the websmith configuration files, e.g., 'websmith.config.json'. */
    public readonly configFile?: string;
    /** The websmith configuration. */
    public readonly config?: CompilationConfig;
    public readonly debug?: boolean;
    /** Path to the TSC configuration file, e.g., 'tsconfig.json'. */
    public readonly tsConfigFile?: string;
    /** The TSC configuration. */
    public readonly tsConfig?: ts.CompilerOptions;
    public readonly profile?: string;
    public readonly buildDir: string;
    public readonly cliArgs: ts.ParsedCommandLine;
    public readonly reporter: Reporter;
    public readonly watch?: boolean;
    public readonly additionalArguments?: Record<string, unknown>;
    /** Instance name for webpack loader. */
    public readonly instanceName?: string;
    /** Profiles configuration from loader options. */
    public readonly profiles?: Record<string, CompilationProfile>;

    constructor(
        private system: ts.System,
        options: CompilerOptions,
        loaderOptions?: WebpackLoaderOptions
    ) {
        this.reporter = options.reporter ?? new DefaultReporter(this.system);
        const compilationConfig = loadCompilationConfig(options, loaderOptions ?? {}, this.reporter, this.system);
        let resolvedOptions = deepmerge<CompilerOptions>(
            {
                ...options,
                config: { ...options.config, ...compilationConfig },
                tsConfig: options.tsConfig,
                cliArgs: {
                    options: {
                        // Filter existing cliArgs.options to only include TSC arguments
                        ...(options.cliArgs?.options
                            ? Object.entries(options.cliArgs.options).reduce(
                                  (acc: ts.ParsedCommandLine["options"], [key, value]: [string, unknown]) => {
                                      if (TSC_ARGUMENT_KEYS.includes(key as TscArgumentKey)) {
                                          acc[key] = value as CompilerOptionsValue;
                                          if (key === "debug" && value === true) {
                                              acc["listFiles"] = true;
                                          }
                                      }
                                      return acc;
                                  },
                                  {} as ts.ParsedCommandLine["options"]
                              )
                            : {}),
                    },
                    fileNames: options.cliArgs?.fileNames ?? [],
                    errors: options.cliArgs?.errors ?? [],
                } as ts.ParsedCommandLine,
            },
            loaderOptions ?? {},
            {
                arrayMerge,
            }
        );
        const {
            cliArgs = { options: {}, fileNames: [], errors: [] },
            config,
            configFile,
            debug = false,
            tsConfig,
            tsConfigFile = cliArgs?.options?.project ?? tsConfig?.project,
            watch = false,
        } = resolvedOptions;
        this.watch = watch;
        this.debug = debug;
        // TODO: Workaround for the missing 'additionalArguments' after deepmerge
        this.additionalArguments = options.additionalArguments;
        // Set loader-specific properties from resolvedOptions (which contains merged options)
        this.instanceName = (resolvedOptions as { instanceName?: string }).instanceName;
        this.profiles = (resolvedOptions as { profiles?: Record<string, CompilationProfile> }).profiles;

        // Resolve paths according to the defined rules
        const resolvedPaths = resolvePathsWithRules(this.system, { tsConfigFile, configFile });

        this.tsConfigFile = resolvedPaths.tsConfigFile;
        this.configFile = resolvedPaths.configFile;

        this.buildDir =
            (this.tsConfigFile && path.dirname(this.tsConfigFile)) ??
            (this.configFile && path.dirname(this.configFile)) ??
            this.system.getCurrentDirectory();

        this.config = deepmerge<CompilationConfig>(compilationConfig, config ?? {}, { arrayMerge });

        // profiles
        const profileName = loaderOptions?.profile ?? options.profile;

        if (this.config?.addonsDir) {
            this.config.addonsDir = resolvePath(this.system, this.buildDir, this.config.addonsDir);
        }
        // resolve tsconfig
        this.profile = resolveProfile(profileName, this.config, this.reporter);
        resolvedOptions = { ...resolvedOptions, tsConfigFile: this.tsConfigFile };
        this.tsConfig = getTsConfig(this.system, this.buildDir, resolvedOptions, this.profile);

        // resolve cli args
        if (this.buildDir) {
            cliArgs.options = resolvePaths(cliArgs.options ?? {}, this.buildDir, this.system);
        }
        const { outDir: profileOutDir, rootDir: profileRootDir } = this.tsConfig;
        // Prioritize CLI outDir over profile outDir
        const outDir = cliArgs?.options?.outDir
            ? resolvePath(this.system, this.buildDir, cliArgs.options.outDir)
            : (profileOutDir ?? tsConfig?.outDir)
              ? resolvePath(this.system, this.buildDir, profileOutDir ?? tsConfig?.outDir)
              : undefined;
        const rootDir =
            (profileRootDir ?? tsConfig?.rootDir) ? resolvePath(this.system, this.buildDir, profileRootDir ?? tsConfig?.rootDir) : undefined;

        const premergedCliArgs = {
            ...(cliArgs ?? {}),
            options: { ...(cliArgs?.options ?? {}), ...(outDir && { outDir }), ...(rootDir && { rootDir }) },
        };

        // Get the parsed command line from tsconfig.json which includes proper file discovery
        const parsedTsConfig =
            this.tsConfigFile && this.system.fileExists(this.tsConfigFile) ? parsedCommandLine(this.tsConfigFile, {}, this.system) : {};

        // Determine if we should use CLI files or tsconfig file discovery
        const useCliFiles = cliArgs?.fileNames?.length > 0;
        const finalFileNames = useCliFiles
            ? cliArgs.fileNames.map(fileName => this.system.resolvePath(fileName))
            : (parsedTsConfig as ts.ParsedCommandLine)?.fileNames || [];

        const baseCliArgs = deepmerge<ts.ParsedCommandLine>(
            parsedTsConfig,
            {
                options: {
                    ...(outDir && { outDir }),
                    ...(this.tsConfig && { ...this.tsConfig }),
                },
            },
            { arrayMerge }
        );

        // When CLI files are provided, replace fileNames instead of merging
        this.cliArgs = {
            ...baseCliArgs,
            ...premergedCliArgs,
            // Ensure all tsconfig options are included in cliArgs.options
            options: {
                ...baseCliArgs.options, // This includes all tsconfig options from parsedTsConfig
                ...premergedCliArgs.options, // This includes CLI-specific options like outDir, rootDir
            },
            fileNames: finalFileNames,
            errors: [],
            // Explicitly set the raw.configFilePath for webpack loader access
            raw: {
                ...baseCliArgs.raw,
                ...premergedCliArgs.raw,
                ...(this.tsConfigFile && { configFilePath: this.tsConfigFile }),
            },
        };
        this.tsConfig = deepmerge<ts.CompilerOptions>(this.tsConfig, this.cliArgs?.options ?? {}, { arrayMerge });

        if (this.tsConfig?.sourceMap === false) {
            delete this.tsConfig?.inlineSources;
            delete this.cliArgs?.options?.inlineSources;
        }
    }

    public getAddons(profileName?: string): string[] {
        const targetProfile = profileName ?? this.profile;
        // If a specific profile is requested, prioritize profile addons over CLI addons
        if (targetProfile) {
            const selectedProfiles = this.getSelectedProfiles(targetProfile);
            const addons = selectedProfiles.flatMap(name => {
                const profile = getProfile(name, this.config);
                return Array.isArray(profile?.addons) ? profile.addons : [];
            });
            return [...(Array.isArray(this.config?.addons) ? this.config.addons : []), ...(Array.isArray(addons) ? addons : [])];
        }

        // No profile requested - return CLI addons if available, otherwise config addons
        if (this.config?.addons?.length) {
            return this.config.addons;
        }
        return [];
    }

    public getOptions(profile?: string): CompilerOptions {
        const options = {
            ...(this.additionalArguments && { additionalArguments: this.additionalArguments }),
            buildDir: this.buildDir,
            cliArgs: this.cliArgs,
            ...(this.config && { config: this.config }),
            ...(this.configFile && { configFile: this.configFile }),
            ...(this.debug && { debug: this.debug }),
            ...(this.profile && { profile: this.profile }),
            reporter: this.reporter,
            ...(this.tsConfig && { tsConfig: this.tsConfig }),
            ...(this.tsConfigFile && { tsConfigFile: this.tsConfigFile }),
            ...(this.watch && { watch: this.watch }),
        };
        if (profile) {
            // Create base options with tsConfig so profile options can merge with it
            const baseOptions = {
                config: this.config,
                tsConfig: this.tsConfig, // Include base tsConfig so profile options can merge with it
                tsConfigFile: this.tsConfigFile,
                profile: this.profile,
            };
            const profileTsConfig = getTsConfig(this.system, this.buildDir, baseOptions, profile);
            // Create cliArgs with profile-specific outDir overriding CLI outDir
            const profileCliArgs = this.cliArgs
                ? {
                      ...this.cliArgs,
                      options: {
                          ...this.cliArgs.options,
                          ...profileTsConfig,
                      },
                  }
                : this.cliArgs;

            return {
                ...options,
                tsConfig: profileTsConfig,
                config: getProfile(profile, this.config),
                cliArgs: profileCliArgs,
                profile,
            };
        }
        return options;
    }

    public getSelectedProfiles(profileName?: string): string[] {
        const existingProfiles = Object.keys(this.config?.profiles ?? {});
        const profile = profileName ?? this.profile;

        return getDependentProfiles(existingProfiles, profile, this.config).filter(cur => existingProfiles.includes(cur));
    }
}

const getDependentProfiles = (existingProfiles: string[], profileName?: string, config?: CompilationConfig): string[] => {
    const { profiles = {} } = config ?? {};
    const { depends = [] } = (profileName ? profiles[profileName] : {}) ?? {};

    const results = new Set<string>();
    // Add the current profile and recursively get its dependencies
    if (profileName && existingProfiles.includes(profileName)) {
        results.add(profileName);
    }
    for (let i = depends.length - 1; i >= 0; i--) {
        const cur = depends[i];
        if (existingProfiles.includes(cur)) {
            results.add(cur);
            // Recursively get dependencies of dependencies
            getDependentProfiles(existingProfiles, cur, config).forEach(dep => results.add(dep));
        }
    }

    return Array.from(results).reverse();
};

/**
 * Returns the resolved compiler options, optionally for the given profile. The ts.CompilerOptions are merged from the
 * tsconfig.json, the CLI arguments, the profile options.
 *
 * @returns Merged ts.CompilerOptions, where the profile options override the CLI options, which override the tsconfig.json options.
 */
const getTsConfig = (system: ts.System, projectDir: string, options: CompilerOptions, profileName?: string): ts.CompilerOptions => {
    const { tsConfig, config, profile, cliArgs, tsConfigFile } = options;
    const profileTsConfig = getDependentProfiles(Object.keys(options.config?.profiles ?? []), profileName ?? profile, options.config)
        .map(cur => getProfile(cur, config))
        .reduce((acc: ts.CompilerOptions, cur) => deepmerge<ts.CompilerOptions>(acc, cur.tsConfig ?? {}, { arrayMerge }), {});

    // Read tsconfig.json if it exists
    const tsConfigOptions = tsConfigFile && system.fileExists(tsConfigFile) ? (parsedCommandLine(tsConfigFile, {}, system).options ?? {}) : {};
    // CLI options
    const cliOptions = cliArgs?.options // filter out non-tsconfig options
        ? Object.entries(cliArgs.options).reduce(
              (acc: Record<string, unknown>, [key, value]) => {
                  if (TSC_ARGUMENT_KEYS.includes(key as TscArgumentKey)) {
                      acc[key] = value;
                  }
                  return acc;
              },
              {} as Record<string, unknown>
          )
        : {};

    // When a profile is specified, merge base tsConfig with profile options instead of overriding
    const baseTsConfig = tsConfig ?? {};
    const mergedTsConfig = profileName ? deepmerge<ts.CompilerOptions>(baseTsConfig, profileTsConfig, { arrayMerge }) : baseTsConfig;

    return {
        ...tsDefaults,
        ...(tsConfigFile && { configFilePath: resolvePath(system, projectDir, tsConfigFile) }),
        ...tsConfigOptions, // tsconfig.json options
        ...mergedTsConfig, // Profile options merged with base tsConfig
        ...cliOptions, // CLI options override everything
    };
};

const getProfile = (name?: string, config?: CompilationConfig): CompilationProfile => {
    if (config && name) {
        const { profiles = {} } = config;
        return profiles[name] ?? {};
    }
    return {};
};

/**
 * Merges two arrays and removes duplicates.
 *
 * @param target - The target array.
 * @param source - The source array.
 * @returns A new array that is the result of merging the target and source arrays and removing duplicates.
 */
export const arrayMerge = (target: unknown[], source: unknown[], _options?: ArrayMergeOptions) => {
    const targetArray = Array.isArray(target) ? target : [];
    const sourceArray = Array.isArray(source) ? source : [];
    return [...new Set([...sourceArray, ...targetArray])];
};

const loadCompilationConfig = (
    options: CompilerOptions,
    loaderOptions: WebpackLoaderOptions,
    reporter: Reporter,
    system: ts.System
): CompilationConfig => {
    // Prefer config values from webpack loaderConfig, but fallback to values from websmith.config.json
    const { configFile = loaderOptions.configFile ?? options.configFile, transpileOnly } = loaderOptions;
    const addons = loaderOptions.config?.addons ?? options.config?.addons ?? [];
    const addonsDir = loaderOptions.config?.addonsDir ?? options.config?.addonsDir;
    let results: CompilationConfig = {
        ...(addons.length && { addons }),
        ...(!!addonsDir && { addonsDir }),
        ...(!!transpileOnly && { transpileOnly }),
    };
    if (configFile) {
        results = { ...resolveCompilationConfig(configFile, reporter, system), ...results };
    }
    return results;
};
