/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { WarnMessage } from "@quatico/websmith-api";
import { AddonRegistry, CompilationConfig, Compiler, DefaultReporter, resolveCompilationConfig } from "@quatico/websmith-core";
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
        .option("-o, --transpileOnly", "Enable the transpile only mode", undefined)
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
            const reporter = compiler?.getReporter() ?? new DefaultReporter(system);
            const options = createOptions(args, reporter, system);
            const compilationConfig = resolveCompilationConfig(args.config ?? "./websmith.config.json", reporter, system);
            const unknownArgs = (command?.args ?? []).filter(arg => !command.getOptionValueSource(arg));
            if (unknownArgs?.length > 0) {
                options.additionalArguments = parseUnknownArguments(unknownArgs);
            }
            if (hasInvalidTargets(options.targets, options.config)) {
                reporter.reportDiagnostic(
                    new WarnMessage(
                        `Custom target configuration "${options.targets.join(",")}" found, but no target provided.\n` +
                            `\tSome custom addons may not be applied during compilation.`
                    )
                );
            }

            if (compiler === undefined) {
                let addons;
                if (command.opts().addonsDir || command.opts().addons) {
                    addons = new AddonRegistry({
                        addons: command.opts().addons ?? compilationConfig?.addons?.join(","),
                        addonsDir:
                            command.opts().addonsDir && command.opts().addonsDir !== "./addons"
                                ? command.opts().addonsDir
                                : compilationConfig?.addonsDir ?? "./addons",
                        targets: options.config?.targets,
                        reporter,
                        system,
                    });
                }
                compiler = new Compiler(options, system, addons);
            } else {
                compiler
                    .setOptions(options)
                    .getAddonRegistry()
                    ?.setConfig({
                        addons: command.opts().addons ?? compilationConfig?.addons?.join(","),
                        addonsDir:
                            command.opts().addonsDir && command.opts().addonsDir !== "./addons"
                                ? command.opts().addonsDir
                                : compilationConfig?.addonsDir ?? "./addons",
                        targets: options.config?.targets,
                    });
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
