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

/**
 * Webpack-specific implementation of AddonContext that provides proper integration
 * with webpack's compilation process while maintaining isolation.
 */
export class WebpackAddonContext implements AddonContext {
    private generators: Generator[] = [];
    private processors: Processor[] = [];
    private transformers: ts.CustomTransformers[] = [];
    private resultProcessors: ResultProcessor[] = [];

    constructor(
        private system: ts.System,
        private reporter: Reporter,
        private profile?: string,
        private profileConfig?: CompilationProfile,
        private compilationContext?: CompilationContext
    ) {}

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
        // In webpack context, we can't directly add input files
        // Log for debugging purposes
        this.reporter.reportDiagnostic(
            new InfoMessage(`WebpackAddonContext: addInputFile called for ${filePath} (not implemented in webpack context).`)
        );
    }

    addAssetDependency(childPath: string, parentPath: string): void {
        // In webpack context, we can't directly manage asset dependencies
        // Log for debugging purposes
        this.reporter.reportDiagnostic(
            new InfoMessage(`WebpackAddonContext: addAssetDependency called for ${childPath} -> ${parentPath} (not implemented in webpack context).`)
        );
    }

    addVirtualFile(filePath: string, _fileContent: string): void {
        // In webpack context, we can't directly add virtual files
        // Log for debugging purposes
        this.reporter.reportDiagnostic(
            new InfoMessage(`WebpackAddonContext: addVirtualFile called for ${filePath} (not implemented in webpack context).`)
        );
    }

    removeOutputFile(filePath: string): void {
        // In webpack context, we can't directly remove output files
        // Log for debugging purposes
        this.reporter.reportDiagnostic(
            new InfoMessage(`WebpackAddonContext: removeOutputFile called for ${filePath} (not implemented in webpack context)`)
        );
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
}
