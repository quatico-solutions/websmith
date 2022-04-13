// ./addons/input-generator/addon.ts
import { AddonContext } from "@websmith/addon-api";
import ts from "typescript";

/**
 * Find all non exported "foobar" functions and add export statement.
 * @param ctx
 */
export const activate = (ctx: AddonContext) => {
    ctx.registerProcessor((filePath: string, fileContent: string): string => {
        const sf = ts.createSourceFile(filePath, fileContent, ctx.getConfig().options?.target ?? ts.ScriptTarget.Latest);
        const result = ts.transform(
            sf,
            [
                (context: ts.TransformationContext) => {
                    return (curFile: ts.SourceFile) => {
                        const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                            // Replace non exported foobar function with exported function.
                            if (ts.isFunctionDeclaration(node) && node.name && node.name.getText() === "foobar") {
                                return ts.factory.updateFunctionDeclaration(
                                    node,
                                    node.decorators,
                                    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword), ...(node.modifiers ?? [])],
                                    node.asteriskToken,
                                    node.name,
                                    node.typeParameters,
                                    node.parameters,
                                    node.type,
                                    node.body
                                );
                            }
                            return ts.visitEachChild(node, visitor, context);
                        };
                        return ts.visitNode(curFile, visitor);
                    };
                },
            ],
            ctx.getConfig().options
        );
        return ts.createPrinter().printFile(result.transformed[0]);
    });
};
