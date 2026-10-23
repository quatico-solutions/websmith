/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { type CacheFile, getCachedName } from "./CacheFile";

export class FileCache {
    private data: ts.MapLike<CacheFile>;
    private system: ts.System;
    constructor(system: ts.System) {
        this.system = system;
        this.data = {};
    }

    public removeCachedFile(filePath: string): this {
        delete this.data[getCachedName(filePath)];
        return this;
    }

    public getCachedFile(fileName: string): CacheFile {
        return this.getCachedFile0(fileName) ?? this.createEmptyCacheFile();
    }

    public hasChanged(fileName: string): boolean {
        const { modifiedTime, content, files } = this.getCachedFile(fileName);
        return (
            modifiedTime === undefined ||
            content === undefined ||
            files === undefined ||
            (typeof this.system.getModifiedTime === "function" && this.system.getModifiedTime(fileName)! > modifiedTime)
        );
    }

    public updateSource(fileName: string, content: string): this {
        const file = this.getCachedFile(fileName);
        if (!file.snapshot || file.content !== content || this.hasChanged(fileName)) {
            const newFile: CacheFile = {
                version: file.version + 1,
                content,
                snapshot: ts.ScriptSnapshot.fromString(content),
                modifiedTime: new Date(),
            };
            this.setCachedFile0(fileName, newFile);
        }
        return this;
    }

    /**
     * Records that the language service read `fileName` without building it. Keeps the version of an earlier entry, so a
     * version that `refreshUnbuilt` raised is not handed out again.
     */
    public createCacheEntry(fileName: string): this {
        this.setCachedFile0(fileName, {
            ...this.createEmptyCacheFile(),
            version: this.getCachedFile0(fileName)?.version ?? 0,
            modifiedTime: this.system.getModifiedTime?.(fileName),
        });
        return this;
    }

    /**
     * Raises the version of `fileName` when it was never built and was modified since it was last seen, so the language
     * service reads it again. Records the modification time of a file seen first. A built file keeps its version:
     * `updateSource` versions it.
     */
    public refreshUnbuilt(fileName: string): this {
        const file = this.getCachedFile0(fileName);
        const modifiedTime = this.system.getModifiedTime?.(fileName);
        if (file?.snapshot || !modifiedTime) {
            return this;
        }
        if (!file?.modifiedTime) {
            this.setCachedFile0(fileName, { ...(file ?? this.createEmptyCacheFile()), modifiedTime });
        } else if (modifiedTime > file.modifiedTime) {
            this.setCachedFile0(fileName, { ...file, version: file.version + 1, modifiedTime });
        }
        return this;
    }

    public updateOutput(fileName: string, outputFiles: ts.OutputFile[]): this {
        const cacheFile = this.getCachedFile0(fileName);
        if (cacheFile) {
            this.setCachedFile0(fileName, { ...cacheFile, files: outputFiles });
        }
        return this;
    }

    public getVersion(fileName: string): number {
        return this.getCachedFile(fileName)?.version ?? 0;
    }

    public getSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
        return this.getCachedFile(fileName)?.snapshot;
    }

    private getCachedFile0(fileName: string): CacheFile | undefined {
        return this.data[getCachedName(fileName)];
    }

    private setCachedFile0(fileName: string, file: CacheFile): void {
        this.data[getCachedName(fileName)] = file;
    }

    private createEmptyCacheFile(): CacheFile {
        return { version: 0, files: [] };
    }
}
