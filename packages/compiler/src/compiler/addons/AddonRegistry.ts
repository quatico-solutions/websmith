/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import path, { basename, extname } from "path";
import ts from "typescript";
import { Reporter, WarnMessage } from "../../../../api/src";
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
    private config?: CompilationConfig;
    private availableAddons: CompilerAddon[];
    private reporter: Reporter;

    constructor(options: AddonRegistryOptions) {
        const { addons, addonsDir, config, reporter, system } = options;
        this.addons =
            addons
                ?.split(",")
                .map(it => it.trim())
                .filter(it => it.length > 0) ?? [];
        this.config = config;
        this.availableAddons = findAddons(addonsDir, reporter, system);
        this.reporter = reporter;
    }

    public getAddons(target?: string): CompilerAddon[] {
        const expected = getAddonNames(target, this.addons, this.config);
        if (expected.length > 0) {
            this.reportMissingAddons(target, expected);
            return this.availableAddons.filter(addon => expected.includes(addon.name));
        }
        return this.availableAddons;
    }

    private reportMissingAddons(target: string | undefined, expected: string[]): void {
        const missing = expected.filter(name => !this.availableAddons.some(addon => addon.name === name));
        if (missing.length > 0) {
            if (target && target !== "*") {
                this.reporter.reportDiagnostic(new WarnMessage(`Missing addons for target "${target}": "${missing.join(", ")}".`));
            } else {
                this.reporter.reportDiagnostic(new WarnMessage(`Missing addons: "${missing.join(", ")}".`));
            }
        }
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

const findAddons = (addonsDir: string, reporter: Reporter, system: ts.System): CompilerAddon[] => {
    const map = new Map<string, CompilerAddon>();

    if (addonsDir && !system.directoryExists(addonsDir)) {
        reporter.reportDiagnostic(new WarnMessage(`Addons directory "${addonsDir}" does not exist.`));
        return [];
    }

    if (addonsDir) {
        system
            .readDirectory(addonsDir)
            .filter(ad => basename(ad, extname(ad)).toLocaleLowerCase() === "addon")
            .forEach(it => {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const activator = require(it.replace(extname(it), "")).activate;
                const name = it
                    .replace(path.sep + basename(it), "")
                    .split(path.sep)
                    .slice(-1)[0];
                if (name && map.has(name)) {
                    reporter.reportDiagnostic(new WarnMessage(`Duplicate addon name "${name}" in "${addonsDir}".`));
                }
                if (name && activator && !map.has(name)) {
                    map.set(name, { name, activate: activator });
                }
            });
    }
    return Array.from(map.values());
};
