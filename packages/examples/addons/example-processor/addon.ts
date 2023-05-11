/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonContext } from "@quatico/websmith-api";
import ts from "typescript";

/**
 * Example addon with a processor that modifies all exports of ES modules.
 *
 * This addons finds all non exported "foobar" functions and adds an export
 * modifier to the function declaration.
 *
 * @param ctx The compilation context for this addon.
 */
export const activate = (ctx: AddonContext) => {
    ctx.registerProcessor((filePath: string, fileContent: string): string => {
        const sf = ts.createSourceFile(filePath, fileContent, ctx.getConfig().options?.target ?? ts.ScriptTarget.Latest);
        const result = ts.transform(
            sf,
            [
                (context: ts.TransformationContext) => {
                    return (curFile: ts.SourceFile) => {
                        const visitor = (node: ts.Node): ts.Node => {
                            // Replace non exported foobar function with exported function.
                            if (ts.isFunctionDeclaration(node) && node.name?.text === "foobar") {
                                return ts.factory.updateFunctionDeclaration(
                                    node,
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
                        return ts.visitNode(curFile, visitor, ts.isSourceFile);
                    };
                },
            ],
            ctx.getConfig().options
        );
        return ts.createPrinter().printFile(result.transformed[0]);
    });
};
