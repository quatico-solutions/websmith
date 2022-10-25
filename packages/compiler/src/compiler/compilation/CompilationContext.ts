/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonContext, Generator, Processor, Reporter, ResultProcessor } from "@quatico/websmith-api";
import { isAbsolute, join } from "path";
import ts from "typescript";
import { FileCache } from "../cache";
import { concat } from "../collections";
import { createSharedHost } from "./shared-host";

export type CompilationContextOptions = {
    buildDir: string;
    config?: unknown;
    program: ts.Program;
    project: ts.CompilerOptions;
    projectDir: string;
    reporter: Reporter;
    rootFiles: string[];
    system: ts.System;
    target: string;
    tsconfig: ts.ParsedCommandLine;
};

export class CompilationContext implements AddonContext {
    protected generators: Generator[];
    protected processors: Processor[];
    protected transformers: ts.CustomTransformers;
    protected ResultProcessors: ResultProcessor[] = [];
    protected rootFiles: string[];

    // @ts-ignore TODO: Unused variable
    private buildDir: string;
    private cache: FileCache;
    private languageHost: ts.LanguageServiceHost;
    private reporter: Reporter;
    private tsconfig: ts.ParsedCommandLine;
    private system: ts.System;
    private projectDir: string;
    private program: ts.Program;
    private config: unknown;

    constructor(options: CompilationContextOptions) {
        const { buildDir, config, program, project, projectDir, rootFiles, system, target, tsconfig } = options;
        this.buildDir = buildDir;
        this.rootFiles = rootFiles;
        this.tsconfig = tsconfig;
        this.projectDir = projectDir;
        this.transformers = {};
        this.processors = [];
        this.generators = [];
        this.languageHost = this.createLanguageServiceHost({
            system,
            options: project,
            target,
        });
        this.cache = new FileCache(system);
        this.reporter = options.reporter;
        this.system = system;
        this.program = program;
        this.config = config;
    }

    public getSystem(): ts.System {
        return this.system;
    }

    public getConfig(): ts.ParsedCommandLine {
        return this.tsconfig;
    }

    public getReporter(): Reporter {
        return this.reporter;
    }

    public getProgram(): ts.Program {
        return this.program;
    }

    public getTargetConfig(): unknown {
        return this.config ?? {};
    }

    public addInputFile(filePath: string): void {
        // TODO: Should only be allowed for Generators
        if (!this.rootFiles.includes(filePath)) {
            this.rootFiles.push(filePath);
        }
    }

    public addVirtualFile(filePath: string, fileContent: string): void {
        if (!this.rootFiles.includes(filePath)) {
            this.rootFiles.push(filePath);
        }
        this.cache.updateSource(filePath, fileContent);
    }

    public removeOutputFile(filePath: string) {
        if (this.rootFiles.includes(filePath)) {
            this.rootFiles = this.rootFiles.filter(f => f !== filePath);
        }
        this.cache.removeCachedFile(filePath);
    }

    public resolvePath(path: string): string {
        return isAbsolute(path) ? path : this.system.resolvePath(join(this.projectDir, path));
    }

    public getFileContent(filePath: string): string {
        return this.cache.getCachedFile(filePath).content ?? "";
    }

    public getCache(): FileCache {
        return this.cache;
    }

    public getLanguageHost(): ts.LanguageServiceHost {
        return this.languageHost;
    }

    // public getBasePath(fileName: string): string {
    //     return Object.keys(this.tsconfig.wildcardDirectories ?? {}).find(it => fileName.includes(it)) ?? this.buildDir;
    // }

    public registerTransformer(transformers: ts.CustomTransformers): this {
        Object.keys(transformers).forEach(kind => {
            // @ts-ignore ts.CustomTransformers defines too many implicit any
            this.transformers[kind] = concat(this.transformers[kind], transformers[kind]);
        });
        return this;
    }

    public registerProcessor(processor: Processor): this {
        this.processors.push(processor);
        return this;
    }

    public registerGenerator(gen: Generator): this {
        this.generators.push(gen);
        return this;
    }

    public registerResultProcessor(emitter: ResultProcessor): this {
        this.ResultProcessors.push(emitter);
        return this;
    }

    public getGenerators(): Generator[] {
        return this.generators;
    }

    public getProcessors(): Processor[] {
        return this.processors;
    }

    public getResultProcessors(): ResultProcessor[] {
        return this.ResultProcessors;
    }

    private createLanguageServiceHost({
        system,
        options,
        target,
    }: {
        system: ts.System;
        options: ts.CompilerOptions;
        target: string;
    }): ts.LanguageServiceHost {
        return {
            ...createSharedHost(system),
            getScriptVersion: (fileName: string) => {
                fileName = system.resolvePath(fileName);
                return `${fileName}:${this.cache.getVersion(fileName).toString()}:${target}`;
            },
            getScriptSnapshot: (fileName: string) => {
                fileName = system.resolvePath(fileName);
                if (fileName.endsWith(".d.ts")) {
                    const content = system.readFile(fileName);
                    if (!content) {
                        return undefined;
                    }
                    return ts.ScriptSnapshot.fromString(content);
                }
                const snapshot = this.cache.getSnapshot(fileName);
                if (snapshot) {
                    return snapshot;
                }
                if (!system.fileExists(fileName)) {
                    return undefined;
                }

                const content = system.readFile(fileName);
                if (!content) {
                    return undefined;
                }

                this.cache.createCacheEntry(fileName);
                return ts.ScriptSnapshot.fromString(content);
            },
            getScriptFileNames: (): string[] => this.rootFiles,
            getCompilationSettings: () => options,
            getCustomTransformers: (): ts.CustomTransformers => this.transformers,
        };
    }
}
