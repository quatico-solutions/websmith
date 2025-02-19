/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type ts from "typescript";
import { createBrowserSystem, getVersionedFile } from "../src/environment";

export type CompileSystem = {
    fileSystem: ts.System;
    getSourceFile(fileName: string): { entry?: ts.SourceFile; fileSystem: ts.System };
};

export type CompileSystemOptions = {
    useCaseSensitiveFileNames?: boolean;
    withDefaultFiles?: boolean;
    fileWatcher?: (fileName: string, eventKind: ts.FileWatcherEventKind, modifiedTime?: Date) => void;
};

export const compileSystem = (files?: Record<string, string>, options?: CompileSystemOptions): CompileSystem => {
    const { useCaseSensitiveFileNames = false, withDefaultFiles = true, fileWatcher } = options ?? {};
    const fileSystem = createBrowserSystem({ ...files }, { useCaseSensitiveFileNames, addLibDefaults: withDefaultFiles, fileWatcher });
    if (withDefaultFiles) {
        if (!fileSystem.fileExists("./tsconfig.json")) {
            fileSystem.writeFile("./tsconfig.json", "{}");
        }
        if (!fileSystem.directoryExists("./addons")) {
            fileSystem.createDirectory("./addons");
        }
    }
    return {
        fileSystem,
        getSourceFile: (fileName: string) => ({
            entry: getVersionedFile(fileName, fileSystem),
            fileSystem,
        }),
    };
};
