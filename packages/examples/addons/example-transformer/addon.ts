/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import { AddonContext } from "@websmith/addon-api";
import ts from "typescript";

/**
 * Find all "foobar" identifiers in the source file and replace them with the
 * string "barfoo".
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
