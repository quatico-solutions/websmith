/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { DefaultReporter } from "@quatico/websmith-core";
import type ts from "typescript";

export class ReporterMock extends DefaultReporter {
    public message: string = "";

    constructor(host: ts.System | ts.FormatDiagnosticsHost) {
        super(host);
    }

    public reportWatchStatus(diagnostic: ts.Diagnostic, newLine?: string, tsConfig?: ts.CompilerOptions, errorCount?: number): void {
        // do nothing
    }

    protected logProblem(message: string, _category: ts.DiagnosticCategory): void {
        // Capture the message for tests
        this.message += `${message}\n`;

        // Don't call parent to avoid writing to stdout in tests
        // super.logProblem(message, category);
    }
}
