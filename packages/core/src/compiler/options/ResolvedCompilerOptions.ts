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
    constructor(
        private system: ts.System,
        options: Partial<CompilerOptions>,
        private addons?: string[],
        loaderOptions?: WebpackLoaderOptions
    ) {
        this.reporter = options.reporter ?? new DefaultReporter(this.system);
        let resolvedOptions = deepmerge<CompilerOptions>(options, loaderOptions ?? {});
        const { buildDir, cliArgs, config, configFile, debug = false, profile, tsConfig, tsConfigFile, watch = false } = resolvedOptions;
        this.watch = watch;
        this.debug = debug;
        // TODO: Workaround for the missing 'additionalArguments' after deepmerge
        this.additionalArguments = options.additionalArguments;
        this.buildDir = resolvePath(this.system, buildDir ?? DEFAULT_BUILD_DIR);

        // resolve tsconfig
        const tsConfigFilePath = tsConfigFile ?? cliArgs?.options?.configFilePath ?? cliArgs?.raw?.configFilePath;
        this.tsConfigFile = tsConfigFilePath ? resolvePath(this.system, tsConfigFilePath) : undefined;
        resolvedOptions = { ...resolvedOptions, tsConfigFile: this.tsConfigFile };
        this.tsConfig = getTsConfig(resolvedOptions);
        if (profile) {
            this.tsConfig = deepmerge<ts.CompilerOptions>(this.tsConfig, getTsConfig(resolvedOptions, profile), { arrayMerge });
        }

        // resolve websmith config
        this.configFile = configFile;
        this.config = deepmerge<CompilationConfig>(resolveCompilationConfig(this.configFile, this.reporter, this.system), config ?? {}, {
            arrayMerge,
        });

        // resolve cli args
        this.profile = resolveProfile(profile, this.config, this.reporter);
        const { outDir: profileOutdir } = getTsConfig(resolvedOptions, this.profile);
        const outDir = profileOutdir ?? tsConfig?.outDir;
        const premergedCliArgs = { ...(cliArgs ?? {}), options: { ...(cliArgs?.options ?? {}), outDir } };
        this.cliArgs = deepmerge<ts.ParsedCommandLine>(
            {
                options: {
                    ...(outDir && { outDir }),
                    ...(this.tsConfig && { ...this.tsConfig }),
                },
                fileNames: cliArgs?.fileNames?.length
                    ? cliArgs.fileNames
                    : recursiveFindByFilter(this.system.resolvePath(this.buildDir), undefined, this.system),
                errors: [],
            },
            this.tsConfigFile
                ? deepmerge<ts.ParsedCommandLine>(parsedCommandLine(this.tsConfigFile, {}, system), premergedCliArgs, { arrayMerge })
                : premergedCliArgs,
            { arrayMerge }
        );

        if (this.tsConfig?.sourceMap === false) {
            delete this.cliArgs?.options?.inlineSources;
        }

        // resolve project directory
        const projectDirectory =
            (configFile && path.dirname(configFile)) ?? (this.cliArgs.raw?.configFilePath && path.dirname(this.cliArgs.raw?.configFilePath));
        if (projectDirectory) {
            this.cliArgs.options = resolvePaths(this.cliArgs.options, projectDirectory, this.system);
        }
    }

    get projectDir(): string {
        return path.dirname(this.configFile ?? this.cliArgs?.raw?.configFilePath ?? this.system.getCurrentDirectory());
    }

    public getAddons(profileName?: string): string[] {
        if (this.addons?.length) {
            return this.addons;
        }
        const targetProfile = profileName ?? this.profile;
        const addons = this.getSelectedProfiles(targetProfile).flatMap(name => getProfile(name, this.config)?.addons ?? []);
        return [...(this.config?.addons ?? []), ...(addons ?? [])];
    }

    // public getAddonConfig(): AddonConfig {
    //     return addonConfig(command, compilationConfig, options),
    // }

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
            const profileTsConfig = getTsConfig(options, profile);
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
 * @param options Provided websmith compiler options.
 * @param profileName Given profile name.
 * @returns Merged ts.CompilerOptions, where the profile options override the CLI options, which override the tsconfig.json options.
 */
const getTsConfig = (options: CompilerOptions, profileName?: string): ts.CompilerOptions => {
    const { tsConfig, config, profile, cliArgs, tsConfigFile } = options;
    const profileConfig = getProfile(profileName ?? profile, config);
    return {
        ...(tsConfigFile && { configFilePath: tsConfigFile }),
        ...tsDefaults,
        ...deepmerge<ts.CompilerOptions>(
            deepmerge<ts.CompilerOptions>(tsConfig ?? {}, cliArgs?.options ?? {}, { arrayMerge }),
            profileConfig?.tsConfig ?? {},
            { arrayMerge }
        ),
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
