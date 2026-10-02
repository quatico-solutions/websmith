/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createSystem } from "../environment";
import ts from "typescript";
import { createVersionedFile, ignoreConfigFiles, recursiveFindByFilter } from "./system";

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

describe("createVersionedFile", () => {
    it.each([
        ["node16", { module: ts.ModuleKind.Node16 }, ts.ScriptTarget.ES2022],
        ["nodenext", { module: ts.ModuleKind.NodeNext }, ts.ScriptTarget.ESNext],
        ["nothing", {}, ts.getDefaultCompilerOptions().target],
        ["nodenext and target ES5", { module: ts.ModuleKind.NodeNext, target: ts.ScriptTarget.ES5 }, ts.ScriptTarget.ES5],
    ])("yields source file with effective target w/ %s set", (_name, tsConfig, expected) => {
        const actual = createVersionedFile("/src/target.ts", "export const x = 1;", tsConfig);

        expect(actual.languageVersion).toBe(expected);
    });
});
