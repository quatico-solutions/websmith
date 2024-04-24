/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * @license
 *
 * Copyright (c) 2017-2023 Quatico Solutions AG
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
import { DefaultReporter } from "@quatico/websmith-core";
import type ts from "typescript";

export class ReporterMock extends DefaultReporter {
    public message?: string = "";

    public reportWatchStatus(diagnostic: ts.Diagnostic, newLine?: string, options?: ts.CompilerOptions, errorCount?: number): void {
        // do nothing
    }

    protected logProblem(message: string, category: ts.DiagnosticCategory): void {
        this.message += `${message ?? ""}\n`;
    }
}
