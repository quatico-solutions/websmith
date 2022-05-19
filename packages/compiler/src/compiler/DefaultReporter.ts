/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { messageToString, Reporter } from "@quatico/websmith-api";

export class DefaultReporter implements Reporter {
    public readonly formatHost: ts.FormatDiagnosticsHost;

    constructor(host: ts.System | ts.FormatDiagnosticsHost) {
        this.formatHost = isSystem(host)
            ? {
                  getCanonicalFileName: (path: string) => path,
                  getCurrentDirectory: () => host.getCurrentDirectory(),
                  getNewLine: () => host.newLine,
              }
            : host;
    }

    public reportDiagnostic(diagnostic: ts.Diagnostic): void {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, this.formatHost.getNewLine());
        if (typeof diagnostic.file?.getLineAndCharacterOfPosition === "function" && diagnostic.start) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            this.logProblem(`${levelOf(diagnostic)}: ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`, diagnostic.category);
        } else {
            this.logProblem(`${levelOf(diagnostic)}: ${diagnostic.code ? diagnostic.code + ": " : ""}${message}`, diagnostic.category);
        }
    }

    /**
     * Prints a diagnostic every time the watch status changes, i.e., mainly
     * messages like "Starting compilation" or "Compilation completed".
     */
    public reportWatchStatus(diagnostic: ts.Diagnostic, newLine = ""): void {
        // console.info(ts.formatDiagnostic(diagnostic, this.formatHost));
        process.stdout.write(`${messageToString(diagnostic.messageText)}${newLine}`);
    }

    protected logProblem(message: string, category: ts.DiagnosticCategory): void {
        switch (category) {
            case ts.DiagnosticCategory.Error:
                // eslint-disable-next-line no-console
                console.error(message);
                break;
            case ts.DiagnosticCategory.Warning:
                // eslint-disable-next-line no-console
                console.warn(message);
                break;
            default:
                // eslint-disable-next-line no-console
                console.log(message);
                break;
        }
    }
}

const levelOf = (diagnostic: ts.Diagnostic): string => {
    if (diagnostic?.category === undefined) {
        diagnostic.category = ts.DiagnosticCategory.Error;
    }
    return ts.DiagnosticCategory[diagnostic.category];
};

const isSystem = (host: ts.System | ts.FormatDiagnosticsHost): host is ts.System => (host as ts.System).write !== undefined;
