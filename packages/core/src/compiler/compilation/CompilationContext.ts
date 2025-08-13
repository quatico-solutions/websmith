/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import {
    type AddonContext,
    type Generator,
    type Processor,
    type Reporter,
    type ResultProcessor,
    ErrorMessage,
    InfoMessage,
} from "@quatico/websmith-api";
import path from "node:path";
import ts from "typescript";
import { type CompilerAddon } from "../addons";
import { FileCache } from "../cache";
import { concat } from "../collections";
import { CompilationHost } from "./CompilationHost";
import { createSharedHost } from "./shared-host";

export type CompilationContextOptions = {
    config?: unknown;
    tsConfig: ts.CompilerOptions;
    projectDir: string;
    reporter: Reporter;
    rootFiles: string[];
    system: ts.System;
    profile?: string;
    cliArgs?: ts.ParsedCommandLine;
    watchCallback?: (filePath: string) => void;
    registerDependencyCallback?: (filePath: string) => void;
};

export class CompilationContext implements AddonContext {
    protected generators: Generator[];
    protected processors: Processor[];
    protected transformers: ts.CustomTransformers;
    protected resultProcessors: ResultProcessor[] = [];
    protected rootFiles: string[];

    // Track which addon registered each function
    protected addonFunctions: WeakMap<Function, string> = new WeakMap();
    private currentAddonName?: string;

    private cache: FileCache;
    private languageHost: ts.LanguageServiceHost;
    private languageService: ts.LanguageService;
    private compilationHost: CompilationHost;
    private reporter: Reporter;
    private cliArgs: ts.ParsedCommandLine;
    private system: ts.System;
    private projectDir: string;
    private config: unknown;
    private watchCallback: (filePath: string) => void;
    private registerDependencyCb?: (filePath: string) => void;

    private assetAssetDependency: Map<string, string[]> = new Map();
    private assetCodeDependency: Map<string, string[]> = new Map();

    constructor(options: CompilationContextOptions) {
        const { config, tsConfig, projectDir, rootFiles, system, profile, cliArgs, watchCallback, registerDependencyCallback } = options;
        this.rootFiles = rootFiles;
        this.cliArgs = cliArgs ?? { options: {}, fileNames: [], errors: [] };
        this.projectDir = projectDir;
        this.transformers = {};
        this.processors = [];
        this.generators = [];
        this.system = system;
        this.config = config;
        this.watchCallback = watchCallback ?? (() => undefined);
        this.registerDependencyCb = registerDependencyCallback;
        this.languageHost = this.createLanguageServiceHost({
            system,
            tsConfig,
            profile,
        });
        this.reporter = options.reporter;
        this.compilationHost = new CompilationHost(this.languageHost);
        this.languageService = ts.createLanguageService(this.compilationHost, ts.createDocumentRegistry());
        this.cache = new FileCache(this.system);
    }

    public getSystem(): ts.System {
        return this.system;
    }

    public getCliArgs(): ts.ParsedCommandLine {
        return this.cliArgs;
    }

    public getReporter(): Reporter {
        return this.reporter;
    }

    public getLanguageService(): ts.LanguageService {
        return this.languageService;
    }

    public getProfileConfig(): unknown {
        return this.config ?? {};
    }

    protected isCodeFileExtension(filePath: string): boolean {
        // List of supported extensions by TypeScript: ts.Extension
        return !!filePath.match(/.*\.([tj]|m[tj]|c[tj])?sx?$/);
    }

    public addInputFile(filePath: string): void {
        if (!this.isCodeFileExtension(filePath)) {
            this.reporter.reportDiagnostic(
                new ErrorMessage(
                    `Only code files are supported for addInputFile. ${path.extname(filePath)} of ${filePath} is no valid code file extension.`
                )
            );
            return;
        }

        // TODO: Should only be allowed for Generators
        if (!this.rootFiles.includes(filePath)) {
            this.rootFiles.push(filePath);
        }
        if (this.watchCallback) {
            this.reporter.reportDiagnostic(new InfoMessage(`Adding ${filePath} to watch.`));
            this.watchCallback(filePath);
        }
    }

    // TODO: Extract to an DependencyCache interface that can be implemented as InMemory and Webpack
    public resolveDependency(dependencyPath?: string): string[] {
        if (dependencyPath !== undefined) {
            const resolvedDependency = this.assetAssetDependency.has(dependencyPath)
                ? this.assetAssetDependency.get(dependencyPath)?.flatMap(cur => this.resolveDependency(cur))
                : this.assetCodeDependency.has(dependencyPath)
                  ? this.assetCodeDependency.get(dependencyPath)
                  : undefined;

            if (resolvedDependency) {
                return resolvedDependency;
            }
        }
        throw new Error(`Cannot resolve dependency "${dependencyPath ?? "undefined"}."`);
    }

    public addAssetDependency(childPath: string, parentPath: string): void {
        // TODO: Extract to an DependencyCache interface that can be implemented as InMemory and Webpack
        if (this.isCodeFileExtension(childPath)) {
            this.reporter.reportDiagnostic(
                new ErrorMessage(
                    `Only non-code files are supported for addAssetDependency. ${path.extname(childPath)} of ${childPath} is a code file extension.`
                )
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
            this.reporter.reportDiagnostic(
                new ErrorMessage(
                    `Only code files are supported for addInputFile. ${path.extname(filePath)} of ${filePath} is no valid code file extension.`
                )
            );
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

    public resolvePath(filePath: string): string {
        return path.isAbsolute(filePath) ? filePath : this.system.resolvePath(path.join(this.projectDir, filePath));
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

    public registerTransformer(transformers: ts.CustomTransformers): this {
        Object.keys(transformers).forEach(kind => {
            // @ts-expect-error ts.CustomTransformers defines too many implicit any
            this.transformers[kind] = concat(this.transformers[kind], transformers[kind]);
        });
        return this;
    }

    public registerProcessor(processor: Processor): this {
        this.processors.push(processor);
        if (this.currentAddonName) {
            this.addonFunctions.set(processor, this.currentAddonName);
        }
        return this;
    }

    public registerGenerator(gen: Generator): this {
        this.generators.push(gen);
        if (this.currentAddonName) {
            this.addonFunctions.set(gen, this.currentAddonName);
        }
        return this;
    }

    public registerResultProcessor(emitter: ResultProcessor): this {
        this.resultProcessors.push(emitter);
        if (this.currentAddonName) {
            this.addonFunctions.set(emitter, this.currentAddonName);
        }
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
        return this.resultProcessors;
    }

    public activateAddon(addon: CompilerAddon): void {
        try {
            this.currentAddonName = addon.getName();
            addon.activate(this);
        } finally {
            this.currentAddonName = undefined;
        }
    }

    public getAddonName(func: Function): string {
        return this.addonFunctions.get(func) || "unknown addon function";
    }

    private createLanguageServiceHost({
        system,
        tsConfig,
        profile,
    }: {
        system: ts.System;
        tsConfig: ts.CompilerOptions;
        profile?: string;
    }): ts.LanguageServiceHost {
        return {
            ...createSharedHost(system),
            getScriptVersion: (fileName: string) => {
                fileName = system.resolvePath(fileName);
                const version = this.cache.getVersion(fileName).toString();
                return profile ? `${fileName}:${version}:${profile}` : `${fileName}:${version}`;
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
            getCompilationSettings: () => tsConfig,
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
