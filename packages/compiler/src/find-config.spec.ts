/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compileSystem } from "@quatico/websmith-testing";
import { findConfigFile } from "./find-config";

describe("findConfigFile", () => {
    it("returns file name with path to existing file", () => {
        const { fileSystem: target } = compileSystem({
            buildDir: "./",
            files: {
                "tsconfig.json": "{}",
            },
            addLibDefaults: false,
        });

        const actual = findConfigFile("./", target);

        expect(actual).toBe("./tsconfig.json");
    });

    it("throws error with no existing config file", () => {
        const { fileSystem: target } = compileSystem({ buildDir: "./", addLibDefaults: false });

        expect(() => findConfigFile("./", target)).toThrow("Could not find a valid 'tsconfig.json'.");
    });
});
