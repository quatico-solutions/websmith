/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createSystem } from "../environment";
import { ignoreConfigFiles, recursiveFindByFilter } from "./system";

describe("recursiveFindByFilter", () => {
    it("should find files", () => {
        const fileSystem = createSystem(
            {
                "test.ts": "console.log('test');",
            },
            { virtual: true }
        );

        const actual = recursiveFindByFilter(".", (name: string) => name.endsWith(".ts"), fileSystem);

        expect(actual).toEqual(["/test.ts"]);
    });

    it("should find files in subdirectories", () => {
        const fileSystem = createSystem(
            {
                "subdir/test.ts": "console.log('test');",
            },
            { virtual: true }
        );

        const actual = recursiveFindByFilter(".", (name: string) => name.endsWith(".ts"), fileSystem);

        expect(actual).toEqual(["/subdir/test.ts"]);
    });

    it("should find files in subdirectories with absolute paths", () => {
        const fileSystem = createSystem(
            {
                "/target/tsconfig.json": "{}",
                "/target/addons/expected-addon/addon.ts": "console.log('test')",
            },
            { virtual: true }
        );

        const actual = recursiveFindByFilter(".", (name: string) => name.endsWith(".ts"), fileSystem);

        expect(actual).toEqual(["/target/addons/expected-addon/addon.ts"]);
    });
});

describe("ignoreConfigFiles", () => {
    it("should ignore config files", () => {
        expect(ignoreConfigFiles("tsconfig.json")).toBe(false);
        expect(ignoreConfigFiles("tsconfig.prod.json")).toBe(false);
        expect(ignoreConfigFiles("websmith.config.json")).toBe(false);
        expect(ignoreConfigFiles("websmith.config.prod.json")).toBe(false);
        expect(ignoreConfigFiles("test.ts")).toBe(true);
    });
});
