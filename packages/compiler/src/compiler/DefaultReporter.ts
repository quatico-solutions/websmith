/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import ts from "typescript";
import { messageToString, Reporter } from "@websmith/addon-api";

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
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
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
        diagnostic = { category: ts.DiagnosticCategory.Error } as any;
    }
    return ts.DiagnosticCategory[diagnostic.category];
};

const isSystem = (host: ts.System | ts.FormatDiagnosticsHost): host is ts.System => (host as ts.System).write !== undefined;