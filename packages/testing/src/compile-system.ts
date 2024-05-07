/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createBrowserSystem, getVersionedFile } from "@quatico/websmith-core";
import ts from "typescript";

export type CompileSystem = {
    fileSystem: ts.System;
    getSourceFile(fileName: string): { entry?: ts.SourceFile; fileSystem: ts.System };
};

export type CompileSystemOptions = {
    useCaseSensitiveFileNames?: boolean;
    withDefaultFiles?: boolean;
};

export const compileSystem = (files?: Record<string, string>, options?: CompileSystemOptions): CompileSystem => {
    const { useCaseSensitiveFileNames = false, withDefaultFiles = true } = options ?? {};
    const fileSystem = createBrowserSystem({ ...files }, useCaseSensitiveFileNames);
    if (withDefaultFiles) {
        if (!fileSystem.fileExists("./tsconfig.json")) {
            fileSystem.writeFile("./tsconfig.json", "{}");
        }
        if (!fileSystem.fileExists("./websmith.config.json")) {
            fileSystem.writeFile("./websmith.config.json", "{}");
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
