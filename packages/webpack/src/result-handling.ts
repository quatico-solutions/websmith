/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type CompileFragment } from "@quatico/websmith-core";
import type typescript from "typescript";
import { type LoaderContext } from "webpack";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

export const makeSourceMap = (outputText: string, sourceMapText?: string) => {
    return {
        output: outputText.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ""),
        ...(!!sourceMapText && { sourceMap: JSON.parse(sourceMapText) }),
    };
};

export const processResultAndFinish = (context: LoaderContext<WebsmithLoaderConfig>, fragment: CompileFragment, profiles: string[]) => {
    const outputText = fragment.files.find((cur: typescript.OutputFile) => cur.name.match(/\.jsx?$/i))?.text;
    const sourceMapText = fragment.files.find((cur: typescript.OutputFile) => cur.name.match(/\.jsx?\.map$/i))?.text;

    if (!outputText) {
        return context.callback(new Error(`No processed output found for "${context.resourcePath}" with profiles "${profiles.join(",")}"`));
    } else {
        const { output, sourceMap } = makeSourceMap(outputText, sourceMapText);
        context.callback(undefined, output, sourceMap);
    }
};
