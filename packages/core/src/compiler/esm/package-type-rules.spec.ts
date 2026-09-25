/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { ModuleClassification } from "./classify-module";
import { checkPackageType } from "./package-type-rules";
import { scanModule } from "./scan-module";

const codesOf = (fileName: string, content: string, classification: ModuleClassification): number[] =>
    checkPackageType(fileName, classification, scanModule(fileName, content)).map(cur => cur.code);

describe("checkPackageType", () => {
    it("yields 91030 w/ export in .cjs file loaded as commonjs", () => {
        const actual = codesOf("/dist/target.cjs", `export const x = 1;`, { kind: "commonjs", typeMissing: false });

        expect(actual).toEqual([91030]);
    });

    it("yields 91030 w/ export in .cjs file loaded as dynamic", () => {
        const actual = codesOf("/dist/target.cjs", `export const x = 1;`, { kind: "dynamic", typeMissing: false });

        expect(actual).toEqual([91030]);
    });

    it("yields 91030 w/ only import.meta in .cjs file", () => {
        const actual = codesOf("/dist/target.cjs", `console.log(import.meta.url);`, { kind: "commonjs", typeMissing: false });

        expect(actual).toEqual([91030]);
    });

    it("yields nothing w/ dynamic import in async function in .cjs file", () => {
        const actual = codesOf("/dist/target.cjs", `async function f() { await import("./x.mjs"); }`, { kind: "commonjs", typeMissing: false });

        expect(actual).toEqual([]);
    });

    it("yields 91030 located at first ESM construct", () => {
        const [actual] = checkPackageType(
            "/dist/target.cjs",
            { kind: "commonjs", typeMissing: false },
            scanModule("/dist/target.cjs", `const a = 1;\nexport { a };`)
        );

        expect([actual.start, actual.length]).toEqual([13, 6]);
    });

    it("yields 91030 message with fix hint", () => {
        const [actual] = checkPackageType(
            "/dist/target.cjs",
            { kind: "commonjs", typeMissing: false },
            scanModule("/dist/target.cjs", `export const x = 1;`)
        );

        expect(actual.message).toBe(`ES module syntax in a .cjs file, which is loaded as CommonJS; rename to ".mjs" or emit CommonJS`);
    });

    it("yields 91031 w/ export in .js file under commonjs package", () => {
        const actual = codesOf("/dist/target.js", `export const x = 1;`, { kind: "commonjs", typeMissing: false, packageJson: "/package.json" });

        expect(actual).toEqual([91031]);
    });

    it("yields 91031 w/ import in .js file loaded as dynamic", () => {
        const actual = codesOf("/dist/target.js", `import x from "y";`, { kind: "dynamic", typeMissing: false, packageJson: "/package.json" });

        expect(actual).toEqual([91031]);
    });

    it("yields 91031 message naming package.json", () => {
        const [actual] = checkPackageType(
            "/dist/target.js",
            { kind: "commonjs", typeMissing: false, packageJson: "/project/package.json" },
            scanModule("/dist/target.js", `export const x = 1;`)
        );

        expect(actual.message).toBe(
            `ES module syntax in a .js file that "/project/package.json" declares "type": "commonjs"; ` +
                `set "type": "module" in "/project/package.json" or rename to ".mjs"`
        );
    });

    it("yields nothing w/ ESM syntax in .js file loaded as esm", () => {
        const actual = codesOf("/dist/target.js", `export const x = 1;`, { kind: "esm", typeMissing: true });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ ESM syntax in .js file loaded as auto", () => {
        const actual = codesOf("/dist/target.js", `export const x = 1;\nawait x;`, { kind: "auto", typeMissing: false });

        expect(actual).toEqual([]);
    });

    it("yields 91033 w/ top-level await in file loaded as commonjs", () => {
        const actual = codesOf("/dist/target.js", `const x = await load();`, { kind: "commonjs", typeMissing: false, packageJson: "/package.json" });

        expect(actual).toEqual([91033]);
    });

    it("yields 91033 w/ top-level for await in .cjs file loaded as dynamic", () => {
        const actual = codesOf("/dist/target.cjs", `for await (const x of load()) {}`, { kind: "dynamic", typeMissing: false });

        expect(actual).toEqual([91033]);
    });

    it("yields nothing w/ await in async function in file loaded as commonjs", () => {
        const actual = codesOf("/dist/target.cjs", `async function f() { await load(); }`, { kind: "commonjs", typeMissing: false });

        expect(actual).toEqual([]);
    });

    it("yields 91033 located at await keyword with fix hint", () => {
        const [actual] = checkPackageType(
            "/dist/target.cjs",
            { kind: "commonjs", typeMissing: false },
            scanModule("/dist/target.cjs", `const x = await load();`)
        );

        expect([actual.start, actual.length, actual.message]).toEqual([
            10,
            5,
            `top-level "await" in a file loaded as CommonJS; wrap in an async function or load as ESM`,
        ]);
    });

    it("yields 91032 w/ module.exports assignment in file loaded as esm", () => {
        const actual = codesOf("/dist/target.js", `module.exports = 42;`, { kind: "esm", typeMissing: false, packageJson: "/package.json" });

        expect(actual).toEqual([91032]);
    });

    it("yields one 91032 w/ TypeScript CommonJS output in .mjs file", () => {
        const actual = codesOf(
            "/dist/target.mjs",
            `"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports.b = exports.a = void 0;\nexports.a = 1;\nexports.b = require("./b");`,
            { kind: "esm", typeMissing: false }
        );

        expect(actual).toEqual([91032]);
    });

    it("yields 91032 w/ only __esModule marker in file loaded as esm", () => {
        const actual = codesOf("/dist/target.js", `Object.defineProperty(exports, "__esModule", { value: true });`, {
            kind: "esm",
            typeMissing: false,
        });

        expect(actual).toEqual([91032]);
    });

    it("yields 91032 located at first CommonJS export with fix hint", () => {
        const [actual] = checkPackageType(
            "/dist/target.js",
            { kind: "esm", typeMissing: false },
            scanModule("/dist/target.js", `const x = 1;\nexports.x = x;`)
        );

        expect([actual.start, actual.length, actual.message]).toEqual([
            13,
            7,
            `file loaded as ES module whose output is CommonJS; set "module" to an ES module format, ` +
                `and note that under the fast path transpileModule ignores "type"`,
        ]);
    });

    it("yields nothing w/ exports read in file loaded as esm", () => {
        const actual = codesOf("/dist/target.js", `use(exports.x);`, { kind: "esm", typeMissing: false });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ ESM syntax mixed with module.exports in file loaded as esm", () => {
        const actual = codesOf("/dist/target.js", `import x from "y";\nmodule.exports = x;`, { kind: "esm", typeMissing: false });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ CommonJS output in file loaded as auto", () => {
        const actual = codesOf("/dist/target.js", `module.exports = 42;`, { kind: "auto", typeMissing: false });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ CommonJS output in file loaded as commonjs", () => {
        const actual = codesOf("/dist/target.cjs", `module.exports = 42;`, { kind: "commonjs", typeMissing: false });

        expect(actual).toEqual([]);
    });
});
