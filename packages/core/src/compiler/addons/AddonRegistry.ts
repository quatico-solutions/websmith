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
import { CompilerAddon } from "./CompilerAddon";

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

    public getAvailableAddons(target?: string): CompilerAddon[] {
        const expected = getAddonNames(target, this.addons, this.options.config);
        if (expected.length > 0) {
            this.reportMissingAddons(target, expected);
            return expected.map(it => this.availableAddons.get(it)).filter(it => it !== undefined) as CompilerAddon[];
        }
        return Array.from(this.availableAddons.values());
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
                .filter(ad => basename(ad, extname(ad)).toLocaleLowerCase() === "addon")
                .forEach(it => {
                    const importPath = system.resolvePath(it);
                    const modulePath = extname(importPath).match(/^(?!.*\.d\.tsx?$).*\.[j]sx?$/g)
                        ? importPath.replace(extname(importPath), "")
                        : importPath;
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const activator = require(modulePath).activate;
                    const name = it
                        .replace(path.sep + basename(it), "")
                        .split(path.sep)
                        .slice(-1)[0];
                    if (name && map.has(name)) {
                        reporter.reportDiagnostic(new WarnMessage(`Duplicate addon name "${name}" in "${addonsDir}".`));
                    }
                    if (name && activator && !map.has(name)) {
                        map.set(name, { getName: () => name, activate: activator });
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
