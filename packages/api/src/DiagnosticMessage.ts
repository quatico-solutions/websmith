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

/**
 * This type represents a message object of the reporter API. It is used to implement the
 * `ErrorMessage`, `WarningMessage` and `InfoMessage` types.
 *
 * You most likely do not want to use this type directly.
 */
export abstract class DiagnosticMessage implements ts.Diagnostic {
    public category: ts.DiagnosticCategory;
    public code: number;
    public file: ts.SourceFile | undefined;
    // @ts-ignore compile problem with ts API?
    public length: number | undefined;
    public messageText: string | ts.DiagnosticMessageChain;
    public source?: string;
    public start: number | undefined;

    constructor(props: ts.Diagnostic) {
        this.category = props.category;
        this.code = props.code;
        this.file = props.file;
        this.length = props.length;
        this.messageText = props.messageText;
        this.source = props.source;
        this.start = props.start;
    }
}

/**
 * This type guard checks if the given object is a `ts.SourceFile`.
 *
 * @param source The object to check.
 * @returns `true` if the given object is a `ts.SourceFile`, otherwise `false`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSourceFile = (source: any): source is ts.SourceFile => source?.kind && ts.isSourceFile(source);
