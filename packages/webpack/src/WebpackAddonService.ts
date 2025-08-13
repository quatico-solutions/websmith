/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type CompilationProfile, ErrorMessage, InfoMessage, type Reporter, WarnMessage } from "@quatico/websmith-api";
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
    debug?: boolean;
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
        if (this.config.debug) {
            this.config.reporter.reportDiagnostic(new InfoMessage(`Loaded ${result.length} addons from ${this.config.addonsDir}.`));
        }
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
                    new ErrorMessage(`Failed to activate addon "${addon.getName()}": ${error instanceof Error ? error.message : String(error)}`)
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
                    new ErrorMessage(
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
        if (this.config.debug) {
            this.config.reporter.reportDiagnostic(
                new InfoMessage(`Found ${addonDirs.length} addon directories: ${addonDirs.map(d => path.basename(d)).join(", ")}.`)
            );
        }

        for (const addonDir of addonDirs) {
            const addonName = path.basename(addonDir);

            try {
                const compiledPath = this.compileAddonIfNeeded(addonDir, addonName);
                if (compiledPath) {
                    this.loadCompiledAddon(compiledPath, addonName);
                    if (this.config.debug) {
                        this.config.reporter.reportDiagnostic(new InfoMessage(`Successfully loaded addon: ${addonName}.`));
                    }
                } else {
                    this.config.reporter.reportDiagnostic(new WarnMessage(`No compiled path for addon: ${addonName}.`));
                }
            } catch (error) {
                this.config.reporter.reportDiagnostic(
                    new ErrorMessage(`Failed to compile addon "${addonName}": ${error instanceof Error ? error.message : String(error)}`)
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

        const preBuiltAddonPath = path.join(addonDir, "addon.js");
        if (fs.existsSync(preBuiltAddonPath)) {
            return preBuiltAddonPath;
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
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            skipLibCheck: true,
            outDir: outputDir,
            rootDir: addonDir, // Set root to the specific addon directory to avoid nested structure
            declaration: false,
            sourceMap: false,
            noEmit: false,
            strict: false, // Be lenient with addon compilation
            allowJs: true, // Allow JS files in case of mixed projects
            resolveJsonModule: true, // Support JSON imports
            typeRoots: [], // Don't include @types packages to avoid conflicts
        };

        // Only include the current addon's source files (no cross-dependencies during compilation)
        const allSourceFiles = sourceFiles;

        // Create separate program instance for addon compilation
        const program = ts.createProgram(allSourceFiles, compilerOptions);
        const emitResult = program.emit();

        if (emitResult.emitSkipped || emitResult.diagnostics.length > 0) {
            const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
            const errors = diagnostics
                .filter(diagnostic => {
                    // Filter out diagnostics from other addons unless they're import errors
                    if (diagnostic.file) {
                        const fileName = diagnostic.file.fileName;
                        const isCurrentAddon = fileName.includes(addonName);
                        const isImportError = diagnostic.code === 2307 || diagnostic.code === 2339; // Module not found or property not found
                        return isCurrentAddon || isImportError;
                    }
                    return true;
                })
                .map(diagnostic => {
                    if (diagnostic.file) {
                        const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
                        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                        return `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
                    } else {
                        return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                    }
                });

            if (errors.length > 0) {
                throw new Error(`Addon compilation failed:\n${errors.join("\n")}`);
            }
        }

        // Find the compiled entry point (prefer index.ts over addon.ts)
        const indexFile = sourceFiles.find(f => path.basename(f, path.extname(f)).toLowerCase() === "index");
        const addonFile = sourceFiles.find(f => path.basename(f, path.extname(f)).toLowerCase() === "addon");

        const entryFile = indexFile || addonFile;
        if (!entryFile) {
            throw new Error(`No addon entry point (index.ts or addon.ts) found in ${addonDir}`);
        }

        // Calculate the compiled path relative to the specific addon directory
        const relativePath = path.relative(addonDir, entryFile);
        const compiledPath = path.join(outputDir, relativePath.replace(/\.ts$/, ".js"));

        // Ensure the output directory exists for the compiled file
        const compiledDir = path.dirname(compiledPath);
        if (!fs.existsSync(compiledDir)) {
            fs.mkdirSync(compiledDir, { recursive: true });
        }

        // Update cache
        this.cache.set(addonName, {
            compiledPath,
            sourceHash,
            timestamp: Date.now(),
            dependencies: sourceFiles, // Track only the current addon's source files
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
            // Check if addons directory exists
            if (!this.config.system.directoryExists(this.config.addonsDir)) {
                this.config.reporter.reportDiagnostic(new WarnMessage(`Addons directory "${this.config.addonsDir}" does not exist.`));
                return [];
            }

            // Read directories at depth 1, excluding build/output directories
            const excludedDirs = ["lib", "dist", "build", "node_modules", ".git", ".vscode", ".idea"];

            const addonDirs = this.config.system
                .readDirectory(this.config.addonsDir, undefined, ["directory"], undefined)
                .filter(entry => {
                    // Convert to absolute path if needed
                    const fullPath = path.isAbsolute(entry) ? entry : path.join(this.config.addonsDir!, entry);
                    const dirName = path.dirname(fullPath);

                    // Skip excluded directories
                    if (dirName === this.config.addonsDir || excludedDirs.includes(dirName)) {
                        return false;
                    }

                    // Verify it's actually a directory
                    if (!this.config.system.directoryExists(dirName)) {
                        return false;
                    }

                    // Check if directory contains addon files (addon.ts/js or index.ts/js)
                    return this.hasAddonFiles(dirName);
                })
                .map(entry => path.dirname(entry));

            // Filter duplicates using Set to ensure unique paths
            return [...new Set(addonDirs)];
        } catch (error) {
            this.config.reporter.reportDiagnostic(
                new ErrorMessage(
                    `Error reading addons directory "${this.config.addonsDir}": ${error instanceof Error ? error.message : String(error)}`
                )
            );
            return [];
        }
    }

    private hasAddonFiles(addonDir: string): boolean {
        try {
            const files = this.config.system.readDirectory(addonDir, [".ts", ".tsx", ".js", ".jsx"], undefined, undefined, 1);

            // Check for index files first (preferred), then addon files
            const hasIndex = files.some(file => path.basename(file, path.extname(file)).toLowerCase() === "index");
            const hasAddon = files.some(file => path.basename(file, path.extname(file)).toLowerCase() === "addon");

            return hasIndex || hasAddon;
        } catch {
            return false;
        }
    }

    private findAddonSourceFiles(addonDir: string): string[] {
        if (!this.config.system) {
            return [];
        }

        try {
            const entries = this.config.system.readDirectory(addonDir, [".ts", ".tsx"], undefined, undefined, 1);
            const validFiles: string[] = [];
            const entryFiles: string[] = [];

            // Separate entry files from other files
            for (const fullPath of entries) {
                if (this.config.system.fileExists(fullPath)) {
                    const baseName = path.basename(fullPath, path.extname(fullPath)).toLowerCase();

                    if (baseName === "index" || baseName === "addon") {
                        entryFiles.push(fullPath);
                    } else {
                        validFiles.push(fullPath);
                    }
                }
            }

            // Include all entry files (both index.ts and addon.ts if they exist)
            const indexFiles = entryFiles.filter(f => path.basename(f, path.extname(f)).toLowerCase() === "index");
            const addonFiles = entryFiles.filter(f => path.basename(f, path.extname(f)).toLowerCase() === "addon");

            // Include all entry files, not just one
            const allEntryFiles = [...indexFiles, ...addonFiles];

            // Return all entry files plus all other TypeScript files
            const result = [...allEntryFiles, ...validFiles];

            // Filter duplicates and ensure we have at least one file
            return [...new Set(result)];
        } catch {
            // Ignore errors, return empty array
            return [];
        }
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
        const requestedAddons = [...(this.config.addons || [])];

        // Add addons from profile and its dependencies recursively
        if (profile) {
            const profileAddons = this.getAddonsWithDependencies(profile, new Set());
            requestedAddons.push(...profileAddons);
        }

        // Remove duplicates and resolve to actual addon instances
        const uniqueAddonNames = [...new Set(requestedAddons)];
        const resolvedAddons = uniqueAddonNames
            .map(name => this.loadedAddons.get(name))
            .filter((addon): addon is CompilerAddon => addon !== undefined);

        // Keep the natural order: dependencies first, then current profile
        // This ensures transformers chain correctly (e.g., foobar→CLIENT→SERVER)
        return resolvedAddons;
    }

    /**
     * Recursively resolves addons from a profile and all its dependencies.
     * Handles circular dependencies by tracking visited profiles.
     */
    private getAddonsWithDependencies(profile: string, visited: Set<string>): string[] {
        const { profiles = {} } = this.config;

        // Prevent circular dependencies
        if (visited.has(profile)) {
            return [];
        }
        visited.add(profile);

        const profileConfig = profiles[profile];
        if (!profileConfig) {
            // Profile doesn't exist
            return [];
        }

        // Get addons from this profile
        const profileAddons = profileConfig.addons || [];

        // Get addons from dependencies recursively
        const dependencyAddons: string[] = [];
        if (profileConfig.depends) {
            for (const dependentProfile of profileConfig.depends) {
                dependencyAddons.push(...this.getAddonsWithDependencies(dependentProfile, visited));
            }
        }

        // Combine current profile addons first, then dependency addons (matching core system logic)
        return [...profileAddons, ...dependencyAddons];
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
                new ErrorMessage(`Failed to create addon cache directory: ${error instanceof Error ? error.message : String(error)}`)
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
