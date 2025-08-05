/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { ErrorMessage, type Reporter } from "@quatico/websmith-api";
import deepmerge from "deepmerge";
import path from "node:path";
import ts from "typescript";
import { createCompileHost, createSystem, recursiveFindByFilter } from "../environment";
import type { AddonRegistry } from "./addons";
import type { FileCache } from "./cache";
import { concat } from "./collections";
import { CompilationContext } from "./compilation";
import { DefaultReporter } from "./DefaultReporter";
import { resolveCompilerOptions, type CompilerOptions, type ResolvedCompilerOptions, type WebpackLoaderOptions, arrayMerge } from "./options";

export type CompileFragment = {
    version: number;
    files: ts.OutputFile[];
    diagnostics?: ts.Diagnostic[];
};

type CompilationFragment = {
    ctx: CompilationContext;
    fileName: string;
    content: string;
};

export class Compiler {
    private system: ts.System;
    private options!: ResolvedCompilerOptions;
    private reporter!: Reporter;
    private contextMap = new Map<string, CompilationContext>();
    private configPath!: string;
    private addons?: AddonRegistry;
    private transpileOnly: boolean = false;
    private dependencyCallback?: (filePath: string) => void;
    private fileWatchers: ts.FileWatcher[] = [];

    constructor(
        options: Partial<CompilerOptions>,
        loaderOptions?: Partial<WebpackLoaderOptions>,
        system?: ts.System,
        addons?: AddonRegistry,
        dependencyCallback?: (filePath: string) => void
    ) {
        this.contextMap = new Map();
        this.addons = addons;
        this.system = system ?? createSystem();

        // Set the reporter from options, fallback to default
        this.reporter = options.reporter ?? new DefaultReporter(this.system);

        this.setOptions(options, loaderOptions);
        this.dependencyCallback = dependencyCallback;
        this.transpileOnly = this.options.config?.transpileOnly ?? false;
    }

    compile(): ts.EmitResult {
        const { profile, buildDir } = this.options;
        const selectedProfiles = profile ? this.options.getSelectedProfiles(profile) : [undefined];

        if (this.options.debug) {
            this.reporter.reportDiagnostic({
                category: ts.DiagnosticCategory.Message,
                code: 0,
                messageText: `Starting compilation with debug mode enabled`,
                file: undefined,
                start: undefined,
                length: undefined,
            });
            this.reporter.indent();
            this.reporter.reportDiagnostic({
                category: ts.DiagnosticCategory.Message,
                code: 0,
                messageText: `Project directory: ${buildDir}`,
                file: undefined,
                start: undefined,
                length: undefined,
            });
            this.reporter.reportDiagnostic({
                category: ts.DiagnosticCategory.Message,
                code: 0,
                messageText: `Configuration: ${this.getConfigSummary()}`,
                file: undefined,
                start: undefined,
                length: undefined,
            });
            this.reporter.reportDiagnostic({
                category: ts.DiagnosticCategory.Message,
                code: 0,
                messageText: `Selected profiles: ${selectedProfiles.length ? selectedProfiles.join(", ") : "<NONE>"}`,
                file: undefined,
                start: undefined,
                length: undefined,
            });
        }

        this.createProfileContextsIfNecessary();
        const profileOptions = this.options.getOptions(profile);
        const program = this.createProgram(profileOptions.tsConfig);

        if (this.options.debug) {
            this.reporter.reportDiagnostic({
                category: ts.DiagnosticCategory.Message,
                code: 0,
                messageText: `Created TypeScript program with ${program.getSourceFiles().length} source files`,
                file: undefined,
                start: undefined,
                length: undefined,
            });
        }

        const results: ts.EmitResult[] = [];
        selectedProfiles.forEach(curProfile => {
            if (this.options.debug) {
                this.reporter.reportDiagnostic({
                    category: ts.DiagnosticCategory.Message,
                    code: 0,
                    messageText: `Processing profile: ${curProfile ?? "default"}`,
                    file: undefined,
                    start: undefined,
                    length: undefined,
                });
                this.reporter.indent();
            }
            const ctx = this.getContext(curProfile);
            if (ctx) {
                results.push(this.report(program, this.emitResult(curProfile, ctx)));
            }
            if (this.options.debug) {
                this.reporter.unindent();
            }
        });

        if (this.options.debug) {
            this.reporter.reportDiagnostic({
                category: ts.DiagnosticCategory.Message,
                code: 0,
                messageText: `Compilation completed with ${results.length} results`,
                file: undefined,
                start: undefined,
                length: undefined,
            });
            this.reporter.unindent?.();
        }

        return results.filter(cur => !!cur).length < 1
            ? { emitSkipped: true, diagnostics: [] }
            : {
                  emitSkipped: !!results.find(cur => cur.emitSkipped) || false,
                  emittedFiles: concat(results.flatMap(cur => cur.emittedFiles ?? [])),
                  diagnostics: concat(results.flatMap(cur => cur.diagnostics)),
              };
    }

    watch(): this {
        this.createProfileContextsIfNecessary();

        if (typeof this.system.watchFile === "function") {
            const profiles = this.options.profile
                ? [...(this.options.config?.profiles?.[this.options.profile]?.depends ?? []), this.options.profile]
                : [];
            if (profiles.length) {
                this.getRootFiles().forEach(curFile => {
                    profiles.forEach(curProfile => this.emitSourceFile(curFile, curProfile, true));
                    this.registerWatch(curFile, profiles);
                });
            } else {
                this.getRootFiles().forEach(curFile => {
                    this.emitSourceFile(curFile, undefined, true);
                    this.registerWatch(curFile);
                });
            }
        } else {
            this.reporter.reportDiagnostic(new ErrorMessage(`Watching is not supported by ${this.system.constructor.name}.`));
        }
        return this;
    }

    closeAllWatchers(): this {
        this.fileWatchers.forEach(cur => cur.close());
        return this;
    }

    getAddonRegistry(): AddonRegistry | undefined {
        return this.addons;
    }

    setAddonRegistry(addons: AddonRegistry): this {
        this.addons = addons;
        return this;
    }

    getSystem(): ts.System {
        return this.system;
    }

    getOptions(): ResolvedCompilerOptions {
        return this.options;
    }

    setOptions(options: Partial<CompilerOptions>, loaderOptions?: Partial<WebpackLoaderOptions>): this {
        if (this.addons) {
            const registryConfig = this.addons.getConfig();
            const { addons, addonsDir } = registryConfig;

            if (addons || addonsDir) {
                const optionsConfig = options.config ?? {};
                const mergedConfig = deepmerge(optionsConfig, registryConfig, { arrayMerge });

                options = { ...options, config: mergedConfig };
            }
        }

        // Include the current reporter in the options to preserve it
        const optionsWithReporter = {
            ...options,
            reporter: this.reporter,
        };

        this.options = resolveCompilerOptions(this.system, optionsWithReporter, loaderOptions);

        return this;
    }

    getReporter(): Reporter {
        return this.reporter;
    }

    protected getContext(profile?: string): CompilationContext | undefined {
        if (profile) {
            return this.contextMap.get(profile);
        }
        const defaultCtx = this.contextMap.get("default");
        if (!defaultCtx) {
            this.contextMap.set("default", this.createCompilationContext());
        }
        return this.contextMap.get("default");
    }

    protected hasContext(profile?: string): boolean {
        return profile ? this.contextMap.has(profile) : true;
    }

    protected createProfileContextsIfNecessary(): this {
        const selectedProfiles = this.options.getSelectedProfiles();

        if (!selectedProfiles.length) {
            // Create default context in any case, context for default profile exists
            const defaultCtx = this.getContext()!;
            // Use the same logic as profile-based addon resolution for consistency
            const defaultAddons = this.options.getAddons();
            const resolvedAddons = defaultAddons
                .map(name => this.addons?.getAvailableAddons().find(addon => addon.getName() === name))
                .filter(addon => addon !== undefined);

            resolvedAddons.forEach(addon => addon.activate(defaultCtx));
        } else {
            selectedProfiles.forEach((profile: string) => {
                if (this.contextMap.has(profile)) {
                    return;
                }
                const ctx = this.createCompilationContext(profile);
                // Get all addons for all selected profiles (including dependencies)
                const profileAddons = this.options.getAddons(profile);
                // Reverse the addon order so current profile addons run before dependency addons
                // This ensures transformers chain correctly (e.g., foobar→CLIENT→SERVER)
                const resolvedAddons = profileAddons
                    .reverse()
                    .map(name => this.addons?.getAvailableAddons().find(addon => addon.getName() === name))
                    .filter(addon => addon !== undefined);

                resolvedAddons.forEach(addon => {
                    addon.activate(ctx);
                });
                this.contextMap.set(profile, ctx);
            });
        }
        return this;
    }

    protected createCompilationContext(profile?: string): CompilationContext {
        const { configFile, tsConfigFile, cliArgs, watch } = this.options;
        const selectedProfiles = this.options.getSelectedProfiles(profile);
        const profileOptions = this.options.getOptions(profile);

        // Get the profile-specific outDir from the profile options
        const profileOutDir = profileOptions.tsConfig?.outDir;
        const resolvedOutDir = profileOutDir ? this.system.resolvePath(profileOutDir) : undefined;

        // Create cliArgs with profile-specific outDir overriding CLI outDir
        const profileCliArgs = profileOptions.cliArgs
            ? {
                  ...profileOptions.cliArgs,
                  options: {
                      ...profileOptions.cliArgs.options,
                      ...(resolvedOutDir && { outDir: resolvedOutDir }),
                  },
              }
            : {
                  ...cliArgs,
                  options: {
                      ...cliArgs?.options,
                      ...(resolvedOutDir && { outDir: resolvedOutDir }),
                  },
              };

        return new CompilationContext({
            buildDir: this.options.buildDir,
            tsConfig: profileOptions.tsConfig ?? {},
            projectDir: path.dirname(configFile ?? tsConfigFile ?? cliArgs?.raw?.configFilePath ?? this.system.getCurrentDirectory()),
            system: this.system,
            cliArgs: profileCliArgs,
            rootFiles: this.getRootFiles(),
            reporter: this.reporter,
            ...(profile && { config: this.options.config?.profiles?.[profile]?.config }),
            profile,
            ...(watch && { watchCallback: (filePath: string) => this.registerWatch(filePath, selectedProfiles) }),
            registerDependencyCallback: this.dependencyCallback,
        });
    }

    protected emitSourceFile(fileName: string, profile?: string, writeFile = true, skipCache = false): CompileFragment {
        const filePath = this.system.resolvePath(fileName);
        const ctx = this.getContext(profile);
        const cache = ctx?.getCache();

        if (ctx && cache) {
            if (!skipCache && !cache.hasChanged(filePath)) {
                return { files: [], content: "", ...cache.getCachedFile(filePath) };
            }

            let content = this.system.readFile(fileName) ?? cache.getCachedFile(fileName)?.content ?? "";

            ctx.getGenerators().forEach(cur => cur(fileName, content));

            ctx.getProcessors().forEach(cur => (content = cur(fileName, content)));

            cache.updateSource(filePath, content);

            const result = this.processOutput(cache, this.transpile({ fileName, ctx, content }), writeFile, fileName, ctx);

            return result;
        }

        throw new Error(`No profile with name "${profile}" configured.`);
    }

    protected report(program: ts.Program, result: ts.EmitResult): ts.EmitResult {
        ts.getPreEmitDiagnostics(program)
            .concat(result.diagnostics)
            .filter(cur => program?.getProjectReferences?.()?.length || cur.file) // Filter out global diagnostics
            .forEach(cur => this.reporter.reportDiagnostic(cur));

        return result;
    }

    protected getDefinedProfiles(name?: string): string[] {
        const profiles = Object.keys(this.options.config?.profiles ?? {});
        if (!name) {
            return profiles;
        }
        const selectedProfiles = this.options.getSelectedProfiles(name);
        return profiles.filter(cur => selectedProfiles.includes(cur));
    }

    private emitResult(profile: string | undefined, ctx: CompilationContext): ts.EmitResult {
        const result: ts.EmitResult = { diagnostics: [], emitSkipped: false, emittedFiles: [] };

        for (const fileName of this.getRootFiles()) {
            const fragment = this.emitSourceFile(fileName, profile);
            if (fragment?.files.length > 0) {
                result.emittedFiles?.push(...fragment.files.map(cur => cur.name));
            } else {
                fragment.diagnostics?.forEach(diagnostic => this.reporter.reportDiagnostic(diagnostic));
                result.diagnostics = [...result.diagnostics, ...(fragment.diagnostics ?? [])];
                result.emitSkipped = !!fragment.diagnostics && fragment.diagnostics.length > 0 ? true : false;
            }
        }

        const files = this.getRootFiles();
        ctx.getResultProcessors().forEach(cur => cur(files));

        return result;
    }

    registerWatch(filePath: string, profileNames?: string[]): this {
        if (typeof this.system.watchFile !== "function") {
            this.reporter.reportDiagnostic(new ErrorMessage(`Watching is not supported by ${this.system.constructor.name}.`));
            return this;
        }

        this.fileWatchers.push(
            this.system.watchFile(
                filePath,
                fileName => {
                    if (!profileNames?.length) {
                        return fileName.match(/.*\.([tj]|m[tj]|c[tj])?sx?$/)
                            ? this.emitSourceFile(fileName, undefined, true, true)
                            : this.getContext()!
                                  .resolveDependency(fileName)
                                  .map(cur => this.emitSourceFile(cur, undefined, true, true));
                    } else {
                        return profileNames.forEach(profile =>
                            fileName.match(/.*\.([tj]|m[tj]|c[tj])?sx?$/)
                                ? this.emitSourceFile(fileName, profile, true, true)
                                : this.hasContext(profile) &&
                                  this.getContext(profile)!
                                      .resolveDependency(fileName)
                                      .map(cur => this.emitSourceFile(cur, profile, true, true))
                        );
                    }
                },
                50,
                {
                    // ts.watchFile / fs.watch / fs.watchFile have a bug with the FsEvent based watch, causing double firing.
                    // In addition, the ts.System.getModifiedTime will report incorrect timeStamps, making it impossible to prevent the double firing.
                    watchFile: ts.WatchFileKind.PriorityPollingInterval,
                    fallbackPolling: ts.PollingWatchKind.FixedInterval,
                }
            )
        );

        return this;
    }

    private getConfigSummary(): string {
        const profile = this.options.profile;
        const profileTsConfig = this.options.config?.profiles?.[profile ?? ""]?.tsConfig ?? {};

        const cliOutDir = this.options.cliArgs?.options?.outDir;
        const resolvedOutDir = cliOutDir ?? profileTsConfig.outDir ?? this.options.tsConfig?.outDir ?? "./lib";

        const cliTsConfig = this.options.cliArgs?.options;
        const resolvedTsConfig = this.options.tsConfig;

        // Prioritize profile values over resolved tsConfig values
        const parts = [
            `tsconfig: ${this.options.tsConfigFile || "./tsconfig.json"}`,
            `profiles: ${this.options.config?.profiles ? Object.keys(this.options.config.profiles).join(", ") : ""}`,
            `addonsDir: ${this.options.config?.addonsDir}`,
            `outDir: ${resolvedOutDir}`,
            `target: ${profileTsConfig.target ?? resolvedTsConfig?.target ?? cliTsConfig?.target ?? 99}`,
            `module: ${profileTsConfig.module ?? resolvedTsConfig?.module ?? cliTsConfig?.module ?? 99}`,
            `strict: ${profileTsConfig.strict ?? resolvedTsConfig?.strict ?? cliTsConfig?.strict ?? true}`,
            `sourceMap: ${profileTsConfig.sourceMap ?? resolvedTsConfig?.sourceMap ?? cliTsConfig?.sourceMap ?? true}`,
            `declaration: ${profileTsConfig.declaration ?? resolvedTsConfig?.declaration ?? cliTsConfig?.declaration ?? true}`,
            `noEmit: ${profileTsConfig.noEmit ?? resolvedTsConfig?.noEmit ?? cliTsConfig?.noEmit ?? true}`,
            `moduleResolution: ${profileTsConfig.moduleResolution ?? resolvedTsConfig?.moduleResolution ?? cliTsConfig?.moduleResolution ?? 2}`,
            `allowJs: ${profileTsConfig.allowJs ?? resolvedTsConfig?.allowJs ?? cliTsConfig?.allowJs ?? true}`,
            `incremental: ${profileTsConfig.incremental ?? resolvedTsConfig?.incremental ?? cliTsConfig?.incremental ?? true}`,
        ];

        return parts.join(", ");
    }

    private createProgram(tsConfig?: ts.CompilerOptions): ts.Program {
        return ts.createProgram({
            rootNames: this.getRootFiles(),
            options: tsConfig ?? {},
            host: createCompileHost(tsConfig ?? {}),
        });
    }

    private processOutput(
        cache: FileCache,
        output: (ts.EmitOutput & { diagnostics?: ts.Diagnostic[] }) | undefined,
        writeFile: boolean,
        fileName: string,
        _ctx?: CompilationContext
    ) {
        if (output && !output.emitSkipped) {
            cache.updateOutput(fileName, output.outputFiles);

            if (writeFile && output.outputFiles) {
                this.writeOutputFiles(output.outputFiles);
            }
            return {
                version: cache.getVersion(fileName),
                files: output.outputFiles,
                diagnostics: output.diagnostics,
            };
        } else {
            return { version: cache.getVersion(fileName), files: [], diagnostics: output?.diagnostics };
        }
    }

    private transpile(compilationFragment: CompilationFragment): (ts.EmitOutput & { diagnostics?: ts.Diagnostic[] }) | undefined {
        const { fileName, ctx } = compilationFragment;

        if (this.transpileOnly) {
            if (fileName.endsWith(".d.ts")) {
                return undefined;
            } else {
                const isSourceFile = (name: string) => name.match(/\.([cm]?ts|tsx)$/i);
                if (!isSourceFile(fileName)) {
                    const result = this.transpileJson(compilationFragment);
                    return result;
                }
                const result = this.transpileSourceCode(compilationFragment);
                return result;
            }
        }

        // If declaration files are requested, use transpileSourceCode to ensure they are generated
        const compilerOptions = ctx.getCliArgs().options;
        if (compilerOptions.declaration) {
            const isSourceFile = (name: string) => name.match(/\.([cm]?ts|tsx)$/i);
            if (isSourceFile(fileName)) {
                return this.transpileSourceCode(compilationFragment);
            }
        }

        const langService = ctx.getLanguageService();
        const emitOutput = langService.getEmitOutput(fileName);

        return {
            ...emitOutput,
            diagnostics: langService.getSyntacticDiagnostics(fileName),
        };
    }

    private transpileSourceCode({ content, ctx, fileName }: CompilationFragment): (ts.EmitOutput & { diagnostics?: ts.Diagnostic[] }) | undefined {
        const isTranspiledSourceFile = (name: string): boolean => !!name.match(/\.([cm]?js|jsx)$/i);
        const isSourceMap = (name: string): boolean => !!name.match(/\.([cm]?js|jsx)\.map$/i);

        // For declaration files, use the language service approach (but not in transpileOnly mode)
        if (ctx.getCliArgs().options.declaration && !this.transpileOnly) {
            const langService = ctx.getLanguageService();
            return { ...langService.getEmitOutput(fileName), diagnostics: langService.getSyntacticDiagnostics(fileName) };
        }

        const { outputText, sourceMapText, diagnostics } = ts.transpileModule(content, {
            compilerOptions: ctx.getCliArgs().options,
            fileName,
            transformers: ctx.getTransformers(),
        });

        const fileNames = ts.getOutputFileNames(ctx.getCliArgs(), fileName, !this.system.useCaseSensitiveFileNames);

        return {
            outputFiles: concat(
                this.extractOutputFile(fileNames, isTranspiledSourceFile, outputText),
                this.extractOutputFile(fileNames, isSourceMap, sourceMapText)
            ),
            diagnostics: diagnostics ?? [],
            emitSkipped: diagnostics !== undefined && diagnostics.length > 0,
        };
    }

    private transpileJson({ ctx, fileName, content }: CompilationFragment): (ts.EmitOutput & { diagnostics?: ts.Diagnostic[] }) | undefined {
        const { outDir } = this.options?.tsConfig ?? {};

        if (outDir !== undefined) {
            // JSON are only output by TypeScript if an outDir is provided, otherwise they are ignored.
            // For JSON files, manually construct the output path since ts.getOutputFileNames doesn't handle JSON files consistently
            const relativePath = path.relative(ctx.getCliArgs().options.rootDir || this.options.buildDir, fileName);
            const outputFileName = path.join(outDir, relativePath);

            return {
                outputFiles: [{ name: outputFileName, text: content, writeByteOrderMark: false }],
                emitSkipped: false,
                diagnostics: [],
            };
        }

        return {
            outputFiles: [],
            emitSkipped: false,
            diagnostics: [createDiagnostic({ source: content, messageText: "JSON files are only emitted if an outDir is provided." })],
        };
    }

    private extractOutputFile(fileNames: readonly string[], fileFilter: (name: string) => boolean, content?: string) {
        const fileName = fileNames.find(fileFilter);
        return fileName ? [<ts.OutputFile>{ name: fileName, text: content ?? "", writeByteOrderMark: false }] : [];
    }

    private getRootFiles(): string[] {
        const { cliArgs } = this.options;

        return cliArgs?.fileNames
            ? cliArgs.fileNames
            : recursiveFindByFilter(this.system.resolvePath(path.join(path.dirname(this.configPath), "./src")), undefined, this.system);
    }

    private writeOutputFiles(files: ts.OutputFile[]) {
        files.forEach(cur => {
            // The file names returned by ts.getOutputFileNames already include the full path
            // So we should write the file directly to the name provided
            this.system.writeFile(cur.name, cur.text);
        });
    }
}

const createDiagnostic = ({
    source,
    category = ts.DiagnosticCategory.Error,
    code = 0,
    file = undefined,
    start = undefined,
    length = undefined,
    messageText,
}: Partial<ts.Diagnostic> & { source: string; messageText: string }): ts.Diagnostic => ({
    source,
    category,
    code,
    file,
    start,
    length,
    messageText,
});
