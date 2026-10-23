/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
// Entry points import this module before anything that loads typescript: it must never import typescript itself.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const SUPPORTED_RANGE = ">=5.7 <7";

/**
 * Checks that the typescript resolvable from `fromDir` is within the supported range.
 *
 * @param fromDir The directory to resolve typescript from.
 * @returns The version of the resolved typescript.
 * @throws Error if no typescript is resolvable or its version is not supported.
 */
export const checkTypeScript = (fromDir: string): string => {
    let manifestPath: string;
    try {
        // createRequire resolves at runtime, webpack would resolve require.resolve at build time
        manifestPath = createRequire(path.join(fromDir, "noop.js")).resolve("typescript/package.json");
    } catch (error) {
        throw new Error(`websmith needs typescript ${SUPPORTED_RANGE}; none was found. Add typescript to your project.`, { cause: error });
    }
    const version = readVersion(manifestPath);
    if (typeof version !== "string" || !isSupported(version)) {
        throw new Error(
            `websmith needs typescript ${SUPPORTED_RANGE}; found ${String(version)}. ` +
                "For TypeScript 7, keep typescript@6 as the project's typescript and run 7.x through its own binary (see README)."
        );
    }
    return version;
};

const readVersion = (manifestPath: string): unknown => {
    try {
        return (JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as { version?: unknown }).version;
    } catch (_ignored) {
        return undefined;
    }
};

const isSupported = (version: string): boolean => {
    const match = /^(\d+)\.(\d+)\./.exec(version);
    if (!match) {
        return false;
    }
    const [major, minor] = [Number(match[1]), Number(match[2])];
    return (major === 5 && minor >= 7) || major === 6;
};
