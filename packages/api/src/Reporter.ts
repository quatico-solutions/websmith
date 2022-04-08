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

export interface Reporter {
    /**
     * Reports a diagnostic object.
     * 
     * @param diagnostic The diagnostic to report.
     */
    reportDiagnostic(diagnostic: ts.Diagnostic): void;
    reportWatchStatus(diagnostic: ts.Diagnostic, newLine?: string, options?: ts.CompilerOptions, errorCount?: number): void;
}
