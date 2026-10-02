/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

/**
 * Returns the target TypeScript compiles for: the explicit `target`, else the one `tsc` derives from `module`, else
 * the installed TypeScript's default. Use it wherever websmith reads `target` itself; the compiler derives it on emit.
 */
export const getEffectiveTarget = (options: ts.CompilerOptions): ts.ScriptTarget => {
    if (options.target !== undefined) {
        return options.target;
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
