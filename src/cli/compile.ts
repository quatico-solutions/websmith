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
import * as ts from "typescript";
import yargs from "yargs";
import { Compiler } from "../compiler";
import { createSystem } from "../environment";
import { findConfigFile, findSassConfig } from "./find-config";

export const compile = (params: string[]): void | never => {
    const args: any = yargs(params.slice(2)).argv;

    const configPath = args.configPath ?? findConfigFile();
    const doWatch = args.watch;

    process.stdout.write(`\nCompiling with configuration:\n`);
    process.stdout.write(`  + Config File: "${configPath}"\n`);

    let sassOptions: any = {};
    try {
        const sassConfigPath = findSassConfig();
        sassOptions = require(sassConfigPath);
        process.stdout.write(`  + Sass Config: "${sassConfigPath}"\n`);
    } catch (error) {
        process.stdout.write(`  + Sass Config: Cannot find module 'sass.config.js'. Using default config.\n`);
    }
    process.stdout.write(`\n\n`);
    // FIXME: Enable addons
    // const compiler = new Compiler({ configPath }).enableAddons("element-docgen");
    const raw = createSystem();
    const system: ts.System = {
        ...raw,
        watchFile: (
            path: string,
            callback: ts.FileWatcherCallback,
            pollingInterval?: number,
            options?: ts.WatchOptions
        ): ts.FileWatcher => {
            process.stdout.write(`Watching: "${path.substring(path.lastIndexOf("/") + 1)}"\n`);
            // tslint:disable-next-line: no-empty
            return raw.watchFile ? raw.watchFile(path, callback, pollingInterval, options) : { close: () => {} };
        },
    };
    const compiler = new Compiler({ configPath, sassOptions, system });
    if (doWatch) {
        compiler.watch();
    } else {
        const exitCode = compiler.compile().emitSkipped ? 1 : 0;
        process.stdout.write(`Process exiting with code '${exitCode}'.\n`);
        process.exit(exitCode);
    }
};

compile(process.argv);
