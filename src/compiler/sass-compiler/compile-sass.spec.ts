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
/* eslint-disable jest/no-mocks-import */
import { ReporterMock } from "../../__mocks__";
import { createBrowserSystem } from "../../environment";
import { createSass } from "./compile-sass";

const testSystem = createBrowserSystem({});

describe("createSass", () => {
    it("yields error message with invalid CSS syntax", () => {
        const reporter = new ReporterMock(testSystem);
        const compileSass = createSass({}, reporter);

        compileSass("invalid css");

        expect(reporter.message).toBe(`Error: expected "{".
  ╷
1 │ invalid css
  │            ^
  ╵
  - 1:12  root stylesheet\n`);
    });

    it("uses default config with invalid config", () => {
        const reporter = new ReporterMock(testSystem);
        const compileSass = createSass({}, reporter);

        compileSass(".foo {}");

        expect(reporter.message).toBe("");
    });
});
