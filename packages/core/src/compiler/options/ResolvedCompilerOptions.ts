import { type CompilationProfile, type Reporter } from "@quatico/websmith-api";
import deepmerge, { type ArrayMergeOptions } from "deepmerge";
import path from "node:path";
import type ts from "typescript";
import { recursiveFindByFilter } from "../../environment";
import { parsedCommandLine, resolveCompilationConfig, resolvePath, resolvePaths, resolveProfile, type CompilationConfig } from "../config";
import { DefaultReporter } from "../DefaultReporter";
import { tsDefaults } from "../defaults";
import { type CompilerOptions } from "./CompilerOptions";
import { type WebpackLoaderOptions } from "./WebpackLoaderOptions";

const DEFAULT_BUILD_DIR = "./src";

export class ResolvedCompilerOptions implements CompilerOptions {
    public readonly configFile?: string;
    public readonly config?: CompilationConfig;
    public readonly debug?: boolean;
    public readonly tsConfigFile?: string;
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
        options: Partial<CompilerOptions>,
        addons?: string[],
        loaderOptions?: WebpackLoaderOptions
    ) {
        this.reporter = options.reporter ?? new DefaultReporter(this.system);
        const compilationConfig = loadCompilationConfig(options, loaderOptions ?? {}, this.reporter, this.system);
        let resolvedOptions = deepmerge<CompilerOptions>({ ...options, config: { ...options.config, ...compilationConfig } }, loaderOptions ?? {}, {
            arrayMerge,
        });
        const {
            buildDir,
            cliArgs = { options: {}, fileNames: [], errors: [] },
            config,
            configFile,
            debug = false,
            profile,
            tsConfig,
            tsConfigFile,
            watch = false,
        } = resolvedOptions;
        this.watch = watch;
        this.debug = debug;
        // TODO: Workaround for the missing 'additionalArguments' after deepmerge
        this.additionalArguments = options.additionalArguments;
        this.buildDir = resolvePath(this.system, buildDir ?? DEFAULT_BUILD_DIR);

        this.projectDir =
            (configFile && path.dirname(configFile)) ??
            (tsConfigFile && path.dirname(tsConfigFile)) ??
            (cliArgs.raw?.configFilePath && path.dirname(cliArgs.raw?.configFilePath)) ??
            this.system.getCurrentDirectory();
        // resolve websmith config
        if (configFile) {
            this.configFile = resolvePath(this.system, this.projectDir, configFile);
        }
        if (this.configFile && this.system.fileExists(this.configFile)) {
            this.config = deepmerge<CompilationConfig>(resolveCompilationConfig(this.configFile, this.reporter, this.system), config ?? {}, {
                arrayMerge,
            });
        } else {
            this.config = config ?? {};
        }
        this.tsConfigFile = tsConfigFile ? resolvePath(this.system, this.projectDir, tsConfigFile) : undefined;

        // profiles
        const profileName = loaderOptions?.profile ?? options.profile;
        const existingProfiles = Object.keys(resolvedOptions.config?.profiles ?? {});
        const selectedProfiles = getDependentProfiles(existingProfiles, profileName, this.config).filter(cur => existingProfiles.includes(cur));

        // addons
        this.addonsDir = resolvePath(this.system, this.projectDir, this.config?.addonsDir ?? "./addons");
        this.addons = addons?.length
            ? addons
            : [...(this.config?.addons ?? []), ...selectedProfiles.map(name => getProfile(name, this.config)?.addons ?? []).flat()];

        // resolve tsconfig
        resolvedOptions = { ...resolvedOptions, tsConfigFile: this.tsConfigFile };
        this.tsConfig = getTsConfig(this.system, this.projectDir, resolvedOptions);
        if (profile) {
            this.tsConfig = deepmerge<ts.CompilerOptions>(this.tsConfig, getTsConfig(this.system, this.projectDir, resolvedOptions, profile), {
                arrayMerge,
            });
        }

        // resolve cli args
        this.profile = resolveProfile(profile, this.config, this.reporter);
        if (this.projectDir) {
            cliArgs.options = resolvePaths(cliArgs.options ?? {}, this.projectDir, this.system);
        }
        const { outDir: profileOutDir, rootDir: profileRootDir } = getTsConfig(this.system, this.projectDir, resolvedOptions, this.profile);
        const outDir = (profileOutDir ?? tsConfig?.outDir) ? resolvePath(this.system, this.projectDir, profileOutDir ?? tsConfig?.outDir) : undefined;
        const rootDir =
            (profileRootDir ?? tsConfig?.rootDir) ? resolvePath(this.system, this.projectDir, profileRootDir ?? tsConfig?.rootDir) : undefined;

        const premergedCliArgs = {
            ...(cliArgs ?? {}),
            options: { ...(cliArgs?.options ?? {}), ...(outDir && { outDir }), ...(rootDir && { rootDir }) },
        };

        this.cliArgs = deepmerge<ts.ParsedCommandLine>(
            deepmerge<ts.ParsedCommandLine>(
                this.tsConfigFile && this.system.fileExists(this.tsConfigFile) ? parsedCommandLine(this.tsConfigFile, {}, system) : {},
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
        if (this.addons?.length) {
            return this.addons;
        }
        const targetProfile = profileName ?? this.profile;
        const addons = this.getSelectedProfiles(targetProfile).flatMap(name => getProfile(name, this.config)?.addons ?? []);
        return [...(this.config?.addons ?? []), ...(addons ?? [])];
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
            const profileTsConfig = getTsConfig(this.system, this.projectDir, options, profile);
            return {
                ...options,
                tsConfig: profileTsConfig,
                config: getProfile(profile, this.config),
                cliArgs: deepmerge<ts.ParsedCommandLine>(this.cliArgs, { options: profileTsConfig }, { arrayMerge }),
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
    for (const cur of depends.reverse()) {
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

    return {
        ...(tsConfigFile && { configFilePath: resolvePath(system, projectDir, tsConfigFile) }),
        ...tsDefaults,
        ...deepmerge<ts.CompilerOptions>(deepmerge<ts.CompilerOptions>(tsConfig ?? {}, cliArgs?.options ?? {}, { arrayMerge }), profileTsConfig, {
            arrayMerge,
        }),
    };
};

const getProfile = (name?: string, config?: CompilationConfig): CompilationProfile => {
    if (config && name) {
        const { profiles = {} } = config;
        return profiles[name] ?? {};
    }
    return {};
};

const arrayMerge = (target: unknown[], source: unknown[], _options?: ArrayMergeOptions) => arrayUnique(source.concat(target));

const arrayUnique = (array: unknown[]) => {
    const result = array.concat();
    for (let i = 0; i < result.length; ++i) {
        for (let j = i + 1; j < result.length; ++j) {
            if (result[i] === result[j]) {
                result.splice(j--, 1);
            }
        }
    }
    return result;
};

const loadCompilationConfig = (
    options: Partial<CompilerOptions>,
    loaderOptions: Partial<WebpackLoaderOptions>,
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
    if (configFile && system.fileExists(configFile)) {
        results = { ...resolveCompilationConfig(configFile, reporter, system), ...results };
    }
    return results;
};
