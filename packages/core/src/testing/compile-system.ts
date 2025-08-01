/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import { type AddonConfig, AddonRegistry, NoReporter } from "../compiler";
import { createBrowserSystem, getVersionedFile } from "../environment";
import { resolvePath } from "../environment/browser-system";
import { type CompileSystem } from "./CompileSystem";
import { type CompileSystemOptions } from "./CompileSystemOptions";
export const compileSystem = (options?: Partial<CompileSystemOptions>, addonConfig?: Partial<AddonConfig>): CompileSystem => {
    const {
        files,
        reporter = new NoReporter(),
        useCaseSensitiveFileNames = false,
        addLibDefaults = true,
        fileWatcher,
        buildDir = "./",
    } = options ?? {};

    const { addons = [], addonsDir = "./addons", profiles } = addonConfig ?? {};

    const resolvedAddonsDir = resolvePath(addonsDir.startsWith("./") ? path.join(buildDir, addonsDir) : addonsDir);

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
        if (!fileSystem.fileExists(`${buildDir}/tsconfig.json`)) {
            fileSystem.writeFile(`${buildDir}/tsconfig.json`, "{}");
        }
        if (!fileSystem.directoryExists(resolvedAddonsDir)) {
            fileSystem.createDirectory(resolvedAddonsDir);
        }
    }

    const registry = new AddonRegistry({
        addons,
        addonsDir,
        profiles,
        reporter,
        system: fileSystem,
    });

    return {
        fileSystem,
        addons: registry,
        getSourceFile: (fileName: string) => ({
            entry: getVersionedFile(resolvePath(fileName), fileSystem),
            fileSystem,
        }),
        reporter,
    };
};
