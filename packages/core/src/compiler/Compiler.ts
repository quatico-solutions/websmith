/* eslint-disable no-console */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { ErrorMessage, type Reporter } from "@quatico/websmith-api";
import path from "node:path";
import ts from "typescript";
import { createCompileHost, createSystem, recursiveFindByFilter } from "../environment";
import { type AddonRegistry } from "./addons";
import { type FileCache } from "./cache";
import { concat } from "./collections";
import { CompilationContext } from "./compilation";
import { resolveCompilerOptions, type CompilerOptions, type ResolvedCompilerOptions } from "./options";

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
    private version: number;
    private options!: ResolvedCompilerOptions;
    private contextMap!: Map<string, CompilationContext>;
    private configPath!: string;
    private reporter!: Reporter;
    private system!: ts.System;
    private dependencyCallback?: (filePath: string) => void;
    private fileWatchers: ts.FileWatcher[] = [];
    private addons?: AddonRegistry;
    private transpileOnly: boolean;

    constructor(options: Partial<CompilerOptions>, system?: ts.System, addons?: AddonRegistry, dependencyCallback?: (filePath: string) => void) {
        this.version = 0;
        this.contextMap = new Map();
        this.addons = addons;
        this.system = system ?? createSystem();
        this.setOptions(options);
        this.dependencyCallback = dependencyCallback;
        this.transpileOnly = this.options.config?.transpileOnly ?? false;
    }

    public getVersion(): number {
        return this.version;
    }

    public getContext(profile?: string): CompilationContext | undefined {
        if (profile) {
            return this.contextMap.get(profile);
        }
        const defaultCtx = this.contextMap.get("default");
        if (!defaultCtx) {
            this.contextMap.set("default", this.createCompilationContext());
        }
        return this.contextMap.get("default");
    }

    public hasContext(profile?: string): boolean {
        return profile ? this.contextMap.has(profile) : true;
    }

    public getSystem(): ts.System {
        return this.system;
    }

    public getReporter(): Reporter {
        return this.reporter;
    }

    public getAddonRegistry(): AddonRegistry | undefined {
        return this.addons;
    }

    public getOptions(): CompilerOptions {
        return this.options;
    }

    public setOptions(options: Partial<CompilerOptions>): this {
        // TODO: This is a workaround, as the options are not correctly resolved otherwise.
        this.options = resolveCompilerOptions(this.system, { tsConfigFile: "./tsconfig.json", ...options });
        this.reporter = this.options.reporter;
        if (!options.debug) {
            console.debug = () => undefined;
            console.log = () => undefined;
        }

        if (this.options.cliArgs?.errors?.length) {
            this.options.cliArgs.errors = this.options.cliArgs.errors.filter(cur => this.options.cliArgs?.projectReferences?.length || cur.file); // Filter out global diagnostics
        }

        return this;
    }

    public compile(): ts.EmitResult {
        const { profile } = this.options;
        const selectedProfiles = profile ? this.options.getSelectedProfiles(profile) : [undefined];
        this.createProfileContextsIfNecessary();
        const profileOptions = this.options.getOptions(profile);
        const program = this.createProgram(profileOptions.tsConfig);

        const results: ts.EmitResult[] = [];
        selectedProfiles.forEach(curProfile => {
            const ctx = this.getContext(curProfile);
            if (ctx) {
                // FIXME: This could be bug, we should always report diagnostics, even if transpileOnly is true.
                // const result = this.emitResult(curProfile, ctx);
                // results.push(this.options.config?.transpileOnly ? result : this.report(ctx.getProgram(), result));
                // Enable for now: reporting of diagnostics, even if transpileOnly is true.
                results.push(this.report(program, this.emitResult(curProfile, ctx)));
            }
        });

        return results.filter(cur => !!cur).length < 1
            ? { emitSkipped: true, diagnostics: [] }
            : {
                  emitSkipped: !!results.find(cur => cur.emitSkipped) || false,
                  emittedFiles: concat(results.flatMap(cur => cur.emittedFiles ?? [])),
                  diagnostics: concat(results.flatMap(cur => cur.diagnostics)),
              };
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

    public watch(): this {
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

    public registerWatch(filePath: string, profileNames?: string[]): this {
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

    public closeAllWatchers(): this {
        this.fileWatchers.forEach(cur => cur.close());
        return this;
    }

    protected createProfileContextsIfNecessary(): this {
        const selectedProfiles = this.options.getSelectedProfiles();
        if (!selectedProfiles.length) {
            // Create default context in any case, context for default profile exists
            const defaultCtx = this.getContext()!;
            this.addons?.getAvailableAddons().forEach(addon => {
                addon.activate(defaultCtx);
            });
        } else {
            selectedProfiles.forEach((profile: string) => {
                if (this.contextMap.has(profile)) {
                    return;
                }
                const ctx = this.createCompilationContext(profile);
                this.addons?.getAvailableAddons(profile).forEach(addon => {
                    addon.activate(ctx);
                });
                this.contextMap.set(profile, ctx);
            });
        }
        return this;
    }

    protected createCompilationContext(profile?: string): CompilationContext {
        const { buildDir, configFile, tsConfigFile, cliArgs, watch } = this.options;
        const selectedProfiles = this.options.getSelectedProfiles(profile);
        const profileOptions = this.options.getOptions(profile);
        return new CompilationContext({
            buildDir,
            tsConfig: profileOptions.tsConfig ?? {},
            projectDir: path.dirname(configFile ?? tsConfigFile ?? cliArgs?.raw?.configFilePath ?? this.system.getCurrentDirectory()),
            system: this.system,
            cliArgs: profileOptions.cliArgs,
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

            return this.processOutput(cache, this.transpile({ fileName, ctx, content }), writeFile, fileName);
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
        const selectedProfiles = [...(this.options.config?.profiles?.[name]?.depends ?? []), name];
        return profiles.filter(cur => selectedProfiles.includes(cur));
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
        fileName: string
    ) {
        if (output && !output.emitSkipped) {
            cache.updateOutput(fileName, output.outputFiles);

            this.version++;
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
                    return this.transpileJson(compilationFragment);
                }
                return this.transpileSourceCode(compilationFragment);
            }
        }

        const langService = ctx.getLanguageService();
        return { ...langService.getEmitOutput(fileName), diagnostics: langService.getSyntacticDiagnostics(fileName) };
    }

    private transpileSourceCode({ content, ctx, fileName }: CompilationFragment): (ts.EmitOutput & { diagnostics?: ts.Diagnostic[] }) | undefined {
        const isTranspiledSourceFile = (name: string): boolean => !!name.match(/\.([cm]?js|jsx)$/i);
        const isSourceMap = (name: string): boolean => !!name.match(/\.([cm]?js|jsx)\.map$/i);
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
            // JSON are only output by TypoScript if an outDir is provided, otherwise they are ignored.
            const fileNames = ts.getOutputFileNames(ctx.getCliArgs(), fileName, !this.system.useCaseSensitiveFileNames);
            return {
                outputFiles: [{ name: fileNames[0], text: content, writeByteOrderMark: false }],
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
        files.forEach(cur => this.system.writeFile(cur.name, cur.text));
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
