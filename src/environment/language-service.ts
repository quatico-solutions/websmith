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
import { VersionedFile } from "../model";
import * as service from "./compile-service";

/**
 * The language service host “abstracts all interactions between the language service
 * and the external world. The language service host defers managing, monitoring, and
 * maintaining input files to the host” (source).
 *
 * This means that the only way the compiler can access the outside world is through
 * the language service host.
 *
 * We create a ScriptSnapshot instead of returning the contents of the file as a
 * string because they allow efficient incremental parsing. The snapshot contains
 * information about the entire contents of the file, as well as changes made from a
 * previous snapshot.
 *
 * TODO: For support of incremental parsing, we should NOT create a new snapshot every time.
 *
 * @param sourceFiles
 * @param options
 * @param compilerHost
 * @param system
 */
export const createLanguageServiceHost = (
    sourceFiles: { [name: string]: VersionedFile },
    options: ts.CompilerOptions,
    compilerHost: ts.CompilerHost,
    system: ts.System,
    transformers?: ts.CustomTransformers
): ts.LanguageServiceHost => ({
    ...compilerHost,
    fileExists: system.fileExists,
    getCompilationSettings: () => options,
    getCurrentDirectory: () => process.cwd(),
    getCustomTransformers: () => transformers,
    getDefaultLibFileName: opts => ts.getDefaultLibFilePath(opts),
    getScriptFileNames: () => Object.keys(sourceFiles),
    getScriptSnapshot: fileName => {
        const contents = system.readFile(fileName);
        if (contents) {
            return ts.ScriptSnapshot.fromString(contents);
        }

        return undefined;
    },
    getScriptVersion: fileName => (sourceFiles[fileName] ? sourceFiles[fileName].version.toString() : "0"),
    readDirectory: system.readDirectory,
    readFile: system.readFile,
    writeFile: (path: string, content: string, writeByteOrderMark?: boolean) => {
        const file = sourceFiles[path];
        if (file) {
            file.version++;
        }
        system.writeFile(path, content, writeByteOrderMark);
    },
});

/**
 * The LanguageService is the main interface into the compiler. It should created
 * only once and update the (virtual) file contents as you need. This allows the
 * compiler to perform various optimizations such as only parsing and typechecking
 * code that has changed.
 *
 * @param sourceFiles
 * @param options
 * @param system
 * @param transformers
 */
export const createLanguageService = (
    sourceFiles: { [name: string]: VersionedFile },
    options: ts.CompilerOptions,
    system: ts.System,
    transformers?: ts.CustomTransformers
) =>
    ts.createLanguageService(
        createLanguageServiceHost(
            sourceFiles,
            options,
            service.createCompileHost(options, system),
            system,
            transformers
        )
    );
