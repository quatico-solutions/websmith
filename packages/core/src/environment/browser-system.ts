/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
// @ts-expect-error no type declarations
import createHashFn from "create-hash";
import { dirname, extname, isAbsolute, join, normalize } from "path";
import ts from "typescript";
import { tsLibDefaults } from "../compiler";

class PathWatcherRegistry {
    private readonly registry: Map<string, ts.FileWatcherCallback[]> = new Map();

    callWatchers(path: string, event: ts.FileWatcherEventKind, recursive = false): this {
        this.getWatchers(path)?.forEach(callback => callback(path, event));
        if (recursive) {
            this.getAllWatchers(dirname(path))?.forEach(callback => callback(path, event));
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
            acc = acc.concat(resolved.startsWith(cur) ? this.registry.get(cur) ?? [] : []);
            return acc;
        }, []);
    }
}

export const createBrowserSystem = (files?: Record<string, string>, useCaseSensitiveFileNames = false, addLibDefaults = false): ts.System => {
    const knownFiles = Object.entries({ ...(files ?? {}), ...(addLibDefaults ? tsLibDefaults : {}) }).reduce(
        (acc: Record<string, string>, [name, content]) => {
            acc[resolvePath(name)] = content;
            return acc;
        },
        {}
    );

    const pathWatchers = new PathWatcherRegistry();

    return {
        args: [],
        newLine: "\n",
        useCaseSensitiveFileNames: useCaseSensitiveFileNames,
        createDirectory: (dirPath: string): void => {
            let resolved = resolvePath(dirPath);
            if (!resolved.endsWith("/")) {
                resolved = resolved + "/";
            }
            knownFiles[resolved] = "";
            pathWatchers.callWatchers(dirPath, ts.FileWatcherEventKind.Created, true);
        },
        createHash: (data: string): string => createHashFn("sha256").update(data).digest("hex"),
        deleteFile: (filePath: string): void => {
            if (filePath && filePath.length > 0) {
                delete knownFiles[resolvePath(filePath)];
                pathWatchers.callWatchers(filePath, ts.FileWatcherEventKind.Deleted, true);
            }
        },
        directoryExists: (directory: string): boolean => {
            if (!directory) {
                return false;
            }
            if (directory === "/") {
                return true;
            }

            const resolved = resolvePath(directory);

            return Object.keys(knownFiles).some(cur => cur.startsWith(resolved) && cur.replace(resolved, "").includes("/"));
        },
        exit: (exitCode?: number): void => {
            if (exitCode && exitCode > 0) {
                throw new Error(`Browser FS exited with code "${exitCode}".`);
            }
        },
        fileExists: (filePath: string): boolean => [filePath, resolvePath(filePath)].some(it => Object.keys(knownFiles).includes(it)),
        getCurrentDirectory: (): string => "/",
        getDirectories: (dirPath: string): string[] => resolveDirectories(dirPath, Object.keys(knownFiles)),
        getExecutingFilePath: (): string => "/",
        readDirectory: (dirPath: string, extensions?: readonly string[]): string[] => {
            let keys: string[] = [];
            if (!isDirectoryName(dirPath)) {
                return keys;
            }

            const resolved = resolvePath(dirPath);
            if (dirPath === "/") {
                keys = resolveFiles("/", Object.keys(knownFiles));
            } else {
                keys = resolveFiles(resolved, Object.keys(knownFiles));
            }

            if (extensions) {
                return keys.filter(cur => extensions.some(extname => cur.endsWith(extname)));
            }
            return keys;
        },
        readFile: (filePath: string): string => knownFiles[resolvePath(filePath)],
        realpath: (filePath: string): string => {
            if (filePath === "") {
                return "/";
            }
            return extname(filePath) !== "" || (isAbsolute(filePath) && !filePath.startsWith(".")) ? filePath : join("/", filePath);
        },
        resolvePath: (filePath: string): string => resolvePath(filePath),
        watchFile: (path: string, callback: ts.FileWatcherCallback): ts.FileWatcher => {
            pathWatchers.addWatcher(path, callback);
            return {
                close() {
                    pathWatchers.removeWatcher(path, callback);
                },
            };
        },
        watchDirectory: (path: string, callback: ts.DirectoryWatcherCallback): ts.FileWatcher => {
            pathWatchers.addWatcher(path, callback);
            return {
                close() {
                    pathWatchers.removeWatcher(path, callback);
                },
            };
        },
        write: (str: string): void => {
            console.warn(`write() not supported. Did not write: "${str}".`);
        },
        writeFile: (filePath: string, contents: string): void => {
            if (filePath && filePath.length > 0) {
                knownFiles[resolvePath(filePath)] = contents;
                pathWatchers.callWatchers(filePath, ts.FileWatcherEventKind.Changed, true);
            }
        },
    };
};

export const resolvePath = (filePath: string): string => {
    if (!filePath || filePath === "" || filePath === "/" || filePath === ".") {
        return "/";
    }

    let result = filePath;
    if (filePath.startsWith("./")) {
        result = filePath.substring(1);
    } else if (filePath.startsWith("../")) {
        result = filePath.substring(2);
    } else if (filePath.startsWith("//")) {
        result = filePath.substring(1);
    } else if (!filePath.startsWith("/")) {
        result = join("/", filePath);
    }

    if (result.endsWith("/")) {
        result = result.slice(0, -1);
    }

    return normalize(result);
};

export const resolveDirectories = (dirPath: string, knownPaths: string[]): string[] => {
    dirPath = resolvePath(dirPath);

    if (dirPath.endsWith("/")) {
        dirPath = dirPath.slice(0, -1);
    }
    return knownPaths
        .filter(cur => cur.startsWith(dirPath))
        .map(cur => cur.replace(dirPath + "/", ""))
        .map(cur => (cur.indexOf("/") === -1 ? cur : cur.substring(0, cur.indexOf("/"))))
        .filter((cur, idx, arr) => isDirectoryName(cur) && cur !== "" && arr.indexOf(cur) === idx);
};

export const resolveFiles = (filePath: string, knownPaths: string[]): string[] =>
    knownPaths.filter(cur => !isDirectoryName(cur) && cur.startsWith(filePath) && !cur.endsWith("/"));

export const isDirectoryName = (filePath: string): boolean => {
    if (!filePath) {
        return false;
    }
    return extname(filePath) === "" || filePath.endsWith("/");
};
