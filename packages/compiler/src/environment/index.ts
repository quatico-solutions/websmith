/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createBrowserSystem } from "./browser-system";
import { createCompileHost, createWatchHost, injectTransformers } from "./compile-service";
import { createLanguageService, createLanguageServiceHost } from "./language-service";
import { createSystem, createVersionedFile, createVersionedFiles, getVersionedFile, isNodeJs, readFiles, recursiveFindByFilter } from "./system";
import type { VersionedFile } from "./VersionedFile";

export {
    createBrowserSystem,
    createCompileHost,
    createLanguageService,
    createLanguageServiceHost,
    createVersionedFile,
    createVersionedFiles,
    createSystem,
    createWatchHost,
    getVersionedFile,
    injectTransformers,
    isNodeJs,
    readFiles,
    recursiveFindByFilter,
};

export type { VersionedFile };
