/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { WarnMessage, type AddonContext, type CompilationProfile, type Reporter } from "@quatico/websmith-api";
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
        this.availableAddons = this.findAddons();
    }

    setConfig(config: Partial<AddonConfig>): this {
        this.config = { ...this.config, ...config };
        return this.refresh();
    }

    public getAddonsDir(): string {
        return this.config.addonsDir;
    }

    /**
     * Retrieves the available compiler addons based on the specified profile. Only addons that are
     * provided in the 'addonsDir' are requested. If unavailable addons are requested, a warning message
     * is emitted to the registry's reporter.
     *
     * @param profile - An optional string specifying the profile name for which to retrieve the addons.
     *                 If not provided, the function will retrieve addons specified by the 'addons'
     *                 property in the configuration, or an empty array.
     * @returns A `CompilerAddons` object containing the available addons for the specified 'profile'
     *          or by the 'addons' property in the configuration.
     */
    public getAvailableAddons(profile?: string): CompilerAddons {
        const expectedNames = this.getExpectedAddons(profile);
        this.reportMissingAddons(expectedNames, profile);
        const results =
            expectedNames.length === 0 && profile === "*"
                ? Array.from(this.availableAddons.values())
                : [...this.availableAddons].filter(([name]) => expectedNames.includes(name)).map(([, addon]) => addon);
        return compilerAddons(results);
    }

    public refresh(): this {
        this.availableAddons = this.findAddons();
        return this;
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
            const targetDir: string = resolvePath(system, addonsDir, "./lib");
            const compiledAddons = system
                .readDirectory(targetDir)
                .filter(dirName => path.basename(dirName, path.extname(dirName)).toLocaleLowerCase() === "addon")
                .map(it => getAddonName(it));

            const missingAddons = targetAddons.filter(it => !compiledAddons.includes(it));
            if (missingAddons.length > 0) {
                // Compile all addons in the addons directory
                const targetDir = resolvePath(system, addonsDir);
                const buildDir = path.dirname(targetDir);
                const outDir = resolvePath(system, buildDir, "./lib");
                new Compiler({
                    buildDir: targetDir, // Set buildDir to source directory to get correct relative paths
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
                        fileNames: system.readDirectory(targetDir).filter(isSourceFile),
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
            reporter.reportDiagnostic(
                new WarnMessage(
                    profile && profile !== "*" ? `Missing addons for profile "${profile}": "${missing}".` : `Missing addons: "${missing}".`
                )
            );
        }
    }

    private findAddons(): Map<string, CompilerAddon> {
        const { addonsDir, reporter, system } = this.config;
        const map = new Map<string, CompilerAddon>();

        if (addonsDir && !system.directoryExists(addonsDir)) {
            reporter.reportDiagnostic(new WarnMessage(`Addons directory "${addonsDir}" does not exist.`));
            return map;
        }

        if (addonsDir) {
            const loadedAddons: string[] = [];

            // First, try to load compiled JS files directly from addons directory (test scenario)
            system
                .readDirectory(addonsDir, [".js", ".jsx"])
                .filter(dirName => path.basename(dirName, path.extname(dirName)).toLocaleLowerCase() === "addon")
                .forEach(filePath => {
                    const addonName = loadAddon(system, filePath, map, reporter, addonsDir);
                    if (addonName) {
                        loadedAddons.push(addonName);
                    }
                });

            // If no JS files found in addonsDir, look for compiled files in lib directory (production scenario)
            if (loadedAddons.length === 0) {
                const buildDir = path.dirname(addonsDir);
                const libDir = resolvePath(system, buildDir, "./lib");

                if (system.directoryExists(libDir)) {
                    system
                        .readDirectory(libDir, [".js", ".jsx"])
                        .filter(dirName => path.basename(dirName, path.extname(dirName)).toLocaleLowerCase() === "addon")
                        .forEach(filePath => {
                            const addonName = loadAddon(system, filePath, map, reporter, libDir);
                            if (addonName) {
                                loadedAddons.push(addonName);
                            }
                        });
                }
            }

            // Finally, load remaining addons from source (only if not already loaded from compiled versions)
            system
                .readDirectory(addonsDir, [".ts", ".tsx"])
                .filter(dirName => path.basename(dirName, path.extname(dirName)).toLocaleLowerCase() === "addon")
                .filter(filePath => !loadedAddons.includes(getAddonName(filePath))) // filter out already loaded addons
                .forEach(filePath => loadAddon(system, filePath, map, reporter, addonsDir));
        }
        return map;
    }
}

const loadAddon = (
    system: ts.System,
    filePath: string,
    map: Map<string, CompilerAddon>,
    reporter: Reporter,
    addonsDir: string
): string | undefined => {
    const addonName = getAddonName(filePath);

    if (!addonName) {
        return;
    }
    if (map.has(addonName)) {
        reporter.reportDiagnostic(new WarnMessage(`Duplicate addon name "${addonName}" in "${addonsDir}".`));
        return;
    }
    const addon = createAddon(system, filePath, addonName);
    if (typeof addon.activate === "function") {
        map.set(addonName, addon);
    } else {
        reporter.reportDiagnostic(new WarnMessage(`No "activate" function found for addon "${addonName}" in "${addonsDir}".`));
    }
    return addonName;
};

const createAddon = (system: ts.System, filePath: string, addonName: string): CompilerAddon => {
    const importPath = getImportPath(system, filePath);

    // Check if file exists before attempting to require it
    if (!system.fileExists(importPath)) {
        throw new Error(`Addon file does not exist: "${importPath}"`);
    }

    try {
        // Clear require cache to ensure fresh load
        delete require.cache[importPath];

        // In test environment, use Jest's module mocking
        const isTestEnvironment = typeof jest !== "undefined" && jest.isMockFunction;
        let module: { activate?: unknown } | undefined;

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
                // Fallback to eval require even in test environment
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                module = eval("require")(importPath);
            }
        } else {
            // Use eval to prevent webpack from trying to bundle this dynamic require
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            module = eval("require")(importPath);
        }

        if (!module || typeof module.activate !== "function") {
            throw new Error(`Addon "${addonName}" does not export an "activate" function`);
        }

         
        return { getName: () => addonName, activate: module.activate as (context: AddonContext) => void };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load addon "${addonName}" from "${importPath}": ${errorMessage}`);
    }
};

const getImportPath = (system: ts.System, filePath: string) => {
    const resolvedPath = system.resolvePath(filePath);
    // Always return the full path with extension for Node 20 compatibility
    return resolvedPath;
};

const getAddonName = (filePath: string) =>
    filePath
        .replace(path.sep + path.basename(filePath), "")
        .split(path.sep)
        .slice(-1)[0];

const isSourceFile = (filePath: string): boolean => filePath.endsWith(".ts") || filePath.endsWith(".tsx");
