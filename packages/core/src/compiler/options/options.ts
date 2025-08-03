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

const TS_DEFAULTS = {
    allowJs: false,
    checkJs: false,
    declaration: false,
    declarationMap: false,
    emitDecorationOnly: false,
    esModuleInterop: false,
    noEmit: false,
    pretty: true,
    removeComments: false,
    strict: false,
    target: ts.ScriptTarget.ES5,
};

export const createOptions = (args: CompilerArguments, reporter = new NoReporter(), system = ts.sys): CompilerOptions => {
    const { configFile, debug = false, profile, project = "./tsconfig.json", sourceMap = false, transpileOnly, watch = false } = args;

    const cliArgs = parsedCommandLine(project, args, system);
    return resolveCompilerOptions(system, {
        buildDir: system.getCurrentDirectory(),
        cliArgs: {
            ...TS_DEFAULTS,
            ...cliArgs,
        },
        reporter,
        configFile,
        debug,
        profile,
        watch,
        tsConfig: {
            ...TS_DEFAULTS,
            ...(sourceMap && { sourceMap }),
        },
        config: {
            ...(transpileOnly && { transpileOnly }),
            ...(args.addonsDir && { addonsDir: args.addonsDir }),
            ...(args.addons && { addons: args.addons.split(",") }),
        },
    });
};
