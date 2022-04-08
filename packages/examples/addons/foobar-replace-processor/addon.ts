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
import { AddonContext, ErrorMessage, Processor } from "@websmith/addon-api";
import ts from "typescript";
import { createTransformer } from "./foobar-transformer";

export const activate = (ctx: AddonContext): void => {
    ctx.registerProcessor(createProcessor(ctx));
};

/**
 * Creates a processor that uses a TS transformer to replace every found "foobar" identifier with "barfoo".
 *
 * @param ctx The addon context for the compilation.
 * @returns A websmith processor factory function.
 */
const createProcessor =
    (ctx: AddonContext): Processor =>
    (fileName: string, content: string): string => {
        const file = ts.createSourceFile(fileName, content, ctx.getConfig().options.target ?? ts.ScriptTarget.Latest, true);
        const result = ts.transform(file, [createTransformer()], ctx.getConfig().options);
        if (result.diagnostics && result.diagnostics.length > 0) {
            result.diagnostics.forEach(it => ctx.getReporter().reportDiagnostic(new ErrorMessage(it.messageText, file)));
            return "";
        }
        if (result.transformed.length > 0) {
            return ts.createPrinter().printFile(result.transformed[0]);
        }
        ctx.getReporter().reportDiagnostic(new ErrorMessage(`Foobar-Replacer failed for ${fileName} without identifiable error.`, file));
        return "";
    };
