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
import { ReporterMock } from "../../../test";
import { createBrowserSystem } from "../../environment";
import { AddonRegistry } from "./AddonRegistry";

let testObj: AddonRegistry;

beforeEach(() => {
    const testSystem = createBrowserSystem();
    testObj = new AddonRegistry({ addonsDir: "./addons", reporter: new ReporterMock(testSystem), system: testSystem });
});

describe("constructor", () => {
    it("returns empty addons by default", () => {
        expect(testObj.getAddons()).toEqual([]);
    });
});
