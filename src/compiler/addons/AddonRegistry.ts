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
import { CompilerAddon, Generator, Processor, Reporter, StyleTransformer, WarnMessage } from "../../model";
import { CompilationConfig } from "../config";

export type AddonRegistryOptions = {
    addonsDir: string;
    config?: CompilationConfig;
    reporter: Reporter;
    system: ts.System;
};

export class AddonRegistry {
    private config?: CompilationConfig;
    private availableAddons: CompilerAddon[];
    private reporter: Reporter;

    constructor(options: AddonRegistryOptions) {
        const { addonsDir, config, reporter, system } = options;
        this.config = config;
        this.availableAddons = findAddons(addonsDir, reporter, system);
        this.reporter = reporter;
    }

    public getAddons(target?: string): CompilerAddon[] {
        const expected = getAddonNames(target, this.config);
        if (target && expected.length > 0) {
            this.reportMissingAddons(target, expected);
            return this.availableAddons.filter(addon => expected.includes(addon.name));
        }
        return this.availableAddons;
    }

    private reportMissingAddons(target: string, expected: string[]): void {
        // TODO: Addon resolution: Found addons in addonsDir vs. specified addons in CompilationConfig
        // Found addons in addonsDir
        // Specified addon names in CompilationConfig
        // TODO: Validate options.addons with options.config.targets[target].addons
        // TODO: Validate args.addons with found addons in args.addonsDir
        const missing = expected.filter(name => !this.availableAddons.some(addon => addon.name === name));
        if (missing.length > 0) {
            this.reporter.reportDiagnostic(new WarnMessage(`Missing addons for target "${target}": "${missing.join(", ")}"`));
        }
    }
}

const getAddonNames = (target?: string, config?: CompilationConfig): string[] => {
    if (target) {
        if (config) {
            const { targets = {} } = config;
            return targets[target]?.addons ?? [];
        }
    }
    return [];
};

const findAddons = (addonsDir: string, reporter: Reporter, system: ts.System): CompilerAddon[] => {
    const map = new Map<string, CompilerAddon>();

    if (!system.directoryExists(addonsDir)) {
        reporter.reportDiagnostic(new WarnMessage(`Addons directory "${addonsDir}" does not exist.`));
        return [];
    }

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
    return Array.from(map.values());
};

export interface CustomProcessors {
    element?: Processor[];
    styles?: Processor[];
}

export interface CustomStyleTransformers {
    after?: StyleTransformer[];
    before?: StyleTransformer[];
}

export interface CustomGenerators {
    docs?: Generator[];
    source?: Generator[];
    binary?: Generator[];
}
