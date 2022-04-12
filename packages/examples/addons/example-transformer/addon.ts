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
    ctx.registerTransformer({
        before: [
            () =>
                (sf: ts.SourceFile): ts.SourceFile => {
                    return ts.visitNode(sf, node => {
                        if (ts.isIdentifier(node) && node.text === "foobar") {
                            return ts.factory.createIdentifier("barfoo");
                        }
                        return node;
                    });
                },
        ],
    });
};
