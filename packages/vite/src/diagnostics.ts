/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

/** A position as Rollup logs take it: the line is 1-based, the column 0-based. */
export type RollupLocation = { file: string; line: number; column: number };

/** The argument of Rollup's `this.error`: every error in `message`, the first position as `loc`. */
export type RollupErrorLog = { message: string; loc?: RollupLocation };

/** The argument of Rollup's `this.warn`: a string, or the message with its position. */
export type RollupWarningLog = string | { message: string; loc: RollupLocation };

/** The diagnostics of a module split into those that fail the build and those Vite only logs. */
export type PartitionedDiagnostics = { errors: ts.Diagnostic[]; warnings: ts.Diagnostic[] };

const getLocation = (diagnostic: ts.Diagnostic): RollupLocation | undefined => {
    if (!diagnostic.file || diagnostic.start === undefined) {
        return undefined;
    }
    const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
    return { file: diagnostic.file.fileName, line: line + 1, column: character };
};

/** Formats a diagnostic as `file (line,column): message`, 1-based like TypeScript, or as the message alone without a file. */
export const formatDiagnostic = (diagnostic: ts.Diagnostic): string => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    const loc = getLocation(diagnostic);
    return loc ? `${loc.file} (${loc.line},${loc.column + 1}): ${message}` : message;
};

/** Identifies a diagnostic by its file, position, code and message, so a repeated diagnostic is reported once. */
export const getDiagnosticKey = ({ file, start, code, messageText }: ts.Diagnostic): string =>
    [file?.fileName, start, code, ts.flattenDiagnosticMessageText(messageText, "\n")].join("\0");

/**
 * Returns one Rollup error for `errors`, since `this.error` throws: every error formatted in the message, one per
 * line, and the position of the first error that has one as `loc`. That error's message has no position, since
 * Rollup prints `loc` in front of the message.
 */
export const toRollupError = (errors: readonly ts.Diagnostic[]): RollupErrorLog => {
    const locs = errors.map(getLocation);
    const index = locs.findIndex(cur => cur !== undefined);
    const loc = locs[index];
    const message = errors.map((cur, i) => (i === index ? ts.flattenDiagnosticMessageText(cur.messageText, "\n") : formatDiagnostic(cur))).join("\n");
    return { message, ...(loc && { loc }) };
};

/**
 * Returns the Rollup warning for `warning`: with its position as `loc` when it has one, and then without the position
 * in the message, since Rollup prints `loc` in front of the message.
 */
export const toRollupWarning = (warning: ts.Diagnostic): RollupWarningLog => {
    const loc = getLocation(warning);
    return loc ? { message: ts.flattenDiagnosticMessageText(warning.messageText, "\n"), loc } : formatDiagnostic(warning);
};

/**
 * Splits `diagnostics` into the errors, which fail the module, and the warnings Vite logs: the warning diagnostics,
 * and with `debug` the messages and suggestions too, as the loader does. A diagnostic repeated with the same file,
 * position, code and message is kept once.
 */
export const partitionDiagnostics = (diagnostics: readonly ts.Diagnostic[], debug: boolean): PartitionedDiagnostics => {
    const seen = new Set<string>();
    const result: PartitionedDiagnostics = { errors: [], warnings: [] };
    for (const diagnostic of diagnostics) {
        const key = getDiagnosticKey(diagnostic);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        if (diagnostic.category === ts.DiagnosticCategory.Error) {
            result.errors.push(diagnostic);
        } else if (diagnostic.category === ts.DiagnosticCategory.Warning || debug) {
            result.warnings.push(diagnostic);
        }
    }
    return result;
};
