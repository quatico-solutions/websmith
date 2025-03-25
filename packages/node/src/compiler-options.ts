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
            // TODO: This is a bug in typescript 5.7.2 using value 99 for ESNext and Latest
            if (value === 99) {
                return "ESNext";
            }
            return ts.ScriptTarget[value];
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
