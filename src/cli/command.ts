/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
/* eslint-disable no-console */
import { Command } from "commander";
import { Compiler } from "../compiler";
import { compileSystem } from "./compiler-system";
import { CompilerArguments } from "./CompilerArguments";
import { createOptions } from "./options";

export const addCompileCommand = (parent = new Command(), compiler?: Compiler): Command => {
    parent
        .command("compile")
        .showSuggestionAfterError()
        .argument("[target]", "Optional name of the compilation target to filter applied addons")
        // TODO: Add option to compile single files only?
        // .argument("[files]", "relative path to the files that should be compiled")
        .showHelpAfterError("Add --help for additional information.")
        .description("Compiles typescript source code and applies addons to transform source before or after emit.")
        .option("-a, --addons <addonsDir>", 'directory path to the "addons" folder', "./addons")
        .option("-c, --config <configPath>", 'Optional file path to the "websmith.config.json"', "./webshmith.config.json")
        .option("-d, --debug", "enable the output of debug information", false)
        .option("-p, --project <projectPath>", 'Path to the configuration file, or to a folder with a "tsconfig.json".', "./tsconfig.json")
        .option("-s, --sourceMap", "enable the output of sourceMap information", false)
        .option("-w, --watch", "enable watch mode", false)
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
        .action((target: string, args: CompilerArguments, command: Command) => {
            if (typeof target !== "string") {
                console.error(`No target provided.` + `\nSome custom addons may not be applied during compilation.`);
            }

            const unknownArgs = command.args.filter(it => it !== target).filter(arg => !command.getOptionValueSource(arg));
            if (unknownArgs?.length > 0) {
                unknownArgs.forEach(arg =>
                    console.error(
                        `Unknown Argument "${arg}".` + `\nIf this is a tsc command, please configure it in your typescript configuration file.\n`
                    )
                );
                command.help({ error: true });
            }

            // TODO: Add support for style processors via addon
            // process.stdout.write(`\nCompiling with configuration:\n`);
            // process.stdout.write(`  + Config File: "${configPath}"\n`);
            // let sassOptions: any = {};
            // try {
            //     const sassConfigPath = findSassConfig();
            //     sassOptions = require(sassConfigPath);
            //     process.stdout.write(`  + Sass Config: "${sassConfigPath}"\n`);
            // } catch (error) {
            //     process.stdout.write(`  + Sass Config: Cannot find module 'sass.config.js'. Using default config.\n`);
            // }
            // process.stdout.write(`\n\n`);

            // TODO: Add files from CLI argument
            const system = compileSystem();
            const options = createOptions(args, system);
            if (compiler === undefined) {
                compiler = new Compiler(options, system);
            } else {
                compiler.setOptions(options);
            }

            if (args.watch) {
                compiler.watch();
            } else {
                const exitCode = compiler.compile().emitSkipped ? 1 : 0;
                process.stdout.write(`Process exiting with code '${exitCode}'.\n`);
                process.exit(exitCode);
            }
        });
    return parent;
};
