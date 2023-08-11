/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Reporter } from "@quatico/websmith-api";
import merge from "lodash/merge";
import * as ts from "typescript";
import { DefaultReporter } from "../compiler";

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
export const createCompileHost = (options: ts.CompilerOptions): ts.CompilerHost => {
    return ts.createCompilerHost(options, true);
};

export const createWatchHost = (
    rootFiles: string[],
    compilerOptions: ts.CompilerOptions,
    system: ts.System,
    reporter?: Reporter
): ts.WatchCompilerHostOfFilesAndCompilerOptions<ts.SemanticDiagnosticsBuilderProgram> => {
    reporter = reporter ?? new DefaultReporter(system);
    return ts.createWatchCompilerHost(
        rootFiles,
        compilerOptions,
        system,
        createProgram,
        reporter.reportDiagnostic,
        reporter.reportWatchStatus,
        undefined /* no project references */,
        undefined /* no extra watch options */
    );
};

export const injectTransformers = (
    host: ts.WatchCompilerHostOfFilesAndCompilerOptions<ts.SemanticDiagnosticsBuilderProgram>,
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
