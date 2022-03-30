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
import ts from "typescript";
import { CompilerAddon, Generator, Processor, Reporter, StyleTransformer, WarnMessage } from "../../model";
import { CompilerConfig } from "../config";
import { createResolver } from "./addon-resolver";

export type AddonRegistryOptions = {
    addonsDir: string;
    config?: CompilerConfig;
    reporter: Reporter;
    system: ts.System;
};

export class AddonRegistry {
    private config?: CompilerConfig;
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
        this.reportMissingAddons(target ?? "", expected);
        if (expected.length > 0) {
            return this.availableAddons.filter(addon => expected.includes(addon.name));
        }
        return this.availableAddons;
    }

    private reportMissingAddons(target: string, expected: string[]): void {
        // TODO: Addon resolution: Found addons in addonsDir vs. specified addons in CompilerConfig
        // Found addons in addonsDir
        // Specified addon names in CompilerConfig
        const missing = expected.filter(name => !this.availableAddons.some(addon => addon.name === name));
        if (missing.length > 0) {
            this.reporter.reportDiagnostic(new WarnMessage(`Missing addons for target "${target || "All"}": "${missing.join(", ")}"`));
        }
    }
}

const getAddonNames = (target?: string, config: CompilerConfig = {}): string[] => {
    if (target) {
        const { targets = {} } = config;
        return targets[target]?.addons ?? [];
    }
    return [];
};

const findAddons = (addonsDir: string, reporter: Reporter, system: ts.System): CompilerAddon[] => {
    // TODO: Implement resolution of all addons in addonsDir
    createResolver(reporter, system);
    return [];
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
