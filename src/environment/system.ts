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
import { VersionedFile } from "../model";
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

export const createVersionedFiles = (
    files: { [name: string]: string },
    options: ts.CompilerOptions
): { [name: string]: VersionedFile } => {
    return Object.keys(files).reduce((result: { [name: string]: VersionedFile }, name: string) => {
        result[name] = createVersionedFile(name, files[name], options);
        return result;
    }, {});
};

export const getVersionedFile = (filePath: string, system: ts.System): ts.SourceFile | undefined =>
    createVersionedFiles(readFiles([filePath], system), tsDefaults)[filePath];

export const createVersionedFile = (name: string, content: string, options: ts.CompilerOptions): VersionedFile => {
    const scriptKind = name.endsWith(".ts") ? undefined : ts.ScriptKind.Deferred;
    return {
        ...ts.createSourceFile(name, content, options.target || ts.ScriptTarget.Latest, undefined, scriptKind),
        version: 0,
    };
};
