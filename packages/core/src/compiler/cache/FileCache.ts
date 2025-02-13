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

    public removeCachedFile(filePath: string, profile = "") {
        delete this.data[getCachedName(filePath, profile)];
    }

    public getCachedFile(fileName: string, profile = ""): CacheFile {
        const cachedName = getCachedName(fileName, profile);
        return this.data[cachedName] ?? this.createEmptyCacheFile();
    }

    public hasChanged(fileName: string, profile = ""): boolean {
        const { modifiedTime, content, files } = this.getCachedFile(fileName, profile);
        return (
            modifiedTime === undefined ||
            content === undefined ||
            files === undefined ||
            !this.system.getModifiedTime ||
            this.system.getModifiedTime(fileName)! > modifiedTime
        );
    }

    public updateSource(fileName: string, content: string, profile = ""): boolean {
        let result = false;
        const file = this.getCachedFile(fileName);
        if (!file.snapshot || this.hasChanged(fileName, profile)) {
            const newFile: CacheFile = {
                version: file.version + 1,
                content,
                snapshot: ts.ScriptSnapshot.fromString(content),
                modifiedTime: new Date(),
            };
            this.data[getCachedName(fileName, profile)] = newFile;
            result = true;
        }

        return result;
    }

    public createCacheEntry(fileName: string, profile = "") {
        this.data[getCachedName(fileName, profile)] = this.createEmptyCacheFile();
    }

    public updateOutput(fileName: string, outputFiles: ts.OutputFile[], profile = "") {
        const cachedName = getCachedName(fileName, profile);
        const cacheFile = this.data[cachedName];
        if (cacheFile) {
            this.data[cachedName] = { ...cacheFile, files: outputFiles };
        }
    }

    public getVersion(fileName: string, profile = ""): number {
        return this.getCachedFile(fileName, profile)?.version ?? 0;
    }

    public getSnapshot(fileName: string, profile = ""): ts.IScriptSnapshot | undefined {
        return this.getCachedFile(fileName, profile)?.snapshot;
    }

    private createEmptyCacheFile(): CacheFile {
        return { version: 0, files: [] };
    }
}
