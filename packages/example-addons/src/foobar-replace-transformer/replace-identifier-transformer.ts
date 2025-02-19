/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

/**
 * Create a transformer that replaces every 'match' identifier with 'replace' string.
 *
 * @param match The regex to match the identifier.
 * @param replace The string to replace the identifier.
 * @returns A TS transformer factory.
 */
export const createReplaceIdentifierTransformer = (match = /foobar/gi, replace = "barfoo"): ts.TransformerFactory<ts.SourceFile> => {
    return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sourceFile: ts.SourceFile): ts.SourceFile => {
            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                // Visit child nodes of source files
                if (ts.isSourceFile(node)) {
                    return ts.visitEachChild(node, visitor, context);
                }
                // Replace 'match' with 'replace' identifiers
                if (ts.isIdentifier(node)) {
                    const identifier = node.text ?? node.getText();
                    if (identifier.match(match)) {
                        return context.factory.createIdentifier(identifier.replace(match, replace));
                    }
                }
                return ts.visitEachChild(node, visitor, context);
            };
            return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
        };
    };
};
