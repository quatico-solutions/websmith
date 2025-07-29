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
        this.config = { ...config };
        this.availableAddons = new Map<string, CompilerAddon>();
        // Load addons synchronously during construction for immediate availability
        this.loadAddonsSync();
    }

    setConfig(config: Partial<AddonConfig>): this {
        this.config = { ...this.config, ...config };
        return this.refresh();
    }

    public getAddonsDir(): string {
        return this.config.addonsDir;
    }

    public refresh(): this {
        this.availableAddons.clear();
        this.loadAddonsSync();
        return this;
    }

    /**
     * Returns all available addons that match the expected names. The expected addon names are defined
     * by the 'addons' properties in the profile specified by the 'profile' parameter
     * or by the 'addons' property in the configuration.
     */
    public getAvailableAddons(profile?: string): CompilerAddons {
        const expectedNames = this.getExpectedAddons(profile);
        this.reportMissingAddons(expectedNames, profile);

        const results =
            expectedNames.length === 0
                ? Array.from(this.availableAddons.values())
                : [...this.availableAddons].filter(([name]) => expectedNames.includes(name)).map(([, addon]) => addon);
        return compilerAddons(results);
    }

    /**
     * Returns the addon names that match the expected names. The expected addon names are defined
     * by the 'addons' properties in the profile specified by the 'profile' parameter
     * or by the 'addons' property in the configuration.
     */
    public getAddons(profile?: string): CompilerAddons {
        const expectedNames = this.getExpectedAddons(profile);
        this.reportMissingAddons(expectedNames, profile);

        return compilerAddons(expectedNames.map(name => this.availableAddons.get(name)).filter(addon => addon !== undefined));
    }

    /**
     * Retrieves the list of expected addons based on the provided 'profile' and the 'addons'
     * property from the configuration.
     *
     * @param profile - An optional string representing the profile for which to retrieve addons.
     * @returns An array of unique addon names that are expected for the given profile or 'addons' config.
     */
    private getExpectedAddons(profile?: string): string[] {
        const { profiles = {}, addons = [], system, reporter, addonsDir } = this.config;
        const requestedAddons = addons.filter(it => it.length > 0);
        const profileAddons = profile ? (profiles[profile]?.addons ?? []) : [];
        const targetAddons = [...new Set([...requestedAddons, ...profileAddons])];

        const addonsToCompile = system
            .readDirectory(addonsDir)
            .filter(it => targetAddons.includes(getAddonName(it)))
            .filter(dirName => path.basename(dirName, path.extname(dirName)).toLocaleLowerCase() === "addon")
            .filter(isSourceFile)
            .map(it => path.dirname(it));

        if (addonsToCompile.length > 0) {
            // Calculate lib directory - if addonsDir ends with 'src', go up one level
            const buildDir = path.dirname(addonsDir);
            const libDir = resolvePath(system, buildDir, "./lib");
            const compiledAddons = system.directoryExists(libDir)
                ? system
                      .readDirectory(libDir)
                      .filter(dirName => path.basename(dirName, path.extname(dirName)).toLocaleLowerCase() === "addon")
                      .map(it => getAddonName(it))
                : [];

            const missingAddons = targetAddons.filter(it => !compiledAddons.includes(it));
            if (missingAddons.length > 0) {
                // Compile all addons in the addons directory
                const outDir = libDir;
                new Compiler({
                    buildDir: addonsDir, // Set buildDir to source directory to get correct relative paths
                    reporter,
                    tsConfig: {
                        outDir,
                        module: ts.ModuleKind.CommonJS,
                        target: ts.ScriptTarget.ES2020,
                        esModuleInterop: true,
                        moduleResolution: ts.ModuleResolutionKind.Node10,
                        skipLibCheck: true,
                        forceConsistentCasingInFileNames: true,
                    },
                    cliArgs: {
                        options: { outDir },
                        fileNames: system.readDirectory(addonsDir).filter(isSourceFile),
                        errors: [],
                    },
                }).compile();
            }
        }
        return targetAddons;
    }

    private getMissingAddons(expectedNames: string[] = []): string[] {
        return expectedNames.filter(name => !this.availableAddons.has(name));
    }

    private reportMissingAddons(expectedNames: string[] = [], profile?: string): void {
        const { reporter } = this.config;

        const missing = this.getMissingAddons(expectedNames).join(", ");
        if (missing.length > 0) {
            reporter?.reportDiagnostic(
                new WarnMessage(
                    profile && profile !== "*" ? `Missing addons for profile "${profile}": "${missing}".` : `Missing addons: "${missing}".`
                )
            );
        }
    }

    private loadAddonsSync(): void {
        const { addonsDir, reporter, system } = this.config;

        if (!addonsDir || !system.directoryExists(addonsDir)) {
            if (addonsDir) {
                reporter?.reportDiagnostic(new WarnMessage(`Addons directory "${addonsDir}" does not exist.`));
            }
            return;
        }

        // Recursively find all addon entry files in subdirectories
        const findAddonEntryFiles = (dir: string): string[] => {
            let results: string[] = [];
            const entries = system.readDirectory(dir, [".ts", ".tsx", ".js", ".jsx"], undefined, undefined);
            for (const entry of entries) {
                if (path.basename(entry, path.extname(entry)).toLowerCase() === "addon") {
                    results.push(entry);
                }
            }
            // Recursively search subdirectories
            const subdirs = system.readDirectory(dir, undefined, ["directory"], undefined);
            for (const subdir of subdirs) {
                if (subdir !== dir) {
                    results = results.concat(findAddonEntryFiles(subdir));
                }
            }
            return results;
        };

        const addonEntryFiles = findAddonEntryFiles(addonsDir);
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
            const buildDir = path.dirname(addonsDir);
            const libDir = resolvePath(system, buildDir, "./lib");
            const tsFiles = addonEntryFiles.filter(f => f.endsWith(".ts") || f.endsWith(".tsx"));
            if (tsFiles.length > 0) {
                // Compile all TypeScript addon entry files
                try {
                    new Compiler({
                        buildDir: addonsDir,
                        reporter,
                        tsConfig: {
                            outDir: libDir,
                            rootDir: addonsDir,
                            module: ts.ModuleKind.CommonJS,
                            target: ts.ScriptTarget.ES2020,
                            esModuleInterop: true,
                            moduleResolution: ts.ModuleResolutionKind.Node10,
                            skipLibCheck: true,
                            forceConsistentCasingInFileNames: true,
                        },
                        cliArgs: {
                            options: { outDir: libDir, rootDir: addonsDir },
                            fileNames: tsFiles,
                            errors: [],
                        },
                    }).compile();
                } catch (error) {
                    reporter?.reportDiagnostic({
                        category: ts.DiagnosticCategory.Warning,
                        code: 0,
                        messageText: `Failed to compile addons in ${addonsDir}: ${error instanceof Error ? error.message : String(error)}`,
                        file: undefined,
                        start: undefined,
                        length: undefined,
                    });
                }
                // Now try to load compiled files from lib directory
                if (system.directoryExists(libDir)) {
                    const compiledAddonFiles = findAddonEntryFiles(libDir).filter(f => f.endsWith(".js") || f.endsWith(".jsx"));
                    compiledAddonFiles.forEach(filePath => {
                        const addonName = this.loadSingleAddon(filePath, libDir);
                        if (addonName) {
                            loadedAddons.push(addonName);
                        }
                    });
                }
            }
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
    const resolvedPath = system.resolvePath(filePath);
    // Always return the full path with extension for Node 20 compatibility
    return resolvedPath;
};

const getAddonName = (filePath: string) => filePath.replace(/\\/g, "/").split("/").slice(-2)[0];

const isSourceFile = (filePath: string): boolean => filePath.endsWith(".ts") || filePath.endsWith(".tsx");
