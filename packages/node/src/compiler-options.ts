/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

export const tsDefaults: ts.CompilerOptions = {
    ...ts.getDefaultCompilerOptions(),
    esModuleInterop: true,
    jsx: ts.JsxEmit.React,
    module: ts.ModuleKind.ESNext,
    strict: true,
    target: ts.ScriptTarget.ESNext,
    noEmit: true,
};

// The reverse map yields "Latest" for 99 and "LatestStandard" for 12 (nothing on TypeScript 5), neither is a --target value
const SCRIPT_TARGET_NAMES: Record<number, string> = {
    12: "ES2025",
    99: "ESNext",
};

export const parseNumberValue = (key: string, value: number): string => {
    switch (key) {
        case "importsNotUsedAsValues":
            return ts.ImportsNotUsedAsValues[value];
        case "jsx":
            return ts.JsxEmit[value];
        case "maxNodeModuleJsDepth":
            return String(value);
        case "module":
            return ts.ModuleKind[value];
        case "moduleResolution":
            return ts.ModuleResolutionKind[value];
        case "moduleDetection":
            return ts.ModuleDetectionKind[value];
        case "newLine":
            return ts.NewLineKind[value];
        case "target":
            return SCRIPT_TARGET_NAMES[value] ?? ts.ScriptTarget[value] ?? String(value);
        default:
            throw new Error(`Unknown key: "${key}" with number value: "${value}"`);
    }
};

export const parseNumberValues = (compilerOptions: Record<string, unknown>) => {
    return Object.entries(compilerOptions).reduce((acc: Record<string, string>, [key, value]) => {
        if (typeof value === "number") {
            acc[key] = parseNumberValue(key, value);
        }
        return acc;
    }, {});
};
