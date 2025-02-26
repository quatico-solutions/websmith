import { type Reporter } from "@quatico/websmith-api";
import type ts from "typescript";
import { type CompilationConfig } from "../config";
import { type WebpackLoaderOptions } from "./WebpackLoaderOptions";
import { type CompilerOptions } from "./CompilerOptions";
export class ResolvedCompilerOptions implements CompilerOptions {
    public readonly configFile?: string | undefined;
    public readonly config?: CompilationConfig | undefined;
    public readonly debug?: boolean | undefined;
    public readonly tsConfigFile?: string | undefined;
    public readonly tsConfig?: ts.CompilerOptions | undefined;
    public readonly profile?: string | undefined;
    public readonly buildDir: string;
    public readonly cliArgs: ts.ParsedCommandLine;
    public readonly reporter: Reporter;
    public readonly watch?: boolean | undefined;
    public readonly additionalArguments?: Map<string, unknown> | undefined;

    constructor(
        private options: CompilerOptions,
        private addons?: string[],
        private loaderOptions?: WebpackLoaderOptions
    ) {
        this.configFile = options.configFile;
        this.config = options.config;
        this.debug = options.debug;
        this.tsConfigFile = options.tsConfigFile;
        this.tsConfig = options.tsConfig;
        this.profile = options.profile;
        this.buildDir = options.buildDir;
        this.cliArgs = options.cliArgs;
        this.reporter = options.reporter;
        this.watch = options.watch;
        this.additionalArguments = options.additionalArguments;
    }

    public getOptions(): CompilerOptions {
        return { ...this.options, ...this.loaderOptions };
    }

    public getAddons(): string[] {
        return this.addons ?? [];
    }
}
