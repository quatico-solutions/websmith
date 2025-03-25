/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type Reporter } from "@quatico/websmith-api";
import { type CompileFragment, type CompilerOptions, NoReporter } from "@quatico/websmith-core";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { TsCompiler } from "./TsCompiler";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

class TestCompiler extends TsCompiler {
    private sys: ts.System | undefined;

    constructor(options: CompilerOptions, loaderConfig?: WebsmithLoaderConfig) {
        super(options, loaderConfig, path => console.info(`dependency ${path} added`, undefined, undefined));
        this.sys = super.getSystem();
    }

    public setSystem(system: ts.System | undefined): this {
        this.sys = system;
        return this;
    }

    public getSystem(): ts.System {
        return this.sys as any;
    }

    public stubEmitSourceFile(func: (fileName: string, target: string, writeFile: boolean) => CompileFragment) {
        super.emitSourceFile = func;
    }
}
let testObj: TestCompiler;
let expected: string;
let reporter: Reporter;

beforeEach(() => {
    expected = path.resolve("./__TEMP__/one.ts");
    reporter = new NoReporter();
});

describe("TsCompiler", () => {
    beforeEach(() => {
        testObj = new TestCompiler(
            {
                buildDir: path.resolve("./__TEMP__"),
                tsConfig: { declaration: true, target: ts.ScriptTarget.ESNext, noEmitOnError: true },
                reporter,
                cliArgs: { options: {}, fileNames: [expected], errors: [] },
                debug: true,
                watch: false,
            },
            { configFile: "./websmith.config.json" }
        );
    });

    it("should throw error in build w/o system", () => {
        testObj.setSystem(undefined);

        expect(() => testObj.build("./src/one.ts")).toThrow(new Error("TsCompiler.build() not called with ts.sys as the active ts.System"));
    });

    it("should provide transpiled compilation fragment w/ build, default config, no profile and source code", () => {
        const expected = { version: 42, files: [{ name: "expected.ts", text: "expected" }] };
        const target = jest.fn().mockReturnValue(expected);
        testObj.stubEmitSourceFile(target);

        const actual = testObj.build("expected.ts");

        expect(actual).toEqual(expected);
        expect(target).toHaveBeenCalledWith(path.resolve("./__TEMP__/expected.ts"), undefined, false);
    });

    it("should fail with invalid source code", () => {
        createSource(expected, "const () => 1;");
        const target = jest.fn();
        console.error = target;

        testObj.build(expected);

        expect(target).toHaveBeenCalledWith("Variable declaration expected.");

        fs.rmSync(path.resolve("./__TEMP__"), { recursive: true, force: true });
    });
});

describe("Transpilation", () => {
    it("should provide transpiled compilation fragment w/ build, default target and source code", () => {
        const expected = "./__TEMP__/src/one.ts";
        createSource(expected, "export const one = () => 1;");

        const actual = new TestCompiler(
            {
                buildDir: "./__TEMP__/src",
                tsConfig: { declaration: true, target: ts.ScriptTarget.ESNext, noEmitOnError: true },
                reporter: new NoReporter(),
                cliArgs: { options: { declaration: true, target: ts.ScriptTarget.ESNext }, fileNames: [expected], errors: [] },
                debug: true,
                watch: false,
            },
            { configFile: "./__TEMP__/websmith.config.json" }
        ).build(expected);

        expect(actual.files.map(f => f.name)).toEqual([path.resolve("./__TEMP__/src/one.js"), path.resolve("./__TEMP__/src/one.d.ts")]);
        expect(actual.files.find(f => f.name.endsWith(".js"))?.text).toBe("export const one = () => 1;\n");
        expect(actual.files.find(f => f.name.endsWith(".d.ts"))?.text).toBe("export declare const one: () => number;\n");

        fs.rmSync(path.resolve("./__TEMP__"), { recursive: true, force: true });
    });

    it('should provide transpiled compilation fragment w/ build, "fragment" and "write" target and source code', () => {
        const expected = "./__TEMP__/src/one.ts";
        createSource(expected, "export const one = () => 1;");
        const reporter = new NoReporter();
        testObj = new TestCompiler(
            {
                buildDir: "./__TEMP__/src",
                config: {
                    profiles: {
                        fragment: {
                            depends: ["write"],
                            tsConfig: { declaration: true },
                        },
                        write: { tsConfig: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, declarationMap: true, sourceMap: true } },
                    },
                    addonsDir: "./addons",
                },
                tsConfig: { target: ts.ScriptTarget.ESNext, outDir: "./__TEMP__/.build", noEmitOnError: true },
                reporter,
                cliArgs: { options: { target: ts.ScriptTarget.ESNext }, fileNames: [expected], errors: [] },
            },
            {
                configFile: "./__TEMP__/websmith.config.json",
                profile: "fragment",
            }
        );

        const actual = testObj.build(expected);

        expect(actual.files.map(f => f.name)).toEqual([
            path.resolve("./__TEMP__/.build/one.js.map"),
            path.resolve("./__TEMP__/.build/one.js"),
            path.resolve("./__TEMP__/.build/one.d.ts.map"),
            path.resolve("./__TEMP__/.build/one.d.ts"),
        ]);
        expect(actual.files.find(f => f.name.endsWith("one.js.map"))?.text).toMatchInlineSnapshot(
            `"{"version":3,"file":"one.js","sourceRoot":"","sources":["../src/one.ts"],"names":[],"mappings":";;;AAAO,IAAM,GAAG,GAAG,cAAM,OAAA,CAAC,EAAD,CAAC,CAAC;AAAd,QAAA,GAAG,OAAW"}"`
        );
        expect(actual.files.find(f => f.name.endsWith("one.js"))?.text).toMatchInlineSnapshot(`
            ""use strict";
            Object.defineProperty(exports, "__esModule", { value: true });
            exports.one = void 0;
            var one = function () { return 1; };
            exports.one = one;
            //# sourceMappingURL=one.js.map"
        `);
        expect(actual.files.find(f => f.name.endsWith("one.d.ts.map"))?.text).toMatchInlineSnapshot(
            `"{"version":3,"file":"one.d.ts","sourceRoot":"","sources":["../src/one.ts"],"names":[],"mappings":"AAAA,eAAO,MAAM,GAAG,cAAU,CAAC"}"`
        );
        expect(actual.files.find(f => f.name.endsWith("one.d.ts"))?.text).toMatchInlineSnapshot(`
            "export declare const one: () => number;
            //# sourceMappingURL=one.d.ts.map"
        `);
        expect(fs.existsSync(path.resolve("./__TEMP__/.build/one.js"))).toMatchInlineSnapshot(`true`);
        expect(fs.existsSync(path.resolve("./__TEMP__/.build/one.d.ts"))).toMatchInlineSnapshot(`true`);

        fs.rmSync(path.resolve("./__TEMP__"), { recursive: true, force: true });
    });
});

const createSource = (fileName: string, text: string) => {
    const dir = path.dirname(fileName);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fileName, text);
};
