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
import { AddonContext, ResultProcessor } from "@websmith/addon-api";
import ts from "typescript";
import { createTransformerFactory, getOutputFilePath } from "./result-processor";

export const activate = (ctx: AddonContext) => {
    ctx.registerResultProcessor(createResultProcessor(ctx));
};

/**
 * Creates a generator that collects all functions and arrow functions with a // @service() comment.
 *
 * @param fileNames The file names of the current target to process.
 * @param ctx The addon context for the compilation.
 * @returns A websmith ResultProcessor factory function.
 */
const createResultProcessor =
    (ctx: AddonContext): ResultProcessor =>
    (fileNames: string[]): void => {
        const outDir = ctx.getConfig().options.outDir ?? process.cwd();
        ctx.getSystem().writeFile(getOutputFilePath(outDir), "");
        fileNames
            .filter(fn => fn.match(/\.tsx?/gi))
            .map(fn => {
                const sf = ts.createSourceFile(fn, ctx.getFileContent(fn), ctx.getConfig().options.target ?? ts.ScriptTarget.Latest);
                ts.transform(sf, [createTransformerFactory(ctx.getSystem(), outDir)], ctx.getConfig().options);
            });
    };
