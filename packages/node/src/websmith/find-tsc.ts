/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable max-len */
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathExists } from "path-exists";
import { Logger } from "../Logger";

export const TSC_EXECUTABLE = "tsc";

export const findTsc = async (logger = new Logger(), fromDir = __dirname) => {
    // attempt to use tsc of the typescript this module imports (resolved from its own location)
    let tscFromImportedModule: string | null = null;
    try {
        tscFromImportedModule = path.join(
            path.dirname(createRequire(path.join(fromDir, "noop.js")).resolve("typescript/package.json")),
            "bin",
            TSC_EXECUTABLE
        );
    } catch (_ignored) {
        /* not found */
    }

    // attempt to use tsc from caller module (should work even if module is symlinked)
    const tscFromCallerModule = path.join(process.cwd(), "node_modules", "typescript", "bin", TSC_EXECUTABLE);

    // attempt to load tsc with require('typescript')
    let tscFromRequire: string | null = null;
    try {
        tscFromRequire = path.join(path.dirname(require.resolve("typescript")), "..", "bin", TSC_EXECUTABLE);
    } catch (_ignored) {
        /* not found */
    }

    // attempt to load tsc from global typescript module (using nvm on OSX)
    const tscFromGlobalNvmScope = path.join(os.homedir(), ".nvm", "versions", "node", process.version, "bin", TSC_EXECUTABLE);

    return getTscPathIfExists(tscFromImportedModule ?? "")
        .catch(() => getTscPathIfExists(tscFromCallerModule))
        .catch(() => getTscPathIfExists(tscFromRequire ?? ""))
        .catch(() => getTscPathIfExists(tscFromGlobalNvmScope))
        .catch(() => {
            logger.error(`✖ Couldn’t find a typescript compiler ("${TSC_EXECUTABLE}") in any expected locations. Unsuccessfully tested locations, by priority:
- ${tscFromImportedModule ? `${tscFromImportedModule} (resolved from ${fromDir})` : `typescript not resolvable from ${fromDir}`} ✖ not found
- ${tscFromCallerModule} ✖ not found
- ${tscFromRequire} (from require('typescript')) ✖ not found
- ${tscFromGlobalNvmScope} ✖ not found
`);
            throw new Error(`Couldn’t find the "${TSC_EXECUTABLE}" typescript compiler in any expected locations!`);
        });
};

// Reads the version of the binary itself: it may differ from the imported typescript (ts.version)
export const readTscVersion = async (tscPath: string): Promise<string | undefined> => {
    try {
        // the nvm-global tsc is a symlink, only its target has the package.json two levels up
        const realPath = await fs.promises.realpath(tscPath);
        const packageJson = JSON.parse(await fs.promises.readFile(path.join(path.dirname(realPath), "..", "package.json"), "utf-8")) as {
            name?: unknown;
            version?: unknown;
        };
        return packageJson.name === "typescript" && typeof packageJson.version === "string" ? packageJson.version : undefined;
    } catch (_ignored) {
        return undefined;
    }
};

const getTscPathIfExists = async (candidate: string): Promise<string> => {
    const exists = await pathExists(candidate);
    if (!exists) {
        throw new Error(`Couldn’t find candidate typescript compiler "${candidate}"!`);
    }
    return candidate;
};
