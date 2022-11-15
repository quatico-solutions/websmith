/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
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
