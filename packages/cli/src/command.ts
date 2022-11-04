/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable no-console */
import { WarnMessage } from "@quatico/websmith-api";
import { CompilationConfig, Compiler, DefaultReporter } from "@quatico/websmith-compiler";
import { Command, program } from "commander";
import parseArgs from "minimist";
import { compileSystem } from "./compiler-system";
import { CompilerArguments } from "./CompilerArguments";
import { createOptions } from "./options";

export const addCompileCommand = (parent = program, compiler?: Compiler): Command => {
    parent
        .showSuggestionAfterError()
        // TODO: Add option to compile single files only?
        // .argument("[files]", "relative path to the files that should be compiled")
        .showHelpAfterError("Add --help for additional information.")
        .description("Compiles typescript source code and applies addons to transform source before or after emit.")
        .option("-a, --addons <addons>", "Comma-separated list of addons to apply. All found addons will be applied by default.")
        .option("-f, --addonsDir <directoryPath>", 'Directory path to the "addons" folder.', "./addons")
        .option("-c, --config <filePath>", 'File path to the "websmith.config.json".', "./websmith.config.json")
        .option("-d, --debug", "Enable the output of debug information.", false)
        .option("-p, --project <projectPath>", 'Path to the configuration file, or to a folder with a "tsconfig.json".', "./tsconfig.json")
        .option("-s, --sourceMap", "Enable the output of sourceMap information.", false)
        .option("-t, --transpileOnly", "Enable the transpile only mode", undefined)
        .option(
            "-t, --targets <targetList>",
            "Comma-separated list of compilation target names to use specific configuration and list of addons.",
            undefined
        )
        .option("-w, --watch", "Enable watch mode.", false)
        .allowUnknownOption(true)
        .hook("preAction", command => {
            if (command.opts().profile) {
                console.time("command duration");
            }
        })
        .hook("postAction", command => {
            if (command.opts().profile) {
                console.timeEnd("command duration");
            }
        })
        .action((args: CompilerArguments, command: Command) => {
            // TODO: Add files from CLI argument
            const system = compiler?.getSystem() ?? compileSystem();
            const options = createOptions(args, compiler?.getReporter() ?? new DefaultReporter(system), system);
            const unknownArgs = (command?.args ?? []).filter(arg => !command.getOptionValueSource(arg));
            if (unknownArgs?.length > 0) {
                options.additionalArguments = parseUnknownArguments(unknownArgs);
            }
            if (hasInvalidTargets(options.targets, options.config)) {
                options.reporter.reportDiagnostic(
                    new WarnMessage(
                        `Custom target configuration "${options.targets.join(",")}" found, but no target provided.\n` +
                            `\tSome custom addons may not be applied during compilation.`
                    )
                );
            }

            if (compiler === undefined) {
                compiler = new Compiler(options, system);
            } else {
                compiler.setOptions(options);
            }

            if (args.watch) {
                compiler.watch();
            } else {
                compiler.compile();
            }
        });
    return parent;
};

export const hasInvalidTargets = (targets?: string[], config?: CompilationConfig) => {
    if (targets === undefined || targets.length === 0 || (targets[0] === "*" && targets.length === 1)) {
        return false;
    }
    if (config === undefined) {
        return true;
    }
    const definedTargets = Object.keys(config?.targets ?? []);

    return !targets.every(it => definedTargets.includes(it));
};

const parseUnknownArguments = (unknownArgs: string[]): Map<string, unknown> => {
    const result = new Map<string, unknown>();
    const args = parseArgs(unknownArgs);
    for (const key in args) {
        if (key === "_") {
            if (args[key].length > 0) {
                result.set(
                    "undefined",
                    args[key].map(cur => (isPotentiallyJson(cur) ? JSON.parse(cur) : cur))
                );
            }
        } else {
            result.set(key, isPotentiallyJson(args[key]) ? JSON.parse(args[key]) : args[key]);
        }
    }
    return result;
};

const isPotentiallyJson = (arg: string): boolean =>
    typeof arg !== "string" ? false : (arg.startsWith("{") && arg.endsWith("}")) || (arg.startsWith("[") && arg.endsWith("]"));
