/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { CompileFragment } from "@quatico/websmith-compiler";
import type typescript from "typescript";
import { LoaderContext } from "webpack";
import { PluginOptions } from "./plugin";

export const makeSourceMap = (outputText: string, sourceMapText?: string) => {
    return {
        output: outputText.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ""),
        ...(sourceMapText && { sourceMap: JSON.parse(sourceMapText) }),
    };
};

export const processResultAndFinish = (loader: LoaderContext<PluginOptions>, fragment: CompileFragment, targets: string[]) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const outputText = fragment.files.find((cur: typescript.OutputFile) => cur.name.match(/\.jsx?$/i))?.text;
    const sourceMapText = fragment.files.find((cur: typescript.OutputFile) => cur.name.match(/\.jsx?\.map$/i))?.text;

    if (!outputText) {
        return loader.callback(new Error(`No processed output found for "${loader.resourcePath}" with targets "${targets.join(",")}"`));
    } else {
        const { output, sourceMap } = makeSourceMap(outputText, sourceMapText);
        loader.callback(undefined, output, sourceMap);
    }
};
