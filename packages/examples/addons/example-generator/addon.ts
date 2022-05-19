/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonContext, InfoMessage } from "@quatico/websmith-api";
import { basename, dirname, extname, join } from "path";

/**
 * Example addon with a generator that creates additional input
 * files for the compilation.
 *
 * This addon creates an additional source file for every input
 * file with substring "foo" in its file name. The additional file
 * is named "*-added.ts" and contains the original file content.
 * It is compiled with the same options as the original file.
 *
 * @param ctx The compilation context for this addon.
 */
export const activate = (ctx: AddonContext) => {
    ctx.registerGenerator((filePath: string, fileContent: string): void => {
        if (filePath.includes("foo")) {
            const dirName = dirname(filePath);
            const fileName = `${basename(filePath, extname(filePath))}-added.ts`;
            if (!filePath.endsWith("-added.ts")) {
                // Add the additional file to the compilation process.
                ctx.addVirtualFile(join(dirName, fileName), fileContent);
            }

            // Report info message to the console.
            ctx.getReporter().reportDiagnostic(new InfoMessage(`Example generator processing ${fileName}`));
        }
    });
};
