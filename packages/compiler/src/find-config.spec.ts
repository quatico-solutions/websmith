/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createSystem } from "@quatico/websmith-core";
import { findConfigFile } from "./find-config";

describe("findConfigFile", () => {
    it("returns file name with path to existing file", () => {
        const target = createSystem(
            {
                "./tsconfig.json": "{}",
            },
            { virtual: true }
        );

        const actual = findConfigFile("./", target);

        expect(actual).toBe("./tsconfig.json");
        expect(target.readFile("./tsconfig.json")).toBe("{}");
    });

    it("throws error with no existing config file", () => {
        const target = createSystem({}, { virtual: true });

        expect(() => findConfigFile("./", target)).toThrow("Could not find a valid 'tsconfig.json'.");
    });
});
