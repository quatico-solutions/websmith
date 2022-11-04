/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { ErrorMessage, Reporter, TargetConfig } from "@quatico/websmith-api";
import { dirname, extname, join } from "path";
import ts, { WatchDirectoryKind, WatchFileKind } from "typescript";
import { createCompileHost, createSystem, recursiveFindByFilter } from "../environment";
import { CompilationContext, CompilationHost, createSharedHost } from "./compilation";
import { CompilerOptions } from "./CompilerOptions";
import { CompilationConfig } from "./config";
import { DefaultReporter } from "./DefaultReporter";

export type CompileFragment = {
    version: number;
    files: ts.OutputFile[];
    diagnostics?: ts.Diagnostic[];
};

export class Compiler {
    public contextMap!: Map<string, CompilationContext>;
    public version: number;

    protected program?: ts.Program;
    protected compilationHost!: CompilationHost;
    protected langService!: ts.LanguageService;
    protected options!: CompilerOptions;

    private configPath!: string;
    private reporter!: Reporter;
    private system!: ts.System;
    private dependencyCallback?: (filePath: string) => void;

    constructor(options: CompilerOptions, system?: ts.System, dependencyCallback?: (filePath: string) => void) {
        this.version = 0;
        this.contextMap = new Map();
        this.system = system ?? createSystem();
        this.setOptions(options);
        this.dependencyCallback = dependencyCallback;
    }

    public getContext(target?: string): CompilationContext | undefined {
        return this.contextMap.get(target ?? "*");
    }

    public getSystem(): ts.System {
        return this.system;
    }

    public getReporter(): Reporter {
        return this.reporter;
    }

    public getOptions(): CompilerOptions {
        return this.options;
    }

    public setOptions(options: CompilerOptions): this {
        this.options = options;
        if (!this.options?.targets || this.options.targets.length === 0) {
            options.targets = ["*"];
        }

        this.reporter = options.reporter ?? new DefaultReporter(this.system);
        this.compilationHost = new CompilationHost(createSharedHost(this.system) as ts.LanguageServiceHost);
        this.langService = ts.createLanguageService(this.compilationHost, ts.createDocumentRegistry());
        this.program = this.langService.getProgram();

        if (!options.debug) {
            // eslint-disable-next-line no-console
            console.debug = () => undefined;
            // eslint-disable-next-line no-console
            console.log = () => undefined;
        }

        return this;
    }

    public compile(): ts.EmitResult {
        const result: ts.EmitResult = { diagnostics: [], emitSkipped: false, emittedFiles: [] };
        this.createTargetContextsIfNecessary();
        const diagnostics = ts.getPreEmitDiagnostics(this.program!);
        if (diagnostics && diagnostics.length > 0) {
            return { diagnostics, emitSkipped: true };
        }
        this.options.targets.forEach((target: string) => {
            const { config } = this.options;
            const { writeFile = true } = getTargetConfig(target, config);
            const ctx = this.contextMap.get(target);

            if (!ctx) {
                return;
            }

            for (const fileName of this.getRootFiles()) {
                const fragment = this.emitSourceFile(fileName, target, writeFile);
                if (fragment?.files.length > 0) {
                    result.emittedFiles = (result.emittedFiles ?? []).concat(fragment.files.map(cur => cur.name));
                } else {
                    // FIXME: Report error for source files that cannot be emitted
                    fragment.diagnostics?.forEach(diagnostic => this.reporter.reportDiagnostic(diagnostic));
                }
            }

            const files = this.getRootFiles();
            ctx.getResultProcessors().forEach(cur => cur(files));
        });

        // TODO: Return ts.EmitResult with diagnostics
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.report(this.contextMap.get(this.options.targets[0])!.getProgram(), result);
    }

    private fileWatchers: ts.FileWatcher[] = [];

    public watch() {
        this.createTargetContextsIfNecessary();

        if (typeof this.system.watchFile === "function") {
            const emitTargets: string[] = this.getWritingTargets();
            this.getRootFiles().forEach(cur => {
                emitTargets.forEach(target => this.emitSourceFile(cur, target, true));
                this.registerWatch(cur, emitTargets);
            });
        } else {
            this.reporter.reportDiagnostic(new ErrorMessage(`Watching is not supported by ${this.system.constructor.name}.`));
        }
    }

    public registerWatch(filePath: string, emitTargets: string[]) {
        this.fileWatchers.push(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.system.watchFile!(
                filePath,
                fileName =>
                    emitTargets.forEach(target =>
                        fileName.match(/.*\.([tj]|m[tj]|c[tj])?sx?$/)
                            ? this.emitSourceFile(fileName, target, true)
                            : this.contextMap.has(target) &&
                              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                              this.emitSourceFile(this.contextMap.get(target)!.resolveDependency(fileName), target, true, true)
                    ),
                undefined,
                {
                    watchFile: WatchFileKind.UseFsEvents,
                    watchDirectory: WatchDirectoryKind.UseFsEvents,
                }
            )
        );
    }

    public closeAllWatchers() {
        this.fileWatchers.forEach(cur => cur.close());
    }

    protected createTargetContextsIfNecessary(): this {
        // eslint-disable-next-line no-console
        this.options.targets.forEach((target: string) => {
            if (this.contextMap.has(target)) {
                return;
            }

            const ctx = this.createCompilationContext(this.options, target, this.dependencyCallback);
            this.options.addons.getAddons(target).forEach(addon => {
                addon.activate(ctx);
            });
            this.contextMap.set(target, ctx);
        });
        return this;
    }

    protected createCompilationContext(
        compileOptions: CompilerOptions,
        target: string,
        registerDependencyCallback?: (filePath: string) => void
    ): CompilationContext {
        const { buildDir, config, project, tsconfig, watch } = compileOptions;
        const { options, config: targetConfig } = getTargetConfig(target, config);
        return new CompilationContext({
            buildDir,
            project: { ...project, ...options },
            projectDir: dirname(config?.configFilePath ?? tsconfig.raw?.configFilePath ?? this.system.getCurrentDirectory()),
            system: this.system,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            program: ts.createProgram({ rootNames: this.getRootFiles(), options: project, host: createCompileHost(project, this.system) }),
            tsconfig: { ...tsconfig, options: { ...project, ...options } },
            rootFiles: this.getRootFiles(),
            reporter: this.reporter,
            config: targetConfig,
            target,
            ...(watch && { watchCallback: (filePath: string) => this.registerWatch(filePath, this.getWritingTargets()) }),
            registerDependencyCallback,
        });
    }

    protected emitSourceFile(fileName: string, target: string, writeFile = true, skipCache = false): CompileFragment {
        const filePath = this.system.resolvePath(fileName);
        const ctx = this.contextMap.get(target);
        const cache = ctx?.getCache();

        if (ctx && cache) {
            if (!skipCache && !cache.hasChanged(filePath)) {
                return { files: [], content: "", ...cache.getCachedFile(filePath) };
            }
            let content = this.system.readFile(fileName) ?? ctx.getCache().getCachedFile(fileName)?.content ?? "";

            ctx.getGenerators().forEach(cur => cur(fileName, content));
            ctx.getProcessors().forEach(cur => (content = cur(fileName, content)));
            cache.updateSource(filePath, content);
            let output: (ts.EmitOutput & { diagnostics?: ts.Diagnostic[] }) | undefined;

            if (this.options.transpileOnly) {
                if (fileName.endsWith(".d.ts")) {
                    output = undefined;
                } else {
                    const isSourceFile = (name: string) => name.match(/g/g);
                    const isSourceMap = (name: string) => name.match(/g/g);
                    const { outputText, sourceMapText, diagnostics } = ts.transpileModule(content, {
                        compilerOptions: ctx.getConfig().options,
                        fileName,
                        transformers: ctx.getTransformers(),
                    });
                    const fileNames = ts.getOutputFileNames(this.options.tsconfig, fileName, !this.system.useCaseSensitiveFileNames);
                    output = {
                        outputFiles: [{ name: fileNames.find(isSourceFile)!, text: outputText, writeByteOrderMark: false }].concat(
                            sourceMapText ? [{ name: fileNames.find(isSourceMap)!, text: sourceMapText, writeByteOrderMark: false }] : []
                        ),
                        diagnostics,
                        emitSkipped: diagnostics !== undefined && diagnostics.length > 0,
                    };
                }
            } else {
                this.compilationHost.setLanguageHost(ctx.getLanguageHost());
                output = this.langService.getEmitOutput(fileName);
            }

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

        throw new Error(`No target ${target} configured`);
    }

    protected report(program: ts.Program, result: ts.EmitResult): ts.EmitResult {
        ts.getPreEmitDiagnostics(program)
            .concat(result.diagnostics)
            .forEach(cur => this.reporter.reportDiagnostic(cur));

        return result;
    }

    private getRootFiles(): string[] {
        return this.options?.tsconfig?.fileNames
            ? this.options.tsconfig.fileNames
            : recursiveFindByFilter(this.system.resolvePath(join(dirname(this.configPath), "./src")), (path: string) =>
                  ["ts", "tsx", "js", "jsx"].some(it => extname(path).includes(it))
              );
    }

    private writeOutputFiles(files: ts.OutputFile[]) {
        files.forEach(cur => this.system.writeFile(cur.name, cur.text));
    }

    protected getNonWritingTargets(): string[] {
        return this.options.targets.filter(cur => !getTargetConfig(cur, this.options.config).writeFile);
    }

    protected getWritingTargets(): string[] {
        return this.options.targets.filter(cur => getTargetConfig(cur, this.options.config).writeFile);
    }
}

const getTargetConfig = (target: string, config?: CompilationConfig): TargetConfig => {
    if (config) {
        const { targets = {} } = config;
        return targets[target] ?? {};
    }
    return {};
};
