/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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
import ts from "typescript";
import { isScriptFile, isStyleFile } from "../elements";
import { Transformer } from "../model";
import { CustomProcessors } from "./addon-registry";

export const createProcessorTransformer = (processors: CustomProcessors): Transformer => {
    const result = (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => ts.visitNode(sf, visit(sf, ctx));
    };
    const visit = (sf: ts.SourceFile, ctx: ts.TransformationContext) => {
        const visitor: ts.Visitor = node => {
            if (isScriptFile(node)) {
                processors.element?.forEach(elementProcessor => elementProcessor(ctx)(node));
            } else if (isStyleFile(node)) {
                processors.styles?.forEach(styleProcessor => styleProcessor(ctx)(node));
            }
            return node;
        };
        return visitor;
    };
    return result;
};
