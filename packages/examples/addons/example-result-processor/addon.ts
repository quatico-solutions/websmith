import { AddonContext, InfoMessage } from "@websmith/addon-api";
import { basename, extname, join } from "path";
import ts from "typescript";

/**
 * Example addon with a result processor that creates JSON data with found
 * function names.
 *
 * This addon consumes all processed source files to find function declarations
 * and arrow functions to extract their names into a JSON file.
 *
 * @param ctx The compilation context for this addon.
 */
export const activate = (ctx: AddonContext) => {
    ctx.registerResultProcessor((filePaths: string[]): void => {
        const result: Record<string, string[]> = {};

        filePaths.forEach(curPath => {
            const content = ctx.getFileContent(curPath);
            const target = ctx.getConfig().options.target ?? ts.ScriptTarget.Latest;

            ts.transform(
                ts.createSourceFile(curPath, content, target),
                [
                    (context: ts.TransformationContext) => (curFile: ts.SourceFile) => {
                        const funcNames: string[] = [];

                        const visitor: ts.Visitor = (node: ts.Node) => {
                            if (ts.isFunctionDeclaration(node) && node.name?.text) {
                                funcNames.push(node.name.text);
                            } else if (ts.isVariableStatement(node)) {
                                const decl = node.declarationList.declarations[0];
                                if (ts.isArrowFunction(decl)) {
                                    funcNames.push(node.declarationList?.declarations[0]?.name?.getText(curFile));
                                }
                            }
                            return ts.visitEachChild(node, visitor, context);
                        };

                        curFile = ts.visitNode(curFile, visitor);
                        result[basename(curPath, extname(curPath))] = funcNames;

                        return curFile;
                    },
                ],
                ctx.getConfig().options
            );
            // Report info message to the console.
            ctx.getReporter().reportDiagnostic(new InfoMessage(`Example result processor: processed "${curPath}"`));
        });

        // Write the result to the output JSON file.
        ctx.getSystem().writeFile(join(ctx.getConfig()?.options?.outDir ?? "", "named-functions.json"), JSON.stringify(result));
    });
};
