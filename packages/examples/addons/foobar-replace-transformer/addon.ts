/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonContext } from "@quatico/websmith-api";
import ts from "typescript";

export const activate = (ctx: AddonContext): void => {
    ctx.registerTransformer({ before: [createTransformer()] });
};

/**
 * Create a transformer that replaces every "foobar" identifier with "barfoo".
 *
 * @returns A TS transformer factory.
 */
export const createTransformer = (): ts.TransformerFactory<ts.SourceFile> => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile): ts.SourceFile => {
            const visitor = (node: ts.Node): ts.Node => {
                // Visit child nodes of source files
                if (ts.isSourceFile(node)) {
                    return ts.visitEachChild(node, visitor, ctx);
                }
                // Replace foobar with barfoo identifiers
                if (ts.isIdentifier(node)) {
                    const identifier = node.getText();
                    if (identifier.match(/foobar/gi)) {
                        return ctx.factory.createIdentifier(identifier.replace(/foobar/gi, "barfoo"));
                    }
                }
                return ts.visitEachChild(node, visitor, ctx);
            };
            return ts.visitNode(sf, visitor, ts.isSourceFile);
        };
    };
};
