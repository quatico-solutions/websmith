/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

export interface Reporter {
    /**
     * Reports a diagnostic object.
     * 
     * @param diagnostic The diagnostic to report.
     */
    reportDiagnostic(diagnostic: ts.Diagnostic): void;
    reportWatchStatus(diagnostic: ts.Diagnostic, newLine?: string, options?: ts.CompilerOptions, errorCount?: number): void;
}
