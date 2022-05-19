/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createBrowserSystem } from "@quatico/websmith-compiler";
import { findConfigFile, findSassConfig } from "./find-config";

describe("findConfigFile", () => {
    it("returns file name with path to existing file", () => {
        const target = createBrowserSystem({
            "tsconfig.json": JSON.stringify({}),
        });

        const actual = findConfigFile("./", target);

        expect(actual).toBe("./tsconfig.json");
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

        expect(actual).toBe("/sass.config.js");
    });

    it("returns file name with path to custom existing file", () => {
        const target = createBrowserSystem({ "expected.js": `{}` });

        const actual = findSassConfig("expected.js", target);

        expect(actual).toBe("/expected.js");
    });

    it("throws error with no existing config file", () => {
        const target = createBrowserSystem({});

        expect(() => findSassConfig("sass.config.js", target)).toThrow("Could not find a valid 'sass.config.js'.");
    });
});
