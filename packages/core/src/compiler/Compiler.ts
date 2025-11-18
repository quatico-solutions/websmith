/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { ErrorMessage, InfoMessage, type CompilerOptions, type Reporter, type WebpackLoaderOptions } from "@quatico/websmith-api";
import deepmerge from "deepmerge";
import path from "node:path";
import ts from "typescript";
import { createCompileHost, createSystem, recursiveFindByFilter } from "../environment";
import type { AddonRegistry } from "./addons";
import type { FileCache } from "./cache";
import { concat } from "./collections";
import { CompilationContext } from "./compilation";
import { DefaultReporter } from "./DefaultReporter";
import { arrayMerge, resolveCompilerOptions, type ResolvedCompilerOptions } from "./options";

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
    private addons?: AddonRegistry;
    private transpileOnly: boolean = false;
    private addonEmitOnly: boolean = false;
    private dependencyCallback?: (filePath: string) => void;
    private fileWatchers: ts.FileWatcher[] = [];
    private rootFilesCache?: string[];
    private rootFilesCacheInvalidated = true;
    private cachedProgram?: ts.Program;
    private lastProgramOptions?: string; // JSON stringified options for comparison

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
        this.addonEmitOnly = this.options.config?.addonEmitOnly ?? false;
    }

    compile(): ts.EmitResult {
        const { profile, buildDir } = this.options;
        const selectedProfiles = profile ? this.options.getSelectedProfiles(profile) : [undefined];

        if (this.options.debug) {
            this.reporter.reportDiagnostic(new InfoMessage(`Starting compilation with debug mode enabled.`));
            this.reporter.indent();
            this.reporter.reportDiagnostic(new InfoMessage(`Project directory: ${buildDir}.`));
            this.reporter.reportDiagnostic(new InfoMessage(`Configuration: ${this.getConfigSummary()}.`));
            this.reporter.reportDiagnostic(
                new InfoMessage(`Selected profiles: ${selectedProfiles.length ? selectedProfiles.join(", ") : "<NONE>"}.`)
            );
        }

        this.createProfileContextsIfNecessary();
        const profileOptions = this.options.getOptions(profile);
        const program = this.createProgram(profileOptions.tsConfig);

        if (this.options.debug) {
            this.reporter.reportDiagnostic(new InfoMessage(`Created TypeScript program with ${program.getSourceFiles().length} source files.`));
        }

        const results: ts.EmitResult[] = [];
        selectedProfiles.forEach(curProfile => {
            if (this.options.debug) {
                this.reporter.reportDiagnostic(new InfoMessage(`Processing profile: ${curProfile ?? "default"}.`));
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
            this.reporter.reportDiagnostic(new InfoMessage(`Compilation completed with ${results.length} results.`));
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
            const files = this.getRootFiles();

            if (profiles.length) {
                // Process all profiles for each file before moving to the next file
                files.forEach(curFile => {
                    profiles.forEach(curProfile => this.emitSourceFile(curFile, curProfile, true));
                });
                // Register watches once per file
                files.forEach(curFile => this.registerWatch(curFile, profiles));
            } else {
                files.forEach(curFile => {
                    this.emitSourceFile(curFile, undefined, true);
                    this.registerWatch(curFile);
                });
            }
        } else {
            this.reporter.reportDiagnostic(new ErrorMessage(`Watching is not supported by "${this.system.constructor.name}".`));
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

        // Invalidate caches when options change
        this.rootFilesCacheInvalidated = true;
        // Don't invalidate cachedProgram - keep it for incremental compilation
        // The createProgram() method will detect option changes and create a new program
        // while still passing the old program for incremental type checking

        // Update AddonRegistry with resolved configuration
        if (this.addons && this.options.config) {
            this.addons
                .setConfig({
                    addonsDir: this.options.config.addonsDir,
                    addons: this.options.config.addons,
                    profiles: this.options.config.profiles,
                    reporter: this.reporter,
                    system: this.system,
                })
                .refresh();
        }

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

            resolvedAddons.forEach(addon => {
                try {
                    defaultCtx.activateAddon(addon);
                } catch (err) {
                    this.reporter.reportDiagnostic(new ErrorMessage(`Error activating addon "${addon.getName()}": ${err}`));
                }
            });
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

                // Optimize addon resolution with direct lookup instead of linear search
                const resolvedAddons = profileAddons
                    .reverse()
                    .map(name => this.addons?.getAddonByName(name))
                    .filter(addon => addon !== undefined);

                resolvedAddons.forEach(addon => {
                    try {
                        ctx.activateAddon(addon);
                    } catch (err) {
                        this.reporter.reportDiagnostic(new ErrorMessage(`Error activating addon "${addon.getName()}": ${err}`));
                    }
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

        // Normalize compiler options to fix numeric enum values
        const normalizedCliArgs = {
            ...profileCliArgs,
            options: this.normalizeCompilerOptions(profileCliArgs.options),
        };

        return new CompilationContext({
            tsConfig: profileOptions.tsConfig ?? {},
            projectDir: path.dirname(configFile ?? tsConfigFile ?? cliArgs?.raw?.configFilePath ?? this.system.getCurrentDirectory()),
            system: this.system,
            cliArgs: normalizedCliArgs,
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

            const generators = ctx.getGenerators();
            if (generators.length > 0) {
                // Set the current source file so that generators calling addInputFile/addVirtualFile
                // can automatically mark the source file as processed
                ctx.setCurrentSourceFile(fileName);
                // Generators are executed, but files are only marked as addon-processed
                // if generators actually perform actions (e.g., via addInputFile/addVirtualFile)
                generators.forEach(cur => {
                    try {
                        cur(fileName, content);
                    } catch (err) {
                        this.reporter.reportDiagnostic(new ErrorMessage(`Error in generator "${ctx.getAddonName(cur)}": ${err}`));
                    }
                });
                // Clear the current source file after generators run
                ctx.setCurrentSourceFile(undefined);
            }

            const processors = ctx.getProcessors();
            if (processors.length > 0) {
                const originalContent = content;
                for (const cur of processors) {
                    try {
                        content = cur(fileName, content);
                    } catch (err) {
                        this.reporter.reportDiagnostic(new ErrorMessage(`Error in processor "${ctx.getAddonName(cur)}": ${err}`));
                        break; // Stop processing further processors on error
                    }
                }
                // Automatically mark file as addon-processed if content was modified
                if (content !== originalContent) {
                    ctx.markFileAsAddonProcessed(fileName);
                }
            }

            cache.updateSource(filePath, content);

            try {
                return this.processOutput(cache, this.transpile({ fileName, ctx, content }), writeFile, fileName, ctx);
            } catch (err) {
                this.reporter.reportDiagnostic(new ErrorMessage(`Error during transpilation of "${fileName}": ${err}`));
                // Return a minimal result to allow compilation to continue
                return {
                    version: cache.getVersion(fileName),
                    files: [],
                    diagnostics: [
                        {
                            category: ts.DiagnosticCategory.Error,
                            code: 0,
                            messageText: `Transpilation failed: ${err}`,
                            file: undefined,
                            start: undefined,
                            length: undefined,
                        },
                    ],
                };
            }
        }

        throw new Error(`No profile with name "${profile}" configured.`);
    }

    protected report(program: ts.Program, result: ts.EmitResult): ts.EmitResult {
        // Skip pre-emit diagnostics in transpileOnly mode to avoid validation errors
        // with numeric enum values that TypeScript's internal validation rejects
        if (!this.transpileOnly) {
            ts.getPreEmitDiagnostics(program)
                .concat(result.diagnostics)
                .filter(cur => program?.getProjectReferences?.()?.length || cur.file) // Filter out global diagnostics
                .forEach(cur => this.reporter.reportDiagnostic(cur));
        } else {
            // In transpileOnly mode, only report diagnostics from the result
            result.diagnostics.forEach(cur => this.reporter.reportDiagnostic(cur));
        }

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

        // Cache getRootFiles() result to avoid redundant calls
        const files = this.getRootFiles();

        for (const fileName of files) {
            const fragment = this.emitSourceFile(fileName, profile);
            if (fragment?.files.length > 0) {
                result.emittedFiles?.push(...fragment.files.map(cur => cur.name));
            } else {
                fragment.diagnostics?.forEach(diagnostic => this.reporter.reportDiagnostic(diagnostic));
                result.diagnostics = [...result.diagnostics, ...(fragment.diagnostics ?? [])];
                result.emitSkipped = !!fragment.diagnostics && fragment.diagnostics.length > 0 ? true : false;
            }
        }

        // Pass the actually emitted files to result processors
        // This respects addonEmitOnly mode - only emitted files are passed
        const emittedFiles = result.emittedFiles ?? [];
        ctx.getResultProcessors().forEach(cur => {
            try {
                cur(emittedFiles, ctx);
            } catch (err) {
                this.reporter.reportDiagnostic(new ErrorMessage(`Error in result processor "${ctx.getAddonName(cur)}": ${err}`));
            }
        });

        return result;
    }

    registerWatch(filePath: string, profileNames?: string[]): this {
        if (typeof this.system.watchFile !== "function") {
            this.reporter.reportDiagnostic(new ErrorMessage(`Watching is not supported by "${this.system.constructor.name}".`));
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

    /**
     * Normalizes TypeScript compiler options by converting numeric enum values to their string equivalents.
     * This ensures compatibility with TypeScript's diagnostic checking which expects string values.
     */
    private normalizeCompilerOptions(tsConfig?: ts.CompilerOptions): ts.CompilerOptions {
        if (!tsConfig) {
            return {};
        }

        const normalized = { ...tsConfig };

        // Normalize target if it's a number
        if (typeof normalized.target === "number") {
            const targetMap: Record<number, ts.ScriptTarget> = {
                0: ts.ScriptTarget.ES3,
                1: ts.ScriptTarget.ES5,
                2: ts.ScriptTarget.ES2015,
                3: ts.ScriptTarget.ES2016,
                4: ts.ScriptTarget.ES2017,
                5: ts.ScriptTarget.ES2018,
                6: ts.ScriptTarget.ES2019,
                7: ts.ScriptTarget.ES2020,
                8: ts.ScriptTarget.ES2021,
                9: ts.ScriptTarget.ES2022,
                10: ts.ScriptTarget.ES2023,
                11: ts.ScriptTarget.ES2024,
                99: ts.ScriptTarget.ESNext,
                100: ts.ScriptTarget.JSON,
            };
            // Keep the numeric value - TypeScript accepts it internally
            normalized.target = targetMap[normalized.target] ?? normalized.target;
        }

        // Normalize module if it's a number
        if (typeof normalized.module === "number") {
            const moduleMap: Record<number, ts.ModuleKind> = {
                0: ts.ModuleKind.None,
                1: ts.ModuleKind.CommonJS,
                2: ts.ModuleKind.AMD,
                3: ts.ModuleKind.UMD,
                4: ts.ModuleKind.System,
                5: ts.ModuleKind.ES2015,
                6: ts.ModuleKind.ES2020,
                7: ts.ModuleKind.ES2022,
                99: ts.ModuleKind.ESNext,
                100: ts.ModuleKind.Node16,
                101: ts.ModuleKind.NodeNext,
                199: ts.ModuleKind.Preserve,
            };
            // Keep the numeric value - TypeScript accepts it internally
            normalized.module = moduleMap[normalized.module] ?? normalized.module;
        }

        return normalized;
    }

    protected createProgram(tsConfig?: ts.CompilerOptions): ts.Program {
        // Normalize TypeScript options to ensure enum values are properly formatted
        const normalizedConfig = this.normalizeCompilerOptions(tsConfig);

        // Serialize options for comparison (exclude functions and complex objects)
        const currentOptionsKey = JSON.stringify({
            ...normalizedConfig,
            // Exclude non-serializable properties
            configFilePath: undefined,
        });

        // Check if we can reuse the existing program
        if (this.cachedProgram && this.lastProgramOptions === currentOptionsKey) {
            return this.cachedProgram;
        }

        // Create a new program with incremental compilation support
        this.cachedProgram = ts.createProgram({
            rootNames: this.getRootFiles(),
            options: normalizedConfig ?? {},
            host: createCompileHost(normalizedConfig ?? {}),
            oldProgram: this.cachedProgram, // Enable incremental compilation
        });

        this.lastProgramOptions = currentOptionsKey;

        return this.cachedProgram;
    }

    private processOutput(
        cache: FileCache,
        output: (ts.EmitOutput & { diagnostics?: ts.Diagnostic[] }) | undefined,
        writeFile: boolean,
        fileName: string,
        ctx?: CompilationContext
    ) {
        if (output && !output.emitSkipped) {
            cache.updateOutput(fileName, output.outputFiles);

            // Check if we should emit this file based on addonEmitOnly flag
            // In full compilation mode (!transpileOnly) with transformers, conservatively emit all files
            // to avoid expensive AST-based detection of which files were actually transformed
            const hasTransformers = ctx && (
                ctx.getTransformers().before?.length ||
                ctx.getTransformers().after?.length ||
                ctx.getTransformers().afterDeclarations?.length
            );
            const shouldEmitFile = !this.addonEmitOnly ||
                (ctx && ctx.isFileProcessedByAddon(fileName)) ||
                (!this.transpileOnly && hasTransformers);


            if (writeFile && output.outputFiles && shouldEmitFile) {
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
        const { ctx, fileName, content } = compilationFragment;

        // Automatically detect if transformers actually changed the output
        // Only do this expensive check in transpileOnly mode when addonEmitOnly is enabled
        if (this.transpileOnly && this.addonEmitOnly && ctx) {
            const transformers = ctx.getTransformers();
            const hasTransformers = transformers.before?.length ||
                                  transformers.after?.length ||
                                  transformers.afterDeclarations?.length;

            if (hasTransformers) {
                // Transpile with transformers to get the actual output
                const { outputText: withTransformers } = ts.transpileModule(content, {
                    compilerOptions: ctx.getCompilerOptions(),
                    fileName,
                    transformers,
                });

                // Transpile without transformers for comparison
                const { outputText: withoutTransformers } = ts.transpileModule(content, {
                    compilerOptions: ctx.getCompilerOptions(),
                    fileName,
                    transformers: {},
                });

                // Compare outputs to detect if transformers actually changed anything
                if (withTransformers !== withoutTransformers) {
                    // Transformers actually modified the output - mark file as processed
                    ctx.markFileAsAddonProcessed(fileName);
                }
            }
        }

        // Generate output normally (with transformers if any)
        return this.transpileInternal(compilationFragment);
    }

    private transpileInternal(compilationFragment: CompilationFragment): (ts.EmitOutput & { diagnostics?: ts.Diagnostic[] }) | undefined {
        const { fileName, ctx } = compilationFragment;

        if (this.transpileOnly) {
            if (fileName.endsWith(".d.ts")) {
                return undefined;
            } else {
                const isSourceFile = (name: string) => name.match(/\.([cm]?ts|tsx)$/i);
                if (!isSourceFile(fileName)) {
                    return this.transpileJson(compilationFragment);
                }
                return this.transpileSourceCode(compilationFragment);
            }
        }

        // If declaration files are requested, use transpileSourceCode to ensure they are generated
        const compilerOptions = ctx.getCompilerOptions();
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

        // For declaration files, we need to use the full compiler API instead of transpileModule
        // because transpileModule doesn't generate declaration files
        if (ctx.getCompilerOptions().declaration) {
            // Create a temporary source file with the processed content
            const sourceFile = ts.createSourceFile(fileName, content, ctx.getCompilerOptions().target ?? ts.ScriptTarget.Latest, true);

            // Create a simple program with just this file
            const program = ts.createProgram({
                rootNames: [fileName],
                options: ctx.getCompilerOptions(),
                host: {
                    ...ts.createCompilerHost(ctx.getCompilerOptions()),
                    getSourceFile: (name: string) => {
                        if (name === fileName) {
                            return sourceFile;
                        }
                        return ts
                            .createCompilerHost(ctx.getCompilerOptions())
                            .getSourceFile(name, ctx.getCompilerOptions().target ?? ts.ScriptTarget.Latest);
                    },
                    writeFile: () => {}, // We'll collect the output ourselves
                },
            });

            const outputFiles: ts.OutputFile[] = [];
            const emitResult = program.emit(
                sourceFile,
                (fileName: string, text: string) => {
                    outputFiles.push({ name: fileName, text, writeByteOrderMark: false });
                },
                undefined,
                false,
                ctx.getTransformers()
            );

            return {
                outputFiles,
                diagnostics: emitResult.diagnostics as ts.Diagnostic[],
                emitSkipped: emitResult.emitSkipped,
            };
        }

        const { outputText, sourceMapText, diagnostics } = ts.transpileModule(content, {
            compilerOptions: ctx.getCompilerOptions(),
            fileName,
            transformers: ctx.getTransformers(),
        });

        // Use ts.getOutputFileNames to get correct output paths
        // Note: We filter error 6046 below, so numeric enum values won't cause issues
        const fileNames = ts.getOutputFileNames(ctx.getCliArgs(), fileName, !this.system.useCaseSensitiveFileNames);

        // Filter out cliArgs validation errors (error code 6046) to avoid reporting issues
        // with numeric enum values that TypeScript's command-line parser rejects
        const filteredDiagnostics = (diagnostics ?? []).filter(d => d.code !== 6046);

        return {
            outputFiles: concat(
                this.extractOutputFile(fileNames, isTranspiledSourceFile, outputText),
                this.extractOutputFile(fileNames, isSourceMap, sourceMapText)
            ),
            diagnostics: filteredDiagnostics,
            emitSkipped: filteredDiagnostics.length > 0,
        };
    }

    private transpileJson({ ctx, fileName, content }: CompilationFragment): (ts.EmitOutput & { diagnostics?: ts.Diagnostic[] }) | undefined {
        const { outDir } = this.options?.tsConfig ?? {};

        if (outDir !== undefined) {
            // JSON are only output by TypeScript if an outDir is provided, otherwise they are ignored.
            // For JSON files, manually construct the output path since ts.getOutputFileNames doesn't handle JSON files consistently
            const relativePath = path.relative(ctx.getCompilerOptions().rootDir || this.options.buildDir, fileName);
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
        // Return cached result if available and valid
        if (this.rootFilesCache && !this.rootFilesCacheInvalidated) {
            return this.rootFilesCache;
        }

        const { cliArgs, tsConfigFile, buildDir } = this.options;

        this.rootFilesCache = cliArgs?.fileNames
            ? cliArgs.fileNames
            : recursiveFindByFilter(
                  this.system.resolvePath(path.join(tsConfigFile ? path.dirname(tsConfigFile) : buildDir, "./src")),
                  undefined,
                  this.system
              );

        this.rootFilesCacheInvalidated = false;
        return this.rootFilesCache;
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
