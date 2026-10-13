/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { selectConfigErrors } from "./config-errors";

const diagnostic = (category: ts.DiagnosticCategory): ts.Diagnostic => ({
    category,
    code: 1,
    file: undefined,
    start: undefined,
    length: undefined,
    messageText: "whatever",
});

describe("selectConfigErrors", () => {
    it("should return errors w/ errors in build", () => {
        const target = diagnostic(ts.DiagnosticCategory.Error);

        const actual = selectConfigErrors("build", undefined, [diagnostic(ts.DiagnosticCategory.Warning), target]);

        expect(actual).toEqual([target]);
    });

    it("should return none w/ build error", () => {
        const actual = selectConfigErrors("build", new Error("whatever"), [diagnostic(ts.DiagnosticCategory.Error)]);

        expect(actual).toEqual([]);
    });

    it("should return none w/ warnings only", () => {
        const actual = selectConfigErrors("build", undefined, [diagnostic(ts.DiagnosticCategory.Warning)]);

        expect(actual).toEqual([]);
    });

    it("should return none w/ errors in serve", () => {
        const actual = selectConfigErrors("serve", undefined, [diagnostic(ts.DiagnosticCategory.Error)]);

        expect(actual).toEqual([]);
    });
});
