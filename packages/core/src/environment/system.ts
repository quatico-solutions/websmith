/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { tsDefaults, tsLibDefaults } from "../compiler";
import { createBrowserSystem } from "./browser-system";
import { type BrowserSystemOptions } from "./BrowserSystemOptions";
import type { VersionedFile } from "./VersionedFile";

export const isNodeJs = (): boolean => {
    // Always return true for CLI operations to ensure real file system access
    if (typeof process !== "undefined" && process.argv && process.argv.length > 0) {
        return true;
    }
    return typeof module !== "undefined" && module.exports;
};

/**
 * A ts.System contains methods for reading files, writing files, checking
 * if a file exists, etc. If you run TypeScript in Node, then the system is
 * a wrapper around fs.
 *
 * The filesystem does not exist in the browser, so we have to create our
 * own virtual system. The full file is here. We pass in an object from
 * filename → file contents that contains all of our files on our
 * virtual filesystem.
 *
 * @param files The returned file system should at least contain.
 */
export const createSystem = (files?: { [name: string]: string }, options?: BrowserSystemOptions): ts.System => {
    if (!options?.virtual) {
        // Always use ts.sys for CLI operations to ensure real file system access
        // Completely bypass virtual file system when running from CLI
        if (typeof process !== "undefined" && process.argv && process.argv.length > 0) {
            return ts.sys;
        }
        if (isNodeJs()) {
            return ts.sys;
        }
    }
    const knownFiles = { ...(files || tsLibDefaults) }; // clone files
    return createBrowserSystem(knownFiles, options);
};

export const readFiles = (paths: string[], system: ts.System = ts.sys): { [name: string]: string } =>
    paths.reduce((result: { [name: string]: string }, path: string) => {
        result[path] = system.readFile(path) || "";
        return result;
    }, {});

export const recursiveFindByFilter = (
    filePath: string,
    filter: (name: string) => boolean = ignoreConfigFiles,
    system: ts.System = ts.sys
): string[] => system.readDirectory(filePath).filter(filter);

export const createVersionedFiles = (files: { [name: string]: string }, tsConfig: ts.CompilerOptions): { [name: string]: VersionedFile } => {
    return Object.keys(files).reduce((result: { [name: string]: VersionedFile }, name: string) => {
        result[name] = createVersionedFile(name, files[name], tsConfig);
        return result;
    }, {});
};

export const getVersionedFile = (filePath: string, system: ts.System): ts.SourceFile | undefined =>
    createVersionedFiles(readFiles([filePath], system), tsDefaults)[filePath];

export const createVersionedFile = (name: string, content: string, tsConfig: ts.CompilerOptions): VersionedFile => {
    const scriptKind = name.endsWith(".ts") ? undefined : ts.ScriptKind.Deferred;
    return {
        ...ts.createSourceFile(name, content, tsConfig.target || ts.ScriptTarget.Latest, true, scriptKind),
        version: 0,
    };
};

export const ignoreConfigFiles = (name: string): boolean => ["tsconfig", "websmith.config"].find(it => name.includes(it)) === undefined;
