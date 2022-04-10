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
import { DiagnosticMessage, isSourceFile } from "./DiagnosticMessage";

/**
 * This type represents an error message object of the reporter API. Use it
 * to report errors in your addon code.
 */
export class ErrorMessage extends DiagnosticMessage {
    constructor(message: string | ts.DiagnosticMessageChain, source?: ts.SourceFile | string) {
        super({
            category: ts.DiagnosticCategory.Error,
            code: 0,
            file: isSourceFile(source) ? source : undefined,
            length: undefined,
            messageText: message,
            source: typeof source === "string" ? source : undefined,
            start: undefined,
        });
    }
}
