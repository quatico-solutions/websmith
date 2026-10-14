/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompileFragment } from "@quatico/websmith-core";
import type { Rollup } from "vite";

// JavaScript output of .ts, .tsx, .mts and .cts sources and its source map
const JS_FILE = /\.(?:[cm]?js|jsx)$/i;
const JS_MAP_FILE = /\.(?:[cm]?js|jsx)\.map$/i;

/** The JavaScript of a compiled module and its source map, as Vite's transform hook returns them. */
export type ModuleOutput = { code: string; map: Rollup.ExistingRawSourceMap | null };

/**
 * Picks the JavaScript file of `fragment` and its source map for Vite, without the `sourceMappingURL` comment that
 * Vite replaces. Returns `null` for a fragment without JavaScript, e.g. the empty fragment of an unconfigured profile.
 */
export const pickOutput = (fragment: CompileFragment): ModuleOutput | null => {
    const outputText = fragment.files.find(cur => JS_FILE.test(cur.name))?.text;
    if (!outputText) {
        return null;
    }
    const sourceMapText = fragment.files.find(cur => JS_MAP_FILE.test(cur.name))?.text;
    return {
        code: outputText.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ""),
        map: sourceMapText ? (JSON.parse(sourceMapText) as Rollup.ExistingRawSourceMap) : null,
    };
};
