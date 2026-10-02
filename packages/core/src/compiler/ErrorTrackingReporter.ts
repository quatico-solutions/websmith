/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { Reporter } from "@quatico/websmith-api";
import ts from "typescript";

/**
 * Passes every call to the wrapped reporter and records whether an error-level diagnostic was reported.
 */
export class ErrorTrackingReporter implements Reporter {
    private errorReported = false;

    constructor(private readonly reporter: Reporter) {}

    public hasErrors(): boolean {
        return this.errorReported;
    }

    public reportDiagnostic(diagnostic: ts.Diagnostic): void {
        if (diagnostic.category === ts.DiagnosticCategory.Error) {
            this.errorReported = true;
        }
        this.reporter.reportDiagnostic(diagnostic);
    }

    public reportWatchStatus(diagnostic: ts.Diagnostic, newLine?: string, tsConfig?: ts.CompilerOptions, errorCount?: number): void {
        this.reporter.reportWatchStatus(diagnostic, newLine, tsConfig, errorCount);
    }

    public indent(): void {
        this.reporter.indent();
    }

    public unindent(): void {
        this.reporter.unindent();
    }
}
