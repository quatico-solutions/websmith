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
        return (sf: ts.SourceFile) => {
            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
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
                    if (identifier.match(/barfoo/gi)) {
                        return ctx.factory.createIdentifier(identifier.replace(/barfoo/gi, "foobar"));
                    }
                }
                return ts.visitEachChild(node, visitor, ctx);
            };
            return ts.visitNode(sf, visitor);
        };
    };
};
