/* eslint-disable max-len */
import os from "node:os";
import path from "node:path";
import { pathExists } from "path-exists";
import { Logger } from "../Logger";

export const TSC_EXECUTABLE = "tsc";

export const findTsc = async (logger = new Logger("[tsc]")) => {
    // attempt to use tsc from sibling module
    const tscFromSiblingModule = path.join(__dirname, "..", "typescript", "bin", TSC_EXECUTABLE);

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

    return getTscPathIfExists(tscFromSiblingModule)
        .catch(() => getTscPathIfExists(tscFromCallerModule))
        .catch(() => getTscPathIfExists(tscFromRequire ?? ""))
        .catch(() => getTscPathIfExists(tscFromGlobalNvmScope))
        .catch(() => {
            logger.error(`✖ Couldn’t find a typescript compiler ("${TSC_EXECUTABLE}") in any expected locations. Unsuccessfully tested locations, by priority:
- ${tscFromSiblingModule} ✖ not found
- ${tscFromCallerModule} ✖ not found
- ${tscFromRequire} (from require('typescript')) ✖ not found
- ${tscFromGlobalNvmScope} ✖ not found
`);
            throw new Error(`Couldn’t find the "${TSC_EXECUTABLE}" typescript compiler in any expected locations!`);
        });
};

const getTscPathIfExists = async (candidate: string): Promise<string> => {
    const exists = await pathExists(candidate);
    if (!exists) {
        throw new Error(`Couldn’t find candidate typescript compiler "${candidate}"!`);
    }
    return candidate;
};
