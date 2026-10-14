/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage } from "@quatico/websmith-api";
import { getEffectiveTarget, getEmittedModuleKind, isEsmModuleKind } from "@quatico/websmith-core";
import ts from "typescript";

/**
 * Selects the diagnostics the plugin raises at the end of a build: the errors, only in a build that has not failed
 * already. A dev server calls buildEnd on close without an error, where raising would abort the closing plugins.
 */
export const selectConfigErrors = (command: "build" | "serve", buildError: unknown, diagnostics: readonly ts.Diagnostic[]): ts.Diagnostic[] =>
    command === "build" && !buildError ? diagnostics.filter(cur => cur.category === ts.DiagnosticCategory.Error) : [];

/**
 * Returns a configuration error when the profile's effective `module`, or without one its `target`, makes TypeScript
 * emit a format Vite cannot bundle as an ES module, e.g. CommonJS. Returns nothing when the profile sets `esm`, which
 * core reports for that case already.
 */
export const checkTargetModule = (profile: string | undefined, tsConfig: ts.CompilerOptions, hasEsm: boolean): ts.Diagnostic | undefined => {
    const { module } = tsConfig;
    const target = getEffectiveTarget(tsConfig);
    if (hasEsm || isEsmModuleKind(getEmittedModuleKind({ module, target }))) {
        return undefined;
    }
    const emitted = typeof module === "number" ? ts.ModuleKind[module] : (module ?? "CommonJS");
    const cause =
        module === undefined
            ? `'tsConfig.module' is unset and 'target' is '${ts.ScriptTarget[target]}'`
            : `'tsConfig.module' is '${String(emitted).toLowerCase()}'`;
    const subject = profile ? `Profile '${profile}'` : "The default profile";
    return new ErrorMessage(`${subject} emits ${emitted} (${cause}), which Vite cannot bundle as an ES module. Use "ESNext" or "ES2022".`);
};
