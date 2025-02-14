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
    public message?: string = "";

    public reportWatchStatus(diagnostic: ts.Diagnostic, newLine?: string, tsConfig?: ts.CompilerOptions, errorCount?: number): void {
        // do nothing
    }

    protected logProblem(message: string, category: ts.DiagnosticCategory): void {
        this.message += `${message ?? ""}\n`;
    }
}
