/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage, WarnMessage } from "@quatico/websmith-api";
import { DiagnosticReporter } from "./diagnostic-reporter";

describe("DiagnosticReporter", () => {
    it("should return buffered diagnostics in order w/ two reports", () => {
        const first = new ErrorMessage("first");
        const second = new WarnMessage("second");
        const testObj = new DiagnosticReporter();
        testObj.reportDiagnostic(first);
        testObj.reportDiagnostic(second);

        const actual = testObj.take();

        expect(actual).toEqual([first, second]);
    });

    it("should empty buffer w/ take", () => {
        const testObj = new DiagnosticReporter();
        testObj.reportDiagnostic(new ErrorMessage("whatever"));
        testObj.take();

        const actual = testObj.take();

        expect(actual).toEqual([]);
    });

    it("should return empty w/o reports", () => {
        const testObj = new DiagnosticReporter();

        const actual = testObj.take();

        expect(actual).toEqual([]);
    });

    it("should delegate watch status w/ delegate", () => {
        const target = { reportDiagnostic: jest.fn(), reportWatchStatus: jest.fn(), indent: jest.fn(), unindent: jest.fn() };
        const testObj = new DiagnosticReporter(target);
        const diagnostic = new WarnMessage("whatever");

        testObj.reportWatchStatus(diagnostic, "\n");
        const actual = target.reportWatchStatus;

        expect(actual).toHaveBeenCalledWith(diagnostic, "\n");
    });

    it("should not pass diagnostics to delegate w/ delegate", () => {
        const target = { reportDiagnostic: jest.fn(), reportWatchStatus: jest.fn(), indent: jest.fn(), unindent: jest.fn() };
        const testObj = new DiagnosticReporter(target);

        testObj.reportDiagnostic(new WarnMessage("whatever"));
        const actual = target.reportDiagnostic;

        expect(actual).not.toHaveBeenCalled();
    });
});
