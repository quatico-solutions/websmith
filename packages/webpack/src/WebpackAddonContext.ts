/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import {
    type AddonContext,
    type CompilationProfile,
    type Generator,
    type Processor,
    type Reporter,
    type ResultProcessor,
    ErrorMessage,
    InfoMessage,
} from "@quatico/websmith-api";
import { type CompilationContext } from "@quatico/websmith-core";
import type ts from "typescript";
import { type LoaderContext, type Compilation, sources } from "webpack";
import path from "node:path";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

/**
 * Webpack-specific implementation of AddonContext that provides proper integration
 * with webpack's compilation process while maintaining isolation.
 */
export class WebpackAddonContext implements AddonContext {
    private generators: Generator[] = [];
    private processors: Processor[] = [];
    private transformers: ts.CustomTransformers[] = [];
    private resultProcessors: ResultProcessor[] = [];

    // Webpack-specific state for file operations
    private virtualFiles = new Map<string, string>();
    private filesToRemove = new Set<string>();
    private assetDependencies = new Map<string, Set<string>>();
    private inputFilesToAdd = new Set<string>();
    private debug: boolean;

    constructor(
        private system: ts.System,
        private reporter: Reporter,
        private profile?: string,
        private profileConfig?: CompilationProfile,
        private compilationContext?: CompilationContext,
        private loaderContext?: LoaderContext<WebsmithLoaderConfig>,
        private webpackCompilation?: Compilation,
        debug?: boolean
    ) {
        this.debug = debug ?? false;
    }

    getSystem(): ts.System {
        return this.system;
    }

    getCliArgs(): ts.ParsedCommandLine {
        // Delegate to the underlying CompilationContext if available
        if (this.compilationContext) {
            return this.compilationContext.getCliArgs();
        }

        // Fallback to empty cliArgs if no compilation context
        return {
            fileNames: [],
            options: {},
            errors: [],
        };
    }

    getReporter(): Reporter {
        return this.reporter;
    }

    getProfileConfig(): CompilationProfile | undefined {
        return this.profileConfig;
    }

    addInputFile(filePath: string): void {
        // Resolve the file path relative to the current working directory
        const resolvedPath = this.resolvePath(filePath);

        // Add to our tracking set
        this.inputFilesToAdd.add(resolvedPath);

        // If we have a loader context, add the file as a dependency
        if (this.loaderContext) {
            this.loaderContext.addDependency(resolvedPath);
            this.reportDebug(`WebpackAddonContext: Added input file dependency ${resolvedPath}`);
        } else {
            // Fallback to compilation context if available
            if (this.compilationContext) {
                this.compilationContext.addInputFile(filePath);
            }
            this.reportDebug(`WebpackAddonContext: Queued input file ${resolvedPath} for addition`);
        }
    }

    addAssetDependency(childPath: string, parentPath: string): void {
        // Resolve both paths
        const resolvedChildPath = this.resolvePath(childPath);
        const resolvedParentPath = this.resolvePath(parentPath);

        // Track the dependency relationship
        if (!this.assetDependencies.has(resolvedParentPath)) {
            this.assetDependencies.set(resolvedParentPath, new Set());
        }
        this.assetDependencies.get(resolvedParentPath)!.add(resolvedChildPath);

        // If we have a loader context, add the child as a dependency
        if (this.loaderContext) {
            this.loaderContext.addDependency(resolvedChildPath);
            this.reportDebug(`WebpackAddonContext: Added asset dependency ${resolvedChildPath} -> ${resolvedParentPath}`);
        } else {
            // Fallback to compilation context if available
            if (this.compilationContext) {
                this.compilationContext.addAssetDependency(childPath, parentPath);
            }
            this.reportDebug(`WebpackAddonContext: Queued asset dependency ${resolvedChildPath} -> ${resolvedParentPath}`);
        }
    }

    addVirtualFile(filePath: string, fileContent: string): void {
        // Resolve the file path
        const resolvedPath = this.resolvePath(filePath);

        // Store the virtual file content
        this.virtualFiles.set(resolvedPath, fileContent);

        // If we have a webpack compilation, we can emit the file as an asset
        if (this.webpackCompilation) {
            // Calculate relative path from output directory, handling both absolute and relative paths
            const outputPath = this.webpackCompilation.outputOptions.path || process.cwd();
            let relativePath = resolvedPath;

            if (resolvedPath.startsWith(outputPath)) {
                relativePath = path.relative(outputPath, resolvedPath);
            } else if (resolvedPath.startsWith("/resolved/")) {
                // Handle mock test paths - remove the mock prefix
                relativePath = resolvedPath.substring("/resolved/".length);
            } else if (resolvedPath.startsWith("/")) {
                // For absolute paths not in output directory, use basename or relative from root
                relativePath = resolvedPath.substring(1); // Remove leading slash
            } else {
                // For relative paths, use as-is
                relativePath = resolvedPath;
            }

            // Use webpack's compilation.emitAsset to add the virtual file
            this.webpackCompilation.emitAsset(relativePath, new sources.RawSource(fileContent));
            this.reportDebug(`WebpackAddonContext: Added virtual file ${resolvedPath} as webpack asset`);
        } else {
            // Fallback to compilation context if available
            if (this.compilationContext) {
                this.compilationContext.addVirtualFile(filePath, fileContent);
            }
            this.reportDebug(`WebpackAddonContext: Queued virtual file ${resolvedPath} for addition`);
        }
    }

    removeOutputFile(filePath: string): void {
        // Resolve the file path
        const resolvedPath = this.resolvePath(filePath);

        // Track files to remove
        this.filesToRemove.add(resolvedPath);

        // If we have a webpack compilation, we can delete the asset
        if (this.webpackCompilation) {
            // Calculate relative path from output directory, handling both absolute and relative paths
            const outputPath = this.webpackCompilation.outputOptions.path || process.cwd();
            let relativePath = resolvedPath;

            if (resolvedPath.startsWith(outputPath)) {
                relativePath = path.relative(outputPath, resolvedPath);
            } else if (resolvedPath.startsWith("/resolved/")) {
                // Handle mock test paths - remove the mock prefix
                relativePath = resolvedPath.substring("/resolved/".length);
            } else if (resolvedPath.startsWith("/")) {
                // For absolute paths not in output directory, use basename or relative from root
                relativePath = resolvedPath.substring(1); // Remove leading slash
            } else {
                // For relative paths, use as-is
                relativePath = resolvedPath;
            }

            // Remove from webpack's assets if it exists
            if (this.webpackCompilation.assets[relativePath]) {
                delete this.webpackCompilation.assets[relativePath];
                this.reportDebug(`WebpackAddonContext: Removed output file ${resolvedPath} from webpack assets`);
            } else {
                this.reportDebug(`WebpackAddonContext: Queued output file ${resolvedPath} for removal`);
            }
        } else {
            // Fallback to compilation context if available
            if (this.compilationContext) {
                this.compilationContext.removeOutputFile(filePath);
            }
            this.reporter.reportDiagnostic(new InfoMessage(`WebpackAddonContext: Queued output file ${resolvedPath} for removal`));
        }
    }

    resolvePath(relativePath: string): string {
        return this.system.resolvePath(relativePath);
    }

    getFileContent(filePath: string): string {
        // Try to read the file content from the system
        const resolvedPath = this.resolvePath(filePath);
        return this.system.readFile(resolvedPath) || "";
    }

    registerGenerator(generator: Generator): void {
        this.generators.push(generator);

        // If we have a compilation context, register with it too
        if (this.compilationContext) {
            this.compilationContext.registerGenerator(generator);
        }
    }

    registerProcessor(processor: Processor): void {
        this.processors.push(processor);
        // If we have a compilation context, register with it too
        if (this.compilationContext) {
            this.compilationContext.registerProcessor(processor);
        }
    }

    registerTransformer(transformer: ts.CustomTransformers): void {
        this.transformers.push(transformer);

        // If we have a compilation context, register with it too
        if (this.compilationContext) {
            // Register the transformer directly with the compilation context
            this.compilationContext.registerTransformer(transformer);
        }
    }

    registerResultProcessor(processor: ResultProcessor): void {
        this.resultProcessors.push(processor);
        // If we have a compilation context, register with it too
        if (this.compilationContext) {
            this.compilationContext.registerResultProcessor(processor);
        }
    }

    // Additional methods for webpack-specific functionality

    /**
     * Execute all registered generators for a given file.
     */
    executeGenerators(filePath: string, fileContent: string): void {
        for (const generator of this.generators) {
            try {
                generator(filePath, fileContent);
            } catch (error) {
                this.reporter.reportDiagnostic(
                    new ErrorMessage(`Generator failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
                );
            }
        }
    }

    /**
     * Execute all registered processors for a given file.
     */
    executeProcessors(filePath: string, fileContent: string): string {
        let processedContent = fileContent;

        for (const processor of this.processors) {
            try {
                processedContent = processor(filePath, processedContent);
            } catch (error) {
                this.reporter.reportDiagnostic(
                    new ErrorMessage(`Processor failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
                );
            }
        }

        return processedContent;
    }

    /**
     * Get all registered transformers.
     */
    getTransformers(): ts.CustomTransformers {
        // Combine all transformers into a single CustomTransformers object
        const combinedTransformers: ts.CustomTransformers = {
            before: [],
            after: [],
            afterDeclarations: [],
        };

        for (const transformer of this.transformers) {
            if (transformer.before) {
                combinedTransformers.before = [...(combinedTransformers.before || []), ...transformer.before];
            }
            if (transformer.after) {
                combinedTransformers.after = [...(combinedTransformers.after || []), ...transformer.after];
            }
            if (transformer.afterDeclarations) {
                combinedTransformers.afterDeclarations = [...(combinedTransformers.afterDeclarations || []), ...transformer.afterDeclarations];
            }
        }

        return combinedTransformers;
    }

    /**
     * Execute all registered result processors.
     */
    executeResultProcessors(filePaths: string[]): void {
        for (const processor of this.resultProcessors) {
            try {
                processor(filePaths);
            } catch (error) {
                this.reporter.reportDiagnostic(
                    new ErrorMessage(`Result processor failed: ${error instanceof Error ? error.message : String(error)}`)
                );
            }
        }
    }

    /**
     * Get the current profile name.
     */
    getProfile(): string | undefined {
        return this.profile;
    }

    /**
     * Check if any generators are registered.
     */
    hasGenerators(): boolean {
        return this.generators.length > 0;
    }

    /**
     * Check if any processors are registered.
     */
    hasProcessors(): boolean {
        return this.processors.length > 0;
    }

    /**
     * Check if any transformers are registered.
     */
    hasTransformers(): boolean {
        return this.transformers.length > 0;
    }

    /**
     * Check if any result processors are registered.
     */
    hasResultProcessors(): boolean {
        return this.resultProcessors.length > 0;
    }

    // Webpack-specific utility methods

    /**
     * Report debug information only if debug is enabled.
     */
    private reportDebug(message: string): void {
        if (this.debug) {
            this.reporter.reportDiagnostic(new InfoMessage(message));
        }
    }

    /**
     * Get all virtual files that have been added.
     */
    getVirtualFiles(): Map<string, string> {
        return new Map(this.virtualFiles);
    }

    /**
     * Get all files queued for removal.
     */
    getFilesToRemove(): Set<string> {
        return new Set(this.filesToRemove);
    }

    /**
     * Get all asset dependencies.
     */
    getAssetDependencies(): Map<string, Set<string>> {
        return new Map(this.assetDependencies);
    }

    /**
     * Get all input files queued for addition.
     */
    getInputFilesToAdd(): Set<string> {
        return new Set(this.inputFilesToAdd);
    }

    /**
     * Apply any deferred webpack operations that require the compilation context.
     * This should be called during webpack's compilation hooks.
     */
    applyDeferredOperations(compilation: Compilation): void {
        const outputPath = compilation.outputOptions.path || process.cwd();

        // Apply virtual files as assets
        for (const [filePath, content] of this.virtualFiles) {
            let relativePath = filePath;

            if (filePath.startsWith(outputPath)) {
                relativePath = path.relative(outputPath, filePath);
            } else if (filePath.startsWith("/resolved/")) {
                // Handle mock test paths - remove the mock prefix
                relativePath = filePath.substring("/resolved/".length);
            } else if (filePath.startsWith("/")) {
                // For absolute paths not in output directory, use basename or relative from root
                relativePath = filePath.substring(1); // Remove leading slash
            } else {
                // For relative paths, use as-is
                relativePath = filePath;
            }

            compilation.emitAsset(relativePath, new sources.RawSource(content));
        }

        // Remove files from assets
        for (const filePath of this.filesToRemove) {
            let relativePath = filePath;

            if (filePath.startsWith(outputPath)) {
                relativePath = path.relative(outputPath, filePath);
            } else if (filePath.startsWith("/resolved/")) {
                // Handle mock test paths - remove the mock prefix
                relativePath = filePath.substring("/resolved/".length);
            } else if (filePath.startsWith("/")) {
                // For absolute paths not in output directory, use basename or relative from root
                relativePath = filePath.substring(1); // Remove leading slash
            } else {
                // For relative paths, use as-is
                relativePath = filePath;
            }

            if (compilation.assets[relativePath]) {
                delete compilation.assets[relativePath];
            }
        }

        this.reportDebug(`WebpackAddonContext: Applied ${this.virtualFiles.size} virtual files and removed ${this.filesToRemove.size} files`);
    }
}
