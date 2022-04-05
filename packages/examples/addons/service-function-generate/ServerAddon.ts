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
import ts from "typescript";
import { AddonContext, TargetConfig } from "@websmith/addon-api";
import { isTsAddonApplicable } from "../magellan-shared/addon-helpers";
import { MagellanConfig } from "../magellan-shared/magellan-config";
import { createServerTransformer } from "./transformer-server";

export const createTransformer = (fileName: string, content: string, ctx: AddonContext<TargetConfig>): string | never => {
    if (!isTsAddonApplicable(fileName, ctx.getConfig() as any)) {
        return content;
    }
    if (fileName.endsWith(".d.ts")) {
        return content;
    }
    if (!ctx.getSystem().fileExists(fileName)) {
        throw new Error(`ServerAddon.preEmit(${fileName}) could not find source file`);
    }

    const sf = ts.createSourceFile(fileName, content, ctx.getConfig().options.target ?? (ts.ScriptTarget.Latest as any), true);
    const compilationOptions = ctx.getTargetConfig() as MagellanConfig;
    if (!compilationOptions) {
        throw new Error("MagellanConfig is missing");
    }

    const transformResults = ts.transform(
        sf,
        [createServerTransformer({ libPath: "@qs/magellan-server", functionsDir: ctx.getSystem().resolvePath(compilationOptions.functionsDir) })],
        ctx.getConfig().options as any
    );
    if (transformResults.diagnostics) {
        // eslint-disable-next-line no-console
        transformResults.diagnostics.forEach(it => console.error(`[${it.category}] - ${it.messageText}`));
    }

    const transformedSf = transformResults.transformed.find(it => it.fileName === sf.fileName);
    return transformedSf ? ts.createPrinter().printFile(transformedSf) : content;
};
