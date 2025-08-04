/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type AddonContext, ErrorMessage, type Processor } from "@quatico/websmith-api";
import ts from "typescript";

/**
 * Create a transformer that replaces every 'match' identifier with 'replace' string.
 *
 * @param match The regex to match the identifier.
 * @param replace The string to replace the identifier.
 * @returns A TS transformer factory.
 */
const createReplaceIdentifierTransformer = (match = /foobar/gi, replace = "barfoo"): ts.TransformerFactory<ts.SourceFile> => {
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

/**
 * Creates a processor that uses a TS transformer to replace every found "foobar" identifier with "CLIENT".
 *
 * @param ctx The addon context for the compilation.
 * @returns A websmith processor factory function.
 */
const createProcessor =
    (ctx: AddonContext): Processor =>
    (fileName: string, content: string): string => {
        const file = ts.createSourceFile(fileName, content, ctx.getCliArgs().options.target ?? ts.ScriptTarget.Latest, true);
        const result = ts.transform(file, [createReplaceIdentifierTransformer(/foobar/gi, "CLIENT")], ctx.getCliArgs().options);
        if (result.diagnostics && result.diagnostics.length > 0) {
            result.diagnostics.forEach(it => ctx.getReporter().reportDiagnostic(new ErrorMessage(it.messageText, file)));
            return "";
        }
        if (result.transformed.length > 0) {
            return ts.createPrinter().printFile(result.transformed[0]);
        }
        ctx.getReporter().reportDiagnostic(new ErrorMessage(`Client-Processor failed for ${fileName} without identifiable error.`, file));
        return "";
    };

export const activate = (ctx: AddonContext): void => {
    ctx.registerProcessor(createProcessor(ctx));
};
