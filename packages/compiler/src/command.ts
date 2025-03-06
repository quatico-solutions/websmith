/* eslint-disable no-console */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilerArguments, WarnMessage } from "@quatico/websmith-api";
import {
    AddonRegistry,
    type CompilationConfig,
    Compiler,
    type CompilerOptions,
    DefaultReporter,
    resolveCompilationConfig,
} from "@quatico/websmith-core";
import { type Command, program } from "commander";
import parseArgs from "minimist";
import { createSystem } from "./compiler-system";
import { createOptions } from "@quatico/websmith-core";

export const addCompileCommand = (parent = program, compiler?: Compiler): Command => {
    parent
        .showSuggestionAfterError()
        // TODO: Add option to compile single files only?
        // .argument("[files]", "relative path to the files that should be compiled")
        .showHelpAfterError("Add --help for additional information.")
        .description("Compiles typescript source code and applies addons to transform source before or after emit.")
        .option("-a, --addons <addons>", "Comma-separated list of addons to apply. All found addons will be applied by default.")
        .option("-f, --addonsDir <directoryPath>", 'Directory path to the "addons" folder.', "./addons")
        .option("-c, --configFile <filePath>", 'File path to the "websmith.config.json".', "./websmith.config.json")
        .option("-d, --debug", "Enable the output of debug information.", false)
        .option("-p, --project <projectPath>", 'Path to the configuration file, or to a folder with a "tsconfig.json".', "./tsconfig.json")
        .option("-s, --sourceMap", "Enable the output of sourceMap information.", false)
        .option("-o, --transpileOnly", "Enable the transpile only mode", undefined)
        .option("-l, --profile <profileName>", "Name of the profile to use with a specific compiler configuration and list of addons.", undefined)
        .option("-w, --watch", "Enable watch mode.", false)
        .allowExcessArguments() // Allow unknown options to be passed to the compiler
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
            const system = compiler?.getSystem() ?? createSystem();
            const reporter = compiler?.getReporter() ?? new DefaultReporter(system);
            const options = createOptions(args, reporter, system);
            options.configFile = args.configFile ?? "./websmith.config.json";
            const compilationConfig = resolveCompilationConfig(options.configFile, reporter, system);
            const unknownArgs = (command?.args ?? []).filter(arg => !command.getOptionValueSource(arg));
            if (unknownArgs?.length > 0) {
                options.additionalArguments = parseUnknownArguments(unknownArgs);
            }
            if (options.profile && hasInvalidProfile(options.profile, options.config)) {
                reporter.reportDiagnostic(
                    new WarnMessage(
                        `Custom profile configuration "${options.profile}" found, but no profile provided.\n` +
                            `\tSome custom addons may not be applied during compilation.`
                    )
                );
            }

            if (compiler === undefined) {
                let addons;
                if (command.opts().addonsDir || command.opts().addons) {
                    addons = new AddonRegistry({
                        // TODO: Resolve compiler options
                        ...addonConfig(command, compilationConfig, options),
                        reporter,
                        system,
                    });
                }
                compiler = new Compiler(options, system, addons);
            } else {
                compiler
                    .setOptions(options)
                    .getAddonRegistry()
                    ?.setConfig(addonConfig(command, compilationConfig, options));
            }

            if (args.watch) {
                compiler.watch();
            } else {
                compiler.compile();
            }
        });
    return parent;
};

// TODO: Resolve compiler options
const addonConfig = (command: Command, compilationConfig?: CompilationConfig, options?: CompilerOptions) => ({
    addons:
        (command.opts().addons ?? compilationConfig?.addons?.join(",") ?? "")
            ?.split(",")
            .map((it: string) => it.trim())
            .filter((it: string) => it.length > 0) ?? [],

    addonsDir:
        command.opts().addonsDir && command.opts().addonsDir !== "./addons" ? command.opts().addonsDir : (compilationConfig?.addonsDir ?? "./addons"),

    ...(!!options?.config?.profiles && { profiles: options?.config?.profiles }),
});

export const hasInvalidProfile = (profile?: string, config?: CompilationConfig) => {
    if (profile === undefined) {
        return false;
    }
    if (config === undefined) {
        return true;
    }
    const definedProfiles = Object.keys(config?.profiles ?? []);
    const selectedProfiles = [...(config?.profiles?.[profile]?.depends ?? []), profile];

    return !selectedProfiles.every(it => definedProfiles.includes(it));
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
