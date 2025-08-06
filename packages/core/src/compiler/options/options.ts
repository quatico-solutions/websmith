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
import { tsDefaults } from "../defaults";

export const createOptions = (args: CompilerArguments, reporter = new NoReporter(), system = ts.sys): CompilerOptions => {
    const { configFile, debug = false, profile, project = "./tsconfig.json", sourceMap = false, transpileOnly, watch = false } = args;

    const cliArgs = parsedCommandLine(project, args, system);
    return resolveCompilerOptions(system, {
        cliArgs: {
            ...tsDefaults,
            ...cliArgs,
        },
        reporter,
        configFile,
        debug,
        profile,
        watch,
        tsConfig: {
            ...tsDefaults,
            ...(sourceMap && { sourceMap }),
        },
        config: {
            ...(transpileOnly && { transpileOnly }),
            ...(args.addonsDir && { addonsDir: args.addonsDir }),
            ...(args.addons && { addons: args.addons.split(",") }),
        },
    });
};
