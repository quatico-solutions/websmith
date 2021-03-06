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
import * as ts from "typescript";
import { tsDefaults, tsLibDefaults } from "../compiler";
import { VersionedSourceFile } from "../model";
import { createBrowserSystem } from "./browser-system";

export const isNodeJs = (): boolean => typeof module !== "undefined" && module.exports;

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
export const createSystem = (files?: { [name: string]: string }): ts.System => {
    if (isNodeJs()) {
        return ts.sys;
    }
    const knownFiles = { ...(files || tsLibDefaults) }; // clone files
    return createBrowserSystem(knownFiles);
};

export const readFiles = (paths: string[], system: ts.System = ts.sys): { [name: string]: string } =>
    paths.reduce((result: { [name: string]: string }, path: string) => {
        result[path] = system.readFile(path) || "";
        return result;
    }, {});

export const createSourceFiles = (
    files: { [name: string]: string },
    options: ts.CompilerOptions
): { [name: string]: VersionedSourceFile } => {
    return Object.keys(files).reduce((result: { [name: string]: VersionedSourceFile }, name: string) => {
        const scriptKind = name.endsWith(".ts") ? undefined : ts.ScriptKind.Deferred;
        result[name] = {
            ...ts.createSourceFile(name, files[name], options.target || ts.ScriptTarget.Latest, undefined, scriptKind),
            version: 0,
        };
        return result;
    }, {});
};

export const getSourceFile = (filePath: string, system: ts.System): ts.SourceFile | undefined => {
    const files = createSourceFiles(readFiles([filePath], system), tsDefaults);
    return files[filePath];
};
