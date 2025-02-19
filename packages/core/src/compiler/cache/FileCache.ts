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
        if (!file.snapshot || this.hasChanged(fileName)) {
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

    public createCacheEntry(fileName: string): this {
        this.setCachedFile0(fileName, this.createEmptyCacheFile());
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
