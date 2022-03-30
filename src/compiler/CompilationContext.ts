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
import ts from "typescript";
import { EmitTransformer, EmitTransformerKind, Generator, GeneratorKind, PreEmitTransformer, Reporter } from "../model";
import { CustomGenerators } from "./addons";
import { FileCache } from "./cache";
import { concat } from "./collections";
import { createSharedHost } from "./host/shared-host";

export type CompilationContextOptions = {
    buildDir: string;
    project: ts.CompilerOptions;
    reporter: Reporter;
    rootFiles: string[];
    system: ts.System;
    tsconfig: ts.ParsedCommandLine;
};

export class CompilationContext {
    protected emitTransformers: ts.CustomTransformers;
    protected generators: CustomGenerators;
    protected preEmitTransformers: PreEmitTransformer[];

    private buildDir: string;
    private cache: FileCache;
    private languageHost: ts.LanguageServiceHost;
    private reporter: Reporter;
    private rootFiles: string[];
    private tsconfig: ts.ParsedCommandLine;

    constructor(options: CompilationContextOptions) {
        const { buildDir, project, rootFiles, system, tsconfig } = options;
        this.buildDir = buildDir;
        this.rootFiles = rootFiles;
        this.tsconfig = tsconfig;
        this.emitTransformers = { before: [], after: [], afterDeclarations: [] };
        this.preEmitTransformers = [];
        this.generators = {};
        this.languageHost = this.createLanguageServiceHost({
            system,
            options: project,
        });
        this.cache = new FileCache(system);
        this.reporter = options.reporter;
    }

    public getCache(): FileCache {
        return this.cache;
    }

    public getReporter(): Reporter {
        return this.reporter;
    }

    public getLanguageHost(): ts.LanguageServiceHost {
        return this.languageHost;
    }

    public getBasePath(fileName: string): string {
        return Object.keys(this.tsconfig.wildcardDirectories ?? {}).find(it => fileName.includes(it)) ?? this.buildDir;
    }

    public registerEmitTransformer(kind: EmitTransformerKind, transformer: EmitTransformer): this {
        if (!this.emitTransformers[kind]) {
            this.emitTransformers[kind] = [];
        }
        this.emitTransformers[kind]!.push(transformer as any);
        return this;
    }

    public registerPreEmitTransformer(transformer: PreEmitTransformer): this {
        this.preEmitTransformers.push(transformer);
        return this;
    }

    public registerGenerator(kind: GeneratorKind, gen: Generator): this {
        this.generators[kind] = concat(this.generators[kind], [gen]);
        return this;
    }

    // TODO: We shouldn't make this available to addon implementors.
    getPreEmitTransformers(): PreEmitTransformer[] {
        return this.preEmitTransformers;
    }

    private createLanguageServiceHost({ system, options }: { system: ts.System; options: ts.CompilerOptions }): ts.LanguageServiceHost {
        return {
            ...createSharedHost(system),
            getScriptVersion: (fileName: string) => this.cache.getVersion(fileName).toString(),
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

                this.cache.updateSource(fileName, content);
                return ts.ScriptSnapshot.fromString(content);
            },
            getScriptFileNames: (): string[] => this.rootFiles,
            getCompilationSettings: () => options,
            getCustomTransformers: (): ts.CustomTransformers => this.emitTransformers,
        };
    }
}
