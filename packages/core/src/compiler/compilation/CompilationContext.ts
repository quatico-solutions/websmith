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

type TransformerFactory = ts.TransformerFactory<ts.SourceFile | ts.Bundle> | ts.CustomTransformerFactory;

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

    // Track files that have been processed by addons
    private addonProcessedFiles: Set<string> = new Set();

    // Track which addons changed each file, so diagnostics can name the addon that introduced a construct
    private addonChangedFiles: Map<string, Set<string>> = new Map();

    // Track which generator addons added each file, per source file being processed when they added it
    private addonAddedFiles: Map<string, Map<string, Set<string>>> = new Map();

    // Replaces the system that getSystem() returns while writes are observed
    private observedSystem?: ts.System;

    // Track the current source file being processed (used to mark source file when generators interact with compilation)
    private currentSourceFile?: string;

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
        return this.observedSystem ?? this.system;
    }

    /**
     * Runs a function while getSystem() returns a system that reports every writeFile to `onWrite` before writing.
     * The original system object is not changed.
     */
    public observeWrites<T>(onWrite: (fileName: string, text: string) => void, fn: () => T): T {
        const system = this.system;
        const previous = this.observedSystem;
        try {
            this.observedSystem = Object.create(system, {
                writeFile: {
                    value: (fileName: string, text: string, writeByteOrderMark?: boolean) => {
                        onWrite(fileName, text);
                        system.writeFile(fileName, text, writeByteOrderMark);
                    },
                },
            }) as ts.System;
            return fn();
        } finally {
            this.observedSystem = previous;
        }
    }

    public getCliArgs(): ts.ParsedCommandLine {
        return this.cliArgs;
    }

    public getCompilerOptions(): ts.CompilerOptions {
        return this.cliArgs.options;
    }

    public getFileNames(): string[] {
        return this.cliArgs.fileNames;
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
        this.markFileAsAddedByAddon(filePath);
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
        this.markFileAsAddedByAddon(filePath);
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
        const addonName = this.currentAddonName;
        Object.keys(transformers).forEach(kind => {
            const key = kind as keyof ts.CustomTransformers;
            const factories = transformers[key] as TransformerFactory[] | undefined;
            const added = addonName ? factories?.map(cur => this.attributeTransformer(cur, addonName)) : factories;
            const registered = this.transformers[key] as TransformerFactory[] | undefined;
            (this.transformers as Record<string, TransformerFactory[]>)[key] = concat(registered, added);
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
        this.runAsAddon(addon.getName(), () => addon.activate(this));
    }

    /**
     * Runs a function on behalf of an addon: functions and transformers it registers are recorded for the addon, and
     * files it adds through `addInputFile` / `addVirtualFile` are attributed to it.
     */
    public runAsAddon<T>(addonName: string, fn: () => T): T {
        const previous = this.currentAddonName;
        try {
            this.currentAddonName = addonName;
            return fn();
        } finally {
            this.currentAddonName = previous;
        }
    }

    public getAddonName(func: Function): string {
        return this.findAddonName(func) || "unknown addon function";
    }

    /** Returns the addon that registered a function, undefined when it was registered outside an addon. */
    public findAddonName(func: Function): string | undefined {
        return this.addonFunctions.get(func);
    }

    /**
     * Mark a file as having been processed by an addon.
     * This is used to track which files should be emitted when addonEmitOnly mode is enabled.
     */
    public markFileAsAddonProcessed(fileName: string): void {
        const resolvedPath = this.system.resolvePath(fileName);
        this.addonProcessedFiles.add(resolvedPath);
    }

    /**
     * Check if a file has been processed by an addon.
     * Used to determine if a file should be emitted in addonEmitOnly mode.
     */
    public isFileProcessedByAddon(fileName: string): boolean {
        const resolvedPath = this.system.resolvePath(fileName);
        return this.addonProcessedFiles.has(resolvedPath);
    }

    /**
     * Get all files that have been marked as addon-processed.
     * Returns a copy of the internal set, not the original.
     */
    public getAddonProcessedFiles(): Set<string> {
        return new Set(this.addonProcessedFiles);
    }

    /**
     * Record that an addon changed a file, for diagnostics that name the addon.
     * Unlike markFileAsAddonProcessed, this records which addon changed the file.
     */
    public markFileAsChangedByAddon(fileName: string, addonName: string): void {
        const resolvedPath = this.system.resolvePath(fileName);
        const addons = this.addonChangedFiles.get(resolvedPath) ?? new Set();
        this.addonChangedFiles.set(resolvedPath, addons.add(addonName));
    }

    /**
     * Get the addons that changed a file, in the order they changed it; empty when no addon changed it.
     */
    public getAddonsChangingFile(fileName: string): string[] {
        const resolvedPath = this.system.resolvePath(fileName);
        const addedBy = [...this.addonAddedFiles.values()].flatMap(cur => [...(cur.get(resolvedPath) ?? [])]);
        return [...new Set([...addedBy, ...(this.addonChangedFiles.get(resolvedPath) ?? [])])];
    }

    /**
     * Forget which addons changed a file and which files generators added while processing it, before the file is
     * processed again. Generators that added the file itself while processing another file stay recorded.
     */
    public resetAddonChanges(fileName: string): void {
        const resolvedPath = this.system.resolvePath(fileName);
        this.addonChangedFiles.delete(resolvedPath);
        this.addonAddedFiles.delete(resolvedPath);
    }

    /**
     * Set the current source file being processed.
     * Used to mark the source file when generators interact with compilation via addInputFile/addVirtualFile.
     * @internal
     */
    public setCurrentSourceFile(fileName: string | undefined): void {
        this.currentSourceFile = fileName;
    }

    private markFileAsAddedByAddon(filePath: string): void {
        // Mark file as addon-processed since it was explicitly added by an addon
        this.markFileAsAddonProcessed(filePath);
        // Also mark the current source file as processed if generators are interacting with compilation
        if (this.currentSourceFile) {
            this.markFileAsAddonProcessed(this.currentSourceFile);
        }
        // Only the added file is attributed to the generator's addon: the generator does not change the source file
        if (this.currentAddonName) {
            const source = this.system.resolvePath(this.currentSourceFile ?? "");
            const added = this.addonAddedFiles.get(source) ?? new Map<string, Set<string>>();
            const resolvedPath = this.system.resolvePath(filePath);
            added.set(resolvedPath, (added.get(resolvedPath) ?? new Set()).add(this.currentAddonName));
            this.addonAddedFiles.set(source, added);
        }
    }

    /**
     * Wraps a transformer factory to record the files its transformer changes for the addon. TypeScript returns the
     * input node when a transformer changes nothing, so a returned node other than the input marks a change.
     * The wrapper returns exactly what the wrapped transformer returns.
     */
    private attributeTransformer(factory: TransformerFactory, addonName: string): TransformerFactory {
        const record = (input: ts.SourceFile | ts.Bundle, output: ts.SourceFile | ts.Bundle): void => {
            if (output !== input) {
                (ts.isBundle(input) ? input.sourceFiles : [input]).forEach(cur => this.markFileAsChangedByAddon(cur.fileName, addonName));
            }
        };
        return ((context: ts.TransformationContext): ts.Transformer<ts.SourceFile | ts.Bundle> | ts.CustomTransformer => {
            const transformer = factory(context);
            if (typeof transformer === "function") {
                return (node: ts.SourceFile | ts.Bundle) => {
                    const result = transformer(node);
                    record(node, result);
                    return result;
                };
            }
            return {
                transformSourceFile: (node: ts.SourceFile) => {
                    const result = transformer.transformSourceFile(node);
                    record(node, result);
                    return result;
                },
                transformBundle: (node: ts.Bundle) => {
                    const result = transformer.transformBundle(node);
                    record(node, result);
                    return result;
                },
            };
        }) as TransformerFactory;
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
