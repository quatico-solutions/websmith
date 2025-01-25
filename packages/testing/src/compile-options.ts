/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilerOptions } from "@quatico/websmith-core";
import ts from "typescript";
import { ReporterMock } from "./ReporterMock";
import { resolvePath } from "./compilation/resolve-path";

const DEFAULT_BUILD_DIR = "./src";
const DEFAULT_OUT_DIR = "./dist";

export const compileOptions = (
    system: ts.System,
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    overrides?: Partial<CompilerOptions> & { tsconfig?: Partial<ts.ParsedCommandLine>; project?: Partial<ts.CompilerOptions>; targets?: string[] }
): CompilerOptions => {
    const reporter = new ReporterMock(system);
    const buildDir: string = resolvePath(system, overrides?.buildDir ?? DEFAULT_BUILD_DIR);
    return {
        buildDir,
        reporter,
        debug: false,
        sourceMap: false,
        transpileOnly: false,
        watch: false,
        ...overrides,
        project: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.Latest,
            configFilePath: `./tsconfig.json`,
            ...overrides?.project,
        },
        targets: overrides?.targets ?? [],
        cliArgs: {
            options: { outDir: overrides?.project?.outDir ?? DEFAULT_OUT_DIR },
            fileNames: system.readDirectory(buildDir),
            errors: [],
            ...overrides?.cliArgs,
        },
    };
};
