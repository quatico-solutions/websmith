/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { CacheFile, getCachedName } from "./CacheFile";

export class FileCache {
    private data: ts.MapLike<CacheFile>;
    private system: ts.System;

    constructor(system: ts.System) {
        this.system = system;
        this.data = {};
    }

    public removeCachedFile(filePath: string, target = "") {
        delete this.data[getCachedName(filePath, target)];
    }

    public getCachedFile(fileName: string, target = ""): CacheFile {
        const cachedName = getCachedName(fileName, target);
        return this.data[cachedName] ?? this.createEmptyCacheFile();
    }

    public hasChanged(fileName: string, target = ""): boolean {
        const { modifiedTime, content, files } = this.getCachedFile(fileName, target);
        return (
            modifiedTime === undefined ||
            content === undefined ||
            files === undefined ||
            !this.system.getModifiedTime ||
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.system.getModifiedTime(fileName)! > modifiedTime
        );
    }

    public updateSource(fileName: string, content: string, target = ""): boolean {
        let result = false;
        const file = this.getCachedFile(fileName);
        if (!file.snapshot || this.hasChanged(fileName, target)) {
            const newFile: CacheFile = {
                version: file.version + 1,
                content,
                snapshot: ts.ScriptSnapshot.fromString(content),
                modifiedTime: new Date(),
            };
            this.data[getCachedName(fileName, target)] = newFile;
            result = true;
        }

        return result;
    }

    public createCacheEntry(fileName: string, target = "") {
        this.data[getCachedName(fileName, target)] = this.createEmptyCacheFile();
    }

    public updateOutput(fileName: string, outputFiles: ts.OutputFile[], target = "") {
        const cachedName = getCachedName(fileName, target);
        const cacheFile = this.data[cachedName];
        if (cacheFile) {
            this.data[cachedName] = { ...cacheFile, files: outputFiles };
        }
    }

    public getVersion(fileName: string, target = ""): number {
        return this.getCachedFile(fileName, target)?.version ?? 0;
    }

    public getSnapshot(fileName: string, target = ""): ts.IScriptSnapshot | undefined {
        return this.getCachedFile(fileName, target)?.snapshot;
    }

    private createEmptyCacheFile(): CacheFile {
        return { version: 0, files: [] };
    }
}
