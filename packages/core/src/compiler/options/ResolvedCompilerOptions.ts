import { type CompilationProfile, type Reporter } from "@quatico/websmith-api";
import deepmerge from "deepmerge";
import path from "node:path";
import ts from "typescript";
import { parsedCommandLine, resolveCompilationConfig, resolvePaths, resolveProfile, type CompilationConfig } from "../config";
import { DefaultReporter } from "../DefaultReporter";
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
        const resolvedOptions = deepmerge<CompilerOptions>(options, loaderOptions ?? {});
        const {
            additionalArguments,
            buildDir,
            cliArgs,
            config,
            configFile,
            debug = false,
            profile,
            tsConfig,
            tsConfigFile,
            watch = false,
        } = resolvedOptions;
        this.buildDir = resolvePath(system, buildDir ?? DEFAULT_BUILD_DIR);
        this.tsConfigFile = resolvePath(system, tsConfigFile ?? path.join(path.dirname(this.buildDir), "tsconfig.json"));
        this.profile = resolveProfile(profile, this.config, this.reporter);
        const { outDir: profileOutdir } = getTsConfig(resolvedOptions, this.profile);
        const outDir = profileOutdir ?? tsConfig?.outDir;
        this.cliArgs = deepmerge<ts.ParsedCommandLine>(
            {
                ...(outDir && { options: { outDir: resolvePath(system, outDir) } }),
                fileNames: this.system.readDirectory(this.buildDir),
                errors: [],
            },
            deepmerge<ts.ParsedCommandLine>(parsedCommandLine(this.tsConfigFile, system), cliArgs ?? {})
        );
        this.configFile = configFile ?? this.cliArgs?.options?.configFilePath ?? this.cliArgs?.raw?.configFilePath;
        this.config = deepmerge<CompilationConfig>(resolveCompilationConfig(this.configFile, this.reporter, system), config ?? {});

        this.watch = watch;
        this.debug = debug;
        this.additionalArguments = additionalArguments;

        const projectDirectory =
            (configFile && path.dirname(configFile)) ?? (this.cliArgs.raw?.configFilePath && path.dirname(this.cliArgs.raw?.configFilePath));
        if (projectDirectory) {
            this.cliArgs.options = resolvePaths(this.cliArgs.options, projectDirectory, this.system);
        }

        this.tsConfig = deepmerge<ts.CompilerOptions>(getTsConfig(resolvedOptions), this.cliArgs?.options ?? {});
        if (this.profile) {
            this.tsConfig = deepmerge<ts.CompilerOptions>(this.tsConfig, getTsConfig(resolvedOptions, this.profile));
        }
        if (this.tsConfig?.sourceMap === false) {
            delete this.cliArgs?.options?.inlineSources;
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
            additionalArguments: this.additionalArguments,
            buildDir: this.buildDir,
            cliArgs: this.cliArgs,
            config: this.config,
            configFile: this.configFile,
            debug: this.debug,
            profile: this.profile,
            reporter: this.reporter,
            tsConfig: this.tsConfig,
            tsConfigFile: this.tsConfigFile,
            watch: this.watch,
        };
        if (profile) {
            return { ...options, tsConfig: getTsConfig(options, this.profile) };
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
    const { tsConfig, config, profile, cliArgs } = options;
    const profileConfig = getProfile(profileName ?? profile, config);
    return {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.Latest,
        ...deepmerge<ts.CompilerOptions>(deepmerge<ts.CompilerOptions>(tsConfig ?? {}, cliArgs?.options ?? {}), profileConfig?.tsConfig ?? {}),
    };
};

const getProfile = (name?: string, config?: CompilationConfig): CompilationProfile => {
    if (config && name) {
        const { profiles = {} } = config;
        return profiles[name] ?? {};
    }
    return {};
};

export const resolvePath = (fs: ts.System, ...pathSegments: string[]) => {
    let resolvedPath = path.join(...pathSegments);
    if (!path.isAbsolute(resolvedPath)) {
        resolvedPath = path.join(fs.getCurrentDirectory(), ...pathSegments);
    }
    return resolvedPath;
};
