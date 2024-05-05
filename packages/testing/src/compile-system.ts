/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Reporter } from "@quatico/websmith-api";
import { AddonRegistry, AddonRegistryOptions, NoReporter, createBrowserSystem, getVersionedFile } from "@quatico/websmith-core";
import ts from "typescript";

export type CompileSystem = {
    fileSystem: ts.System;
    getSourceFile(fileName: string): { entry?: ts.SourceFile; fileSystem: ts.System };
    addons: AddonRegistry;
};

export type CompileSystemOptions = {
    useCaseSensitiveFileNames?: boolean;
    withDefaultFiles?: boolean;
    files?: Record<string, string>;
    addonConfig?: Partial<AddonRegistryOptions>;
    reporter?: Reporter;
};

export const compileSystem = (options?: CompileSystemOptions): CompileSystem => {
    const { files, addonConfig, reporter, useCaseSensitiveFileNames = false, withDefaultFiles = true } = options ?? {};

    const fileSystem = createBrowserSystem({ ...files }, useCaseSensitiveFileNames);
    if (withDefaultFiles) {
        if (!fileSystem.fileExists("./tsconfig.json")) {
            fileSystem.writeFile("./tsconfig.json", "{}");
        }
        if (!fileSystem.fileExists("./websmith.config.json")) {
            fileSystem.writeFile("./websmith.config.json", "{}");
        }
        if (!fileSystem.directoryExists("./addons")) {
            fileSystem.createDirectory("./addons");
        }
    }

    const { addons = "", addonsDir = "./addons", targets } = addonConfig ?? JSON.parse(fileSystem.readFile("./websmith.config.json") ?? "{}");

    const registry = new AddonRegistry({
        addons,
        addonsDir,
        targets,
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
