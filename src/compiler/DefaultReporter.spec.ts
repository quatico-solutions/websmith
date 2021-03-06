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
