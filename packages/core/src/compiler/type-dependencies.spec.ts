/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { getTypeDependencies } from "./type-dependencies";

const OPTIONS: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
};

const baseHost = ts.createCompilerHost(OPTIONS);
const libFiles = new Map<string, ts.SourceFile | undefined>();

const getLibFile = (name: string, languageVersion: ts.ScriptTarget): ts.SourceFile | undefined => {
    if (!libFiles.has(name)) {
        libFiles.set(name, baseHost.getSourceFile(name, languageVersion));
    }
    return libFiles.get(name);
};

const createProgram = (
    files: Record<string, string>,
    rootNames = Object.keys(files).filter(cur => !cur.includes("node_modules")),
    sourceFiles = new Map<string, ts.SourceFile>()
): ts.Program => {
    const getSourceFile = (name: string, languageVersion: ts.ScriptTarget): ts.SourceFile => {
        const key = `${name}\n${files[name]}`;
        if (!sourceFiles.has(key)) {
            sourceFiles.set(key, ts.createSourceFile(name, files[name], languageVersion, true));
        }
        return sourceFiles.get(key) as ts.SourceFile;
    };
    return ts.createProgram({
        rootNames,
        options: OPTIONS,
        host: {
            ...baseHost,
            fileExists: name => name in files || baseHost.fileExists(name),
            readFile: name => files[name] ?? baseHost.readFile(name),
            getSourceFile: (name, languageVersion) => (name in files ? getSourceFile(name, languageVersion) : getLibFile(name, languageVersion)),
            getCurrentDirectory: () => "/",
            directoryExists: name => Object.keys(files).some(cur => cur.startsWith(`${name}/`)) || !!baseHost.directoryExists?.(name),
        },
    });
};

describe("getTypeDependencies", () => {
    it("yields barrel and re-exported file", () => {
        const program = createProgram({
            "/src/a.ts": `import type { T } from "./barrel";\nexport const a: T = 1;`,
            "/src/barrel.ts": `export * from "./types";`,
            "/src/types.ts": `export type T = number;`,
        });

        const actual = getTypeDependencies(program, "/src/a.ts");

        expect(actual.sort()).toEqual(["/src/barrel.ts", "/src/types.ts"]);
    });

    it("yields file of import type", () => {
        const program = createProgram({
            "/src/a.ts": `export const a: import("./types").T = 1;`,
            "/src/types.ts": `export type T = number;`,
        });

        const actual = getTypeDependencies(program, "/src/a.ts");

        expect(actual).toEqual(["/src/types.ts"]);
    });

    it("yields file of dynamic import", () => {
        const program = createProgram({
            "/src/a.ts": `export const load = () => import("./lazy");`,
            "/src/lazy.ts": `export const b = 1;`,
        });

        const actual = getTypeDependencies(program, "/src/a.ts");

        expect(actual).toEqual(["/src/lazy.ts"]);
    });

    it("yields file of import equals declaration", () => {
        const program = createProgram({
            "/src/a.ts": `import types = require("./types");\nexport const a: types.T = 1;`,
            "/src/types.ts": `export type T = number;`,
        });

        const actual = getTypeDependencies(program, "/src/a.ts");

        expect(actual).toEqual(["/src/types.ts"]);
    });

    it("yields file of reference path", () => {
        const program = createProgram(
            {
                "/src/a.ts": `/// <reference path="./types.ts" />\nexport const a = 1;`,
                "/src/types.ts": `export type T = number;`,
            },
            ["/src/a.ts"]
        );

        const actual = getTypeDependencies(program, "/src/a.ts");

        expect(actual).toEqual(["/src/types.ts"]);
    });

    it("yields script and ambient declaration files without import", () => {
        const program = createProgram({
            "/src/a.ts": `export const a = 1;`,
            "/src/globals.d.ts": `declare const G: number;`,
            "/src/script.ts": `const S = 1;`,
        });

        const actual = getTypeDependencies(program, "/src/a.ts");

        expect(actual.sort()).toEqual(["/src/globals.d.ts", "/src/script.ts"]);
    });

    it("yields module with global augmentation without import", () => {
        const program = createProgram({
            "/src/a.ts": `export const a = 1;`,
            "/src/global.ts": `export {};\ndeclare global {\n    interface Window { g: number }\n}`,
        });

        const actual = getTypeDependencies(program, "/src/a.ts");

        expect(actual).toEqual(["/src/global.ts"]);
    });

    it("yields module with module declaration without import", () => {
        const program = createProgram({
            "/src/a.ts": `export const a = 1;`,
            "/src/shims.ts": `export {};\ndeclare module "virtual:x" {\n    export const x: number;\n}`,
        });

        const actual = getTypeDependencies(program, "/src/a.ts");

        expect(actual).toEqual(["/src/shims.ts"]);
    });

    it("yields no unrelated module, node_modules or lib file", () => {
        const program = createProgram({
            "/src/a.ts": `import type { D } from "dep";\nexport const a: D = 1;`,
            "/src/unrelated.ts": `export const u = 1;`,
            "/node_modules/dep/package.json": JSON.stringify({ name: "dep", types: "index.d.ts" }),
            "/node_modules/dep/index.d.ts": `import type { E } from "./e";\nexport type D = E;`,
            "/node_modules/dep/e.d.ts": `export type E = number;`,
        });

        const actual = getTypeDependencies(program, "/src/a.ts");

        expect(actual).toEqual([]);
    });

    it("yields no own file w/ import cycle", () => {
        const program = createProgram({
            "/src/a.ts": `import type { B } from "./b";\nexport type A = B;`,
            "/src/b.ts": `import type { A } from "./a";\nexport type B = number;\nexport type C = A;`,
        });

        const actual = getTypeDependencies(program, "/src/a.ts");

        expect(actual).toEqual(["/src/b.ts"]);
    });

    it("yields newly resolved file w/ unchanged importer reused by next program", () => {
        const sourceFiles = new Map<string, ts.SourceFile>();
        const files = { "/src/a.ts": `import type { B } from "./b";\nexport const a: B = 1;` };
        getTypeDependencies(createProgram(files, undefined, sourceFiles), "/src/a.ts");
        const program = createProgram({ ...files, "/src/b.ts": `export type B = number;` }, ["/src/a.ts"], sourceFiles);

        const actual = getTypeDependencies(program, "/src/a.ts");

        expect(actual).toEqual(["/src/b.ts"]);
    });

    it("yields nothing w/ file outside program", () => {
        const program = createProgram({ "/src/a.ts": `export const a = 1;` });

        const actual = getTypeDependencies(program, "/src/missing.ts");

        expect(actual).toEqual([]);
    });
});
