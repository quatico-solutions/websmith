/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
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

    public getCachedFile(fileName: string, target = ""): CacheFile {
        const cachedName = getCachedName(fileName, target);
        return this.data[cachedName] ?? <CacheFile>{ version: 0, content: "", files: [] };
    }

    public hasChanged(fileName: string, target = ""): boolean {
        const { content } = this.getCachedFile(fileName, target);
        const update = this.system.readFile(fileName) ?? "";
        return content !== update;
    }

    public updateSource(fileName: string, content: string, target = ""): boolean {
        let result = false;
        const file = this.getCachedFile(fileName);
        if (!file.snapshot || content !== file.content) {
            const newFile: CacheFile = {
                version: file.version + 1,
                files: [],
                content,
                snapshot: ts.ScriptSnapshot.fromString(content),
            };
            this.data[getCachedName(fileName, target)] = newFile;
            result = true;
        }

        return result;
    }

    public createCacheEntry(fileName: string, target = "") {
        this.data[getCachedName(fileName, target)] = { version: 0, content: "", files: [] };
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
}
