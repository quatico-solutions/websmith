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
import { Command, program } from "commander";
import { CompilationConfig, Compiler, DefaultReporter, WarnMessage } from "../compiler";
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
            const unknownArgs = (command?.args ?? []).filter(arg => !command.getOptionValueSource(arg));
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
            const system = compiler?.getSystem() ?? compileSystem();
            const options = createOptions(args, compiler?.getReporter() ?? new DefaultReporter(system), system);
            if (hasInvalidTargets(options.targets, options.config)) {
                options.reporter.reportDiagnostic(
                    new WarnMessage(
                        `Custom target configuration found, but no target provided.\nSome custom addons may not be applied during compilation.`
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
