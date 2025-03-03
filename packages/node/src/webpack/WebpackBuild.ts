/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type WebsmithLoaderOptions } from "websmith-loader";
import { split } from "lodash";
import path from "node:path";
import tildify from "tildify";
import { type LoaderOptions as TsLoaderOptions } from "ts-loader/dist/interfaces";
import webpack, { type Configuration, type RuleSetRule } from "webpack";
import { CompileError } from "../CompileError";
import { parseNumberValues } from "../compiler-options";
import { Logger } from "../Logger";
import { webpackDefaults } from "./webpack-options";
import { parseReasonFromStats } from "./webpack-stats";

export class WebpackBuild {
    private logger: Logger;
    private stdout: string;
    private stderr: string;
    private failedAlready: boolean;
    private config: Configuration;
    private tsLoaderOptions?: Partial<TsLoaderOptions>;
    private websmithLoaderOptions?: WebsmithLoaderOptions;
    private outputFileSystem?: any;
    private inputFileSystem?: any;
    private watchFileSystem?: any;
    private intermediateFileSystem?: any;

    constructor(config?: Configuration) {
        this.logger = new Logger(`[webpack]`);
        this.stdout = "";
        this.stderr = "";
        this.failedAlready = false;
        this.config = { ...webpackDefaults, ...(config ?? {}) };
    }

    public getConfig(): Configuration {
        return this.config;
    }

    public setTsLoaderOptions(options?: Partial<TsLoaderOptions>): this {
        this.tsLoaderOptions = options;
        return this;
    }

    public getTsLoaderOptions() {
        return this.tsLoaderOptions;
    }

    public setWebsmithLoaderOptions(options?: WebsmithLoaderOptions): this {
        this.websmithLoaderOptions = options;
        return this;
    }

    public getWebsmithLoaderOptions() {
        return this.websmithLoaderOptions;
    }

    public setOutputFileSystem(fs: any): this {
        this.outputFileSystem = fs;
        return this;
    }

    public setInputFileSystem(fs: any): this {
        this.inputFileSystem = fs;
        return this;
    }

    public setWatchFileSystem(fs: any): this {
        this.watchFileSystem = fs;
        return this;
    }

    public setIntermediateFileSystem(fs: any): this {
        this.intermediateFileSystem = fs;
        return this;
    }

    public async build(entries?: string[]): Promise<string> {
        this.failedAlready = false;

        if (entries) {
            this.config.entry = entries;
        }
        this.config?.module?.rules?.forEach(rule => {
            if (isUseRuleSetRule(rule) && Array.isArray(rule.use)) {
                rule.use?.forEach(use => {
                    if (isRuleSetRule(use)) {
                        this.customizeRule(use);
                    }
                });
            } else if (isRuleSetRule(rule)) {
                this.customizeRule(rule);
            }
        });

        const result = await new Promise<string>((resolve, reject) => {
            try {
                this.createProcess(this.config, reject, resolve);
            } catch (error) {
                this.handleFailure(reject, `unexpected global catch`, new CompileError(error as Error));
            }
        });
        this.logger.log(`✔ Executed successfully.`);
        return result;
    }

    private customizeRule(rule: string | number | boolean | webpack.RuleSetRule | null | undefined) {
        if (isRuleSetRule(rule)) {
            if (this.tsLoaderOptions && rule?.loader?.includes("ts-loader")) {
                this.injectTsLoaderOptions(rule, this.tsLoaderOptions);
            }
            if (
                this.websmithLoaderOptions &&
                (rule?.loader?.includes("websmith-loader") || rule?.loader?.includes("packages/webpack/src/index.ts"))
            ) {
                this.injectWebsmithLoaderOptions(rule, this.websmithLoaderOptions);
            }
        }
    }

    private injectTsLoaderOptions(rule: webpack.RuleSetRule, options: Partial<TsLoaderOptions>) {
        if (options.compilerOptions) {
            options.compilerOptions = { ...parseNumberValues(options.compilerOptions) };
        }
        if (typeof rule.options === "object") {
            rule.options = { ...rule.options, ...options };
        } else {
            rule.options = { ...options };
        }
    }

    private injectWebsmithLoaderOptions(rule: webpack.RuleSetRule, options: WebsmithLoaderOptions) {
        if (typeof rule.options === "object") {
            rule.options = { ...rule.options, ...options };
        } else {
            rule.options = { ...options };
        }
    }

    private createProcess(webpackConfig: Configuration, reject: (reason?: unknown) => void, resolve: (value: string | PromiseLike<string>) => void) {
        const compiler = webpack(webpackConfig);
        if (this.outputFileSystem) {
            compiler.outputFileSystem = this.outputFileSystem;
        }
        if (this.inputFileSystem) {
            compiler.inputFileSystem = this.inputFileSystem;
        }
        if (this.watchFileSystem) {
            compiler.watchFileSystem = this.watchFileSystem;
        }
        if (this.intermediateFileSystem) {
            compiler.intermediateFileSystem = this.intermediateFileSystem;
        }
        compiler.run((err, stats) => {
            if (stats) {
                const data = stats.toString({ colors: true });
                split(data, "\n").forEach(line => {
                    if (!line.length) {
                        return;
                    }
                    if (line[0] === "/") {
                        line = tildify(line);
                    }
                    if (line.slice(-35) === "Starting incremental build...") {
                        this.logger.log("\n************************************");
                    }
                    this.logger.log(line);
                });
                this.stdout += data;
            }

            if (err || stats?.hasErrors()) {
                this.handleFailure(reject, 'Spawn: got event "err"', new CompileError(err ?? stats?.toString() ?? ""));
            }

            compiler.close(closeErr => {
                if (closeErr) {
                    this.handleFailure(reject, `Spawn: got event "exit" with error "${closeErr}"!`);
                } else {
                    resolve(this.stdout);
                }
            });
        });

        return compiler;
    }

    private handleFailure(reject: (error: CompileError) => void, reason: string, error?: CompileError) {
        if (this.failedAlready) {
            return;
        }

        error = error ?? new CompileError(`${parseReasonFromStats(this.stdout, this.stderr) || reason}`);
        error.setStdout(this.stdout).setStderr(this.stderr).setReason(reason);

        this.logger.error(`✖ Failure during webpack invocation: "${reason}"`);
        this.logger.error(error.message);

        error.message = this.logger.getMessage(`In directory '${path.parse(process.cwd()).base}' ${error.message}`);
        reject(error);
        this.failedAlready = true;
    }
}

const isRuleSetRule = (rule: unknown): rule is RuleSetRule => {
    return typeof rule === "object" && rule !== null && "loader" in rule;
};

const isUseRuleSetRule = (rule: unknown): rule is RuleSetRule => {
    return typeof rule === "object" && rule !== null && "use" in rule;
};
