/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { DefaultReporter } from "../src/compiler";

export class ReporterMock extends DefaultReporter {
    public message?: string = "";

    public reportWatchStatus(diagnostic: ts.Diagnostic) {
        // do nothing
    }

    protected logProblem(message: string, category: ts.DiagnosticCategory): void {
        this.message += `${message ?? ""}\n`;
    }
}
