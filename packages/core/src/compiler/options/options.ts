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
    const { configFile, debug = false, profile, project = "./tsconfig.json", sourceMap = false, transpileOnly, watch = false } = args;

    const cliArgs = parsedCommandLine(project, args, system);
    return resolveCompilerOptions(
        system,
        {
            buildDir: system.getCurrentDirectory(),
            cliArgs,
            reporter,
            configFile,
            debug,
            profile,
            watch,
            tsConfig: {
                sourceMap,
            },
            config: {
                ...(transpileOnly && { transpileOnly }),
                addonsDir: args.addonsDir,
            },
        },
        args.addons ? args.addons.split(",") : undefined
    );
};
