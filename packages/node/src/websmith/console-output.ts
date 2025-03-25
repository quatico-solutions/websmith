/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
export const parseReasonFromConsole = (stdout: string, stderr: string) => {
    const console = stderr || stdout;
    const firstLine = console.split("\n")[0];
    return firstLine?.toLowerCase().includes("error") ? firstLine : null;
};
