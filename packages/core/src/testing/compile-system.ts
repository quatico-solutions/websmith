/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import { AddonRegistry, NoReporter } from "../compiler";
import { createBrowserSystem, getVersionedFile } from "../environment";
import { type CompileSystem } from "./CompileSystem";
import { type CompileSystemOptions } from "./CompileSystemOptions";
export const compileSystem = (options?: CompileSystemOptions): CompileSystem => {
    const { files, addonConfig, reporter, useCaseSensitiveFileNames = false, addLibDefaults = true, fileWatcher, buildDir = "./" } = options ?? {};

    const resolvedAddonsDir = path.join(buildDir, "addons");
    const projectDir = path.dirname(buildDir);

    const fileSystem = createBrowserSystem({ ...files }, { useCaseSensitiveFileNames, addLibDefaults, fileWatcher });
    if (addLibDefaults) {
        if (!fileSystem.fileExists(path.join(projectDir, "tsconfig.json"))) {
            fileSystem.writeFile(path.join(projectDir, "tsconfig.json"), "{}");
        }
        if (!fileSystem.directoryExists(resolvedAddonsDir)) {
            fileSystem.createDirectory(resolvedAddonsDir);
        }
    }

    const { addons = [], addonsDir = path.join(buildDir, "addons"), profiles } = addonConfig ?? {};

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
