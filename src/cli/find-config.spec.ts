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
import { createBrowserSystem } from "../environment";
import { findConfigFile, findSassConfig } from "./find-config";

describe("findConfigFile", () => {
    it("returns file name with path to existing file", () => {
        const target = createBrowserSystem({
            "tsconfig.json": JSON.stringify({}),
        });

        const actual = findConfigFile("./", target);

        expect(actual).toBe("tsconfig.json");
    });

    it("throws error with no existing config file", () => {
        const target = createBrowserSystem({});

        expect(() => findConfigFile("./", target)).toThrow("Could not find a valid 'tsconfig.json'.");
    });
});

describe("findSassConfig", () => {
    it("returns file name with path to existing file", () => {
        const target = createBrowserSystem({ "sass.config.js": `{}` });

        const actual = findSassConfig("sass.config.js", target);

        expect(actual).toBe("sass.config.js");
    });

    it("returns file name with path to custom existing file", () => {
        const target = createBrowserSystem({ "expected.js": `{}` });

        const actual = findSassConfig("expected.js", target);

        expect(actual).toBe("expected.js");
    });

    it("throws error with no existing config file", () => {
        const target = createBrowserSystem({});

        expect(() => findSassConfig("sass.config.js", target)).toThrow("Could not find a valid 'sass.config.js'.");
    });
});
