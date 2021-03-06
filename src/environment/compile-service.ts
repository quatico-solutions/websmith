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
import merge from "lodash/merge";
import * as ts from "typescript";
import { DefaultReporter } from "../compiler";
import { Reporter, VersionedSourceFile } from "../model";

/**
 * The TypeScript compiler interacts with the host environment via a compiler host.
 *
 * The compiler host uses <code>ts.SourceFiles</code> for representing files on
 * the filesystem. These include the content of the file as well as additional
 * metadata, such as the language version. We can easily create source files from
 * an object from filename -> contents.
 *
 * @param sourceFiles
 * @param system
 */
export const createCompileHost = (
    sourceFiles: { [name: string]: VersionedSourceFile },
    system: ts.System
): ts.CompilerHost => ({
    ...system,
    getCanonicalFileName: fileName => fileName,
    getDefaultLibFileName: () => "/lib.es2015.d.ts",
    getDirectories: (path: string) => system.getDirectories(path),
    getNewLine: () => system.newLine,
    getSourceFile: fileName => sourceFiles[fileName],
    useCaseSensitiveFileNames: () => system.useCaseSensitiveFileNames,
});

export const createWatchHost = (
    configFilePath: string,
    system: ts.System,
    reporter?: Reporter
): ts.WatchCompilerHostOfConfigFile<ts.SemanticDiagnosticsBuilderProgram> => {
    reporter = reporter ?? new DefaultReporter(system);
    const result = ts.createWatchCompilerHost(
        configFilePath,
        undefined /* no extra compiler options */,
        system,
        createProgram,
        reporter.reportDiagnostic,
        reporter.reportWatchStatus,
        undefined /* no extra watch options */,
        [
            /* extra file extensions to watch */
            {
                extension: ".scss",
                isMixedContent: true,
                scriptKind: ts.ScriptKind.Deferred,
            },
        ]
    );
    return result;
};

export const injectTransformers = (
    host: ts.WatchCompilerHostOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>,
    transformers?: ts.CustomTransformers
): void => {
    const originalAfterProgramCreate = host.afterProgramCreate;
    host.afterProgramCreate = builderProgram => {
        const originalEmit = builderProgram.emit;
        builderProgram.emit = (
            targetSourceFile?: ts.SourceFile,
            writeFile?: ts.WriteFileCallback,
            cancellationToken?: ts.CancellationToken,
            emitOnlyDtsFiles?: boolean,
            customTransformers?: ts.CustomTransformers
        ): ts.EmitResult => {
            const newTransformers = merge(customTransformers ?? {}, transformers ?? {});
            return originalEmit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, newTransformers);
        };
        if (originalAfterProgramCreate) {
            originalAfterProgramCreate(builderProgram);
        }
    };
};

/**
 * TypeScript can use several different program creation "strategies":
 *  * ts.createEmitAndSemanticDiagnosticsBuilderProgram,
 *  * ts.createSemanticDiagnosticsBuilderProgram
 *  * ts.createAbstractBuilder
 * The first two produce "builder programs". These use an incremental strategy
 * to only re-check and emit files whose contents may have changed, or whose
 * dependencies may have changes which may impact change the result of prior
 * type-check and emit.
 * The last uses an ordinary program which does a full type check after every
 * change.
 * Between `createEmitAndSemanticDiagnosticsBuilderProgram` and
 * `createSemanticDiagnosticsBuilderProgram`, the only difference is emit.
 * For pure type-checking scenarios, or when another tool/process handles emit,
 * using `createSemanticDiagnosticsBuilderProgram` may be more desirable.
 */
const createProgram = ts.createSemanticDiagnosticsBuilderProgram;
