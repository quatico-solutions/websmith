/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compileSystem } from "@quatico/websmith-testing";
import { findConfigFile, findSassConfig } from "./find-config";

describe("findConfigFile", () => {
    it("returns file name with path to existing file", () => {
        const { fileSystem: target } = compileSystem(
            {
                "tsconfig.json": JSON.stringify({}),
            },
            { withDefaultFiles: false }
        );

        const actual = findConfigFile("./", target);

        expect(actual).toBe("./tsconfig.json");
    });

    it("throws error with no existing config file", () => {
        const { fileSystem: target } = compileSystem({}, { withDefaultFiles: false });

        expect(() => findConfigFile("./", target)).toThrow("Could not find a valid 'tsconfig.json'.");
    });
});

describe("findSassConfig", () => {
    it("returns file name with path to existing file", () => {
        const { fileSystem: target } = compileSystem({ "sass.config.js": `{}` });

        const actual = findSassConfig("sass.config.js", target);

        expect(actual).toBe("/sass.config.js");
    });

    it("returns file name with path to custom existing file", () => {
        const { fileSystem: target } = compileSystem({ "expected.js": `{}` });

        const actual = findSassConfig("expected.js", target);

        expect(actual).toBe("/expected.js");
    });

    it("throws error with no existing config file", () => {
        const { fileSystem: target } = compileSystem();

        expect(() => findSassConfig("sass.config.js", target)).toThrow("Could not find a valid 'sass.config.js'.");
    });
});
