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
import { createLanguageService, createSystem, createVersionedFiles } from "../environment";

export const typecheck = (code: string): ts.Diagnostic[] => {
    const dummyFilename = "file.ts";
    const files = {
        [dummyFilename]: code,
    };

    const system = createSystem({
        ...tsLibDefaults,
        ...files,
    });
    const compilerOptions = tsDefaults;
    const sourceFiles = createVersionedFiles(files, compilerOptions);
    const languageService = createLanguageService(sourceFiles, compilerOptions, system);
    const diagnostics = languageService.getSemanticDiagnostics(dummyFilename);

    return diagnostics;
};
