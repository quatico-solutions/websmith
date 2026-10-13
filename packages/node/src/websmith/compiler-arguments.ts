/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { isArray } from "lodash";
import type ts from "typescript";
import { parseNumberValue } from "../compiler-options";

// tsc 6 rejects file arguments next to a tsconfig.json (TS5112), tsc 5 rejects --ignoreConfig (TS5023),
// tsc --build rejects --ignoreConfig, and an explicit ignoreConfig is the caller's choice
const needsIgnoreConfig = (tsConfig: ts.CompilerOptions, files: string[], tscVersion?: string): boolean =>
    files.length > 0 && tsConfig.ignoreConfig === undefined && !tsConfig.build && Number.parseInt(tscVersion ?? "", 10) >= 6;

// tsc 6 colors its output under FORCE_COLOR even without a TTY, the reducer drops pretty: false
const prettyArguments = (tsConfig: ts.CompilerOptions): string[] => (tsConfig.pretty === true ? [] : ["--pretty", "false"]);

export const parseCliArguments = (tsConfig: ts.CompilerOptions, files: string[], tscVersion?: string) =>
    Object.entries(tsConfig)
        .reduce((acc: string[], [key, value]) => {
            if (value === false) {
                return acc;
            }
            if (value === true) {
                acc.push(`--${key}`);
            } else if (isArray(value)) {
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                acc.push(`--${key}`, String(value.join(",")));
            } else if (value && typeof value === "number") {
                acc.push(`--${key}`, parseNumberValue(key, value));
            } else if (value && typeof value === "string") {
                acc.push(`--${key}`, String(value));
            } else {
                throw new Error(`Unknown value type: ${typeof value}`);
            }
            return acc;
        }, [])
        .concat(prettyArguments(tsConfig), needsIgnoreConfig(tsConfig, files, tscVersion) ? ["--ignoreConfig"] : [], files);
