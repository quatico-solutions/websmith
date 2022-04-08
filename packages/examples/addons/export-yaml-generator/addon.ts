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
import { AddonContext, ErrorMessage, Generator } from "@websmith/addon-api";
import ts from "typescript";
import { createTransformer, resetOutput } from "./export-transformer";

/**
 * Registers the generator for the given addon context.
 *
 * @param ctx AddonContext for the compilation.
 */
export const activate = (ctx: AddonContext): void => {
    resetOutput(ctx);
    ctx.registerGenerator(createGenerator(ctx));
};

/**
 * Generator for the export-yaml-generator addon.
 *
 * @param ctx
 * @returns A websmith generator factory function.
 */
const createGenerator =
(ctx: AddonContext): Generator =>
(fileName: string, fileContent: string): void => {
    const file = ts.createSourceFile(fileName, fileContent, ctx.getConfig().options.target ?? ts.ScriptTarget.Latest, true);
    const result = ts.transform(file, [createTransformer(ctx.getSystem())], ctx.getConfig().options);
    
    if (result.diagnostics && result.diagnostics.length > 0) {
        result.diagnostics.forEach(it => ctx.getReporter().reportDiagnostic(new ErrorMessage(it.messageText, file)));
    }
    
    if (result.transformed.length < 1) {
        ctx.getReporter().reportDiagnostic(new ErrorMessage(`exportCollector failed for ${fileName} without identifiable error.`, file));
    }
};
