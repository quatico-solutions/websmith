/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonRegistry, NoReporter, createBrowserSystem, getVersionedFile, type AddonConfig } from "@quatico/websmith-core";
import type { CompileSystemOptions } from "./CompileSystemOptions";
import type ts from "typescript";

export type CompileSystem = {
    fileSystem: ts.System;
    getSourceFile(fileName: string): { entry?: ts.SourceFile; fileSystem: ts.System };
    addons: AddonRegistry;
};

export { type CompileSystemOptions };

export const compileSystem = (options?: CompileSystemOptions, addonConfig?: Partial<AddonConfig>): CompileSystem => {
    const { addLibDefaults = true, files, fileWatcher, reporter, useCaseSensitiveFileNames = false } = options ?? {};

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
