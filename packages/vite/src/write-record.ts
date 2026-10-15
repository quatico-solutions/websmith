/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createHash } from "node:crypto";
import type ts from "typescript";

const BYTE_ORDER_MARK = "﻿";

const hashOf = (text: string): string => createHash("sha1").update(text).digest("hex");

// Vite reports files with forward slashes, TypeScript's system may write them with backslashes
const toKey = (filePath: string): string => filePath.replace(/\\/g, "/");

/**
 * The files the plugin instance wrote and the hash of the text it wrote last, shared by the compilers of all its
 * environments, so that each environment recognises a write of another environment's compiler as the plugin's own.
 */
export class WriteRecord {
    private readonly written = new Map<string, string>();

    /** Records that the plugin wrote `text` to `filePath`, with a byte order mark if `writeByteOrderMark` is set. */
    public record(filePath: string, text: string, writeByteOrderMark?: boolean): void {
        this.written.set(toKey(filePath), hashOf(writeByteOrderMark ? BYTE_ORDER_MARK + text : text));
    }

    /** Returns whether the plugin wrote `filePath`, and has not seen other text in it since. */
    public has(filePath: string): boolean {
        return this.written.has(toKey(filePath));
    }

    /**
     * Returns whether `text`, read from `filePath`, is what the plugin wrote there last. Forgets `filePath` otherwise,
     * so that another writer's later write of the same text is not taken for the plugin's own.
     */
    public isOwnWrite(filePath: string, text: string): boolean {
        const key = toKey(filePath);
        if (this.written.get(key) === hashOf(text)) {
            return true;
        }
        this.written.delete(key);
        return false;
    }
}

/**
 * Returns a copy of `system` with a `writeFile` that skips a write when the file on disk already has the same text,
 * e.g. a dependent profile's output of an unchanged source written again, or a generator's output after a restart.
 * Every write it does goes into `record`. A write with a byte order mark is never skipped, since `readFile` strips it.
 * `system` itself is not changed.
 */
export const createDeduplicatingSystem = (system: ts.System, record: WriteRecord): ts.System => ({
    // A copy with own members, since the compiler spreads the system into its hosts, which drops inherited members
    ...system,
    writeFile: (fileName: string, text: string, writeByteOrderMark?: boolean): void => {
        const filePath = system.resolvePath(fileName);
        if (!writeByteOrderMark && system.fileExists(filePath) && system.readFile(filePath) === text) {
            return;
        }
        system.writeFile(fileName, text, writeByteOrderMark);
        record.record(filePath, text, writeByteOrderMark);
    },
});
