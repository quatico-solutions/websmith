/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
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
