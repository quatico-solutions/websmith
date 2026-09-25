/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage, InfoMessage, WarnMessage } from "@quatico/websmith-api";
import { NoReporter } from "@quatico/websmith-core";
import { ErrorTrackingReporter } from "./ErrorTrackingReporter";

describe("ErrorTrackingReporter", () => {
    it("should yield no errors w/o reported diagnostics", () => {
        const testObj = new ErrorTrackingReporter(new NoReporter());

        const actual = testObj.hasErrors();

        expect(actual).toBe(false);
    });

    it("should yield errors w/ reported error diagnostic", () => {
        const testObj = new ErrorTrackingReporter(new NoReporter());

        testObj.reportDiagnostic(new ErrorMessage("whatever"));
        const actual = testObj.hasErrors();

        expect(actual).toBe(true);
    });

    it("should yield no errors w/ reported warning and message diagnostics", () => {
        const testObj = new ErrorTrackingReporter(new NoReporter());

        testObj.reportDiagnostic(new WarnMessage("whatever"));
        testObj.reportDiagnostic(new InfoMessage("whatever"));
        const actual = testObj.hasErrors();

        expect(actual).toBe(false);
    });

    it("should pass reported diagnostic to wrapped reporter", () => {
        const target = new NoReporter();
        const reportSpy = jest.spyOn(target, "reportDiagnostic");
        const expected = new ErrorMessage("expected");
        const testObj = new ErrorTrackingReporter(target);

        testObj.reportDiagnostic(expected);
        const actual = reportSpy.mock.calls[0][0];

        expect(actual).toBe(expected);
    });

    it("should pass watch status to wrapped reporter", () => {
        const target = new NoReporter();
        const watchSpy = jest.spyOn(target, "reportWatchStatus");
        const expected = new InfoMessage("expected");
        const testObj = new ErrorTrackingReporter(target);

        testObj.reportWatchStatus(expected, "\n");
        const actual = watchSpy.mock.calls[0];

        expect(actual).toEqual([expected, "\n", undefined, undefined]);
    });

    it("should pass indent and unindent to wrapped reporter", () => {
        const target = new NoReporter();
        const indentSpy = jest.spyOn(target, "indent");
        const unindentSpy = jest.spyOn(target, "unindent");
        const testObj = new ErrorTrackingReporter(target);

        testObj.indent();
        testObj.unindent();
        const actual1 = indentSpy.mock.calls.length;
        const actual2 = unindentSpy.mock.calls.length;

        expect(actual1).toBe(1);
        expect(actual2).toBe(1);
    });
});
