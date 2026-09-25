/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { InfoMessage, type EsmProfileOptions } from "@quatico/websmith-api";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { NoReporter } from "../NoReporter";
import { checkEsm, type EsmCheckContext } from "./check-esm";
import { createCjsNamesCache } from "./cjs-names";

const MODULE_PACKAGE = JSON.stringify({ type: "module" });

const TS_CJS = [
    `"use strict";`,
    `Object.defineProperty(exports, "__esModule", { value: true });`,
    `exports.named = void 0;`,
    `exports.default = def;`,
    `exports.named = 1;`,
    `function def() { }`,
].join("\n");

const TS_EXPORT_STAR = [
    `"use strict";`,
    `var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {`,
    `    if (k2 === undefined) k2 = k;`,
    `    var desc = Object.getOwnPropertyDescriptor(m, k);`,
    `    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {`,
    `      desc = { enumerable: true, get: function() { return m[k]; } };`,
    `    }`,
    `    Object.defineProperty(o, k2, desc);`,
    `}) : (function(o, m, k, k2) {`,
    `    if (k2 === undefined) k2 = k;`,
    `    o[k2] = m[k];`,
    `}));`,
    `var __exportStar = (this && this.__exportStar) || function(m, exports) {`,
    `    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);`,
    `};`,
    `Object.defineProperty(exports, "__esModule", { value: true });`,
    `__exportStar(require("./inner"), exports);`,
].join("\n");

const PACKAGES: Record<string, string> = {
    "node_modules/tscjs/package.json": JSON.stringify({ name: "tscjs", main: "index.js" }),
    "node_modules/tscjs/index.js": TS_CJS,
    "node_modules/objcjs/package.json": JSON.stringify({ name: "objcjs" }),
    "node_modules/objcjs/index.js": `module.exports = Object.assign({}, { a: 1 });`,
    "node_modules/plaincjs/package.json": JSON.stringify({ name: "plaincjs", main: "lib/main.js" }),
    "node_modules/plaincjs/lib/main.js": `module.exports = function def() {};`,
    "node_modules/starcjs/package.json": JSON.stringify({ name: "starcjs", main: "index.js" }),
    "node_modules/starcjs/index.js": TS_EXPORT_STAR,
    "node_modules/starcjs/inner.js": `"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports.fromInner = 1;`,
    "node_modules/dual/package.json": JSON.stringify({
        name: "dual",
        exports: { ".": { import: "./esm/index.mjs", require: "./cjs/index.js" } },
    }),
    "node_modules/dual/esm/index.mjs": `export const onlyInEsm = 1;`,
    "node_modules/dual/cjs/index.js": `module.exports = Object.assign({}, { onlyInCjs: 1 });`,
    "node_modules/esmpkg/package.json": JSON.stringify({ name: "esmpkg", type: "module", main: "index.js" }),
    "node_modules/esmpkg/index.js": `export default 1;`,
    "node_modules/@scope/scoped/package.json": JSON.stringify({ name: "@scope/scoped", exports: { "./sub": "./sub.js" } }),
    "node_modules/@scope/scoped/sub.js": `module.exports = Object.assign({}, { a: 1 });`,
    "node_modules/brokenstar/package.json": JSON.stringify({ name: "brokenstar" }),
    "node_modules/brokenstar/index.js": `module.exports = require("./missing");`,
    "node_modules/cycle/package.json": JSON.stringify({ name: "cycle" }),
    "node_modules/cycle/index.js": `exports.first = 1;\nmodule.exports = require("./other");`,
    "node_modules/cycle/other.js": `exports.second = 1;\nmodule.exports = require("./index");`,
    "node_modules/tsnodef/package.json": JSON.stringify({ name: "tsnodef" }),
    "node_modules/tsnodef/index.js": `"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports.named = 1;`,
    "node_modules/modsync/package.json": JSON.stringify({ name: "modsync", exports: { "module-sync": "./esm.mjs", default: "./cjs.js" } }),
    "node_modules/modsync/esm.mjs": `export const onlyEsm = 1;`,
    "node_modules/modsync/cjs.js": `module.exports = Object.assign({}, { onlyCjs: 1 });`,
    "node_modules/mainmod/package.json": JSON.stringify({ name: "mainmod", main: "cjs/index.js", module: "esm/index.js" }),
    "node_modules/mainmod/cjs/index.js": TS_CJS,
    "node_modules/mainmod/esm/index.js": `export default function def() {}`,
};

const roots: string[] = [];

afterAll(() => roots.forEach(cur => fs.rmSync(cur, { recursive: true, force: true })));

const createProject = (files: Record<string, string>): string => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "websmith-cjs-names-")));
    roots.push(root);
    Object.entries(files).forEach(([name, content]) => {
        const fileName = path.join(root, name);
        fs.mkdirSync(path.dirname(fileName), { recursive: true });
        fs.writeFileSync(fileName, content);
    });
    return root;
};

const createContext = (projectDir: string, overrides: Partial<EsmCheckContext> = {}): EsmCheckContext => ({
    system: ts.sys,
    reporter: new NoReporter(),
    projectDir,
    ...overrides,
});

const output = (name: string, text: string): ts.OutputFile => ({ name, text, writeByteOrderMark: false });

const check = (
    text: string,
    esm: EsmProfileOptions,
    projectPackage: string | undefined = MODULE_PACKAGE,
    overrides: Partial<EsmCheckContext> = {}
) => {
    const root = createProject({ ...PACKAGES, ...(projectPackage !== undefined && { "package.json": projectPackage }) });
    return checkEsm([output(path.join(root, "dist", "main.js"), text)], esm, createContext(root, overrides));
};

const codesOf = (text: string, esm: EsmProfileOptions, projectPackage?: string): number[] => check(text, esm, projectPackage).map(cur => cur.code);

describe("checkEsm CommonJS names", () => {
    it("yields nothing w/ named import of TypeScript-compiled CommonJS export in node output", () => {
        const actual = codesOf(`import { named } from "tscjs";`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields 91020 w/ named import missing from module.exports object in node output", () => {
        const actual = codesOf(`import { a } from "objcjs";`, { runtime: "node" });

        expect(actual).toEqual([91020]);
    });

    it("yields 91020 per missing name w/ renamed and default imports in node output", () => {
        const actual = codesOf(`import { default as def, a as b, c } from "objcjs";`, { runtime: "node" });

        expect(actual).toEqual([91020, 91020]);
    });

    it("yields 91020 w/ re-export of missing name in node output", () => {
        const actual = codesOf(`export { a } from "objcjs";`, { runtime: "node" });

        expect(actual).toEqual([91020]);
    });

    it("yields nothing w/ named import re-exported through __exportStar in node output", () => {
        const actual = codesOf(`import { fromInner } from "starcjs";`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ named import from dual package whose import condition points at ESM entry in node output", () => {
        const actual = codesOf(`import { onlyInEsm } from "dual";`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ named import from ESM package in node output", () => {
        const actual = codesOf(`import { missing } from "esmpkg";`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields 91020 w/ missing name in scoped package subpath from exports in node output", () => {
        const actual = codesOf(`import { b } from "@scope/scoped/sub";`, { runtime: "node" });

        expect(actual).toEqual([91020]);
    });

    it("yields nothing w/ named import missing from CommonJS package in bundler ESM output", () => {
        const actual = codesOf(`import { a } from "objcjs";`, { runtime: "bundler" });

        expect(actual).toEqual([]);
    });

    it("yields 91021 w/ default import from __esModule package in node output", () => {
        const actual = codesOf(`import def from "tscjs";\ndef();`, { runtime: "node" });

        expect(actual).toEqual([91021]);
    });

    it("yields 91021 w/ default and named import from __esModule package in node output", () => {
        const actual = codesOf(`import def, { named } from "tscjs";\ndef(named);`, { runtime: "node" });

        expect(actual).toEqual([91021]);
    });

    it("yields 91021 w/ default import from __esModule package in bundler ESM output", () => {
        const actual = codesOf(`import def from "tscjs";\ndef();`, { runtime: "bundler" });

        expect(actual).toEqual([91021]);
    });

    it("yields nothing w/ default import from __esModule package in bundler auto output", () => {
        const actual = codesOf(`import def from "tscjs";\ndef();`, { runtime: "bundler" }, JSON.stringify({}));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ default import from plain CommonJS package in node output", () => {
        const actual = codesOf(`import def from "plaincjs";\ndef();`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ named import from CommonJS package in node output under commonjs package", () => {
        const actual = codesOf(`import { a } from "objcjs";`, { runtime: "node" }, JSON.stringify({ type: "commonjs" }));

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ named import from not installed package in node output", () => {
        const actual = codesOf(`import { x } from "not-installed";`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ named import through unresolvable re-export in node output", () => {
        const actual = codesOf(`import { x } from "brokenstar";`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields 91020 w/ names collected across re-export cycle in node output", () => {
        const actual = codesOf(`import { first, second, third } from "cycle";`, { runtime: "node" });

        expect(actual).toEqual([91020]);
    });

    it("yields nothing w/ imports of builtin modules in node output", () => {
        const actual = codesOf(`import { readFile } from "node:fs";\nimport { join } from "path";`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ default import of __esModule package used through property access only in node output", () => {
        const actual = codesOf(`import pkg from "tscjs";\nconsole.log(pkg.named, pkg["named"], pkg?.named);`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ default import of __esModule package calling its default property in node output", () => {
        const actual = codesOf(`import pkg from "tscjs";\npkg.default();`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ unused default import of __esModule package in node output", () => {
        const actual = codesOf(`import pkg from "tscjs";`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields 91021 w/ default import of __esModule package passed as argument in node output", () => {
        const actual = codesOf(`import pkg from "tscjs";\nfn(pkg.named, pkg);`, { runtime: "node" });

        expect(actual).toEqual([91021]);
    });

    it("yields 91021 w/ default import of __esModule package exported locally in node output", () => {
        const actual = codesOf(`import pkg from "tscjs";\nexport { pkg };`, { runtime: "node" });

        expect(actual).toEqual([91021]);
    });

    it("yields nothing w/ called default import of __esModule package without default export in node output", () => {
        const actual = codesOf(`import pkg from "tsnodef";\npkg();`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields 91021 w/ called default specifier of __esModule package in node output", () => {
        const actual = codesOf(`import { default as x } from "tscjs";\nx();`, { runtime: "node" });

        expect(actual).toEqual([91021]);
    });

    it("yields 91021 w/ default re-exported from __esModule package in node output", () => {
        const actual = codesOf(`export { default } from "tscjs";`, { runtime: "node" });

        expect(actual).toEqual([91021]);
    });

    it("yields nothing w/ module.exports name imported from CommonJS package in node output", () => {
        const actual = codesOf(`import { "module.exports" as m } from "objcjs";\nm();`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields nothing w/ named import from package whose module-sync condition points at ESM entry in node output", () => {
        const actual = codesOf(`import { onlyEsm } from "modsync";`, { runtime: "node" });

        expect(actual).toEqual([]);
    });

    it("yields 91021 w/ called default import of package with module field in node output", () => {
        const actual = codesOf(`import def from "mainmod";\ndef();`, { runtime: "node" });

        expect(actual).toEqual([91021]);
    });

    it("yields nothing w/ called default import of package with module field in bundler ESM output", () => {
        const actual = codesOf(`import def from "mainmod";\ndef();`, { runtime: "bundler" });

        expect(actual).toEqual([]);
    });

    it("reports package with module field w/ debug in bundler ESM output", () => {
        const reporter = new NoReporter();
        const target = jest.spyOn(reporter, "reportDiagnostic");

        check(`import def from "mainmod";\ndef();`, { runtime: "bundler" }, MODULE_PACKAGE, { reporter, debug: true });
        const actual = target.mock.calls.map(([cur]) => cur.messageText);

        expect(actual).toEqual([expect.stringMatching(/^ESM check skipped "mainmod" imported by .*: .*"module" or "browser" field.*\.$/)]);
    });

    it("reports not installed package once w/ debug and several imports of it", () => {
        const reporter = new NoReporter();
        const target = jest.spyOn(reporter, "reportDiagnostic");

        check(`import { x } from "not-installed";\nimport { y } from "not-installed";`, { runtime: "node" }, MODULE_PACKAGE, {
            reporter,
            debug: true,
        });
        const actual = target.mock.calls;

        expect(actual).toHaveLength(1);
    });

    it("yields nothing w/ named import re-exported from pnpm sibling of symlinked package in node output", () => {
        const root = createProject({
            "package.json": MODULE_PACKAGE,
            "node_modules/.pnpm/wrap@1.0.0/node_modules/wrap/package.json": JSON.stringify({ name: "wrap" }),
            "node_modules/.pnpm/wrap@1.0.0/node_modules/wrap/index.js": `module.exports = require("core");`,
            "node_modules/.pnpm/wrap@1.0.0/node_modules/core/package.json": JSON.stringify({ name: "core" }),
            "node_modules/.pnpm/wrap@1.0.0/node_modules/core/index.js": `exports.fromCore = 1;`,
            "node_modules/core/package.json": JSON.stringify({ name: "core" }),
            "node_modules/core/index.js": `exports.other = 1;`,
        });
        fs.symlinkSync(
            path.join(root, "node_modules", ".pnpm", "wrap@1.0.0", "node_modules", "wrap"),
            path.join(root, "node_modules", "wrap"),
            "junction"
        );

        const actual = checkEsm(
            [output(path.join(root, "dist", "main.js"), `import { fromCore } from "wrap";`)],
            { runtime: "node" },
            createContext(root)
        );

        expect(actual).toEqual([]);
    });

    it("reports symlinked and real entry dependencies w/ symlinked package", () => {
        const root = createProject({
            "package.json": MODULE_PACKAGE,
            "node_modules/.pnpm/objcjs@1.0.0/node_modules/objcjs/package.json": JSON.stringify({ name: "objcjs" }),
            "node_modules/.pnpm/objcjs@1.0.0/node_modules/objcjs/index.js": `module.exports = Object.assign({}, { a: 1 });`,
        });
        const realDir = path.join(root, "node_modules", ".pnpm", "objcjs@1.0.0", "node_modules", "objcjs");
        fs.symlinkSync(realDir, path.join(root, "node_modules", "objcjs"), "junction");
        const onDependency = jest.fn();

        checkEsm(
            [output(path.join(root, "dist", "main.js"), `import { a } from "objcjs";`)],
            { runtime: "node" },
            createContext(root, { onDependency })
        );
        const actual = onDependency.mock.calls;

        expect(actual).toEqual(
            expect.arrayContaining([
                [path.join(root, "node_modules", "objcjs", "index.js"), true],
                [path.join(realDir, "index.js"), true],
            ])
        );
    });

    it("yields 91021 warning w/ check warn", () => {
        const [actual] = check(`import def from "tscjs";\ndef();`, { runtime: "node", check: "warn" });

        expect(actual.category).toBe(ts.DiagnosticCategory.Warning);
    });

    it("yields 91020 located at the imported name with fix hint", () => {
        const [actual] = check(`import { a } from "objcjs";`, { runtime: "node" });

        expect([actual.start, actual.length, actual.messageText]).toEqual([
            9,
            1,
            `ESM91020: "a" is not a named export of CommonJS module "objcjs" as Node detects it; ` + `use a default import and read "a" from it.`,
        ]);
    });

    it("yields 91021 located at the default binding with fix hint", () => {
        const [actual] = check(`import def from "tscjs";\ndef();`, { runtime: "node" });

        expect([actual.start, actual.length, actual.messageText]).toEqual([
            7,
            3,
            `ESM91021: default import of CommonJS module "tscjs", which sets "__esModule", is its whole "module.exports", ` +
                `not its default export; read its "default" property (\`def.default\`) or use a named import.`,
        ]);
    });

    it("reports not installed package w/ debug", () => {
        const reporter = new NoReporter();
        const target = jest.spyOn(reporter, "reportDiagnostic");

        check(`import { x } from "not-installed";`, { runtime: "node" }, MODULE_PACKAGE, { reporter, debug: true });
        const actual = target.mock.calls.map(([cur]) => cur);

        expect(actual).toEqual([expect.any(InfoMessage)]);
        expect(actual[0].messageText).toMatch(/^ESM check skipped "not-installed" imported by ".*main\.js": package not found in node_modules\.$/);
    });

    it("reports unresolvable re-export w/ debug", () => {
        const reporter = new NoReporter();
        const target = jest.spyOn(reporter, "reportDiagnostic");

        check(`import { x } from "brokenstar";`, { runtime: "node" }, MODULE_PACKAGE, { reporter, debug: true });
        const actual = target.mock.calls.map(([cur]) => cur.messageText);

        expect(actual).toEqual([
            expect.stringMatching(/^ESM check skipped "brokenstar" imported by .*: cannot resolve re-export "\.\/missing" in ".*index\.js"\.$/),
        ]);
    });

    it("reports package.json, entry and re-export target dependencies", () => {
        const root = createProject({ ...PACKAGES, "package.json": MODULE_PACKAGE });
        const onDependency = jest.fn();

        checkEsm(
            [output(path.join(root, "dist", "main.js"), `import { fromInner } from "starcjs";`)],
            { runtime: "node" },
            createContext(root, { onDependency })
        );
        const actual = onDependency.mock.calls;

        expect(actual).toEqual(
            expect.arrayContaining([
                [path.join(root, "dist", "node_modules", "starcjs", "package.json"), false],
                [path.join(root, "node_modules", "starcjs", "package.json"), true],
                [path.join(root, "node_modules", "starcjs", "index.js"), true],
                [path.join(root, "node_modules", "starcjs", "inner.js"), true],
            ])
        );
    });

    it("replays package dependencies to the current callback w/ cache shared across checks", () => {
        const root = createProject({ ...PACKAGES, "package.json": MODULE_PACKAGE });
        const cjsNamesCache = createCjsNamesCache();
        const first = jest.fn();
        checkEsm(
            [output(path.join(root, "dist", "one.js"), `import { fromInner } from "starcjs";`)],
            { runtime: "node" },
            createContext(root, { cjsNamesCache, onDependency: first })
        );
        const second = jest.fn();

        checkEsm(
            [output(path.join(root, "dist", "two.js"), `import { fromInner } from "starcjs";`)],
            { runtime: "node" },
            createContext(root, { cjsNamesCache, onDependency: second })
        );
        const actual = second.mock.calls;

        expect(actual).toEqual(first.mock.calls);
        expect(actual).toEqual(
            expect.arrayContaining([
                [path.join(root, "node_modules", "starcjs", "package.json"), true],
                [path.join(root, "node_modules", "starcjs", "index.js"), true],
                [path.join(root, "node_modules", "starcjs", "inner.js"), true],
            ])
        );
    });

    it("reads each package entry once w/ cache shared across checks", () => {
        const root = createProject({ ...PACKAGES, "package.json": MODULE_PACKAGE });
        const cjsNamesCache = createCjsNamesCache();
        const system = { ...ts.sys, readFile: jest.fn((fileName: string) => ts.sys.readFile(fileName)) };
        checkEsm(
            [output(path.join(root, "dist", "one.js"), `import { a } from "objcjs";`)],
            { runtime: "node" },
            createContext(root, { system, cjsNamesCache })
        );

        checkEsm(
            [output(path.join(root, "src", "two.js"), `import { a } from "objcjs";`)],
            { runtime: "node" },
            createContext(root, { system, cjsNamesCache })
        );
        const actual = system.readFile.mock.calls.filter(([cur]) => cur === path.join(root, "node_modules", "objcjs", "index.js"));

        expect(actual).toHaveLength(1);
    });
});
