/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage } from "@quatico/websmith-api";
import { ErrorTrackingReporter, NoReporter } from "./index";

describe("package entry point", () => {
    it("should export a usable ErrorTrackingReporter", () => {
        const testObj = new ErrorTrackingReporter(new NoReporter());

        testObj.reportDiagnostic(new ErrorMessage("whatever"));
        const actual = testObj.hasErrors();

        expect(actual).toBe(true);
    });
});
