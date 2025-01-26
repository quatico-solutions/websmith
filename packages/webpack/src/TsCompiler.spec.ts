/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { Reporter } from "@quatico/websmith-api";
import { CompileFragment, CompilerOptions, NoReporter } from "@quatico/websmith-core";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import ts from "typescript";
import { TsCompiler } from "./TsCompiler";
import { WebsmithLoaderConfig } from "./loader-options";

class TestCompiler extends TsCompiler {
    private sys: ts.System | undefined;

    constructor(options: CompilerOptions, loaderConfig?: WebsmithLoaderConfig) {
        super(options, path => console.info(`dependency ${path} added`), loaderConfig);
        this.sys = super.getSystem();
    }

    public setProgram(program: ts.Program): this {
        this.program = program;
        return this;
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
    expected = resolve("./__TEMP__/one.ts");
    reporter = new NoReporter();
});

describe("TsCompiler", () => {
    beforeEach(() => {
        testObj = new TestCompiler(
            {
                buildDir: resolve("./__TEMP__"),
                tsConfig: { declaration: true, target: 99, noEmitOnError: true },
                reporter,
                targets: ["*"],
                cliArgs: { options: {}, fileNames: [expected], errors: [] },
                debug: true,
                sourceMap: false,
                watch: false,
            },
            { addonsDir: "./addons", configFile: "./websmith.config.json" }
        );
    });

    it("should return the program", () => {
        const expected = {} as ts.Program;
        testObj.setProgram(expected);

        const actual = testObj.getProgram();

        expect(actual).toBe(expected);
    });

    it("should throw error in build w/o system", () => {
        testObj.setSystem(undefined);

        expect(() => testObj.build("./src/one.ts")).toThrow(new Error("TsCompiler.build() not called with ts.sys as the active ts.System"));
    });

    it('should provide transpiled compilation fragment w/ build, default config, "*" target and source code', () => {
        const expected = { version: 42, files: [{ name: "expected.ts", text: "expected" }] };
        const target = jest.fn().mockReturnValue(expected);
        testObj.stubEmitSourceFile(target);

        const actual = testObj.build("expected.ts");

        expect(actual).toEqual(expected);
        expect(target).toHaveBeenCalledWith("expected.ts", "*", false);
    });

    it("should fail with invalid source code", () => {
        createSource(expected, "const () => 1;");
        const target = jest.fn();
        console.error = target;

        testObj.build(expected);

        expect(target).toHaveBeenCalledWith("Variable declaration expected.");

        rmSync(resolve("./__TEMP__"), { recursive: true, force: true });
    });
});

describe("Transpilation", () => {
    it('should provide transpiled compilation fragment w/ build, default "*" target and source code', () => {
        const expected = resolve("./__TEMP__/one.ts");
        createSource(expected, "export const one = () => 1;");
        const reporter = new NoReporter();
        testObj = new TestCompiler(
            {
                buildDir: resolve("./__TEMP__"),
                tsConfig: { declaration: true, target: 99, noEmitOnError: true },
                reporter,
                targets: ["*"],
                cliArgs: { options: { declaration: true, target: 99 }, fileNames: [expected], errors: [] },
                debug: true,
                sourceMap: false,
                watch: false,
            },
            { addonsDir: "./addons", configFile: "./websmith.config.json" }
        );

        const actual = testObj.build(expected);

        expect(actual.files.map(f => f.name)).toEqual([resolve("./__TEMP__/one.js"), resolve("./__TEMP__/one.d.ts")]);
        expect(actual.files.find(f => f.name.endsWith(".js"))?.text).toBe("export const one = () => 1;\n");
        expect(actual.files.find(f => f.name.endsWith(".d.ts"))?.text).toBe("export declare const one: () => number;\n");

        rmSync(resolve("./__TEMP__"), { recursive: true, force: true });
    });

    it('should provide transpiled compilation fragment w/ build, "fragment" and "write" target and source code', () => {
        const expected = resolve("./__TEMP__/one.ts");
        createSource(expected, "export const one = () => 1;");
        const reporter = new NoReporter();
        testObj = new TestCompiler(
            {
                buildDir: resolve("./__TEMP__"),
                config: {
                    configFilePath: resolve("./__TEMP__/websmith.config.json"),
                    targets: {
                        fragment: { options: { declaration: true } },
                        write: { writeFile: true, options: { module: 1, target: 1 } },
                    },
                },
                tsConfig: { target: 99, outDir: resolve("./__TEMP__/.build"), noEmitOnError: true },
                reporter,
                targets: ["fragment", "write"],
                cliArgs: { options: { target: 99 }, fileNames: [expected], errors: [] },
                debug: false,
                sourceMap: false,
                watch: false,
            },
            { config: resolve("__TEMP__", "websmith.config.json"), webpackTarget: "fragment", addonsDir: "./addons" }
        );

        const actual = testObj.build(expected);

        expect(actual.files.map(f => f.name)).toEqual([resolve("./__TEMP__/.build/one.js"), resolve("./__TEMP__/.build/one.d.ts")]);
        expect(actual.files.find(f => f.name.endsWith(".js"))?.text).toBe("export const one = () => 1;\n");
        expect(actual.files.find(f => f.name.endsWith(".d.ts"))?.text).toBe("export declare const one: () => number;\n");
        expect(readFileSync(resolve("./__TEMP__/.build/one.js"), "utf8")).toMatchInlineSnapshot(`
            ""use strict";
            Object.defineProperty(exports, "__esModule", { value: true });
            exports.one = void 0;
            var one = function () { return 1; };
            exports.one = one;
            "
        `);
        expect(existsSync(resolve("./__TEMP__/.build/one.d.ts"))).toBe(false);

        rmSync(resolve("./__TEMP__"), { recursive: true, force: true });
    });
});

const createSource = (fileName: string, text: string) => {
    const dir = dirname(fileName);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fileName, text);
};
