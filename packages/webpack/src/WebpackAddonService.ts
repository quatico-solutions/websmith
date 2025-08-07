/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type CompilationProfile, type Reporter, WarnMessage } from "@quatico/websmith-api";
import { type CompilationContext, type CompilerAddon, type CompilerAddons, compilerAddons } from "@quatico/websmith-core";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { WebpackAddonContext } from "./WebpackAddonContext";

export interface WebpackAddonConfig {
    addonsDir?: string;
    addons?: string[];
    profiles?: Record<string, CompilationProfile>;
    system: ts.System;
    reporter: Reporter;
    cacheDir?: string;
}

interface AddonCacheEntry {
    compiledPath: string;
    sourceHash: string;
    timestamp: number;
    dependencies: string[];
}

/**
 * Webpack-specific addon service that provides isolated addon compilation
 * and caching to avoid conflicts with webpack's TypeScript compilation.
 */
export class WebpackAddonService {
    private readonly config: WebpackAddonConfig;
    private readonly cache = new Map<string, AddonCacheEntry>();
    private readonly loadedAddons = new Map<string, CompilerAddon>();
    private readonly cacheDir: string;

    constructor(config: WebpackAddonConfig) {
        this.config = config;
        this.cacheDir = config.cacheDir || path.join(this.config.system?.getCurrentDirectory() || process.cwd(), ".websmith-cache", "addons");
        this.ensureCacheDirectory();
        this.loadCacheIndex();
    }

    /**
     * Get available addons for webpack compilation.
     * This method ensures addons are compiled and cached separately from webpack's TS context.
     */
    public getAvailableAddons(): CompilerAddons {
        if (!this.config.system || !this.config.addonsDir || !this.config.system.directoryExists(this.config.addonsDir)) {
            if (this.config.addonsDir && this.config.system) {
                this.config.reporter.reportDiagnostic(new WarnMessage(`Addons directory "${this.config.addonsDir}" does not exist.`));
            } else {
                this.config.reporter.reportDiagnostic(new WarnMessage(`No addons directory configured or system not available.`));
            }
            return this.createEmptyAddons();
        }

        // Load and compile addons if necessary
        this.compileAndLoadAddons();

        const result = this.createCompilerAddons();
        this.config.reporter.reportDiagnostic(new WarnMessage(`Loaded ${result.length} addons from ${this.config.addonsDir}`));

        return result;
    }

    /**
     * Apply addon transformations to a compilation context.
     * This is called during webpack compilation for each file.
     */
    public applyAddonsToContext(context: CompilationContext, profile?: string): WebpackAddonContext {
        const activeAddons = this.getActiveAddons(profile);
        const profileConfig = profile ? this.config.profiles?.[profile] : undefined;

        const webpackContext = new WebpackAddonContext(this.config.system, this.config.reporter, profile, profileConfig, context);

        for (const addon of activeAddons) {
            try {
                addon.activate(webpackContext);
            } catch (error) {
                this.config.reporter.reportDiagnostic(
                    new WarnMessage(`Failed to activate addon "${addon.getName()}": ${error instanceof Error ? error.message : String(error)}`)
                );
            }
        }

        return webpackContext;
    }

    /**
     * Generate addon output files after webpack compilation.
     * This handles generators and result processors.
     */
    public generateAddonOutputs(compiledFiles: string[], profile?: string): void {
        const activeAddons = this.getActiveAddons(profile);
        const profileConfig = profile ? this.config.profiles?.[profile] : undefined;

        const webpackContext = new WebpackAddonContext(this.config.system, this.config.reporter, profile, profileConfig);

        for (const addon of activeAddons) {
            try {
                addon.activate(webpackContext);
            } catch (error) {
                this.config.reporter.reportDiagnostic(
                    new WarnMessage(
                        `Failed to execute addon "${addon.getName()}" post-compilation: ${error instanceof Error ? error.message : String(error)}`
                    )
                );
            }
        }

        // Execute result processors with the compiled files
        webpackContext.executeResultProcessors(compiledFiles);
    }

    private compileAndLoadAddons(): void {
        const addonDirs = this.findAddonDirectories();
        this.config.reporter.reportDiagnostic(
            new WarnMessage(`Found ${addonDirs.length} addon directories: ${addonDirs.map(d => path.basename(d)).join(", ")}`)
        );

        for (const addonDir of addonDirs) {
            const addonName = path.basename(addonDir);

            try {
                const compiledPath = this.compileAddonIfNeeded(addonDir, addonName);
                if (compiledPath) {
                    this.loadCompiledAddon(compiledPath, addonName);
                    this.config.reporter.reportDiagnostic(new WarnMessage(`Successfully loaded addon: ${addonName}`));
                } else {
                    this.config.reporter.reportDiagnostic(new WarnMessage(`No compiled path for addon: ${addonName}`));
                }
            } catch (error) {
                this.config.reporter.reportDiagnostic(
                    new WarnMessage(`Failed to compile addon "${addonName}": ${error instanceof Error ? error.message : String(error)}`)
                );
            }
        }
    }

    private compileAddonIfNeeded(addonDir: string, addonName: string): string | null {
        // Check if this is a pre-built addon (has index.js)
        const preBuiltIndexPath = path.join(addonDir, "index.js");
        if (fs.existsSync(preBuiltIndexPath)) {
            return preBuiltIndexPath;
        }

        // Otherwise, try to compile from source
        const sourceFiles = this.findAddonSourceFiles(addonDir);
        if (sourceFiles.length === 0) {
            return null;
        }

        const sourceHash = this.calculateSourceHash(sourceFiles);
        const cachedEntry = this.cache.get(addonName);

        // Check if addon needs recompilation
        if (cachedEntry && cachedEntry.sourceHash === sourceHash && this.config.system.fileExists(cachedEntry.compiledPath)) {
            return cachedEntry.compiledPath;
        }

        // Compile addon in isolation
        return this.compileAddonIsolated(addonDir, addonName, sourceFiles, sourceHash);
    }

    private compileAddonIsolated(addonDir: string, addonName: string, sourceFiles: string[], sourceHash: string): string {
        const outputDir = path.join(this.cacheDir, addonName);
        this.config.system.createDirectory(outputDir);

        // Create isolated TypeScript program for addon compilation
        const compilerOptions: ts.CompilerOptions = {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.CommonJS,
            moduleResolution: ts.ModuleResolutionKind.Node10,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            skipLibCheck: true,
            outDir: outputDir,
            rootDir: addonDir,
            declaration: false,
            sourceMap: false,
            noEmit: false,
            strict: false, // Be lenient with addon compilation
        };

        // Create separate program instance for addon compilation
        const program = ts.createProgram(sourceFiles, compilerOptions);
        const emitResult = program.emit();

        if (emitResult.emitSkipped || emitResult.diagnostics.length > 0) {
            const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
            const errors = diagnostics.map(diagnostic => {
                if (diagnostic.file) {
                    const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
                    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                    return `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
                } else {
                    return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                }
            });

            throw new Error(`Addon compilation failed:\n${errors.join("\n")}`);
        }

        // Find the compiled entry point
        const entryFile = sourceFiles.find(f => f.endsWith("addon.ts") || f.endsWith("index.ts"));
        if (!entryFile) {
            throw new Error(`No addon entry point found in ${addonDir}`);
        }

        const compiledPath = path.join(outputDir, path.relative(addonDir, entryFile).replace(/\.ts$/, ".js"));

        // Update cache
        this.cache.set(addonName, {
            compiledPath,
            sourceHash,
            timestamp: Date.now(),
            dependencies: sourceFiles,
        });

        this.saveCacheIndex();
        return compiledPath;
    }

    private loadCompiledAddon(compiledPath: string, addonName: string): void {
        if (this.loadedAddons.has(addonName)) {
            return; // Already loaded
        }

        try {
            // Clear require cache to ensure fresh load
            delete require.cache[require.resolve(compiledPath)];

            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const addonModule = require(compiledPath);
            const moduleExports = addonModule?.default || addonModule;

            if (!moduleExports || typeof moduleExports.activate !== "function") {
                throw new Error(`Addon "${addonName}" does not export an "activate" function`);
            }

            const addon: CompilerAddon = {
                getName: () => addonName,
                activate: moduleExports.activate,
            };

            this.loadedAddons.set(addonName, addon);
        } catch (error) {
            throw new Error(`Failed to load compiled addon "${addonName}": ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private findAddonDirectories(): string[] {
        if (!this.config.addonsDir || !this.config.system) {
            return [];
        }

        try {
            return this.config.system
                .readDirectory(this.config.addonsDir, undefined, undefined, undefined, 1)
                .filter(entry => {
                    const fullPath = path.join(this.config.addonsDir!, entry);
                    return this.config.system.directoryExists(fullPath);
                })
                .map(entry => path.join(this.config.addonsDir!, entry));
        } catch {
            return [];
        }
    }

    private findAddonSourceFiles(addonDir: string): string[] {
        const files: string[] = [];

        if (!this.config.system) {
            return files;
        }

        try {
            const entries = this.config.system.readDirectory(addonDir, [".ts", ".tsx"], undefined, undefined, 2);
            for (const entry of entries) {
                const fullPath = path.join(addonDir, entry);
                if (this.config.system.fileExists(fullPath)) {
                    files.push(fullPath);
                }
            }
        } catch {
            // Ignore errors, return empty array
        }

        return files;
    }

    private calculateSourceHash(sourceFiles: string[]): string {
        if (!this.config.system) {
            return "";
        }

        const contents = sourceFiles.map(file => this.config.system.readFile(file) || "").join("");

        // Simple hash function for content
        let hash = 0;
        for (let i = 0; i < contents.length; i++) {
            const char = contents.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return hash.toString(36);
    }

    private getActiveAddons(profile?: string): CompilerAddon[] {
        const requestedAddons = this.config.addons || [];

        // Add profile-specific addons
        if (profile && this.config.profiles?.[profile]?.addons) {
            requestedAddons.push(...this.config.profiles[profile].addons);
        }

        return requestedAddons.map(name => this.loadedAddons.get(name)).filter((addon): addon is CompilerAddon => addon !== undefined);
    }

    private createCompilerAddons(): CompilerAddons {
        const addons = Array.from(this.loadedAddons.values());
        return compilerAddons(addons);
    }

    private createEmptyAddons(): CompilerAddons {
        return compilerAddons([]);
    }

    private ensureCacheDirectory(): void {
        try {
            // Use Node.js fs for directory creation since TypeScript system might not support recursive creation
            if (!fs.existsSync(this.cacheDir)) {
                fs.mkdirSync(this.cacheDir, { recursive: true });
            }
        } catch (error) {
            // Silently ignore directory creation errors - cache is optional
            this.config.reporter.reportDiagnostic(
                new WarnMessage(`Failed to create addon cache directory: ${error instanceof Error ? error.message : String(error)}`)
            );
        }
    }

    private loadCacheIndex(): void {
        if (!this.config.system) {
            return;
        }

        const indexPath = path.join(this.cacheDir, "index.json");

        try {
            if (this.config.system.fileExists(indexPath)) {
                const indexContent = this.config.system.readFile(indexPath);
                if (indexContent) {
                    const cacheData = JSON.parse(indexContent);
                    for (const [name, entry] of Object.entries(cacheData)) {
                        this.cache.set(name, entry as AddonCacheEntry);
                    }
                }
            }
        } catch {
            // Ignore cache loading errors, start with empty cache
        }
    }

    private saveCacheIndex(): void {
        if (!this.config.system) {
            return;
        }

        const indexPath = path.join(this.cacheDir, "index.json");

        try {
            const cacheData = Object.fromEntries(this.cache);
            this.config.system.writeFile(indexPath, JSON.stringify(cacheData, null, 2));
        } catch {
            // Ignore cache saving errors
        }
    }
}
