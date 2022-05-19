/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonContext } from "@quatico/websmith-api";
import ts from "typescript";

/**
 * Example addon with a transformer that modifies the source code inside a
 * module.
 *
 * This addon finds all "foobar" identifiers in the source file and
 * replaces them with the string "barfoo".
 *
 * @param ctx The compilation context for this addon.
 */
export const activate = (ctx: AddonContext): void => {
    ctx.registerTransformer({
        before: [
            (context: ts.TransformationContext) => {
                return (sourceFile: ts.SourceFile): ts.SourceFile => {
                    const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                        if (ts.isIdentifier(node)) {
                            const identifier = node.getText();
                            if (identifier.match(/foobar/gi)) {
                                return context.factory.createIdentifier(identifier.replace(/foobar/gi, "barfoo"));
                            }
                        }
                        return ts.visitEachChild(node, visitor, context);
                    };
                    return ts.visitNode(sourceFile, visitor);
                };
            },
        ],
    });
};
