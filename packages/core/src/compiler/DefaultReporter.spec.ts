/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { ReporterMock } from "../../test";
import { createSystem } from "../environment";
import { DefaultReporter } from "./DefaultReporter";

describe("constructor", () => {
    it("yields formatHost with system as host", () => {
        const testObj = new DefaultReporter(createSystem());

        expect(testObj.formatHost).toBeDefined();
    });

    it("yields formatHost with FormatDiagnosticsHost as host", () => {
        const expected = {
            getCanonicalFileName: (path: string) => path,
            getCurrentDirectory: () => ".",
            getNewLine: () => "\n",
        };
        const testObj = new DefaultReporter(expected);

        expect(testObj.formatHost).toEqual(expected);
    });
});

describe("reportDiagnostic", () => {
    it("reports file and location w/ diagnostic at first character", () => {
        const target = createSystem({}, { virtual: true });
        const testObj = new ReporterMock(target);
        const file = ts.createSourceFile("/dist/target.js", `require("x");`, ts.ScriptTarget.Latest);

        testObj.reportDiagnostic({ category: ts.DiagnosticCategory.Error, code: 91001, file, start: 0, length: 7, messageText: "whatever" });
        const actual = testObj.message;

        expect(actual).toBe("Error: /dist/target.js (1,1): whatever\n");
    });
});
