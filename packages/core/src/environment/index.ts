/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
export { createBrowserSystem } from "./browser-system";
export { createCompileHost, createWatchHost, injectTransformers } from "./compile-service";
export type { CompileSystemOptions } from "./CompileSystemOptions";
export { createLanguageService, createLanguageServiceHost } from "./language-service";
export { createSystem, createVersionedFile, createVersionedFiles, getVersionedFile, isNodeJs, readFiles, recursiveFindByFilter } from "./system";
export type { VersionedFile } from "./VersionedFile";
