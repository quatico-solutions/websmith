/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { WarnMessage, type CompilationProfile, type Reporter } from "@quatico/websmith-api";
import path from "node:path";
import ts from "typescript";
import { Compiler } from "../Compiler";
import { type CompilerOptions } from "../CompilerOptions";
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
            const targetDir: string = path.join(path.dirname(addonsDir), "lib");
            const compiledAddons = system
                .readDirectory(targetDir)
                .filter(dirName => path.basename(dirName, path.extname(dirName)).toLocaleLowerCase() === "addon")
                .map(it => getAddonName(it));

            const missingAddons = targetAddons.filter(it => !compiledAddons.includes(it));
            if (missingAddons.length > 0) {
                // Compile all addons in the addons directory
                new Compiler(compileAddonOptions(reporter, system, { buildDir: addonsDir }), system).compile();
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
            // Load compiled addons from addons directory first
            const loadedAddons = system
                .readDirectory(addonsDir, [".js", ".jsx"])
                .filter(dirName => path.basename(dirName, path.extname(dirName)).toLocaleLowerCase() === "addon")
                .reduce((acc: string[], filePath) => {
                    const addonName = loadAddon(system, filePath, map, reporter, addonsDir);
                    if (addonName) {
                        acc.push(addonName);
                    }
                    return acc;
                }, []);
            // Load remaining addons from source
            system
                .readDirectory(addonsDir, [".ts", ".tsx"])
                .filter(dirName => path.basename(dirName, path.extname(dirName)).toLocaleLowerCase() === "addon")
                .filter(curDir => !loadedAddons.includes(getAddonName(curDir))) // filter out already loaded addons
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return { getName: () => addonName, activate: require(importPath).activate };
};

const getImportPath = (system: ts.System, filePath: string) => {
    const resolvedPath = system.resolvePath(filePath);
    return path.extname(resolvedPath).match(/^(?!.*\.d\.tsx?$).*\.[j]sx?$/g) ? resolvedPath.replace(path.extname(resolvedPath), "") : resolvedPath;
};

const getAddonName = (filePath: string) =>
    filePath
        .replace(path.sep + path.basename(filePath), "")
        .split(path.sep)
        .slice(-1)[0];

const isSourceFile = (filePath: string): boolean => filePath.endsWith(".ts") || filePath.endsWith(".tsx");

const compileAddonOptions = (reporter: Reporter, system: ts.System, overrides: Partial<CompilerOptions>): CompilerOptions => {
    const addonsDir: string = resolvePath(system, overrides.buildDir!);
    const buildDir: string = path.dirname(addonsDir);
    const outDir: string = path.join(buildDir, "lib");
    return {
        debug: false,
        watch: false,
        ...overrides,
        reporter,
        buildDir,
        tsConfig: {
            outDir,
            module: ts.ModuleKind.ES2020,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true,
            moduleResolution: ts.ModuleResolutionKind.Node10,
            configFilePath: overrides?.tsConfigFile ?? path.join(buildDir, "tsconfig.json"),
            ...overrides?.tsConfig,
        },
        profile: overrides?.profile,
        cliArgs: {
            options: { outDir },
            fileNames: system.readDirectory(addonsDir).filter(isSourceFile),
            errors: [],
            ...overrides?.cliArgs,
        },
    };
};

const resolvePath = (fs: ts.System, ...pathSegments: string[]) => {
    let resolvedPath = path.join(...pathSegments);
    if (!path.isAbsolute(resolvedPath)) {
        resolvedPath = path.join(fs.getCurrentDirectory(), ...pathSegments);
    }
    return resolvedPath;
};
