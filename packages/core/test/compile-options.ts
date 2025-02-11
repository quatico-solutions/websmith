/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { type CompilerOptions } from "../src/compiler";
import { ReporterMock } from "./ReporterMock";

export const compileOptions = (system: ts.System, overrides?: Partial<CompilerOptions>): CompilerOptions => {
    const reporter = new ReporterMock(system);
    return {
        buildDir: "./src",
        reporter,
        debug: false,
        watch: false,
        ...overrides,
        tsConfig: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.Latest,
            configFilePath: "./tsconfig.json",
            ...overrides?.tsConfig,
        },
        targets: overrides?.targets ?? ["*"],
        cliArgs: {
            options: {},
            fileNames: system.readDirectory("./src"),
            errors: [],
            ...overrides?.cliArgs,
        },
    };
};
