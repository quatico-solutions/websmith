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

export const resolveCompilerOptions = (system: ts.System, overrides?: Partial<CompilerOptions>): CompilerOptions => {
    const reporter = new ReporterMock(system);
    const buildDir: string = resolvePath(system, overrides?.buildDir ?? DEFAULT_BUILD_DIR);
    return {
        buildDir,
        reporter,
        debug: false,
        watch: false,
        ...overrides,
        tsConfig: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.Latest,
            configFilePath: overrides?.tsConfigFile ?? "./tsconfig.json",
            ...overrides?.tsConfig,
        },
        profiles: overrides?.profiles ?? ["*"],
        cliArgs: {
            options: { outDir: overrides?.tsConfig?.outDir ?? DEFAULT_OUT_DIR },
            fileNames: system.readDirectory(buildDir),
            errors: [],
            ...overrides?.cliArgs,
        },
    };
};
