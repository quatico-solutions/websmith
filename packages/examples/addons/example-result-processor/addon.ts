import { AddonContext, InfoMessage } from "@websmith/addon-api";
import { basename } from "path";

/**
 * Example addon with a result processor that modifies the result from
 * compilation.
 *
 * This addon adds an extra comment line to every compiled file.
 *
 * @param ctx The compilation context for this addon.
 */
export const activate = (ctx: AddonContext) => {
    const comment = (filePath: string) => `// ${basename(filePath)} was compiled by the websmith compiler\n`;

    ctx.registerResultProcessor((filePaths: string[]): void => {
        filePaths.forEach(curPath => {
            // processed input file content
            const modifiedContent = ctx.getFileContent(curPath);
            // Inject a comment as the first line into the file.
            ctx.getSystem().writeFile(curPath, comment(curPath) + modifiedContent);
            // Report info message to the console.
            ctx.getReporter().reportDiagnostic(new InfoMessage(`Example result processor ${curPath}`));
        });
    });
};
