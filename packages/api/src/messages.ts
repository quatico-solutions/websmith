/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

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

export const isMessage = (data?: string | ts.DiagnosticMessageChain): data is ts.DiagnosticMessageChain =>
    (data as ts.DiagnosticMessageChain)?.messageText !== undefined;
