/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createSystem } from "../environment";
import ts from "typescript";
import { createVersionedFile, ignoreConfigFiles, recursiveFindByFilter } from "./system";

const isTs5 = Number(ts.versionMajorMinor.split(".")[0]) < 6;
const describeOnTs5 = isTs5 ? describe : describe.skip;
const describeOnTs6 = isTs5 ? describe.skip : describe;
// ES2025; ts.ScriptTarget.ES2025 is undefined on TypeScript 5
const DEFAULT_TARGET = isTs5 ? ts.ScriptTarget.ES5 : (12 as ts.ScriptTarget);

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
        ["nothing", {}, DEFAULT_TARGET],
        ["nodenext and target ES5", { module: ts.ModuleKind.NodeNext, target: ts.ScriptTarget.ES5 }, ts.ScriptTarget.ES5],
    ])("yields source file with effective target w/ %s set", (_name, tsConfig, expected) => {
        const actual = createVersionedFile("/src/target.ts", "export const x = 1;", tsConfig);

        expect(actual.languageVersion).toBe(expected);
    });

    describeOnTs5("on TypeScript 5", () => {
        it.each([
            ["node16", { module: ts.ModuleKind.Node16 }, ts.ScriptTarget.ES2022],
            ["nodenext", { module: ts.ModuleKind.NodeNext }, ts.ScriptTarget.ESNext],
        ])("yields source file with the target derived from module w/ %s set", (_name, tsConfig, expected) => {
            const actual = createVersionedFile("/src/target.ts", "export const x = 1;", tsConfig);

            expect(actual.languageVersion).toBe(expected);
        });
    });

    describeOnTs6("on TypeScript 6", () => {
        it.each([
            ["node16", { module: ts.ModuleKind.Node16 }],
            ["nodenext", { module: ts.ModuleKind.NodeNext }],
        ])("yields source file with the TypeScript default target w/ %s set", (_name, tsConfig) => {
            const actual = createVersionedFile("/src/target.ts", "export const x = 1;", tsConfig);

            expect(actual.languageVersion).toBe(DEFAULT_TARGET);
        });
    });
});
