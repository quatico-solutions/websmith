/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type AddonContext } from "@quatico/websmith-api";
import ts from "typescript";

/**
 * Example processor that demonstrates a common pitfall:
 * Using ts.transform() + ts.createPrinter() without checking if the AST actually changed.
 *
 * This processor will ALWAYS return different content from the original because
 * ts.createPrinter().printFile() reformats the code (whitespace, line breaks, etc.)
 * even when no semantic changes occurred.
 *
 * This causes ALL files to be marked as addon-processed, defeating the purpose of
 * addonEmitOnly mode.
 *
 * LESSON: If your processor uses AST transformation, you must:
 * 1. Track whether the AST actually changed
 * 2. Return the original content if unchanged
 * 3. Only call ts.createPrinter() when transformations occurred
 */
export const activate = (ctx: AddonContext) => {
    ctx.registerProcessor((fileName: string, content: string): string => {
        // Skip non-TypeScript files
        if (!fileName.match(/\.([cm]?ts|tsx)$/i)) {
            return content;
        }

        // Parse content into AST
        const sourceFile = ts.createSourceFile(
            fileName,
            content,
            ts.ScriptTarget.Latest,
            true
        );

        // Create a "no-op" transformer that doesn't actually modify the AST
        // But we still use ts.transform() and ts.createPrinter()
        const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
            return (sf) => {
                // Visitor that just passes through nodes unchanged
                const visit = (node: ts.Node): ts.Node => {
                    return ts.visitEachChild(node, visit, context);
                };
                return ts.visitNode(sf, visit) as ts.SourceFile;
            };
        };

        // Transform (but nothing actually changes)
        const result = ts.transform(sourceFile, [transformer]);
        const transformedFile = result.transformed[0];

        // THE PROBLEM: Even though we didn't modify the AST,
        // ts.createPrinter().printFile() will reformat the code,
        // causing content !== original content
        const printed = ts.createPrinter().printFile(transformedFile);

        // This will ALWAYS be different from 'content' due to formatting changes
        return printed;
    });
};
