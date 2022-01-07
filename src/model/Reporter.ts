/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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
    reportDiagnostic(diagnostic: ts.Diagnostic): void;
    reportWatchStatus(diagnostic: ts.Diagnostic, newLine?: string, options?: ts.CompilerOptions, errorCount?: number): void;
}

export type MessageConstructor = new (message: string | ts.DiagnosticMessageChain, source?: ts.SourceFile | string) => ts.Diagnostic;

export abstract class DiagnosticMessage implements MessageConstructor, ts.Diagnostic {
    public category: ts.DiagnosticCategory;
    public code: number;
    public file: ts.SourceFile | undefined;
    // @ts-ignore FIXME: compile problem?
    public length: number | undefined;
    public messageText: string | ts.DiagnosticMessageChain;
    public source?: string;
    public start: number | undefined;

    constructor(props: ts.Diagnostic) {
        this.category = props.category;
        this.code = props.code;
        this.file = props.file;
        this.length = undefined;
        this.messageText = props.messageText;
        this.source = props.source;
        this.start = undefined;
    }
}

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

export class WarnMessage extends DiagnosticMessage {
    constructor(message: string | ts.DiagnosticMessageChain, source?: ts.SourceFile | string) {
        super({
            category: ts.DiagnosticCategory.Warning,
            code: 0,
            file: isSourceFile(source) ? source : undefined,
            length: undefined,
            messageText: message,
            source: typeof source === "string" ? source : undefined,
            start: undefined,
        });
    }
}
export class InfoMessage extends DiagnosticMessage {
    constructor(message: string | ts.DiagnosticMessageChain, source?: ts.SourceFile | string) {
        super({
            category: ts.DiagnosticCategory.Suggestion,
            code: 0,
            file: isSourceFile(source) ? source : undefined,
            length: undefined,
            messageText: message,
            source: typeof source === "string" ? source : undefined,
            start: undefined,
        });
    }
}

export const aggregateMessages = (message: string | ts.DiagnosticMessageChain, result = ""): string => {
    result = result.concat(messageToString(message));
    if (isMessage(message) && message.next) {
        message.next.forEach(cur => aggregateMessages(cur, result));
    }
    return result;
};

export const messageToString = (message?: string | ts.DiagnosticMessageChain): string => {
    return isMessage(message) ? message.messageText : message || "";
};

const isMessage = (data?: string | ts.DiagnosticMessageChain): data is ts.DiagnosticMessageChain =>
    (data as ts.DiagnosticMessageChain)?.messageText !== undefined;

const isSourceFile = (source: any): source is ts.SourceFile => source?.kind && ts.isSourceFile(source);
