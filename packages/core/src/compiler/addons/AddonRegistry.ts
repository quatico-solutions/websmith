/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter, WarnMessage, type CompilationProfile } from "@quatico/websmith-api";
import path, { basename, extname } from "node:path";
import type ts from "typescript";
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
        this.reportMissingAddons(profile);
        const expectedNames = this.getExpectedAddons(profile);
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
        const { profiles = {}, addons = [] } = this.config;
        const requestedAddons = addons.filter(it => it.length > 0);

        const profileAddons = profile ? (profiles[profile]?.addons ?? []) : [];

        return [...new Set([...requestedAddons, ...profileAddons])];
    }

    private getMissingAddons(profile?: string): string[] {
        return this.getExpectedAddons(profile).filter(name => !this.availableAddons.has(name));
    }

    private reportMissingAddons(profile?: string): void {
        const { reporter } = this.config;

        const missing = this.getMissingAddons(profile).join(", ");
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
            system
                .readDirectory(addonsDir, [".js", ".jsx"])
                .filter(dirName => basename(dirName, extname(dirName)).toLocaleLowerCase() === "addon")
                .forEach(filePath => {
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
                });
        }
        return map;
    }
}

const createAddon = (system: ts.System, filePath: string, addonName: string): CompilerAddon => {
    const importPath = getImportPath(system, filePath);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return { getName: () => addonName, activate: require(importPath).activate };
};

const getImportPath = (system: ts.System, filePath: string) => {
    const resolvedPath = system.resolvePath(filePath);
    return extname(resolvedPath).match(/^(?!.*\.d\.tsx?$).*\.[j]sx?$/g) ? resolvedPath.replace(extname(resolvedPath), "") : resolvedPath;
};

const getAddonName = (filePath: string) =>
    filePath
        .replace(path.sep + basename(filePath), "")
        .split(path.sep)
        .slice(-1)[0];
