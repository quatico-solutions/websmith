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

// Create unique test directories for each test to prevent cross-test contamination
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const timestamp = Date.now();
    const uniqueId = `${testId}_${timestamp}`;
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-${uniqueId}`);
    const OUTPUT_DIR = path.resolve(PROJECT_DIR, "dist");
    const SOURCE_DIR = path.join(PROJECT_DIR, "src");
    return { PROJECT_DIR, OUTPUT_DIR, SOURCE_DIR };
};

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
    jest.spyOn(console, "log").mockImplementation(() => {});

    const { SOURCE_DIR } = getTestDirs();
    expected = path.resolve(SOURCE_DIR, "one.ts");
    reporter = new NoReporter();
});

describe("TsCompiler", () => {
    beforeEach(() => {
        testObj = new TestCompiler(
            {
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

        expect(() => testObj.build("./src/one.ts")).toThrow(new Error("TsCompiler.build() called without a valid ts.System"));
    });

    it("should provide transpiled compilation fragment w/ build, default config, no profile and source code", () => {
        const { PROJECT_DIR } = getTestDirs();
        const expected = { version: 42, files: [{ name: "expected.ts", text: "expected" }] };
        const target = jest.fn().mockReturnValue(expected);
        testObj.stubEmitSourceFile(target);

        const actual = testObj.build("expected.ts");

        expect(actual).toEqual(expected);
        expect(target).toHaveBeenCalledWith(path.resolve("./expected.ts"), undefined, false);

        fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
    });

    // FIXME: We don't call the reporter we call the webpack error() callback
    it.skip("should fail with invalid source code", () => {
        const { PROJECT_DIR } = getTestDirs();
        createSource(expected, "const () => 1;");
        jest.spyOn(testObj.getReporter(), "reportDiagnostic").mockImplementation(() => {});

        testObj.build(expected);

        expect(testObj.getReporter().reportDiagnostic).toHaveBeenCalledWith({
            messageText: "Variable declaration expected.",
        });

        fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
    });
});

describe("Transpilation", () => {
    it("should provide transpiled compilation fragment w/ build, default target and source code", () => {
        const { PROJECT_DIR, SOURCE_DIR } = getTestDirs();
        const expected = path.join(SOURCE_DIR, "one.ts");
        createSource(expected, "export const one = () => 1;");

        const actual = new TestCompiler(
            {
                tsConfig: { declaration: true, target: ts.ScriptTarget.ESNext, noEmitOnError: true },
                reporter: new NoReporter(),
                cliArgs: { options: { declaration: true, target: ts.ScriptTarget.ESNext }, fileNames: [expected], errors: [] },
                debug: true,
                watch: false,
            },
            { configFile: path.join(PROJECT_DIR, "websmith.config.json") }
        ).build(expected);

        expect(actual.files.map(f => f.name)).toEqual([path.resolve(SOURCE_DIR, "one.js"), path.resolve(SOURCE_DIR, "one.d.ts")]);
        expect(actual.files.find(f => f.name.endsWith(".js"))?.text).toBe("export const one = () => 1;\n");
        expect(actual.files.find(f => f.name.endsWith(".d.ts"))?.text).toBe("export declare const one: () => number;\n");

        fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
    });

    it('should provide transpiled compilation fragment w/ build, "fragment" and "write" target and source code', () => {
        const { PROJECT_DIR, OUTPUT_DIR, SOURCE_DIR } = getTestDirs();
        const expected = path.join(SOURCE_DIR, "one.ts");
        createSource(expected, "export const one = () => 1;");
        const reporter = new NoReporter();
        testObj = new TestCompiler(
            {
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
                tsConfig: { target: ts.ScriptTarget.ESNext, outDir: OUTPUT_DIR, noEmitOnError: true, noEmit: false },
                reporter,
                cliArgs: { options: { target: ts.ScriptTarget.ESNext }, fileNames: [expected], errors: [] },
            },
            {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                profile: "fragment",
            }
        );

        const actual = testObj.build(expected);

        expect(actual.files.map(f => f.name)).toEqual([
            path.resolve(OUTPUT_DIR, "one.js.map"),
            path.resolve(OUTPUT_DIR, "one.js"),
            path.resolve(OUTPUT_DIR, "one.d.ts.map"),
            path.resolve(OUTPUT_DIR, "one.d.ts"),
        ]);
        expect(actual.files.find(f => f.name.endsWith("one.js.map"))?.text).toContain('"version":3');
        expect(actual.files.find(f => f.name.endsWith("one.js"))?.text).toContain('"use strict"');
        expect(actual.files.find(f => f.name.endsWith("one.d.ts.map"))?.text).toContain('"version":3');
        expect(actual.files.find(f => f.name.endsWith("one.d.ts"))?.text).toContain("export declare const one: () => number;");
        expect(fs.existsSync(path.resolve(OUTPUT_DIR, "one.js"))).toBe(true);
        expect(fs.existsSync(path.resolve(OUTPUT_DIR, "one.d.ts"))).toBe(true);

        fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
    });
});

const createSource = (fileName: string, text: string) => {
    const dir = path.dirname(fileName);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fileName, text);
};
