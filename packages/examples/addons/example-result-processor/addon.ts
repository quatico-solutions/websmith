// ./addons/input-file-generator/addon.ts
import { AddonContext, InfoMessage } from "@websmith/addon-api";
import { basename } from "path";

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
    const comment = (filePath: string) => `// ${basename(filePath)} was compiled by the websmith compiler\n`;

    ctx.registerResultProcessor((filePaths: string[]): void => {
        filePaths.forEach(curPath => {
            const content = ctx.getSystem().readFile(curPath);
            // Inject a comment as the first line into the file.
            ctx.getSystem().writeFile(curPath, comment(curPath) + content);
            // Report info message to the console.
            ctx.getReporter().reportDiagnostic(new InfoMessage(`Example result processor ${curPath}`));
        });
    });
};
