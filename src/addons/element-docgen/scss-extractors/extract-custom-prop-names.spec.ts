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
/* eslint-disable jest/no-mocks-import */
import path from "path";
import { ReporterMock } from "../../../__mocks__";
import { createBrowserSystem } from "../../../environment";
import { extractCustomPropNames, readCustomPropNames } from "./extract-custom-prop-names";

const reporter = new ReporterMock(createBrowserSystem({}));

// FIXME: Tests don't run on local machine
describe.skip("extractCustomPropNames", () => {
    it("extracts names of CssCustomProperties from $properties and composite-props() elements", () => {
        const actual = extractCustomPropNames("./test/patterns/test/_test.scss", "qs-test", [
            // FIXME: extract properties libraries for use in scripts
            path.resolve(__dirname, "../../packages/patterns/src/properties"),
            __dirname,
        ]);

        expect(actual).toStrictEqual([
            "--qs-test__border-x-start",
            "--qs-test__border-x-end",
            "--qs-test__border-y-start",
            "--qs-test__border-y-end",
            "--qs-test__border-x",
            "--qs-test__border-y",
            "--qs-test__border",
        ]);
    });

    it("reads the sorted property names from the patterns below a directory", () => {
        const actual = readCustomPropNames(
            "./src/test/patterns", // use 'path.resolve("../../packages/patterns/src")' to test with patterns
            reporter,
            [
                // FIXME: extract properties libraries for use in scripts
                path.resolve("../../packages/patterns/src/properties"),
            ]
        );

        expect(actual).toStrictEqual({
            "qs-test": [
                "--qs-test__border",
                "--qs-test__border-x",
                "--qs-test__border-x-end",
                "--qs-test__border-x-start",
                "--qs-test__border-y",
                "--qs-test__border-y-end",
                "--qs-test__border-y-start",
            ],
        });
    });
});
