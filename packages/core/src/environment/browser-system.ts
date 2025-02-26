/* eslint-disable no-console */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
// @ts-expect-error no type declarations
import createHashFn from "create-hash";
import path from "node:path";
import ts from "typescript";
import { tsLibDefaults } from "../compiler";
import { type BrowserSystemOptions } from "./BrowserSystemOptions";
import { PathWatcherRegistry } from "./PathWatcherRegistry";

export const createBrowserSystem = (files?: Record<string, string>, options: BrowserSystemOptions = {}): ts.System => {
    const { useCaseSensitiveFileNames = false, addLibDefaults = false, fileWatcher } = options;
    const initialTime = Date.now();
    const knownFiles = Object.entries({ ...(files ?? {}), ...(addLibDefaults ? tsLibDefaults : {}) }).reduce(
        (acc: Record<string, string>, [name, content]) => {
            acc[resolvePath(name)] = content;
            return acc;
        },
        {}
    );

    const modifiedTimes = Object.entries(knownFiles).reduce((acc: Record<string, number>, [name, _content]) => {
        acc[resolvePath(name)] = initialTime;
        return acc;
    }, {});

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
            modifiedTimes[resolved] = Date.now();
            pathWatchers.callWatchers(dirPath, ts.FileWatcherEventKind.Created, true);
        },
        createHash: (data: string): string => createHashFn("sha256").update(data).digest("hex"),
        deleteFile: (filePath: string): void => {
            if (filePath && filePath.length > 0) {
                const absolutePath = resolvePath(filePath);
                delete knownFiles[absolutePath];
                delete modifiedTimes[absolutePath];
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
            return path.extname(filePath) !== "" || (path.isAbsolute(filePath) && !filePath.startsWith(".")) ? filePath : path.join("/", filePath);
        },
        resolvePath: (filePath: string): string => resolvePath(filePath),
        watchFile: (path: string, callback: ts.FileWatcherCallback): ts.FileWatcher => {
            pathWatchers.addWatcher(path, callback ?? fileWatcher);
            return {
                close() {
                    pathWatchers.removeWatcher(path, callback);
                },
            };
        },
        watchDirectory: (path: string, callback: ts.DirectoryWatcherCallback): ts.FileWatcher => {
            pathWatchers.addWatcher(path, callback ?? fileWatcher);
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
                const absolutePath = resolvePath(filePath);
                knownFiles[absolutePath] = contents;
                modifiedTimes[absolutePath] = Date.now();
                pathWatchers.callWatchers(filePath, ts.FileWatcherEventKind.Changed, true);
            }
        },
        getModifiedTime: (filePath: string): Date | undefined => {
            const value = modifiedTimes[resolvePath(filePath)];
            return value ? new Date(value) : undefined;
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
        result = path.join("/", filePath);
    }

    if (result.endsWith("/")) {
        result = result.slice(0, -1);
    }

    return path.normalize(result);
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
    return path.extname(filePath) === "" || filePath.endsWith("/");
};
