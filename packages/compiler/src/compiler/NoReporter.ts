/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import type { Reporter } from "@quatico/websmith-api";

export class NoReporter implements Reporter {
    public reportDiagnostic(diagnostic: ts.Diagnostic): void {
        // do nothing
    }

    public reportWatchStatus(diagnostic: ts.Diagnostic, newLine = ""): void {
        // do nothing
    }
}
