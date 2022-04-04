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
        return this.data[cachedName] ?? <CacheFile>{ version: 0, content: "", files: [], snapshot: ts.ScriptSnapshot.fromString("") };
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