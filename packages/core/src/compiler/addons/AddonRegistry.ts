/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Reporter, WarnMessage, type TargetConfig } from "@quatico/websmith-api";
import path, { basename, extname } from "path";
import ts from "typescript";
import { compilerAddons, type CompilerAddon, type CompilerAddons } from "./CompilerAddon";

export type AddonConfig = {
    addons?: string;
    addonsDir: string;
    targets?: Record<string, TargetConfig>;
    reporter: Reporter;
    system: ts.System;
};

export class AddonRegistry {
    private availableAddons: Map<string, CompilerAddon>;
    private config: AddonConfig;

    constructor(config: AddonConfig) {
        this.availableAddons = new Map<string, CompilerAddon>();
        this.config = { ...config };
    }

    setConfig(config: Partial<AddonConfig>): this {
        this.config = { ...this.config, ...config };
        return this.refresh();
    }

    public getAddonsDir(): string {
        return this.config.addonsDir;
    }

    public getAvailableAddons(target?: string): CompilerAddons {
        this.reportMissingAddons(target);
        const expectedNames = this.getExpectedAddons(target);
        const results =
            expectedNames.length > 0
                ? [...this.availableAddons].filter(([name]) => expectedNames.includes(name)).map(([, addon]) => addon)
                : Array.from(this.availableAddons.values());
        return compilerAddons(results);
    }

    public refresh(): this {
        this.availableAddons = this.findAddons();
        return this;
    }

    private getExpectedAddons(target?: string): string[] {
        const { targets = {}, addons } = this.config;
        const requestedAddons =
            addons
                ?.split(",")
                .map(it => it.trim())
                .filter(it => it.length > 0) ?? [];

        const targetAddons = target ? targets[target]?.addons ?? [] : [];

        return [...new Set([...requestedAddons, ...targetAddons])];
    }

    private getMissingAddons(target?: string): string[] {
        return this.getExpectedAddons(target).filter(name => !this.availableAddons.has(name));
    }

    private reportMissingAddons(target?: string): void {
        const { reporter } = this.config;

        const missing = this.getMissingAddons(target).join(", ");
        if (missing.length > 0) {
            reporter.reportDiagnostic(
                new WarnMessage(target && target !== "*" ? `Missing addons for target "${target}": "${missing}".` : `Missing addons: "${missing}".`)
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
                    if (addon.activate) {
                        map.set(addonName, addon);
                    } else {
                        reporter.reportDiagnostic(new WarnMessage(`No "activate" function found for addon "${addonName}" in "${addonsDir}".`));
                    }
                });
        }
        return map;
    }
}

const createAddon = (system: ts.System, filePath: string, addonName: string) => {
    const importPath = getImportPath(system, filePath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
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
