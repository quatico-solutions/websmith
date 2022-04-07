/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import { AddonContext, Generator, Processor, Reporter, TargetPostTransformer } from "@websmith/addon-api";
import ts from "typescript";
import { FileCache } from "../cache";
import { concat } from "../collections";
import { createSharedHost } from "./shared-host";

export type CompilationContextOptions = {
    buildDir: string;
    project: ts.CompilerOptions;
    reporter: Reporter;
    rootFiles: string[];
    system: ts.System;
    program: ts.Program;
    tsconfig: ts.ParsedCommandLine;
    config?: unknown;
    target: string;
};

export class CompilationContext implements AddonContext<any> {
    protected generators: Generator[];
    protected processors: Processor[];
    protected transformers: ts.CustomTransformers;
    protected targetPostTransformers: TargetPostTransformer[] = [];

    private buildDir: string;
    private cache: FileCache;
    private languageHost: ts.LanguageServiceHost;
    private reporter: Reporter;
    private rootFiles: string[];
    private tsconfig: ts.ParsedCommandLine;
    private system: ts.System;
    private program: ts.Program;
    private config: any;

    constructor(options: CompilationContextOptions) {
        const { buildDir, project, rootFiles, system, program, tsconfig, config, target } = options;
        this.buildDir = buildDir;
        this.rootFiles = rootFiles;
        this.tsconfig = tsconfig;
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

    public getTargetConfig(): any {
        return this.config ?? {};
    }

    public getCache(): FileCache {
        return this.cache;
    }

    public getLanguageHost(): ts.LanguageServiceHost {
        return this.languageHost;
    }

    public getBasePath(fileName: string): string {
        return Object.keys(this.tsconfig.wildcardDirectories ?? {}).find(it => fileName.includes(it)) ?? this.buildDir;
    }

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

    public registerTargetPostTransformer(emitter: TargetPostTransformer): this {
        this.targetPostTransformers.push(emitter);
        return this;
    }

    public getGenerators(): Generator[] {
        return this.generators;
    }

    public getProcessors(): Processor[] {
        return this.processors;
    }

    public getTargetPostTransformers(): TargetPostTransformer[] {
        return this.targetPostTransformers;
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
            getScriptVersion: (fileName: string) => `${fileName}:${this.cache.getVersion(fileName).toString()}:${target}`,
            getScriptSnapshot: (fileName: string) => {
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
