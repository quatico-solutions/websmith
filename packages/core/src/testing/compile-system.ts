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
import { resolvePath } from "../environment/browser-system";
export const compileSystem = (options?: CompileSystemOptions): CompileSystem => {
    const { files, addonConfig, reporter, useCaseSensitiveFileNames = false, addLibDefaults = true, fileWatcher, buildDir = "./src" } = options ?? {};

    const resolvedAddonsDir = resolvePath(path.join(buildDir, "addons"));
    const projectDir = resolvePath(path.dirname(buildDir));

    let resolvedFiles = files;
    if (resolvedFiles) {
        resolvedFiles = Object.entries(resolvedFiles).reduce(
            (acc, [key, value]) => {
                const resolvedPath = resolvePath(key);
                acc[resolvedPath] = value;
                return acc;
            },
            {} as Record<string, string>
        );
    }

    const fileSystem = createBrowserSystem({ ...resolvedFiles }, { useCaseSensitiveFileNames, addLibDefaults, fileWatcher });
    if (addLibDefaults) {
        if (!fileSystem.fileExists(path.join(projectDir, "tsconfig.json"))) {
            fileSystem.writeFile(path.join(projectDir, "tsconfig.json"), "{}");
        }
        if (!fileSystem.directoryExists(resolvedAddonsDir)) {
            fileSystem.createDirectory(resolvedAddonsDir);
        }
    }

    const { addons = [], addonsDir = resolvedAddonsDir, profiles } = addonConfig ?? {};

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
            entry: getVersionedFile(resolvePath(fileName), fileSystem),
            fileSystem,
        }),
    };
};
