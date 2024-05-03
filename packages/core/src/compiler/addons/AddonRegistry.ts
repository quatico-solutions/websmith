/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Reporter, WarnMessage } from "@quatico/websmith-api";
import path, { basename, extname } from "path";
import ts from "typescript";
import { CompilationConfig } from "../config";
import type { CompilerAddon, CompilerAddons } from "./CompilerAddon";

export type AddonRegistryOptions = {
    addons?: string;
    addonsDir: string;
    config?: CompilationConfig;
    reporter: Reporter;
    system: ts.System;
};

export class AddonRegistry {
    private addons: string[];
    private availableAddons: Map<string, CompilerAddon>;
    private options: AddonRegistryOptions;

    constructor(options: AddonRegistryOptions) {
        this.options = options;
        this.addons =
            options.addons
                ?.split(",")
                .map(it => it.trim())
                .filter(it => it.length > 0) ?? [];
        this.availableAddons = this.findAddons();
    }

    public getAvailableAddons(target?: string): CompilerAddons {
        const expectedNames = getAddonNames(target, this.addons, this.options.config);
        let results: CompilerAddon[];
        if (expectedNames.length > 0) {
            this.reportMissingAddons(target, expectedNames);
            results = Object.entries(this.availableAddons)
                .filter(([name]) => expectedNames.includes(name))
                .map(([, addon]) => addon);
        } else {
            results = Array.from(this.availableAddons.values());
        }
        return Object.assign(results, { getNames: () => results.map(it => it.getName()) });
    }

    public getAddonsDir(): string {
        return this.options.addonsDir;
    }

    public refresh(): this {
        this.availableAddons = this.findAddons();
        return this;
    }

    private reportMissingAddons(target: string | undefined, expected: string[]): void {
        const { reporter } = this.options;
        const missing = expected.filter(name => !this.availableAddons.has(name));
        if (missing.length > 0) {
            if (target && target !== "*") {
                reporter.reportDiagnostic(new WarnMessage(`Missing addons for target "${target}": "${missing.join(", ")}".`));
            } else {
                reporter.reportDiagnostic(new WarnMessage(`Missing addons: "${missing.join(", ")}".`));
            }
        }
    }
    private findAddons(): Map<string, CompilerAddon> {
        const { addonsDir, reporter, system } = this.options;
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
                    const addonName = filePath
                        .replace(path.sep + basename(filePath), "")
                        .split(path.sep)
                        .slice(-1)[0];
                    if (addonName) {
                        if (map.has(addonName)) {
                            reporter.reportDiagnostic(new WarnMessage(`Duplicate addon name "${addonName}" in "${addonsDir}".`));
                        } else {
                            const resolvedPath = system.resolvePath(filePath);
                            const importPath = extname(resolvedPath).match(/^(?!.*\.d\.tsx?$).*\.[j]sx?$/g)
                                ? resolvedPath.replace(extname(resolvedPath), "")
                                : resolvedPath;
                            // eslint-disable-next-line @typescript-eslint/no-var-requires
                            const activator = require(importPath).activate;
                            if (activator) {
                                map.set(addonName, { getName: () => addonName, activate: activator });
                            } else {
                                reporter.reportDiagnostic(
                                    new WarnMessage(`No "activate" function found for addon "${addonName}" in "${addonsDir}".`)
                                );
                            }
                        }
                    }
                });
        }
        return map;
    }
}

const getAddonNames = (target: string | undefined, expectedAddons: string[], config?: CompilationConfig): string[] => {
    if (expectedAddons.length > 0) {
        return expectedAddons;
    }

    if (config) {
        if (target) {
            const { targets = {} } = config;
            return targets[target]?.addons ?? [];
        } else {
            return config.addons ?? [];
        }
    }
    return [];
};
