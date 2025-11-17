/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage, InfoMessage, WarnMessage, type AddonContext, type CompilationProfile, type Reporter } from "@quatico/websmith-api";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { resolvePath } from "../config";
import { compilerAddons, type CompilerAddon, type CompilerAddons } from "./CompilerAddon";

/**
 * Default directory name for compiled addon output, relative to the addons directory's parent.
 */
const DEFAULT_ADDON_LIB_DIR = "lib";

export type AddonConfig = {
    addons?: string[];
    addonsDir?: string;
    /**
     * Directory name for compiled addon output, relative to the addons directory's parent.
     * Defaults to "lib" if not specified.
     */
    addonLibDir?: string;
    profiles?: Record<string, CompilationProfile>;
    activeProfile?: string;
    reporter: Reporter;
    system: ts.System;
};

/**
 * Registry for managing and loading compiler addons.
 *
 * ## Addon Loading Behavior
 *
 * When specific addons are requested via `addons` array or profile configurations:
 * - **Loads ONLY the explicitly requested addons**
 * - Provides better performance by avoiding unnecessary addon loading
 * - Used by CLI when `--addons` flag is specified or profiles are configured
 *
 * @example
 * ```typescript
 * const registry = new AddonRegistry({
 *   addonsDir: './addons',
 *   addons: ['my-addon', 'another-addon'],
 *   reporter,
 *   system
 * });
 * ```
 */
export class AddonRegistry {
    private availableAddons: Map<string, CompilerAddon>;
    private config: AddonConfig;
    /**
     * Cache for compilation results to optimize repeated builds.
     *
     * - **Key:** string representing a unique compilation identifier (e.g., source file path or hash).
     * - **Value:** Object containing:
     *    - `timestamp`: number indicating when the compilation occurred.
     *    - `outputPath`: string path to the compiled output.
     *
     * The cache is invalidated when configuration changes (e.g., via `setConfig` or `refresh`),
     * or when a new compilation is triggered for a different source or with different options.
     * This mechanism helps avoid redundant compilations and improves performance by reusing
     * previous results when possible.
     */
    private compilationCache: Map<string, { timestamp: number; outputPath: string }> = new Map();
    private addonLookupCache: Map<string, CompilerAddon> = new Map();

    /**
     * Cache for file modification times to avoid repeated filesystem operations.
     * Key: file path, Value: { timestamp: modification time in milliseconds, cachedAt: when this was cached }
     */
    private fileTimeCache: Map<string, { timestamp: number; cachedAt: number }> = new Map();

    private compilerHost?: ts.CompilerHost;
    private lastCompilerOptions?: ts.CompilerOptions;

    constructor(config: AddonConfig) {
        this.availableAddons = new Map();
        this.config = config;
        this.loadAddonsSync();
    }

    setConfig(config: AddonConfig): this {
        // Don't remove addonsDir from the config
        this.config = { ...config, addonsDir: config.addonsDir ?? this.config.addonsDir };
        return this.refresh();
    }

    getConfig(): AddonConfig {
        return this.config;
    }

    /**
     * Retrieves a loaded addon by its name, using an internal cache for performance optimization.
     *
     * If the addon has been previously looked up, it is returned from the cache.
     * Otherwise, the method searches the available addons, caches the result, and returns it.
     *
     * @param name - The name of the addon to retrieve.
     * @returns The `CompilerAddon` instance if found; otherwise, `undefined`.
     */
    getAddonByName(name: string): CompilerAddon | undefined {
        // Check cache first
        if (this.addonLookupCache.has(name)) {
            return this.addonLookupCache.get(name);
        }

        // Find addon and cache result
        for (const addon of this.availableAddons.values()) {
            if (addon.getName() === name) {
                this.addonLookupCache.set(name, addon);
                return addon;
            }
        }
        return undefined;
    }

    getAvailableAddons(profile?: string): CompilerAddons {
        let expectedNames: string[];

        if (!profile) {
            // RULE 1: Return all loaded addons when no profile specified
            expectedNames = [];
        } else {
            // RULES 2-6: Get expected addons from profile and dependencies
            expectedNames = this.getExpectedAddonsWithDependencies(profile);
        }

        // RULE 7: Report warnings for missing addons
        this.reportMissingAddons(expectedNames, profile);

        const results =
            expectedNames.length === 0
                ? Array.from(this.availableAddons.values()) // RULE 1: All addons when no profile
                : [...this.availableAddons].filter(([name]) => expectedNames.includes(name)).map(([, addon]) => addon);

        return compilerAddons(results);
    }

    refresh(): this {
        this.availableAddons.clear();
        this.addonLookupCache.clear(); // Clear cache to prevent stale references
        this.fileTimeCache.clear(); // Clear file time cache to get fresh modification times
        this.loadAddonsSync();
        return this;
    }

    /**
     * Recursively resolves addons from a profile and all its dependencies.
     * Handles circular dependencies by tracking visited profiles.
     */
    private getExpectedAddonsWithDependencies(profile?: string, visited: Set<string> = new Set()): string[] {
        const { profiles = {}, addons = [] } = this.config;

        // If no profile is provided, return base addons
        if (!profile) {
            return addons.filter(it => it.length > 0);
        }

        // Prevent circular dependencies
        if (visited.has(profile)) {
            return [];
        }
        visited.add(profile);

        const profileConfig = profiles[profile];
        if (!profileConfig) {
            // Profile doesn't exist - will be handled by warning system
            return [];
        }

        // Get addons from this profile
        const profileAddons = profileConfig.addons ?? [];

        // Get addons from dependencies recursively
        const dependencyAddons: string[] = [];
        if (profileConfig.depends) {
            for (const dependentProfile of profileConfig.depends) {
                dependencyAddons.push(...this.getExpectedAddonsWithDependencies(dependentProfile, new Set(visited)));
            }
        }

        // Combine base addons, profile addons, and dependency addons
        const baseAddons = addons.filter(it => it.length > 0);
        const allAddons = [...baseAddons, ...dependencyAddons, ...profileAddons];

        // Return unique addon names
        return [...new Set(allAddons)];
    }

    private getMissingAddons(expectedNames: string[] = []): string[] {
        return expectedNames.filter(name => !this.availableAddons.has(name));
    }

    private reportMissingAddons(expectedNames: string[] = [], profile?: string): void {
        const { reporter, addonsDir } = this.config;

        const missingAddons = this.getMissingAddons(expectedNames);
        if (missingAddons.length > 0) {
            const availableAddons = Array.from(this.availableAddons.keys());

            // Enhanced error reporting for missing addons
            const detailedReport = [
                profile
                    ? `Missing addons for profile "${profile}": ${missingAddons.map(name => `"${name}"`).join(", ")}`
                    : `Missing addons: ${missingAddons.map(name => `"${name}"`).join(", ")}`,
                ``,
                `🔍 Addon Resolution Details:`,
                `   • Addons directory: ${addonsDir || "(not configured)"}`,
                `   • Directory exists: ${addonsDir ? this.config.system.directoryExists(addonsDir) : false}`,
                `   • Available addons (${availableAddons.length}): ${availableAddons.length > 0 ? availableAddons.join(", ") : "(none found)"}`,
                ``,
                `🛠️  Troubleshooting suggestions:`,
                `   • Check if addon directories exist in: ${addonsDir}`,
                `   • Verify addon naming matches expected names exactly`,
                `   • Ensure addons have proper structure with 'addon.ts' or 'index.ts' files`,
                `   • Check if addons compiled successfully (look for compilation errors above)`,
                `   • Verify addon files export an 'activate' function`,
                ``,
                `📂 Expected addon structure:`,
                ...missingAddons.map(name => `   • ${addonsDir}/${name}/addon.ts (or .js) - OR -`),
                ...missingAddons.map(name => `   • ${addonsDir}/${name}/index.ts (or .js)`),
            ].join("\n");

            reporter?.reportDiagnostic(new WarnMessage(detailedReport));
        }
    }

    /**
     * Gets the list of addon names requested by profiles based on the current configuration.
     *
     * @returns Array of addon names requested by profiles
     *
     * **Behavior:**
     * - Returns addons from all profiles to ensure they are available for activation
     * - The Compiler class decides which addons to actually activate based on the selected profile
     * - Returns empty array if no profiles are configured
     */
    private getRequestedProfileAddons(): string[] {
        if (!this.config.profiles) {
            return [];
        }

        // Always load addons from all profiles - let the Compiler decide which ones to activate
        // This ensures that profile-dependent addons are available when the Compiler needs them
        const profileAddons: string[] = [];
        for (const [, profile] of Object.entries(this.config.profiles)) {
            if (profile.addons) {
                profileAddons.push(...profile.addons);
            }
        }
        return profileAddons;
    }

    /**
     * Gets the modification time of a file, using cache to avoid repeated filesystem operations.
     * Cache entries are valid for 1 second to balance performance with accuracy.
     *
     * @param filePath - Path to the file
     * @returns File modification timestamp in milliseconds, or 0 if file doesn't exist or error occurred
     */
    private getCachedFileModTime(filePath: string): number {
        const now = Date.now();
        const cached = this.fileTimeCache.get(filePath);

        // Use cached value if it's less than 1 second old
        if (cached && now - cached.cachedAt < 1000) {
            return cached.timestamp;
        }

        // Get fresh modification time
        let timestamp = 0;
        try {
            const modTime = this.config.system.getModifiedTime?.(filePath);
            timestamp = modTime ? modTime.getTime() : 0;
        } catch (_error) {
            // File might not exist or be inaccessible
            timestamp = 0;
        }

        // Cache the result
        this.fileTimeCache.set(filePath, { timestamp, cachedAt: now });
        return timestamp;
    }

    /**
     * Selectively invalidates addon lookup cache entries for addons that are no longer requested.
     * This preserves cache entries for addons that are still needed, maintaining performance benefits.
     *
     * @param requestedAddonNames - Array of addon names that are currently requested
     */
    private invalidateStaleAddonCacheEntries(requestedAddonNames: string[]): void {
        const requestedSet = new Set(requestedAddonNames);

        // Remove cache entries for addons that are no longer requested
        for (const cachedAddonName of this.addonLookupCache.keys()) {
            if (!requestedSet.has(cachedAddonName)) {
                this.addonLookupCache.delete(cachedAddonName);
            }
        }

        // Also remove cache entries for addons that are no longer in availableAddons
        // (in case they were removed from the filesystem)
        for (const cachedAddonName of this.addonLookupCache.keys()) {
            if (!this.availableAddons.has(cachedAddonName)) {
                this.addonLookupCache.delete(cachedAddonName);
            }
        }
    }

    private loadAddonsSync(): void {
        const { addonsDir, reporter, system, addons } = this.config;
        if (!addonsDir || !system.directoryExists(addonsDir)) {
            if (addonsDir) {
                reporter?.reportDiagnostic(new WarnMessage(`Addons directory "${addonsDir}" does not exist.`));
            }
            return;
        }

        const requestedAddons = addons || [];

        // Get addons requested by profiles
        const profileAddons = this.getRequestedProfileAddons();
        const hasProfileAddons = profileAddons.length > 0;

        if (requestedAddons.length === 0 && !hasProfileAddons) {
            return;
        }

        const loadedAddons: string[] = [];

        // Combine requested addons and profile addons
        const allRequestedAddons = [...new Set([...requestedAddons, ...profileAddons])];

        // Selective cache invalidation: only clear cache entries for addons that are no longer requested
        this.invalidateStaleAddonCacheEntries(allRequestedAddons);

        for (const addonName of allRequestedAddons) {
            const loaded = this.loadSpecificAddon(addonName, addonsDir, reporter, system);
            if (loaded) {
                loadedAddons.push(loaded);
            }
        }

        this.reportMissingAddons(addons);
    }

    private loadSpecificAddon(addonName: string, addonsDir: string, reporter: Reporter, system: ts.System): string | null {
        // Try to find the specific addon in common locations
        const possiblePaths = [
            path.join(addonsDir, addonName, "addon.js"),
            path.join(addonsDir, addonName, "index.js"),
            path.join(addonsDir, addonName, "addon.jsx"),
            path.join(addonsDir, addonName, "index.jsx"),
        ];

        // First try to load pre-compiled JS files
        for (const jsPath of possiblePaths) {
            if (system.fileExists(jsPath)) {
                const loadedName = this.loadSingleAddon(jsPath, addonsDir);
                if (loadedName) {
                    return loadedName;
                }
            }
        }

        // If no JS files found, look for TypeScript files and compile them
        const tsPossiblePaths = [
            path.join(addonsDir, addonName, "addon.ts"),
            path.join(addonsDir, addonName, "index.ts"),
            path.join(addonsDir, addonName, "addon.tsx"),
            path.join(addonsDir, addonName, "index.tsx"),
        ];

        const foundTsFiles: string[] = [];
        for (const tsPath of tsPossiblePaths) {
            if (system.fileExists(tsPath)) {
                foundTsFiles.push(tsPath);
                break; // Only need one entry point per addon
            }
        }

        if (foundTsFiles.length > 0) {
            // This is the directory where the compiled addons will be stored, next to the addonsDir
            const addonLibDirName = this.config.addonLibDir ?? DEFAULT_ADDON_LIB_DIR;
            const libDir = path.resolve(addonsDir, "..", addonLibDirName);

            if (!system.directoryExists(libDir)) {
                system.createDirectory(libDir);
            }

            // To handle cross-addon dependencies, compile all TypeScript files in the addons directory
            // This ensures that when an addon imports from another addon, the dependency is available
            const allTsFilesInAddonsDir = this.findTypeScriptFilesInDirectory(addonsDir);

            const compiledAddonFiles = this.compileSourceFiles(addonsDir, reporter, libDir, allTsFilesInAddonsDir);

            // Load the compiled addon
            for (const compiledFile of compiledAddonFiles) {
                const loadedName = this.loadSingleAddon(compiledFile, libDir);
                if (loadedName === addonName) {
                    return loadedName;
                }
            }
        }

        return null;
    }

    private findTypeScriptFilesInDirectory(dir: string): string[] {
        const results: string[] = [];
        const { system } = this.config;

        if (!system.directoryExists(dir)) {
            return results;
        }

        // Get all TypeScript files in the current directory
        const tsFiles = system.readDirectory(dir, [".ts", ".tsx"], undefined, undefined);
        results.push(...tsFiles);

        // Recursively search subdirectories, excluding build and output directories
        const subdirs = system.readDirectory(dir, undefined, ["directory"], undefined);
        const excludedDirs = ["lib", "dist", "build", "node_modules", ".git"];

        for (let subdir of subdirs) {
            if (subdir !== dir) {
                const subdirName = path.basename(subdir);
                if (excludedDirs.includes(subdirName)) {
                    continue; // Skip build/output directories
                }

                if (!path.isAbsolute(subdir)) {
                    subdir = resolvePath(system, subdir);
                }
                results.push(...this.findTypeScriptFilesInDirectory(subdir));
            }
        }

        return results;
    }

    private needsCompilation(tsFiles: string[], libDir: string, addonsDir: string): { needsCompilation: boolean; filesToCompile: string[] } {
        const filesToCompile: string[] = [];

        for (const tsFile of tsFiles) {
            const relativePath = path.relative(addonsDir, tsFile);
            const outputPath = path.join(libDir, relativePath.replace(/\.ts$/, ".js"));
            const cacheKey = tsFile;

            // Check if source file exists and get its modification time
            if (!this.config.system.fileExists(tsFile)) {
                continue;
            }

            const sourceTimestamp = this.getCachedFileModTime(tsFile);

            // Check if output file exists
            const outputExists = this.config.system.fileExists(outputPath);

            // Check cache
            const cached = this.compilationCache.get(cacheKey);

            if (!outputExists || !cached || cached.timestamp < sourceTimestamp) {
                filesToCompile.push(tsFile);
            }
        }

        return {
            needsCompilation: filesToCompile.length > 0,
            filesToCompile,
        };
    }

    private getExistingCompiledFiles(libDir: string): string[] {
        const compiledAddonFiles: string[] = [];

        if (!this.config.system.directoryExists(libDir)) {
            return compiledAddonFiles;
        }

        // Get all files and extract unique addon directory names
        const allFiles = this.config.system.readDirectory(libDir, [".js"], undefined, undefined);

        // Extract unique directory names from file paths (excluding root level files)
        const addonDirNames = new Set<string>();
        for (const filePath of allFiles) {
            const relativePath = path.relative(libDir, filePath);
            const dirParts = relativePath.split(path.sep);
            if (dirParts.length > 1) {
                // Skip root level files like index.js
                addonDirNames.add(dirParts[0]);
            }
        }
        const addonDirs = Array.from(addonDirNames);

        for (const addonDirName of addonDirs) {
            const addonDirPath = path.join(libDir, addonDirName);
            if (this.config.system.directoryExists(addonDirPath)) {
                const files = this.config.system.readDirectory(addonDirPath, [".js", ".jsx"], undefined, undefined);

                // Look for addon.js or index.js files
                const addonFiles = files.filter(f => path.basename(f, path.extname(f)).toLowerCase() === "addon");
                const indexFiles = files.filter(f => path.basename(f, path.extname(f)).toLowerCase() === "index");

                if (addonFiles.length > 0) {
                    compiledAddonFiles.push(addonFiles[0]);
                } else if (indexFiles.length > 0) {
                    compiledAddonFiles.push(indexFiles[0]);
                }
            }
        }

        return compiledAddonFiles;
    }

    private compileSourceFiles(addonsDir: string, reporter: Reporter, libDir: string, tsFiles: string[]): string[] {
        try {
            // Check if compilation is actually needed
            const compilationCheck = this.needsCompilation(tsFiles, libDir, addonsDir);

            if (!compilationCheck.needsCompilation) {
                // All files are up to date, return existing compiled files
                return this.getExistingCompiledFiles(libDir);
            }

            // Only compile files that actually need compilation
            const filesToCompile = compilationCheck.filesToCompile;

            // Enhanced error reporting: Check filesystem permissions and paths
            const fsInfo = this.validateFilesystemAccess(addonsDir, libDir);
            if (!fsInfo.canCompile) {
                const errorDetails = [
                    `Filesystem validation failed for addon compilation:`,
                    `  - Addons directory: ${addonsDir} (exists: ${fsInfo.addonsExists}, readable: ${fsInfo.addonsReadable})`,
                    `  - Output directory: ${libDir} (exists: ${fsInfo.libExists}, writable: ${fsInfo.libWritable})`,
                    `  - Working directory: ${fsInfo.workingDir}`,
                    `  - Error: ${fsInfo.error}`,
                ].join("\n");

                reporter?.reportDiagnostic(new WarnMessage(`Failed to compile addons - ${errorDetails}`));
                return [];
            }

            // Enhanced error reporting: List files being compiled
            const fileList = filesToCompile.map(f => `    - ${path.relative(addonsDir, f)}`).join("\n");

            // Use batch compilation instead of individual file transpilation for better performance
            const compilerOptions: ts.CompilerOptions = {
                outDir: libDir,
                rootDir: addonsDir,
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2020,
                esModuleInterop: true,
                moduleResolution: ts.ModuleResolutionKind.Classic,
                noResolve: true,
                skipLibCheck: true,
                strict: false,
            };

            // Pre-create all necessary directories to avoid repeated checks
            const outputDirs = new Set<string>();
            for (const tsFile of filesToCompile) {
                const relativePath = path.relative(addonsDir, tsFile);
                const outputPath = path.join(libDir, relativePath.replace(/\.ts$/, ".js"));
                const outputDir = path.dirname(outputPath);
                outputDirs.add(outputDir);
            }

            // Create all directories at once
            for (const outputDir of outputDirs) {
                if (!this.config.system.directoryExists(outputDir)) {
                    this.config.system.createDirectory(outputDir);
                }
            }

            // Use batch compilation with createProgram for better performance
            if (filesToCompile.length > 1) {
                this.batchCompileFiles(filesToCompile, compilerOptions, addonsDir, libDir);
            } else {
                // For single files, still use transpileModule for simplicity
                this.transpileSingleFile(filesToCompile[0], compilerOptions, addonsDir, libDir);
            }

            const result = { emitSkipped: false, diagnostics: [] };

            // Check if compilation succeeded by verifying output files exist
            const expectedJsFiles = tsFiles.map(ts => ts.replace(/\.ts$/, ".js").replace(addonsDir, libDir));
            const outputExists = this.config.system.directoryExists(libDir) && expectedJsFiles.some(jsFile => this.config.system.fileExists(jsFile));

            // Enhanced error reporting for compilation failures
            if (result.emitSkipped || (result.diagnostics && result.diagnostics.length > 0) || !outputExists) {
                const diagnosticDetails = this.formatCompilationDiagnostics([...(result.diagnostics || [])], addonsDir);
                const missingOutputs = expectedJsFiles.filter(js => !this.config.system.fileExists(js));

                const errorReport = [
                    `Failed to compile addons in "${addonsDir}":`,
                    ``,
                    `📁 Input files (${tsFiles.length}):`,
                    fileList,
                    ``,
                    `📁 Expected outputs (${expectedJsFiles.length}):`,
                    expectedJsFiles.map(f => `    - ${path.relative(libDir, f)}`).join("\n"),
                    ``,
                    `❌ Missing outputs (${missingOutputs.length}):`,
                    missingOutputs.length > 0 ? missingOutputs.map(f => `    - ${path.relative(libDir, f)}`).join("\n") : "    (none)",
                    ``,
                    `🔍 Diagnostics:`,
                    diagnosticDetails || "    (no diagnostics available)",
                    ``,
                    `ℹ️  Compilation details:`,
                    `    - Emit skipped: ${result.emitSkipped}`,
                    `    - Diagnostic count: ${result.diagnostics?.length || 0}`,
                    `    - Output directory exists: ${this.config.system.directoryExists(libDir)}`,
                ].join("\n");

                reporter?.reportDiagnostic(new WarnMessage(errorReport));
                return [];
            }

            // Return the compiled addon file paths by directly mapping from the compiled output
            const compiledAddonFiles: string[] = [];

            // Get all files and extract unique addon directory names
            const allFiles = this.config.system.readDirectory(libDir, [".js"], undefined, undefined);

            // Extract unique directory names from file paths (excluding root level files)
            const addonDirNames = new Set<string>();
            for (const filePath of allFiles) {
                const relativePath = path.relative(libDir, filePath);
                const dirParts = relativePath.split(path.sep);
                if (dirParts.length > 1) {
                    // Skip root level files like index.js
                    addonDirNames.add(dirParts[0]);
                }
            }
            const addonDirs = Array.from(addonDirNames);

            for (const addonDirName of addonDirs) {
                const addonDirPath = path.join(libDir, addonDirName);
                if (this.config.system.directoryExists(addonDirPath)) {
                    const files = this.config.system.readDirectory(addonDirPath, [".js", ".jsx"], undefined, undefined);

                    // Look for addon.js or index.js files
                    const addonFiles = files.filter(f => path.basename(f, path.extname(f)).toLowerCase() === "addon");
                    const indexFiles = files.filter(f => path.basename(f, path.extname(f)).toLowerCase() === "index");

                    if (addonFiles.length > 0) {
                        // addonFiles[0] is already a full path from readDirectory
                        compiledAddonFiles.push(addonFiles[0]);
                    } else if (indexFiles.length > 0) {
                        // indexFiles[0] is already a full path from readDirectory
                        compiledAddonFiles.push(indexFiles[0]);
                    }
                }
            }

            return compiledAddonFiles;
        } catch (error) {
            reporter?.reportDiagnostic(
                new ErrorMessage(`Failed to compile addons in "${addonsDir}": ${error instanceof Error ? error.message : String(error)}`)
            );
            return [];
        }
    }

    private batchCompileFiles(filesToCompile: string[], compilerOptions: ts.CompilerOptions, addonsDir: string, libDir: string): void {
        // Reuse compiler host if options have not changed
        if (!this.compilerHost || !this.lastCompilerOptions || this.hasCompilerOptionsChanged(compilerOptions)) {
            this.compilerHost = ts.createCompilerHost(compilerOptions);
            this.lastCompilerOptions = { ...compilerOptions };
        }

        // Add retry logic for CI environments where file system operations might be slower
        let program: ts.Program;
        try {
            program = ts.createProgram(filesToCompile, compilerOptions, this.compilerHost);
        } catch (error) {
            // Log the original error for debugging
            this.config.reporter?.reportDiagnostic(
                new WarnMessage(
                    `Failed to create TypeScript program with cached compiler host for files: ${filesToCompile.join(", ")}. ` +
                        `Error: ${error}. Attempting fallback with new compiler host.`
                )
            );

            // Fallback: create a new compiler host if the cached one fails
            try {
                this.compilerHost = ts.createCompilerHost(compilerOptions);
                program = ts.createProgram(filesToCompile, compilerOptions, this.compilerHost);
            } catch (fallbackError) {
                // If fallback also fails, report both errors and throw
                this.config.reporter?.reportDiagnostic(
                    new ErrorMessage(
                        `Failed to create TypeScript program even with new compiler host for files: ${filesToCompile.join(", ")}. ` +
                            `Original error: ${error}. Fallback error: ${fallbackError}`
                    )
                );
                throw fallbackError;
            }
        }

        // Emit all files at once
        const emitResult = program.emit();

        // Check for compilation errors and report them, but be more lenient
        const errorDiagnostics = emitResult.diagnostics.filter(diag => diag.category === ts.DiagnosticCategory.Error);
        const warningDiagnostics = emitResult.diagnostics.filter(diag => diag.category === ts.DiagnosticCategory.Warning);
        const infoDiagnostics = emitResult.diagnostics.filter(
            diag => diag.category === ts.DiagnosticCategory.Message || diag.category === ts.DiagnosticCategory.Suggestion
        );
        const hasErrors = errorDiagnostics.length > 0;

        // Report all diagnostics for better debugging
        for (const diag of errorDiagnostics) {
            const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
            const fileName = diag.file ? path.relative(addonsDir, diag.file.fileName) : "unknown";
            this.config.reporter?.reportDiagnostic(new ErrorMessage(`TypeScript error in addon file ${fileName}: ${message}`));
        }

        for (const diag of warningDiagnostics) {
            const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
            const fileName = diag.file ? path.relative(addonsDir, diag.file.fileName) : "unknown";
            this.config.reporter?.reportDiagnostic(new WarnMessage(`TypeScript warning in addon file ${fileName}: ${message}`));
        }

        for (const diag of infoDiagnostics) {
            const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
            const fileName = diag.file ? path.relative(addonsDir, diag.file.fileName) : "unknown";
            this.config.reporter?.reportDiagnostic(new InfoMessage(`TypeScript info in addon file ${fileName}: ${message}`));
        }

        if (emitResult.emitSkipped) {
            // If emit was skipped, try fallback to individual file transpilation
            // But only for files that actually need compilation
            for (const tsFile of filesToCompile) {
                const { needsCompilation: fileNeedsCompilation } = this.needsCompilation([tsFile], libDir, addonsDir);
                if (fileNeedsCompilation) {
                    try {
                        this.transpileSingleFile(tsFile, compilerOptions, addonsDir, libDir);
                    } catch (error) {
                        this.config.reporter?.reportDiagnostic(new ErrorMessage(`Failed to compile addon file ${tsFile}: ${error}`));
                    }
                }
            }
            return;
        }

        // Only report errors if they're severe (not just warnings or info)
        if (hasErrors) {
            for (const diag of errorDiagnostics) {
                const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
                this.config.reporter?.reportDiagnostic(new ErrorMessage(`TypeScript error in "${addonsDir}": ${message}`));
            }
        }

        // Update cache if emit was successful, even if there were non-error diagnostics
        // This is more lenient than before to handle CI environment differences
        if (!emitResult.emitSkipped && !hasErrors) {
            for (const tsFile of filesToCompile) {
                const sourceTime = this.config.system.getModifiedTime?.(tsFile);
                const relativePath = path.relative(addonsDir, tsFile);
                const outputPath = path.join(libDir, relativePath.replace(/\.ts$/, ".js"));

                this.compilationCache.set(tsFile, {
                    timestamp: sourceTime ? sourceTime.getTime() : Date.now(),
                    outputPath,
                });
            }
        }
    }

    private transpileSingleFile(tsFile: string, compilerOptions: ts.CompilerOptions, addonsDir: string, libDir: string): void {
        const sourceCode = this.config.system.readFile(tsFile);
        if (sourceCode) {
            const transpileResult = ts.transpileModule(sourceCode, {
                compilerOptions,
                fileName: tsFile,
            });

            const relativePath = path.relative(addonsDir, tsFile);
            const outputPath = path.join(libDir, relativePath.replace(/\.ts$/, ".js"));

            // Write the transpiled JavaScript
            this.config.system.writeFile(outputPath, transpileResult.outputText);

            // Update cache
            const sourceTime = this.config.system.getModifiedTime?.(tsFile);
            this.compilationCache.set(tsFile, {
                timestamp: sourceTime ? sourceTime.getTime() : Date.now(),
                outputPath,
            });
        }
    }

    private loadSingleAddon(filePath: string, _baseDir: string): string | undefined {
        const addonName = getAddonName(filePath);
        const { system } = this.config;

        if (this.availableAddons.has(addonName)) {
            return; // Already loaded
        }

        try {
            const importPath = getImportPath(system, filePath);

            // Check if file exists before attempting to load it
            if (!system.fileExists(importPath)) {
                return;
            }

            // In test environment, use Jest's module mocking
            // Correct Jest environment detection: check if we're actually running in Jest
            const isTestEnvironment = typeof jest !== "undefined" && typeof jest.fn === "function";
            let module: { activate?: unknown; default?: { activate?: unknown } } | undefined;

            if (isTestEnvironment) {
                try {
                    // Try different Jest mock paths for test environment
                    const mockPaths = [
                        `/${path.relative("/", importPath)}`, // absolute mock path
                        importPath.replace(path.extname(importPath), ""), // path without extension
                        `./${path.basename(importPath, path.extname(importPath))}`, // relative path
                    ];

                    for (const mockPath of mockPaths) {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
                            module = require(mockPath);
                            break;
                        } catch {
                            // Try next path
                        }
                    }

                    if (!module) {
                        throw new Error("No mock found for any path variation");
                    }
                } catch {
                    // Fallback to regular require in test environment
                    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
                    module = require(importPath);
                }
            } else {
                // Use require for production - this avoids eval but still works synchronously
                // Clear require cache for fresh load
                delete require.cache[importPath];

                // Use Node.js native createRequire to avoid webpack bundling issues
                const nodeRequire = createRequire(__filename);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                module = nodeRequire(importPath);
            }

            // Handle both ES modules (default export) and CommonJS modules
            const addonModule = module?.default || module;

            if (!addonModule || (path.basename(importPath, path.extname(importPath)) === "addon" && typeof addonModule.activate !== "function")) {
                // Return undefined and log warning instead of throwing error (restore original behavior)
                this.config.reporter?.reportDiagnostic(
                    new WarnMessage(`Addon "${addonName}" does not export an "activate" function and will be ignored.`)
                );
                return;
            }

            const addon: CompilerAddon = {
                getName: () => addonName,
                activate: addonModule.activate as (context: AddonContext) => void,
            };
            this.availableAddons.set(addonName, addon);
            return addonName;
        } catch (error) {
            // Enhanced error reporting for addon loading failures
            const errorMessage = error instanceof Error ? error.message : String(error);
            const importPath = getImportPath(system, filePath);

            // Categorize the error type for better diagnostics
            const errorCategory = this.categorizeLoadingError(errorMessage);

            const detailedReport = [
                `Failed to load addon "${addonName}" from "${importPath}"`,
                ``,
                `🔍 Error Category: ${errorCategory.type}`,
                `📝 Error Message: ${errorMessage}`,
                ``,
                `🛠️  Troubleshooting suggestions:`,
                ...errorCategory.suggestions.map(s => `   • ${s}`),
                ``,
                `ℹ️  File Information:`,
                `   • Path: ${importPath}`,
                `   • Exists: ${system.fileExists(importPath)}`,
                `   • Directory: ${path.dirname(importPath)}`,
                `   • Working directory: ${system.getCurrentDirectory()}`,
            ].join("\n");

            this.config.reporter?.reportDiagnostic(new WarnMessage(detailedReport));
            return;
        }
    }

    /**
     * Validates filesystem access for addon compilation
     */
    private validateFilesystemAccess(
        addonsDir: string,
        libDir: string
    ): {
        canCompile: boolean;
        addonsExists: boolean;
        addonsReadable: boolean;
        libExists: boolean;
        libWritable: boolean;
        workingDir: string;
        error?: string;
    } {
        const { system } = this.config;
        let workingDir = "unknown";

        try {
            workingDir = system.getCurrentDirectory();
        } catch (e) {
            return {
                canCompile: false,
                addonsExists: false,
                addonsReadable: false,
                libExists: false,
                libWritable: false,
                workingDir: "ERROR: Cannot get current working directory",
                error: e instanceof Error ? e.message : String(e),
            };
        }

        const addonsExists = system.directoryExists(addonsDir);
        const addonsReadable = addonsExists && this.canReadDirectory(addonsDir);
        const libExists = system.directoryExists(libDir);

        // Test if we can write to the lib directory
        let libWritable = false;
        if (libExists) {
            libWritable = this.canWriteToDirectory(libDir);
        } else {
            // Try to create the directory to test writability
            try {
                system.createDirectory(libDir);
                libWritable = true;
            } catch (e) {
                return {
                    canCompile: false,
                    addonsExists,
                    addonsReadable,
                    libExists: false,
                    libWritable: false,
                    workingDir,
                    error: `Cannot create output directory: ${e instanceof Error ? e.message : String(e)}`,
                };
            }
        }

        return {
            canCompile: addonsExists && addonsReadable && libWritable,
            addonsExists,
            addonsReadable,
            libExists,
            libWritable,
            workingDir,
        };
    }

    /**
     * Tests if a directory can be read
     */
    private canReadDirectory(dir: string): boolean {
        try {
            this.config.system.readDirectory(dir);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Tests if we can write to a directory
     */
    private canWriteToDirectory(dir: string): boolean {
        const testFile = path.join(dir, ".write-test-" + Date.now());
        try {
            this.config.system.writeFile(testFile, "test");
            // Clean up the test file if deleteFile method exists
            if (typeof this.config.system.deleteFile === "function") {
                this.config.system.deleteFile(testFile);
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Formats TypeScript diagnostics with enhanced dependency information
     */
    private formatCompilationDiagnostics(diagnostics: ts.Diagnostic[], addonsDir: string): string {
        if (!diagnostics.length) {
            return "    (no compilation errors)";
        }

        const formatted = diagnostics
            .map(diagnostic => {
                const messageText =
                    typeof diagnostic.messageText === "string" ? diagnostic.messageText : diagnostic.messageText?.messageText || "Unknown error";

                let location = "";
                if (diagnostic.file && diagnostic.start !== undefined) {
                    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                    const relativePath = path.relative(addonsDir, diagnostic.file.fileName);
                    location = ` at ${relativePath}:${line + 1}:${character + 1}`;
                }

                // Detect dependency-related errors
                const isDependencyError = this.isDependencyRelatedError(messageText);
                const errorType = isDependencyError ? "🔗 DEPENDENCY" : "🔧 SYNTAX";

                let result = `    ${errorType}: ${messageText}${location}`;

                // Add specific guidance for dependency errors
                if (isDependencyError) {
                    result += "\n      💡 This might be caused by:";
                    result += "\n         - Missing import file in the addons directory";
                    result += "\n         - Incorrect relative path in import statement";
                    result += "\n         - Circular dependency between addon files";
                    result += "\n         - Missing external package (not available in addon context)";
                }

                return result;
            })
            .join("\n");

        return formatted;
    }

    /**
     * Performs a deep equality comparison between two values.
     * Handles objects, arrays, and primitive values correctly without relying on JSON.stringify.
     */
    private deepEqual(a: unknown, b: unknown): boolean {
        // Same reference or both null/undefined
        if (a === b) {
            return true;
        }

        // Different types or one is null/undefined
        if (a == null || b == null || typeof a !== typeof b) {
            return false;
        }

        // Handle arrays
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) {
                return false;
            }
            return a.every((val, index) => this.deepEqual(val, b[index]));
        }

        // Handle objects (but not arrays, which are handled above)
        if (typeof a === "object" && !Array.isArray(a)) {
            const keysA = Object.keys(a as Record<string, unknown>);
            const keysB = Object.keys(b as Record<string, unknown>);

            if (keysA.length !== keysB.length) {
                return false;
            }

            return keysA.every(
                key => keysB.includes(key) && this.deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
            );
        }

        // Primitive values (already handled by a === b above, but explicit for clarity)
        return a === b;
    }

    /**
     * Efficiently compares compiler options to determine if the compiler host needs to be recreated.
     * Only checks properties that actually affect compiler host behavior, avoiding expensive deep equality.
     */
    private hasCompilerOptionsChanged(newOptions: ts.CompilerOptions): boolean {
        const lastOptions = this.lastCompilerOptions;
        if (!lastOptions) {
            return true;
        }

        // Properties that affect compiler host behavior and require recreation
        const criticalProperties: (keyof ts.CompilerOptions)[] = [
            "target",
            "module",
            "moduleResolution",
            "baseUrl",
            "paths",
            "rootDir",
            "outDir",
            "typeRoots",
            "types",
            "lib",
            "allowJs",
            "checkJs",
            "jsx",
            "jsxFactory",
            "jsxFragmentFactory",
            "jsxImportSource",
            "resolveJsonModule",
            "esModuleInterop",
            "allowSyntheticDefaultImports",
            "experimentalDecorators",
            "emitDecoratorMetadata",
        ];

        // Fast comparison of critical properties
        for (const prop of criticalProperties) {
            const lastValue = lastOptions[prop];
            const newValue = newOptions[prop];

            // Handle array properties (like 'lib', 'types', 'typeRoots')
            if (Array.isArray(lastValue) && Array.isArray(newValue)) {
                if (lastValue.length !== newValue.length || !lastValue.every((val, index) => val === newValue[index])) {
                    return true;
                }
            }
            // Handle object properties (like 'paths')
            else if (typeof lastValue === "object" && typeof newValue === "object" && lastValue !== null && newValue !== null) {
                // For paths specifically, do a shallow comparison
                if (prop === "paths") {
                    const lastPaths = lastValue as Record<string, string[]>;
                    const newPaths = newValue as Record<string, string[]>;
                    const lastKeys = Object.keys(lastPaths);
                    const newKeys = Object.keys(newPaths);

                    if (
                        lastKeys.length !== newKeys.length ||
                        !lastKeys.every(
                            key =>
                                newKeys.includes(key) &&
                                Array.isArray(lastPaths[key]) &&
                                Array.isArray(newPaths[key]) &&
                                lastPaths[key].length === newPaths[key].length &&
                                lastPaths[key].every((val, idx) => val === newPaths[key][idx])
                        )
                    ) {
                        return true;
                    }
                } else {
                    // For other objects, use proper deep equality comparison
                    if (!this.deepEqual(lastValue, newValue)) {
                        return true;
                    }
                }
            }
            // Handle primitive properties
            else if (lastValue !== newValue) {
                return true;
            }
        }

        return false;
    }

    /**
     * Detects if a TypeScript error is dependency-related
     */
    private isDependencyRelatedError(message: string): boolean {
        const dependencyErrorPatterns = [
            /cannot find module/i,
            /module .* was resolved to .* but .* does not exist/i,
            /could not find a declaration file for module/i,
            /cannot resolve dependency/i,
            /failed to resolve import/i,
            /cannot import.*from/i,
            /module.*has no exported member/i,
            /cannot find name.*in module/i,
        ];

        return dependencyErrorPatterns.some(pattern => pattern.test(message));
    }

    /**
     * Categorizes addon loading errors for better diagnostics
     */
    private categorizeLoadingError(errorMessage: string): { type: string; suggestions: string[] } {
        const message = errorMessage.toLowerCase();

        // Module/Import related errors
        if (message.includes("cannot find module") || message.includes("module not found")) {
            return {
                type: "DEPENDENCY_ERROR",
                suggestions: [
                    "Check if all required dependencies are installed in the addon directory",
                    "Verify import paths are correct and files exist",
                    "Ensure external packages are available in the addon context",
                    "Check if the module has been compiled properly",
                ],
            };
        }

        // Syntax errors in the addon file
        if (message.includes("unexpected token") || message.includes("syntaxerror") || message.includes("syntax error")) {
            return {
                type: "SYNTAX_ERROR",
                suggestions: [
                    "Check the addon file for JavaScript/TypeScript syntax errors",
                    "Ensure the file was compiled correctly if it's a TypeScript addon",
                    "Verify the file encoding is correct (UTF-8)",
                    "Check for missing semicolons, brackets, or other syntax issues",
                ],
            };
        }

        // Permission/File system errors
        if (message.includes("enoent") || message.includes("eacces") || message.includes("permission denied")) {
            return {
                type: "FILE_SYSTEM_ERROR",
                suggestions: [
                    "Check if the addon file exists at the specified path",
                    "Verify file permissions allow reading the addon file",
                    "Ensure the directory structure is correct",
                    "Check if the file path is correct and accessible",
                ],
            };
        }

        // Read-only file system errors (common in test environments)
        if (message.includes("erofs") || message.includes("read-only file system")) {
            return {
                type: "READ_ONLY_FILESYSTEM",
                suggestions: [
                    "This typically occurs in test or containerized environments",
                    "Ensure compilation output directory has write permissions",
                    "Check if the addon directory is mounted as read-only",
                    "Try compiling addons to a writable temporary directory",
                ],
            };
        }

        // Working directory issues
        if (message.includes("uv_cwd") || message.includes("current working directory")) {
            return {
                type: "WORKING_DIRECTORY_ERROR",
                suggestions: [
                    "The current working directory may have been deleted or corrupted",
                    "This often happens in test environments with cleanup issues",
                    "Restore the working directory before loading addons",
                    "Check test cleanup procedures to avoid directory deletion",
                ],
            };
        }

        // Export/Structure errors
        if (message.includes("activate") || message.includes("export") || message.includes("function")) {
            return {
                type: "ADDON_STRUCTURE_ERROR",
                suggestions: [
                    'Ensure the addon exports an "activate" function',
                    "Check if the export structure matches expected format",
                    "Verify the activate function is properly defined",
                    "Review addon API documentation for correct structure",
                ],
            };
        }

        // Generic/Unknown errors
        return {
            type: "UNKNOWN_ERROR",
            suggestions: [
                "Review the full error message for specific details",
                "Check if the addon file is valid JavaScript/TypeScript",
                "Ensure all required dependencies are available",
                "Try loading the addon manually to reproduce the error",
                "Check system logs for additional error information",
            ],
        };
    }
}

const getImportPath = (system: ts.System, filePath: string) => {
    const resolvedPath = resolvePath(system, filePath);
    // Always return the full path with extension for Node 20 compatibility
    return resolvedPath;
};

const getAddonName = (filePath: string) => filePath.replace(/\\/g, "/").split("/").slice(-2)[0];
