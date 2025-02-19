import path from "node:path";
import type ts from "typescript";
import { resolvePath } from "./browser-system";

export class PathWatcherRegistry {
    private readonly registry: Map<string, ts.FileWatcherCallback[]> = new Map();

    callWatchers(filePath: string, event: ts.FileWatcherEventKind, recursive = false): this {
        this.getWatchers(filePath)?.forEach(callback => callback(filePath, event));
        if (recursive) {
            this.getAllWatchers(path.dirname(filePath))?.forEach(callback => callback(filePath, event));
        }
        return this;
    }

    addWatcher(path: string, callback: ts.FileWatcherCallback): this {
        if (!this.isWatched(path)) {
            this.registry.set(resolvePath(path), []);
        }
        this.getWatchers(path)?.push(callback);
        return this;
    }

    removeWatcher(path: string, callback: ts.FileWatcherCallback): this {
        if (this.isWatched(path)) {
            this.registry.set(
                resolvePath(path),
                this.getWatchers(path).filter(cur => cur !== callback)
            );
        }

        return this;
    }

    isWatched(path: string): boolean {
        return this.registry.has(resolvePath(path));
    }

    getWatchers(path: string): ts.FileWatcherCallback[] {
        return this.registry.get(resolvePath(path)) ?? [];
    }

    getAllWatchers(path: string): ts.FileWatcherCallback[] {
        const resolved = resolvePath(path);
        return Array.from(this.registry.keys()).reduce((acc: ts.FileWatcherCallback[], cur: string) => {
            acc = acc.concat(resolved.startsWith(cur) ? (this.registry.get(cur) ?? []) : []);
            return acc;
        }, []);
    }
}
