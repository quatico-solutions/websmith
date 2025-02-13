/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter } from "@quatico/websmith-api";
import { AddonRegistry, type AddonConfig, NoReporter, createBrowserSystem, getVersionedFile } from "@quatico/websmith-core";
import type ts from "typescript";

export type CompileSystem = {
    fileSystem: ts.System;
    getSourceFile(fileName: string): { entry?: ts.SourceFile; fileSystem: ts.System };
    addons: AddonRegistry;
};

export type CompileSystemOptions = {
    useCaseSensitiveFileNames?: boolean;
    withDefaultFiles?: boolean;
    files?: Record<string, string>;
    addonConfig?: Partial<AddonConfig>;
    reporter?: Reporter;
};

export const compileSystem = (options?: CompileSystemOptions): CompileSystem => {
    const { files, addonConfig, reporter, useCaseSensitiveFileNames = false, withDefaultFiles = true } = options ?? {};

    const fileSystem = createBrowserSystem({ ...files }, useCaseSensitiveFileNames);
    if (withDefaultFiles) {
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
