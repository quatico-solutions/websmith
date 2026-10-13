/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { stripVTControlCharacters } from "node:util";

// tsc 6 colors its output with FORCE_COLOR even without a TTY, the reason becomes an error message
export const parseReasonFromConsole = (stdout: string, stderr: string) => {
    const console = stripVTControlCharacters(stderr || stdout);
    const firstLine = console.split("\n")[0];
    return firstLine?.toLowerCase().includes("error") ? firstLine : null;
};
