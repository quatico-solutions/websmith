/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonContext, Generator, Processor, Reporter, ResultProcessor } from "@quatico/websmith-api";
import { extname, isAbsolute, join } from "path";
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
    watchCallback?: (filePath: string) => void;
    registerDependencyCallback?: (filePath: string) => void;
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
    private watchCallback: (filePath: string) => void;
    private registerDependencyCb?: (filePath: string) => void;

    private assetAssetDependency: Map<string, string[]> = new Map();
    private assetCodeDependency: Map<string, string[]> = new Map();

    constructor(options: CompilationContextOptions) {
        const { buildDir, config, program, project, projectDir, rootFiles, system, target, tsconfig, watchCallback, registerDependencyCallback } =
            options;
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
        this.watchCallback = watchCallback ?? (() => undefined);
        this.registerDependencyCb = registerDependencyCallback;
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

    protected isCodeFileExtension(filePath: string): boolean {
        // List of supported extensions by TypeScript: ts.Extension
        return !!filePath.match(/.*\.([tj]|m[tj]|c[tj])?sx?$/);
    }

    public addInputFile(filePath: string): void {
        if (!this.isCodeFileExtension(filePath)) {
            // eslint-disable-next-line no-console
            console.error(`Only code files are supported for addInputFile. ${extname(filePath)} of ${filePath} is no valid code file extension.`);
            return;
        }

        // TODO: Should only be allowed for Generators
        if (!this.rootFiles.includes(filePath)) {
            this.rootFiles.push(filePath);
        }
        if (this.watchCallback) {
            // eslint-disable-next-line no-console
            console.error(`add ${filePath} to watch`);
            this.watchCallback(filePath);
        }
    }

    // TODO: Extract to an DependencyCache interface that can be implemented as InMemory and Webpack
    public resolveDependency(dependencyPath?: string): string[] {
        if (dependencyPath !== undefined) {
            const resolvedDependency = this.assetAssetDependency.has(dependencyPath)
                ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  this.assetAssetDependency.get(dependencyPath)?.flatMap(cur => this.resolveDependency(cur))
                   // this.resolveDependency(this.assetAssetDependency.get(dependencyPath)!)
                : this.assetCodeDependency.has(dependencyPath)
                ? this.assetCodeDependency.get(dependencyPath)
                : undefined;

            if (resolvedDependency) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                return resolvedDependency;
            }
        }
        throw new Error(`Cannot resolve dependency "${dependencyPath ?? "undefined"}."`);
    }

    public addAssetDependency(childPath: string, parentPath: string): void {
        // TODO: Extract to an DependencyCache interface that can be implemented as InMemory and Webpack
        if (this.isCodeFileExtension(childPath)) {
            // eslint-disable-next-line no-console
            console.error(
                `Only non-code files are supported for addAssetDependency. ${extname(childPath)} of ${childPath} is a code file extension.`
            );
            return;
        }

        if (this.registerDependencyCb) {
            this.registerDependencyCb(childPath);
        } else {
            this.registerDependency(childPath, parentPath);
        }
    }

    public addVirtualFile(filePath: string, fileContent: string): void {
        if (!this.isCodeFileExtension(filePath)) {
            // eslint-disable-next-line no-console
            console.error(`Only code files are supported for addInputFile. ${extname(filePath)} of ${filePath} is no valid code file extension.`);
            return;
        }
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

    public getTransformers(): ts.CustomTransformers {
        return this.transformers;
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

    protected registerDependency(childPath: string, parentPath: string) {
        const registerForWatch = () => {
            if (this.watchCallback) {
                this.watchCallback(childPath);
            }
        };

        if (this.isCodeFileExtension(parentPath)) {
            if (!this.assetCodeDependency.has(childPath)) {
                registerForWatch();
            }

            const dependencies = this.assetCodeDependency.get(childPath) ?? [];
            if (!dependencies.includes(parentPath)) {
                dependencies.push(parentPath);
            }
            this.assetCodeDependency.set(childPath, dependencies);
        } else {
            if (!this.assetAssetDependency.has(childPath)) {
                registerForWatch();
            }

            const dependencies = this.assetAssetDependency.get(childPath) ?? [];
            if (!dependencies.includes(parentPath)) {
                dependencies.push(parentPath);
            }
            this.assetAssetDependency.set(childPath, dependencies);
        }
    }
}
