/* eslint-disable no-console */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilerArguments, type Reporter, WarnMessage } from "@quatico/websmith-api";
import {
    type AddonConfig,
    AddonRegistry,
    type CompilationConfig,
    Compiler,
    type CompilerOptions,
    createOptions,
    DefaultReporter,
} from "@quatico/websmith-core";
import { type Command, program } from "commander";
import parseArgs from "minimist";
import ts from "typescript";
import { getVersion } from "./get-version";

export const addCompileCommand = (parent = program, compiler?: Compiler): Command => {
    parent
        .name("websmith")
        .version(getVersion(), "-v, --version", "Print the compiler's version.")
        .showSuggestionAfterError()
        // TODO: Add option to compile single files only?
        // .argument("[files]", "relative path to the files that should be compiled")
        .showHelpAfterError("Add --help for additional information.")
        .description("Compiles typescript source code and applies addons to transform source before or after emit.")
        .option("-a, --addons <addons>", "Comma-separated list of addons to apply. No addons are applied by default.")
        .option("-f, --addonsDir <directoryPath>", 'Directory path to the "addons" folder.')
        .option("-c, --configFile <filePath>", 'File path to the "websmith.config.json".')
        .option("--debug", "Enable the output of debug information.")
        .option("-p, --project <projectPath>", "Compile the project given the path to its configuration file, or to a folder with a 'tsconfig.json'.")
        .option("-o, --transpileOnly", "Enable the transpile only mode.")
        .option("-l, --profile <profileName>", "Name of the profile to use with a specific compiler configuration and list of addons.")
        .option("-w, --watch", "Enable watch mode.")
        .option("--init", "Initializes a TypeScript project and creates a tsconfig.json file.")
        .option("--showConfig", "Print the final configuration instead of building.")
        .option("-b, --build", "Build one or more projects and their dependencies, if out of date.")
        .option("--pretty", "Enable color and formatting in TypeScript's output to make compiler errors easier to read.")
        .option("-d, --declaration", "Generate .d.ts files from TypeScript and JavaScript files in your project.")
        .option("--declarationMap", "Create sourcemaps for d.ts files.")
        .option("--emitDeclarationOnly", "Only output d.ts files and not JavaScript files.")
        .option("--sourceMap", "Create source map files for emitted JavaScript files.")
        .option("--noEmit", "Disable emitting files from a compilation.")
        .option(
            "-t, --target <target>",
            "Set the JavaScript language version for emitted JavaScript and include compatible library declarations.\n" +
                "one of:  es5, es5, es6/es2015, es2016, es2017, es2018, es2019, es2020, es2021, es2022, es2023, es2024, esnext"
        )
        .option("-m, --module <module>", "Specify what module code is generated.\n" + "one of:  commonjs, amd, umd, system, esnext, none")
        .option(
            "--lib <lib...>",
            "Specify a set of bundled library declaration files that describe the target runtime environment.\n" +
                "one or more:  es5, es6/es2015, es7/es2016, es2017, es2018, es2019, es2020, es2021, es2022, es2023, es2024, esnext, dom, dom.iterable, dom.asynciterable, webworker, webworker.importscripts, webworker.iterable, webworker.asynciterable, scripthost, es2015.core, es2015.collection, es2015.generator, es2015.iterable, es2015.promise, es2015.proxy, es2015.reflect, es2015.symbol, es2015.symbol.wellknown, es2016.array.include, es2016.intl, es2017.arraybuffer, es2017.date, es2017.object, es2017.sharedmemory, es2017.string, es2017.intl, es2017.typedarrays, es2018.asyncgenerator, es2018.asynciterable/esnext.asynciterable, es2018.intl, es2018.promise, es2018.regexp, es2019.array, es2019.object, es2019.string, es2019.symbol/esnext.symbol, es2019.intl, es2020.bigint/esnext.bigint, es2020.date, es2020.promise, es2020.sharedmemory, es2020.string, es2020.symbol.wellknown, es2020.intl, es2020.number, es2021.promise, es2021.string, es2021.weakref/esnext.weakref, es2021.intl, es2022.array, es2022.error, es2022.intl, es2022.object, es2022.string, es2022.regexp, es2023.array, es2023.collection, es2023.intl, es2024.arraybuffer, es2024.collection, es2024.object/esnext.object, es2024.promise/esnext.promise, es2024.regexp/esnext.regexp, es2024.sharedmemory, es2024.string/esnext.string, esnext.array, esnext.collection, esnext.intl, esnext.disposable, esnext.decorators, esnext.iterator, decorators, decorators.legacy"
        )
        .option("--allowJs", "Allow JavaScript files to be a part of your program. Use the 'checkJS' option to get errors from these files.")
        .option("--checkJs", "Enable error reporting in type-checked JavaScript files.")
        .option("--jsx <jsx>", "Specify what JSX code is generated.\n" + "one of:  preserve, react, react-jsx, react-jsxdev, react-jsx, react-jsxdev")
        .option(
            "--outFile <outFile>",
            "Specify a file that bundles all outputs into one JavaScript file. If 'declaration' is true, also designates a file that bundles all .d.ts output."
        )
        .option("--outDir <outputDir>", "Specify an output folder for all emitted files.")
        .option("--removeComments", "Disable emitting comments.")
        .option("--strict", "Enable all strict type-checking options.")
        .option("--types <types...>", "Specify type package names to be included without being referenced in a source file.")
        .option(
            "--esModuleInterop",
            "Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility."
        )
        .allowExcessArguments()
        .allowUnknownOption(true) // Allow unknown options to be passed to the compiler
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
            const system = compiler?.getSystem() ?? ts.sys;
            const reporter = compiler?.getReporter() ?? new DefaultReporter(system);
            const tsConfigFile = args.project ?? "./tsconfig.json";

            // Extract file arguments from command line
            const unknownArgs = (command?.args ?? []).filter(arg => !command.getOptionValueSource(arg));
            const fileArguments = unknownArgs.filter(
                arg => !arg.startsWith("-") && (arg.endsWith(".ts") || arg.endsWith(".tsx") || arg.endsWith(".js") || arg.endsWith(".jsx"))
            );
            const otherUnknownArgs = unknownArgs.filter(arg => !fileArguments.includes(arg));

            const options: CompilerOptions = {
                tsConfigFile,
                ...createOptions(
                    {
                        ...args,
                        project: tsConfigFile,
                        // Pass file arguments through args so they get picked up by parsedCommandLine
                        ...(fileArguments.length > 0 && { fileNames: fileArguments }),
                    },
                    reporter,
                    system
                ),
            };
            if (otherUnknownArgs?.length > 0) {
                // Check for common typos and warn about them
                const commonTypos = [
                    { wrong: "--tsConfigFile", correct: "--project" },
                    { wrong: "--tsconfig", correct: "--project" },
                    { wrong: "--config", correct: "--configFile" },
                ];

                for (const typo of commonTypos) {
                    if (otherUnknownArgs.includes(typo.wrong)) {
                        reporter.reportDiagnostic(
                            new WarnMessage(`Unknown option "${typo.wrong}". Did you mean "${typo.correct}"? Use --help to see available options.`)
                        );
                    }
                }
                options.additionalArguments = parseUnknownArguments(otherUnknownArgs);
            }
            if (options.profile && hasInvalidProfile(options.profile, options.config)) {
                reporter.reportDiagnostic(
                    new WarnMessage(
                        `Custom profile configuration "${options.profile}" found, but no profile provided.\n` +
                            `\tSome custom addons may not be applied during compilation.`
                    )
                );
            }

            if (compiler) {
                compiler.setOptions(options);
            } else {
                compiler = new Compiler({ ...options, reporter }, {}, system);
            }

            const { addons, addonsDir, profiles } = options?.config ?? {};
            if (addons?.length || addonsDir || Object.keys(profiles ?? {}).length || options.profile) {
                const addonsReg = compiler.getAddonRegistry();
                if (addonsReg) {
                    addonsReg.setConfig(addonConfig(command, compiler.getSystem(), options, reporter));
                } else {
                    compiler.setAddonRegistry(new AddonRegistry(addonConfig(command, compiler.getSystem(), options, reporter)));
                }
            }

            if (args.watch) {
                compiler.watch();
            } else {
                compiler.compile();
            }
        });
    return parent;
};

export const addonConfig = (command: Command, system: ts.System, options: CompilerOptions, reporter: Reporter): AddonConfig => {
    const { config } = options ?? {};
    const addons = command.opts().addons ?? config?.addons?.join(",") ?? "";
    const addonsDir = command.opts().addonsDir ?? config?.addonsDir;
    const resolvedAddonsDir = addonsDir ? system.resolvePath(addonsDir) : undefined;

    // Check if addons directory exists and warn if it doesn't
    if (resolvedAddonsDir && !system.directoryExists(resolvedAddonsDir)) {
        reporter.reportDiagnostic(new WarnMessage(`Addons directory "${resolvedAddonsDir}" does not exist.`));
    }

    return {
        addons:
            addons
                ?.split(",")
                .map((it: string) => it.trim())
                .filter((it: string) => it.length > 0) ?? [],

        ...(resolvedAddonsDir && { addonsDir: resolvedAddonsDir }),
        system,
        reporter,

        ...(!!options?.config?.profiles && { profiles: options?.config?.profiles }),
    };
};

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
