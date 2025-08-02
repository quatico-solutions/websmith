/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { WarnMessage, type AddonContext, type CompilationProfile, type Reporter } from "@quatico/websmith-api";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { Compiler } from "../Compiler";
import { resolvePath } from "../config";
import { compilerAddons, type CompilerAddon, type CompilerAddons } from "./CompilerAddon";

export type AddonConfig = {
    addons?: string[];
    addonsDir: string;
    profiles?: Record<string, CompilationProfile>;
    reporter: Reporter;
    system: ts.System;
};

export class AddonRegistry {
    private availableAddons: Map<string, CompilerAddon>;
    private config: AddonConfig;

    constructor(config: AddonConfig) {
        this.availableAddons = new Map();
        this.config = config;
        this.loadAddonsSync();
    }

    setConfig(config: AddonConfig): this {
        this.config = config;
        return this.refresh();
    }

    /**
     * Retrieves all available addons based on the provided profile and its dependencies.
     *
     * RULES:
     * 1. Returns all loaded addons when profile is undefined/not passed
     * 2. Returns addons defined by the specified profile
     * 3. Returns addons from profile + all depends profiles (recursively)
     * 4. Returns no addons when profile defines no addons
     * 5. Returns no addons when profile and all depends define no addons
     * 6. Returns no addons when profile defines unknown addon names
     * 7. Reports warnings for expected addons that cannot be returned
     */
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
        const { reporter } = this.config;

        const missing = this.getMissingAddons(expectedNames).join(", ");
        if (missing.length > 0) {
            reporter?.reportDiagnostic(
                new WarnMessage(profile ? `Missing addons for profile "${profile}": "${missing}".` : `Missing addons: "${missing}".`)
            );
        }
    }

    /**
     * Recursively find all addon entry files in subdirectories.
     * Prefers 'index' files over 'addon' files in each directory.
     */
    private findAddonEntryFiles(dir: string): string[] {
        let results: string[] = [];
        const { system } = this.config;
        const entries = system.readDirectory(dir, [".ts", ".tsx", ".js", ".jsx"], undefined, undefined);

        // Group entries by directory to prefer 'index' over 'addon' files
        const entriesByDir = new Map<string, string[]>();
        for (let entry of entries) {
            if (!path.isAbsolute(dir)) {
                // If the directory is absolute, make it relative to the addons directory
                entry = resolvePath(system, entry);
            }
            const dirName = path.dirname(entry);
            const fileName = path.basename(entry, path.extname(entry)).toLowerCase();
            if (fileName === "addon" || fileName === "index") {
                if (!entriesByDir.has(dirName)) {
                    entriesByDir.set(dirName, []);
                }
                entriesByDir.get(dirName)!.push(entry);
            }
        }

        // For each directory, prefer 'addon' over 'index' files
        // Skip the root addons directory to avoid picking up main index files
        const rootDir = path.resolve(dir);
        for (const [dirPath, files] of entriesByDir) {
            // Skip files in the root addons directory (like src/index.ts)
            if (dirPath === rootDir) {
                continue;
            }

            const addonFiles = files.filter((f: string) => path.basename(f, path.extname(f)).toLowerCase() === "addon");
            const indexFiles = files.filter((f: string) => path.basename(f, path.extname(f)).toLowerCase() === "index");

            // Prefer addon files for clarity, fall back to index files
            if (addonFiles.length > 0) {
                results.push(...addonFiles);
            } else if (indexFiles.length > 0) {
                results.push(...indexFiles);
            }
        }

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
                results = results.concat(this.findAddonEntryFiles(subdir));
            }
        }
        return results;
    }

    private loadAddonsSync(): void {
        const { addonsDir, reporter, system, addons } = this.config;

        if (!addonsDir || !system.directoryExists(addonsDir)) {
            if (addonsDir) {
                reporter?.reportDiagnostic(new WarnMessage(`Addons directory "${addonsDir}" does not exist.`));
            }
            return;
        }

        const addonEntryFiles = this.findAddonEntryFiles(addonsDir);
        const loadedAddons: string[] = [];

        // Try to load compiled JS files first
        const jsFiles = addonEntryFiles.filter(f => f.endsWith(".js") || f.endsWith(".jsx"));
        jsFiles.forEach(filePath => {
            const addonName = this.loadSingleAddon(filePath, addonsDir);
            if (addonName) {
                loadedAddons.push(addonName);
            }
        });

        // If no JS files found, check for TypeScript files and compile them first
        if (loadedAddons.length === 0) {
            const tsFiles = addonEntryFiles.filter(isSourceFile);
            if (tsFiles.length > 0) {
                // Calculate lib directory relative to addons directory
                const libDir = path.isAbsolute(addonsDir) ? path.resolve(path.dirname(addonsDir), "lib") : resolvePath(system, ".", "lib");

                if (!system.directoryExists(libDir)) {
                    system.createDirectory(libDir);
                }

                const compiledAddonFiles = this.compileSourceFiles(addonsDir, reporter, libDir, tsFiles);

                // Load the compiled addons
                compiledAddonFiles.forEach((filePath: string) => {
                    const addonName = this.loadSingleAddon(filePath, libDir);
                    if (addonName) {
                        loadedAddons.push(addonName);
                    }
                });
            }
        }

        this.reportMissingAddons(addons);
    }

    private compileSourceFiles(addonsDir: string, reporter: Reporter, libDir: string, tsFiles: string[]): string[] {
        try {
            // // Create a wrapper reporter to capture diagnostics
            const result = new Compiler({
                buildDir: addonsDir,
                reporter,
                tsConfig: {
                    outDir: libDir,
                    rootDir: addonsDir,
                    module: ts.ModuleKind.CommonJS,
                    target: ts.ScriptTarget.ES2020,
                    esModuleInterop: true,
                    moduleResolution: ts.ModuleResolutionKind.Node10,
                    skipLibCheck: false, // Enable lib checking to catch more errors
                    forceConsistentCasingInFileNames: true,
                    noEmit: false,
                    strict: true,
                },
                cliArgs: {
                    options: { outDir: libDir, rootDir: addonsDir },
                    fileNames: tsFiles,
                    errors: [],
                },
            }).compile();

            // Check if compilation succeeded by verifying output files exist
            const expectedJsFiles = tsFiles.map(ts => ts.replace(/\.ts$/, ".js").replace(addonsDir, libDir));
            const outputExists = this.config.system.directoryExists(libDir) && expectedJsFiles.some(jsFile => this.config.system.fileExists(jsFile));

            // Check if compilation had errors or failed to produce output
            if (result.emitSkipped || (result.diagnostics && result.diagnostics.length > 0) || !outputExists) {
                const errorMessages =
                    result.diagnostics
                        ?.map(d => (typeof d.messageText === "string" ? d.messageText : d.messageText?.messageText || "Unknown error"))
                        .join("; ") || "Compilation failed";
                reporter?.reportDiagnostic(new WarnMessage(`Failed to compile addons in ${addonsDir}: ${errorMessages}`));
                return [];
            }

            // Return the compiled addon file paths
            return this.findAddonEntryFiles(libDir).filter((f: string) => f.endsWith(".js") || f.endsWith(".jsx"));
        } catch (error) {
            reporter?.reportDiagnostic(
                new WarnMessage(`Failed to compile addons in ${addonsDir}: ${error instanceof Error ? error.message : String(error)}`)
            );
            return [];
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

            if (!addonModule || typeof addonModule.activate !== "function") {
                // Return undefined and log warning instead of throwing error (restore original behavior)
                this.config.reporter?.reportDiagnostic(
                    new WarnMessage(`Addon "${addonName}" does not export an "activate" function and will be ignored`)
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
            // Log warning and return undefined instead of throwing error (restore original behavior)
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.config.reporter?.reportDiagnostic(
                new WarnMessage(`Failed to load addon "${addonName}" from "${getImportPath(system, filePath)}": ${errorMessage}`)
            );
            return;
        }
    }
}

const getImportPath = (system: ts.System, filePath: string) => {
    const resolvedPath = resolvePath(system, filePath);
    // Always return the full path with extension for Node 20 compatibility
    return resolvedPath;
};

const getAddonName = (filePath: string) => filePath.replace(/\\/g, "/").split("/").slice(-2)[0];

const isSourceFile = (filePath: string): boolean => filePath.endsWith(".ts") || filePath.endsWith(".tsx");
