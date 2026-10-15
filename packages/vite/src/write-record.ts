/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createHash } from "node:crypto";
import type ts from "typescript";

const hashOf = (text: string, writeByteOrderMark?: boolean): string =>
    createHash("sha1")
        .update(`${writeByteOrderMark ? 1 : 0}${text}`)
        .digest("hex");

/**
 * Returns a copy of `system` with a `writeFile` that skips a write when the last write of this system to the same path had the
 * same text and the file still exists, e.g. a dependent profile's output of an unchanged source written again by a
 * later build of the same plugin instance. Output paths differ per profile, so writes are deduplicated per profile and
 * file version. `system` itself is not changed.
 */
export const createDeduplicatingSystem = (system: ts.System): ts.System => {
    const written = new Map<string, string>();
    // A copy with own members, since the compiler spreads the system into its hosts, which drops inherited members
    return {
        ...system,
        writeFile: (fileName: string, text: string, writeByteOrderMark?: boolean): void => {
            const filePath = system.resolvePath(fileName);
            const hash = hashOf(text, writeByteOrderMark);
            if (written.get(filePath) === hash && system.fileExists(filePath)) {
                return;
            }
            system.writeFile(fileName, text, writeByteOrderMark);
            written.set(filePath, hash);
        },
    };
};
