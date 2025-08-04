#!/usr/bin/env node
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Command } from "commander";
import { addCompileCommand } from "./command";

let exitCode = 0;
const originalExit = process.exit;

try {
    // Mock process.exit to capture exit codes without actually exiting
    process.exit = (code = 0) => {
        exitCode = code as number;
        throw new Error(`Process exit called with code ${code}`);
    };

    addCompileCommand(new Command()).parse(process.argv);
} catch (err) {
    // Only throw for actual compilation failures
    if (!err.message?.includes("Process exit called")) {
        throw err;
    }

    // For non-zero exit codes, throw the error
    if (exitCode !== 0) {
        throw err;
    }
} finally {
    // Always restore the original process.exit
    process.exit = originalExit;
}
