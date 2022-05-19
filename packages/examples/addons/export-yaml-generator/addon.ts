/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonContext, ErrorMessage, Generator } from "@quatico/websmith-api";
import ts from "typescript";
import { createTransformer } from "./export-transformer";

/**
 * Example addon with a generator that creates an additional YAML
 * file describing exported members per module.
 *
 * This addon creates an additional documentation file as compilation
 * result for all files. It uses a TS custom transformer to collect
 * exported members per module.
 *
 * @param ctx The compilation context for this addon.
 */
export const activate = (ctx: AddonContext): void => {
    ctx.registerGenerator(createGenerator(ctx));
};

/**
 * Creates the YAML file generator.
 */
const createGenerator =
    (ctx: AddonContext): Generator =>
    (fileName: string, fileContent: string): void => {
        const file = ts.createSourceFile(fileName, fileContent, ctx.getConfig().options.target ?? ts.ScriptTarget.Latest, true);
        const result = ts.transform(file, [createTransformer(ctx)], ctx.getConfig().options);

        if (result.diagnostics && result.diagnostics.length > 0) {
            result.diagnostics.forEach(it => ctx.getReporter().reportDiagnostic(new ErrorMessage(it.messageText, file)));
        }

        if (result.transformed.length < 1) {
            ctx.getReporter().reportDiagnostic(new ErrorMessage(`YAML generator failed for ${fileName}.`, file));
        }
    };
