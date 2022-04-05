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
