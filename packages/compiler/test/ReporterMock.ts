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
import { DefaultReporter } from "@websmith/compiler";

export class ReporterMock extends DefaultReporter {
    public message?: string = "";

    public reportWatchStatus(diagnostic: ts.Diagnostic) {
        // do nothing
    }

    protected logProblem(message: any, category: ts.DiagnosticCategory): void {
        this.message += `${message ?? ""}\n`;
    }
}
