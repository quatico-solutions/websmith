/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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
// tslint:disable: object-literal-sort-keys
import * as path from "path";
import * as ts from "typescript";
import { tsLibDefaults } from "../compiler";

export const createBrowserSystem = (files?: { [name: string]: string }): ts.System => {
    const knownFiles = { ...(files ?? tsLibDefaults) };
    return {
        args: [],
        newLine: "\n",
        useCaseSensitiveFileNames: true,
        createDirectory: (): void => {
            throw new Error("createDirectory() not implemented");
        },
        directoryExists: (directory: string): boolean => {
            if (!directory) {
                return false;
            }
            if (directory === "/") {
                return true;
            }
            if (directory.endsWith("/")) {
                directory = directory.slice(0, -1);
            }
            return Object.keys(knownFiles).some(
                cur => cur.startsWith(directory) && cur.replace(directory, "").includes("/")
            );
        },
        exit: (): boolean => {
            throw new Error("exit() not implemented");
        },
        fileExists: (filePath: string): boolean => knownFiles[filePath] != null,
        getCurrentDirectory: (): string => "/",

        getDirectories: (dirPath: string): string[] => resolveDirectories(dirPath, Object.keys(knownFiles)),
        getExecutingFilePath: (): string => "/",
        readDirectory: (dirPath: string, extensions?: readonly string[]): string[] => {
            let keys: string[] = [];
            if (dirPath === "/") {
                keys = Object.keys(knownFiles);
            } else {
                keys = resolveFiles(dirPath, Object.keys(knownFiles));
            }

            if (extensions) {
                return keys.filter(cur => extensions.some(extname => cur.endsWith(extname)));
            }
            return keys;
        },
        readFile: (filePath: string): string => knownFiles[filePath],
        resolvePath: (filePath: string): string => absolutePath(filePath),
        write: (): void => {
            throw new Error("write() not implemented");
        },
        writeFile: (filePath: string, contents: string): void => {
            if (filePath && filePath.length > 0) {
                knownFiles[filePath] = contents;
            }
        },
    };
};

const absolutePath = (filePath: string): string => {
    let result = filePath;
    if (["//", "./"].includes(filePath.substring(0, 2))) {
        result = filePath.substring(1);
    } else if (["../"].includes(filePath.substring(0, 3))) {
        result = filePath.substring(2);
    } else if (!filePath || filePath === "") {
        return "/";
    }
    return path.normalize(result);
};

const resolveDirectories = (dirPath: string, knownPaths: string[]): string[] => {
    return knownPaths
        .filter(cur => cur.startsWith(dirPath) && isDirectoryName(cur.replace(dirPath, "")))
        .map(cur => cur.substring(0, cur.lastIndexOf("/")));
};

const resolveFiles = (filePath: string, knownPaths: string[]): string[] => {
    return knownPaths.filter(cur => isDirectoryName(cur) && cur.startsWith(filePath));
};

const isDirectoryName = (filePath: string): boolean => filePath.substring(1).includes("/");
