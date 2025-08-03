/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { TSC_ARGUMENT_KEYS, type CompilationProfile, type Reporter, type TscArgumentKey } from "@quatico/websmith-api";
import deepmerge, { type ArrayMergeOptions } from "deepmerge";
import path from "node:path";
import ts, { type CompilerOptionsValue } from "typescript";
import { recursiveFindByFilter } from "../../environment";
import { parsedCommandLine, resolveCompilationConfig, resolvePath, resolvePaths, resolveProfile, type CompilationConfig } from "../config";
import { DefaultReporter } from "../DefaultReporter";
import { tsDefaults } from "../defaults";
import { type CompilerOptions } from "./CompilerOptions";
import { type WebpackLoaderOptions } from "./WebpackLoaderOptions";

const DEFAULT_BUILD_DIR = "./";
const DEFAULT_TSCONFIG_FILE = "tsconfig.json";
const DEFAULT_CONFIG_FILE = "websmith.config.json";
const TS_DEFAULTS = {
    allowJs: false,
    checkJs: false,
    declaration: false,
    declarationMap: false,
    emitDecorationOnly: false,
    esModuleInterop: false,
    noEmit: false,
    pretty: true,
    removeComments: false,
    strict: false,
    target: ts.ScriptTarget.ES5,
};

type ResolvedPaths = {
    buildDir: string;
    tsConfigFile?: string;
    configFile?: string;
};

/**
 * Resolves buildDir, tsConfigFile, and configFile according to the following rules:
 * 1. Default values: buildDir = "./", tsConfigFile = "./tsconfig.json", configFile = "./websmith.config.json"
 * 2. If buildDir specified but not others: derive tsConfigFile and configFile from buildDir
 * 3. If tsConfigFile specified but not buildDir/configFile: use dirname of tsConfigFile for both
 * 4. If configFile specified but not buildDir/tsConfigFile: use dirname of configFile for both
 * 5. If all specified but tsConfigFile uses different location than buildDir: buildDir = dirname(tsConfigFile) + warning
 * 6. configFile can be in different location from buildDir and tsConfigFile
 */
const resolvePathsWithRules = (
    system: ts.System,
    options: {
        buildDir?: string;
        tsConfigFile?: string;
        configFile?: string;
    },
    reporter?: Reporter
): ResolvedPaths => {
    const { buildDir, tsConfigFile, configFile } = options;

    // Rule 1: Default values when nothing is specified
    if (!buildDir && !tsConfigFile && !configFile) {
        return {
            buildDir: resolvePath(system, DEFAULT_BUILD_DIR),
            tsConfigFile: resolvePath(system, DEFAULT_BUILD_DIR, DEFAULT_TSCONFIG_FILE),
            configFile: resolvePath(system, DEFAULT_BUILD_DIR, DEFAULT_CONFIG_FILE),
        };
    }

    // Rule 2: Only buildDir specified
    if (buildDir && !tsConfigFile && !configFile) {
        const resolvedBuildDir = resolvePath(system, buildDir);
        return {
            buildDir: resolvedBuildDir,
            tsConfigFile: resolvePath(system, resolvedBuildDir, DEFAULT_TSCONFIG_FILE),
            configFile: resolvePath(system, resolvedBuildDir, DEFAULT_CONFIG_FILE),
        };
    }

    // Rule 3: Only tsConfigFile specified
    if (!buildDir && tsConfigFile && !configFile) {
        const resolvedTsConfigFile = resolvePath(system, tsConfigFile);
        const tsConfigDir = path.dirname(resolvedTsConfigFile);
        return {
            buildDir: tsConfigDir,
            tsConfigFile: resolvedTsConfigFile,
            configFile: resolvePath(system, tsConfigDir, DEFAULT_CONFIG_FILE),
        };
    }

    // Rule 4: Only configFile specified
    if (!buildDir && !tsConfigFile && configFile) {
        const resolvedConfigFile = resolvePath(system, configFile);
        const configDir = path.dirname(resolvedConfigFile);
        return {
            buildDir: configDir,
            tsConfigFile: resolvePath(system, configDir, DEFAULT_TSCONFIG_FILE),
            configFile: resolvedConfigFile,
        };
    }

    // For other combinations, start with provided values
    let resolvedBuildDir = buildDir ? resolvePath(system, buildDir) : resolvePath(system, DEFAULT_BUILD_DIR);
    let resolvedTsConfigFile = tsConfigFile ? resolvePath(system, tsConfigFile) : undefined;
    let resolvedConfigFile = configFile ? resolvePath(system, configFile) : undefined;

    // Rule 5: If tsConfigFile and buildDir are both specified but in different directories
    if (resolvedTsConfigFile && resolvedBuildDir) {
        const tsConfigDir = path.dirname(resolvedTsConfigFile);
        const normalizedBuildDir = path.resolve(resolvedBuildDir);
        const normalizedTsConfigDir = path.resolve(tsConfigDir);

        if (normalizedBuildDir !== normalizedTsConfigDir) {
            reporter?.reportDiagnostic({
                category: ts.DiagnosticCategory.Warning,
                code: 0,
                messageText: `The value for buildDir "${resolvedBuildDir}" differs from tsConfigFile directory "${tsConfigDir}". Using "tsConfigFile" directory as "buildDir".`,
                file: undefined,
                start: undefined,
                length: undefined,
            });
            resolvedBuildDir = tsConfigDir;
        }
    }

    // Fill in missing values based on resolved buildDir
    if (!resolvedTsConfigFile) {
        resolvedTsConfigFile = resolvePath(system, resolvedBuildDir, DEFAULT_TSCONFIG_FILE);
    }
    if (!resolvedConfigFile) {
        resolvedConfigFile = resolvePath(system, resolvedBuildDir, DEFAULT_CONFIG_FILE);
    }

    return {
        buildDir: resolvedBuildDir,
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
    public readonly reporter: Reporter;
    public readonly watch?: boolean;
    public readonly additionalArguments?: Map<string, unknown>;
    public readonly cliArgs: ts.ParsedCommandLine;
    public readonly addons?: string[];
    public readonly addonsDir?: string;
    public readonly projectDir: string;

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
                tsConfig: { ...TS_DEFAULTS, ...options.tsConfig },
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
            buildDir,
            cliArgs = { options: {}, fileNames: [], errors: [] },
            config,
            configFile,
            debug = false,
            profile,
            tsConfig,
            tsConfigFile = cliArgs?.options?.project,
            watch = false,
        } = resolvedOptions;
        this.watch = watch;
        this.debug = debug;
        // TODO: Workaround for the missing 'additionalArguments' after deepmerge
        this.additionalArguments = options.additionalArguments;

        // Resolve paths according to the defined rules
        const resolvedPaths = resolvePathsWithRules(this.system, { buildDir, tsConfigFile, configFile }, this.reporter);

        this.buildDir = resolvedPaths.buildDir;
        this.tsConfigFile = resolvedPaths.tsConfigFile;
        this.configFile = resolvedPaths.configFile;

        this.projectDir =
            (this.configFile && path.dirname(this.configFile)) ??
            (this.tsConfigFile && path.dirname(this.tsConfigFile)) ??
            (cliArgs.raw?.configFilePath && path.dirname(cliArgs.raw?.configFilePath)) ??
            this.system.getCurrentDirectory();

        this.config = deepmerge<CompilationConfig>(compilationConfig, config ?? {}, { arrayMerge });

        // profiles
        const profileName = loaderOptions?.profile ?? options.profile;
        const existingProfiles = Object.keys(resolvedOptions.config?.profiles ?? {});
        const selectedProfiles = getDependentProfiles(existingProfiles, profileName, this.config).filter(cur => existingProfiles.includes(cur));

        // addons
        this.addonsDir = resolvePath(this.system, this.projectDir, this.config?.addonsDir ?? "./addons");
        this.addons = [
            ...(Array.isArray(this.config?.addons) ? this.config.addons : []),
            ...selectedProfiles
                .map(name => {
                    const profile = getProfile(name, this.config);
                    return Array.isArray(profile?.addons) ? profile.addons : [];
                })
                .flat(),
        ];

        // resolve tsconfig
        resolvedOptions = { ...resolvedOptions, tsConfigFile: this.tsConfigFile };
        this.tsConfig = getTsConfig(this.system, this.projectDir, resolvedOptions, profileName);

        // resolve cli args
        this.profile = resolveProfile(profile, this.config, this.reporter);
        if (this.projectDir) {
            cliArgs.options = resolvePaths(cliArgs.options ?? {}, this.projectDir, this.system);
        }
        const { outDir: profileOutDir, rootDir: profileRootDir } = getTsConfig(this.system, this.projectDir, resolvedOptions, this.profile);
        // Prioritize CLI outDir over profile outDir
        const outDir = cliArgs?.options?.outDir
            ? resolvePath(this.system, this.projectDir, cliArgs.options.outDir)
            : (profileOutDir ?? tsConfig?.outDir)
              ? resolvePath(this.system, this.projectDir, profileOutDir ?? tsConfig?.outDir)
              : undefined;
        const rootDir =
            (profileRootDir ?? tsConfig?.rootDir) ? resolvePath(this.system, this.projectDir, profileRootDir ?? tsConfig?.rootDir) : undefined;

        const premergedCliArgs = {
            ...(cliArgs ?? {}),
            options: { ...(cliArgs?.options ?? {}), ...(outDir && { outDir }), ...(rootDir && { rootDir }) },
        };

        this.cliArgs = deepmerge<ts.ParsedCommandLine>(
            deepmerge<ts.ParsedCommandLine>(
                this.tsConfigFile && this.system.fileExists(this.tsConfigFile) ? parsedCommandLine(this.tsConfigFile, {}, this.system) : {},
                {
                    options: {
                        ...(outDir && { outDir }),
                        ...(this.tsConfig && { ...this.tsConfig }),
                    },
                },
                { arrayMerge }
            ),
            {
                ...premergedCliArgs,
                fileNames: cliArgs?.fileNames?.length
                    ? cliArgs.fileNames.map(fileName => this.system.resolvePath(fileName))
                    : recursiveFindByFilter(this.system.resolvePath(this.buildDir), undefined, this.system),
                errors: [],
            },
            { arrayMerge }
        );
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
            const result = [...(Array.isArray(this.config?.addons) ? this.config.addons : []), ...(Array.isArray(addons) ? addons : [])];
            return result;
        }

        // No profile requested - return CLI addons if available, otherwise config addons
        if (this.addons?.length) {
            return this.addons;
        }
        const configAddons = Array.isArray(this.config?.addons) ? this.config.addons : [];
        return configAddons;
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
                buildDir: this.buildDir,
                config: this.config,
                tsConfig: this.tsConfig, // Include base tsConfig so profile options can merge with it
                tsConfigFile: this.tsConfigFile,
                profile: this.profile,
            };
            const profileTsConfig = getTsConfig(this.system, this.projectDir, baseOptions, profile);
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
