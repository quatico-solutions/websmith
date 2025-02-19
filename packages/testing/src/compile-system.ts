/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter } from "@quatico/websmith-api";
import {
    AddonRegistry,
    NoReporter,
    createBrowserSystem,
    getVersionedFile,
    type AddonConfig,
    type CompileSystemOptions as CoreSystemOptions,
} from "@quatico/websmith-core";
import type ts from "typescript";

export type CompileSystem = {
    fileSystem: ts.System;
    getSourceFile(fileName: string): { entry?: ts.SourceFile; fileSystem: ts.System };
    addons: AddonRegistry;
};

export type CompileSystemOptions = CoreSystemOptions & {
    files?: Record<string, string>;
    addonConfig?: Partial<AddonConfig>;
    reporter?: Reporter;
};

export const compileSystem = (options?: CompileSystemOptions): CompileSystem => {
    const { files, addonConfig, reporter, useCaseSensitiveFileNames = false, addLibDefaults = true, fileWatcher } = options ?? {};

    const fileSystem = createBrowserSystem({ ...files }, { useCaseSensitiveFileNames, addLibDefaults, fileWatcher });
    if (addLibDefaults) {
        if (!fileSystem.fileExists("./tsconfig.json")) {
            fileSystem.writeFile("./tsconfig.json", "{}");
        }
        if (!fileSystem.directoryExists("./addons")) {
            fileSystem.createDirectory("./addons");
        }
    }

    const { addons = [], addonsDir = "./addons", profiles } = addonConfig ?? {};

    const registry = new AddonRegistry({
        addons,
        addonsDir,
        profiles,
        reporter: reporter ?? new NoReporter(),
        system: fileSystem,
    });

    return {
        fileSystem,
        addons: registry,
        getSourceFile: (fileName: string) => ({
            entry: getVersionedFile(fileName, fileSystem),
            fileSystem,
        }),
    };
};
