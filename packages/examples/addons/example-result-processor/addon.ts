// ./addons/input-file-generator/addon.ts
import { AddonContext, InfoMessage } from "@websmith/addon-api";
import { basename } from "path";

/**
 * TODO: Add description.
 *
 * @param ctx The compilation context for this addon.
 */
export const activate = (ctx: AddonContext) => {
    const comment = (filePath: string) => `// ${basename(filePath)} was compiled by the websmith compiler\n`;

    ctx.registerResultProcessor((filePaths: string[]): void => {
        filePaths.forEach(curPath => {
            // unmodified source file content from input
            const content = ctx.getSystem().readFile(curPath);

            // processed input file content
            const modified = ctx.getFileContent(curPath);

            // Inject a comment as the first line into the file.
            ctx.getSystem().writeFile(curPath, comment(curPath) + content);
            // Report info message to the console.
            ctx.getReporter().reportDiagnostic(new InfoMessage(`Example result processor ${curPath}`));
        });
    });
};
