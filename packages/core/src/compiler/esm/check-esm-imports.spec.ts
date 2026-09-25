/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { EsmProfileOptions } from "@quatico/websmith-api";
import ts from "typescript";
import { createSystem } from "../../environment";
import { NoReporter } from "../NoReporter";
import { checkEsm } from "./check-esm";

const MODULE_PACKAGE = { "/package.json": JSON.stringify({ type: "module" }) };

const IMPORT_VIOLATIONS = `import "./b";\nimport "./utils";\nimport "./gone.js";\nimport data from "./d.json";`;
const UTILS_ON_DISK = { ...MODULE_PACKAGE, "/dist/utils/index.js": "", "/dist/d.json": "{}" };

const output = (name: string, text = ""): ts.OutputFile => ({ name, text, writeByteOrderMark: false });

const codesOf = (files: ts.OutputFile[], esm: EsmProfileOptions, onDisk: Record<string, string> = MODULE_PACKAGE): number[] =>
    checkEsm(files, esm, { system: createSystem(onDisk, { virtual: true }), reporter: new NoReporter(), projectDir: "/" }).map(cur => cur.code);

describe("checkEsm w/ relative imports", () => {
    it("yields 91011 w/ import of directory with index.js in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `import "./b";`), output("/dist/b/index.js")], { runtime: "node" });

        expect(actual).toEqual([91011]);
    });

    it("yields 91010 w/ extensionless re-export in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `export { x } from "./b";`), output("/dist/b.js", `export const x = 1;`)], {
            runtime: "node",
        });

        expect(actual).toEqual([91010]);
    });

    it("yields 91010 w/ extensionless literal dynamic import in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `await import("./b");`), output("/dist/b.js")], { runtime: "node" });

        expect(actual).toEqual([91010]);
    });

    it("yields nothing w/ non-literal dynamic import in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `const name = "./b";\nawait import(name);`)], { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ import of file on disk not written this run in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `import "./b.js";`)], { runtime: "node" }, { ...MODULE_PACKAGE, "/dist/b.js": "" });

        expect(actual).toEqual([]);
    });

    it("yields 91012 w/ import of missing file in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `import "./gone.js";`)], { runtime: "node" });

        expect(actual).toEqual([91012]);
    });

    it("yields 91013 w/ JSON import without attribute in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `import data from "./d.json";`), output("/dist/d.json", `{}`)], { runtime: "node" });

        expect(actual).toEqual([91013]);
    });

    it("yields nothing w/ JSON import without attribute in bundler ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `import data from "./d.json";`), output("/dist/d.json", `{}`)], { runtime: "bundler" });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ JSON import with type json attribute in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `import data from "./d.json" with { type: "json" };`), output("/dist/d.json", `{}`)], {
            runtime: "node",
        });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ extensionless import in bundler auto output", () => {
        const actual = codesOf([output("/dist/target.js", `import "./b";`), output("/dist/b.js")], { runtime: "bundler" }, {});

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ bare specifier in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", `import x from "pkg";`)], { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ require of extensionless relative path in bundler .cjs output", () => {
        const actual = codesOf([output("/dist/target.cjs", `require("./b");`)], { runtime: "bundler" });

        expect(actual).toEqual([]);
    });

    it("yields warnings w/ check warn and every import rule violated in node ESM output", () => {
        const actual = checkEsm(
            [
                output("/dist/target.js", `import "./b";\nimport "./utils";\nimport "./gone.js";\nimport data from "./d.json";`),
                output("/dist/d.json", `{}`),
            ],
            { runtime: "node", check: "warn" },
            {
                system: createSystem({ ...MODULE_PACKAGE, "/dist/utils/index.js": "" }, { virtual: true }),
                reporter: new NoReporter(),
                projectDir: "/",
            }
        ).map(cur => [cur.code, cur.category]);

        expect(actual).toEqual([
            [91010, ts.DiagnosticCategory.Warning],
            [91011, ts.DiagnosticCategory.Warning],
            [91012, ts.DiagnosticCategory.Warning],
            [91013, ts.DiagnosticCategory.Warning],
        ]);
    });

    it("yields nothing w/ check off and every import rule violated in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", IMPORT_VIOLATIONS)], { runtime: "node", check: "off" }, UTILS_ON_DISK);

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ file matching ignore pattern and every import rule violated in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", IMPORT_VIOLATIONS)], { runtime: "node", ignore: ["dist/*.js"] }, UTILS_ON_DISK);

        expect(actual).toEqual([]);
    });

    it("yields every import rule w/ file not matching ignore pattern in node ESM output", () => {
        const actual = codesOf([output("/dist/target.js", IMPORT_VIOLATIONS)], { runtime: "node", ignore: ["dist/legacy/*.js"] }, UTILS_ON_DISK);

        expect(actual).toEqual([91010, 91011, 91012, 91013]);
    });

    it("yields nothing w/ extensionless import in node .cjs output", () => {
        const actual = codesOf([output("/dist/target.cjs", `import "./b";`)], { runtime: "node" });

        expect(actual).toEqual([]);
    });
});
