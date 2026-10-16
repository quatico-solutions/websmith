/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import type ts from "typescript";

const BYTE_ORDER_MARK = "﻿";

const hashOf = (text: string): string => createHash("sha1").update(text).digest("hex");

/** Returns `filePath` with forward slashes, as Vite reports files, since TypeScript's system may use backslashes. */
export const toFileKey = (filePath: string): string => filePath.replace(/\\/g, "/");

/**
 * The files the plugin instance wrote and the hash of the text it wrote last, shared by the compilers of all its
 * environments, so that each environment recognises a write of another environment's compiler as the plugin's own.
 */
export class WriteRecord {
    private readonly written = new Map<string, string>();

    /** Records that the plugin wrote `text` to `filePath`, with a byte order mark if `writeByteOrderMark` is set. */
    public record(filePath: string, text: string, writeByteOrderMark?: boolean): void {
        this.written.set(toFileKey(filePath), hashOf(writeByteOrderMark ? BYTE_ORDER_MARK + text : text));
    }

    /** Returns whether the plugin wrote `filePath`, and has not seen other text in it since. */
    public has(filePath: string): boolean {
        return this.written.has(toFileKey(filePath));
    }

    /** Forgets that the plugin wrote `filePath`, e.g. after it was deleted. */
    public forget(filePath: string): void {
        this.written.delete(toFileKey(filePath));
    }

    /**
     * Returns whether `text`, read from `filePath`, is what the plugin wrote there last. Forgets `filePath` otherwise,
     * so that another writer's later write of the same text is not taken for the plugin's own.
     */
    public isOwnWrite(filePath: string, text: string): boolean {
        const key = toFileKey(filePath);
        if (this.written.get(key) === hashOf(text)) {
            return true;
        }
        this.written.delete(key);
        return false;
    }
}

/** Reads the bytes of a file, or nothing for a file that cannot be read. */
export type ReadBytes = (filePath: string) => Uint8Array | undefined;

const readFileBytes: ReadBytes = filePath => {
    try {
        return fs.readFileSync(filePath);
    } catch {
        return undefined;
    }
};

/**
 * Returns a copy of `system` with a `writeFile` that skips a write when the file on disk already has the same bytes,
 * e.g. a dependent profile's output of an unchanged source written again, or a generator's output after a restart.
 * It compares bytes, read with `readBytes`, since `system.readFile` strips a byte order mark. Every write it does goes
 * into `record`. `system` itself is not changed.
 */
export const createDeduplicatingSystem = (system: ts.System, record: WriteRecord, readBytes: ReadBytes = readFileBytes): ts.System => ({
    // A copy with own members, since the compiler spreads the system into its hosts, which drops inherited members
    ...system,
    writeFile: (fileName: string, text: string, writeByteOrderMark?: boolean): void => {
        const filePath = system.resolvePath(fileName);
        const onDisk = readBytes(filePath);
        if (onDisk && Buffer.from(writeByteOrderMark ? BYTE_ORDER_MARK + text : text, "utf-8").equals(onDisk)) {
            return;
        }
        system.writeFile(fileName, text, writeByteOrderMark);
        record.record(filePath, text, writeByteOrderMark);
    },
});
