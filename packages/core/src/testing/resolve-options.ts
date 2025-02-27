/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import ts from "typescript";
import { DefaultReporter, type CompilerOptions } from "../compiler";

const DEFAULT_BUILD_DIR = "./src";
const DEFAULT_OUT_DIR = "./dist";

// TODO: Resolve compiler options
export const resolveCompilerOptions = (system: ts.System, overrides?: Partial<CompilerOptions>): CompilerOptions => {
    const buildDir: string = resolvePath(system, overrides?.buildDir ?? DEFAULT_BUILD_DIR);

    return {
        reporter: new DefaultReporter(system),
        debug: false,
        watch: false,
        ...overrides,
        buildDir,
        tsConfig: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.Latest,
            configFilePath: overrides?.tsConfigFile ?? "./tsconfig.json",
            ...overrides?.tsConfig,
        },
        cliArgs: {
            options: { outDir: overrides?.tsConfig?.outDir ?? DEFAULT_OUT_DIR },
            fileNames: system.readDirectory(buildDir),
            errors: [],
            ...overrides?.cliArgs,
        },
    };
};

export const resolvePath = (fs: ts.System, ...pathSegments: string[]) => {
    let resolvedPath = path.join(...pathSegments);
    if (!path.isAbsolute(resolvedPath)) {
        resolvedPath = path.join(fs.getCurrentDirectory(), ...pathSegments);
    }
    return resolvedPath;
};
