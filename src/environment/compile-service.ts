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
import * as path from "path";
import ts from "typescript";
import { DefaultReporter } from "../compiler";
import { createVersionedFile } from "../environment";
import { Reporter, VersionedFile } from "../model";

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
export const createCompileHost = (options: ts.CompilerOptions, system: ts.System): ts.CompilerHost => {
    const knownFiles: { [name: string]: VersionedFile } = {};
    return {
        ...system,
        getCanonicalFileName: fileName => {
            return system.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase();
        },
        getDefaultLibFileName: (compOptions: ts.CompilerOptions) => path.join("/", getDefaultLibFileName0(compOptions)),
        getDirectories: (dirPath: string) => system.getDirectories(dirPath),
        getNewLine: () => system.newLine,
        getSourceFile: fileName => {
            let result = knownFiles[fileName];
            if (!result) {
                const content = system.readFile(fileName);
                if (content) {
                    result = createVersionedFile(fileName, content, options);
                    knownFiles[fileName] = result;
                }
            }
            return result;
        },
        useCaseSensitiveFileNames: () => system.useCaseSensitiveFileNames,
    };
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

const getDefaultLibFileName0 = (options: ts.CompilerOptions): string => {
    switch (options.target) {
        case 99 /* ESNext */:
            return "lib.esnext.full.d.ts";
        case 7 /* ES2020 */:
            return "lib.es2020.full.d.ts";
        case 6 /* ES2019 */:
            return "lib.es2019.full.d.ts";
        case 5 /* ES2018 */:
            return "lib.es2018.full.d.ts";
        case 4 /* ES2017 */:
            return "lib.es2017.full.d.ts";
        case 3 /* ES2016 */:
            return "lib.es2016.full.d.ts";
        case 2 /* ES2015 */:
            return "lib.es6.d.ts"; // We don't use lib.es2015.full.d.ts due to breaking change.
        default:
            return "lib.d.ts";
    }
};
