/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

// TypeScript 6 derives no target from module: getEmitScriptTarget gives ES2025 for node16, nodenext and the rest
const DERIVES_TARGET_FROM_MODULE = Number(ts.versionMajorMinor.split(".")[0]) < 6;

/**
 * Returns the target TypeScript compiles for: the explicit `target`, else the one `tsc` 5.x derives from `module`, else
 * the installed TypeScript's default. Use it wherever websmith reads `target` itself; the compiler derives it on emit.
 */
export const getEffectiveTarget = (options: ts.CompilerOptions): ts.ScriptTarget => {
    if (options.target !== undefined) {
        return options.target;
    }
    if (!DERIVES_TARGET_FROM_MODULE) {
        return ts.getDefaultCompilerOptions().target as ts.ScriptTarget;
    }
    switch (options.module) {
        case ts.ModuleKind.Node16:
            return ts.ScriptTarget.ES2022;
        case ts.ModuleKind.NodeNext:
            return ts.ScriptTarget.ESNext;
        default:
            // Always set by TypeScript: ES5 on 5.x, ES2025 on 6.x
            return ts.getDefaultCompilerOptions().target as ts.ScriptTarget;
    }
};
