/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type ts from "typescript";
import { DefaultReporter } from "../src/compiler";

export class ReporterMock extends DefaultReporter {
    public message: string = "";

    constructor(host: ts.System | ts.FormatDiagnosticsHost) {
        super(host);
    }

    public reportWatchStatus(_diagnostic: ts.Diagnostic) {
        // do nothing
    }

    protected logProblem(message: string, _category: ts.DiagnosticCategory): void {
        // Capture the message for tests
        this.message += `${message}\n`;

        // Don't call parent to avoid writing to stdout in tests
        // super.logProblem(message, category);
    }
}
