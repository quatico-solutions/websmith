// ./addons/input-generator/addon.ts
import { AddonContext } from "@websmith/addon-api";
import ts from "typescript";

export const activate = (ctx: AddonContext) => {
    ctx.registerProcessor((filePath: string, fileContent: string): string => {
        if (filePath.endsWith("foo.ts")) {
            const sf = ts.createSourceFile(filePath, fileContent, ctx.getConfig().options?.target ?? ts.ScriptTarget.Latest);
            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                // Replace foobar with barfoo identifiers
                if (!ts.isSourceFile(node) && ts.isIdentifier(node)) {
                    const identifier = node.getText();
                    if (identifier.match(/foobar/gi)) {
                        return ts.factory.createIdentifier(identifier.replace(/foobar/gi, "barfoo"));
                    }
                }
                return ts.visitEachChild(node, visitor, ctx);
            };
            return ts.visitNode(sf, visitor).getText();
        }
        return fileContent;
    });
};
