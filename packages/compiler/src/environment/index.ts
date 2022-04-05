/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
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