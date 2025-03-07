/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilerArguments } from "@quatico/websmith-api";
import ts from "typescript";
import { parsedCommandLine } from "../config";
import { NoReporter } from "../NoReporter";
import { type CompilerOptions } from "./CompilerOptions";
import { resolveCompilerOptions } from "./resolveCompilerOptions";

export const createOptions = (args: CompilerArguments, reporter = new NoReporter(), system = ts.sys): CompilerOptions => {
    const { configFile, debug = false, project = "./tsconfig.json", sourceMap = false, profile, transpileOnly, watch = false } = args;

    const cliArgs = parsedCommandLine(project, system);
    return resolveCompilerOptions(system, {
        ...cliArgs,
        reporter,
        configFile,
        debug,
        profile,
        watch,
        tsConfig: {
            sourceMap,
        },
        config: {
            transpileOnly,
        },
    });
};
