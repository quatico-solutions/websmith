/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { scanModule } from "./scan-module";

const ESBUILD_BUNDLE =
    `var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);\n` +
    `var require_dep = __commonJS((exports, module) => {\n` +
    `  Object.defineProperty(exports, "__esModule", { value: true });\n` +
    `  exports.a = 1;\n` +
    `  module.exports.b = 2;\n` +
    `});\n` +
    `console.log(require_dep().a);`;

const freeNames = (content: string): string[] => scanModule("/dist/target.js", content).freeReferences.map(cur => cur.name);

describe("scanModule", () => {
    it("yields free require w/ require call", () => {
        const actual = freeNames(`const x = require("x");`);

        expect(actual).toEqual(["require"]);
    });

    it("yields all free CommonJS names w/ module, exports, __dirname and __filename", () => {
        const actual = freeNames(`module.id; exports.id; console.log(__dirname, __filename);`);

        expect(actual).toEqual(["module", "exports", "__dirname", "__filename"]);
    });

    it("yields nothing w/ createRequire declaration", () => {
        const actual = freeNames(`import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\nrequire("x");`);

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ __dirname declared from import.meta.url", () => {
        const actual = freeNames(
            `import path from "node:path";\nimport { fileURLToPath } from "node:url";\nconst __dirname = path.dirname(fileURLToPath(import.meta.url));\nconsole.log(__dirname);`
        );

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ typeof guarded require in conditional expression", () => {
        const actual = freeNames(`const x = typeof require !== "undefined" ? require("x") : null;`);

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ typeof guarded module in UMD if statement", () => {
        const actual = freeNames(`if (typeof module === "object" && typeof module.exports === "object") { module.exports = factory(); }`);

        expect(actual).toEqual([]);
    });

    it("yields free require w/ require after || of typeof function test", () => {
        const actual = freeNames(`typeof require === "function" || require("x");`);

        expect(actual).toEqual(["require"]);
    });

    it("yields free require w/ require after && of typeof undefined test", () => {
        const actual = freeNames(`typeof require === "undefined" && require("x");`);

        expect(actual).toEqual(["require"]);
    });

    it("yields free require w/ require in true branch of typeof undefined conditional", () => {
        const actual = freeNames(`const x = typeof require === "undefined" ? require("x") : null;`);

        expect(actual).toEqual(["require"]);
    });

    it("yields free require w/ require in else branch of typeof defined if statement", () => {
        const actual = freeNames(`if (typeof require !== "undefined") { load(); } else { require("x"); }`);

        expect(actual).toEqual(["require"]);
    });

    it("yields free require w/ require after || of negated typeof undefined test", () => {
        const actual = freeNames(`!(typeof require === "undefined") || require("x");`);

        expect(actual).toEqual(["require"]);
    });

    it("yields nothing w/ require after && of negated typeof undefined test", () => {
        const actual = freeNames(`!(typeof require === "undefined") && require("x");`);

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ require after && of typeof function test", () => {
        const actual = freeNames(`typeof require === "function" && require("x");`);

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ require after || of typeof undefined test", () => {
        const actual = freeNames(`typeof require === "undefined" || require("x");`);

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ require in then branch of typeof defined if statement", () => {
        const actual = freeNames(`if (typeof require !== "undefined") { require("x"); }`);

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ typeof guarded module in UMD conditional expression", () => {
        const actual = freeNames(`const x = typeof module === "object" && module.exports ? module.exports : factory();`);

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ exports as property name", () => {
        const actual = freeNames(`const obj = { exports: {}, require: 1 }; obj.exports.x = 1; obj.require;`);

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ require as function parameter", () => {
        const actual = freeNames(`function load(require) { return require("x"); }`);

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ exports as destructured variable", () => {
        const actual = freeNames(`const { exports } = pkg; exports.x = 1;`);

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ require as catch clause variable", () => {
        const actual = freeNames(`try { x(); } catch (require) { require("x"); }`);

        expect(actual).toEqual([]);
    });

    it("yields free require w/ declaration in sibling block", () => {
        const actual = freeNames(`{ const require = createRequire(import.meta.url); }\nrequire("x");`);

        expect(actual).toEqual(["require"]);
    });

    it("yields free module w/ var declaration in other function", () => {
        const actual = freeNames(`function other() { var module = {}; }\nmodule.exports = 1;`);

        expect(actual).toEqual(["module"]);
    });

    it("yields nothing w/ var declaration hoisted from nested block", () => {
        const actual = freeNames(`function f() { if (x) { var require = load; } return require("x"); }`);

        expect(actual).toEqual([]);
    });

    it("yields location of free reference", () => {
        const [actual] = scanModule("/dist/target.js", `const x = require("x");`).freeReferences;

        expect([actual.start, actual.length]).toEqual([10, 7]);
    });

    it("yields source file of scanned content", () => {
        const actual = scanModule("/dist/target.js", `whatever;`).file.fileName;

        expect(actual).toBe("/dist/target.js");
    });

    it("yields CommonJS export w/ module.exports assignment", () => {
        const actual = scanModule("/dist/target.js", `module.exports = x;`).freeReferences.map(cur => cur.commonJsExport);

        expect(actual).toEqual([true]);
    });

    it("yields CommonJS export w/ exports property assignment", () => {
        const actual = scanModule("/dist/target.js", `exports.x = 1; exports["y"] = 2;`).freeReferences.map(cur => cur.commonJsExport);

        expect(actual).toEqual([true, true]);
    });

    it("yields no CommonJS export w/ exports read", () => {
        const actual = scanModule("/dist/target.js", `use(exports.x);`).freeReferences.map(cur => cur.commonJsExport);

        expect(actual).toEqual([false]);
    });

    it("yields ESM syntax w/ import declaration", () => {
        const actual = scanModule("/dist/target.js", `import x from "y";`).hasEsmSyntax;

        expect(actual).toBe(true);
    });

    it("yields ESM syntax w/ exported variable", () => {
        const actual = scanModule("/dist/target.js", `export const x = 1;`).hasEsmSyntax;

        expect(actual).toBe(true);
    });

    it("yields ESM syntax w/ import.meta", () => {
        const actual = scanModule("/dist/target.js", `console.log(import.meta.url);`).hasEsmSyntax;

        expect(actual).toBe(true);
    });

    it("yields ESM syntax w/ top-level await", () => {
        const actual = scanModule("/dist/target.js", `const x = await load();`).hasEsmSyntax;

        expect(actual).toBe(true);
    });

    it("yields ESM syntax w/ top-level for await", () => {
        const actual = scanModule("/dist/target.js", `for await (const x of load()) {}`).hasEsmSyntax;

        expect(actual).toBe(true);
    });

    it("yields no ESM syntax w/ await in async function", () => {
        const actual = scanModule("/dist/target.js", `async function f() { await load(); for await (const x of load()) {} }`).hasEsmSyntax;

        expect(actual).toBe(false);
    });

    it("yields no ESM syntax w/ script and dynamic import", () => {
        const actual = scanModule("/dist/target.js", `const x = 1; import("y");`).hasEsmSyntax;

        expect(actual).toBe(false);
    });

    it("yields location of first ESM construct w/ import declaration after statement", () => {
        const actual = scanModule("/dist/target.js", `const a = 1;\nimport x from "y";\nexport const b = x;`).esmSyntax;

        expect(actual).toEqual({ start: 13, length: 6 });
    });

    it("yields location of export keyword w/ exported function", () => {
        const actual = scanModule("/dist/target.js", `export function f() {}`).esmSyntax;

        expect(actual).toEqual({ start: 0, length: 6 });
    });

    it("yields location of import.meta w/ import.meta only", () => {
        const actual = scanModule("/dist/target.js", `use(import.meta.url);`).esmSyntax;

        expect(actual).toEqual({ start: 4, length: 11 });
    });

    it("yields no ESM construct location w/ top-level await only", () => {
        const actual = scanModule("/dist/target.js", `const x = await load();`).esmSyntax;

        expect(actual).toBeUndefined();
    });

    it("yields no ESM construct location w/ dynamic import in async function", () => {
        const actual = scanModule("/dist/target.js", `async function f() { await import("./x.mjs"); }`).esmSyntax;

        expect(actual).toBeUndefined();
    });

    it("yields location of top-level await", () => {
        const actual = scanModule("/dist/target.js", `const x = await load();`).topLevelAwait;

        expect(actual).toEqual({ start: 10, length: 5 });
    });

    it("yields location of await keyword w/ top-level for await", () => {
        const actual = scanModule("/dist/target.js", `for await (const x of load()) {}`).topLevelAwait;

        expect(actual).toEqual({ start: 4, length: 5 });
    });

    it("yields no top-level await w/ await in async function", () => {
        const actual = scanModule("/dist/target.js", `async function f() { await load(); for await (const x of load()) {} }`).topLevelAwait;

        expect(actual).toBeUndefined();
    });

    it("yields ES module marker w/ Object.defineProperty on exports", () => {
        const actual = scanModule("/dist/target.js", `"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });`).esModuleMarker;

        expect(actual).toEqual({ start: 14, length: 61 });
    });

    it("yields ES module marker w/ __esModule property assignment", () => {
        const actual = scanModule("/dist/target.js", `exports.__esModule = true;`).esModuleMarker;

        expect(actual).toEqual({ start: 0, length: 25 });
    });

    it("yields no ES module marker w/ __esModule read", () => {
        const actual = scanModule("/dist/target.js", `use(x.__esModule);`).esModuleMarker;

        expect(actual).toBeUndefined();
    });

    it("yields no ES module marker w/ marker in typeof exports guard", () => {
        const actual = scanModule(
            "/dist/target.js",
            `if (typeof exports === "object") { Object.defineProperty(exports, "__esModule", { value: true }); exports.a = 1; }`
        ).esModuleMarker;

        expect(actual).toBeUndefined();
    });

    it("yields no ES module marker w/ exports as function parameter", () => {
        const actual = scanModule(
            "/dist/target.js",
            `function f(exports) { Object.defineProperty(exports, "__esModule", { value: true }); exports.x = 1; return exports; }`
        ).esModuleMarker;

        expect(actual).toBeUndefined();
    });

    it("yields no ES module marker w/ esbuild __commonJS wrapper", () => {
        const actual = scanModule("/dist/target.js", ESBUILD_BUNDLE).esModuleMarker;

        expect(actual).toBeUndefined();
    });

    it("yields ES module marker w/ module.exports.__esModule assignment", () => {
        const actual = scanModule("/dist/target.js", `module.exports.__esModule = true;`).esModuleMarker;

        expect(actual).toEqual({ start: 0, length: 32 });
    });
});
