/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

/**
 * Selects the diagnostics the plugin raises at the end of a build: the errors, only in a build that has not failed
 * already. A dev server calls buildEnd on close without an error, where raising would abort the closing plugins.
 */
export const selectConfigErrors = (command: "build" | "serve", buildError: unknown, diagnostics: readonly ts.Diagnostic[]): ts.Diagnostic[] =>
    command === "build" && !buildError ? diagnostics.filter(cur => cur.category === ts.DiagnosticCategory.Error) : [];
