/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Compiler, NoReporter, createSystem } from "@quatico/websmith-core";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { type LoaderContext } from "webpack";
import { getCompilerInstance } from "./compiler-instances";
import { loader } from "./loader";
import { getLoaderOptions } from "./loader-options";
import { type LoaderBuildResult, TsCompiler } from "./TsCompiler";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

jest.mock("./compiler-instances");
jest.mock("./loader-options");

beforeAll(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
});

describe("TsCompiler compatibility with Compiler", () => {
    const tempDir = path.resolve("./__LOADER_TEST_TEMP__");

    beforeEach(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    afterEach(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it("should yield compiled js files like Compiler", () => {
        const target = createSystem(
            {
                "tsconfig.json": JSON.stringify({
                    compilerOptions: {
                        outDir: "./bin",
                        target: "es2015",
                        module: "commonjs",
                    },
                }),
                "src/one.ts": `export const one = "whatever";`,
                "src/two.ts": `export const two = "whatever";`,
            },
            { virtual: true }
        );

        // Test with core Compiler
        const compilerResult = new Compiler(
            {
                reporter: new NoReporter(),
                tsConfig: { outDir: "./bin" },
            },
            undefined,
            target
        ).compile();

        // Test with TsCompiler (used by webpack loader)
        const tsCompiler = new TsCompiler(
            {
                tsConfig: { outDir: "./bin", target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS },
                reporter: new NoReporter(),
                cliArgs: {
                    options: { outDir: "./bin" },
                    fileNames: ["/src/one.ts", "/src/two.ts"],
                    errors: [],
                },
            },
            {
                tsConfigFile: "/tsconfig.json",
                transpileOnly: true,
            },
            () => {
                /* dependency callback */
            },
            undefined,
            target
        );

        const tsCompilerResult1 = tsCompiler.build("/src/one.ts").fragment;
        const tsCompilerResult2 = tsCompiler.build("/src/two.ts").fragment;

        // Both should succeed without errors
        expect(compilerResult.diagnostics).toEqual([]);
        expect(compilerResult.emitSkipped).toBe(false);
        expect(tsCompilerResult1.files.length).toBeGreaterThan(0);
        expect(tsCompilerResult2.files.length).toBeGreaterThan(0);

        // Both should result in the same output files
        expect(target.fileExists("/bin/one.js")).toBe(true);
        expect(target.fileExists("/bin/two.js")).toBe(true);
    });

    it("should produce similar transpiled output like Compiler", () => {
        const target = createSystem(
            {
                "tsconfig.json": JSON.stringify({
                    compilerOptions: {
                        outDir: "./bin",
                        target: "es2015",
                        module: "commonjs",
                    },
                }),
                "src/simple.ts": `export const value = 42; export function getName() { return "test"; }`,
            },
            { virtual: true }
        );

        // Test with core Compiler
        const compilerResult = new Compiler(
            {
                reporter: new NoReporter(),
                tsConfig: { outDir: "./bin" },
            },
            undefined,
            target
        ).compile();

        // Test with TsCompiler in transpileOnly mode (common webpack usage)
        const tsCompiler = new TsCompiler(
            {
                tsConfig: { outDir: "./bin", target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS },
                reporter: new NoReporter(),
                cliArgs: {
                    options: { outDir: "./bin" },
                    fileNames: ["/src/simple.ts"],
                    errors: [],
                },
            },
            {
                tsConfigFile: "/tsconfig.json",
                transpileOnly: true,
            },
            () => {
                /* dependency callback */
            },
            undefined,
            target
        );

        const tsCompilerResult = tsCompiler.build("/src/simple.ts").fragment;

        // Both should succeed without errors
        expect(compilerResult.diagnostics).toEqual([]);
        expect(compilerResult.emitSkipped).toBe(false);
        expect(tsCompilerResult.files.length).toBeGreaterThan(0);

        // Both should result in output files
        expect(target.fileExists("/bin/simple.js")).toBe(true);

        // The compiled output should contain the expected content
        const jsContent = target.readFile("/bin/simple.js");
        expect(jsContent).toContain("value");
        expect(jsContent).toContain("getName");
    });

    it("should produce consistent compilation behavior", () => {
        const target = createSystem(
            {
                "tsconfig.json": JSON.stringify({
                    compilerOptions: {
                        outDir: "./bin",
                        target: "es2015",
                        module: "commonjs",
                    },
                }),
                "src/test.ts": `export const test = "hello world";`,
            },
            { virtual: true }
        );

        // Test with core Compiler
        const compilerResult = new Compiler(
            {
                reporter: new NoReporter(),
                tsConfig: { outDir: "./bin" },
            },
            undefined,
            target
        ).compile();

        // Test with TsCompiler
        const tsCompiler = new TsCompiler(
            {
                tsConfig: { outDir: "./bin", target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS },
                reporter: new NoReporter(),
                cliArgs: {
                    options: { outDir: "./bin" },
                    fileNames: ["/src/test.ts"],
                    errors: [],
                },
            },
            {
                tsConfigFile: "/tsconfig.json",
                transpileOnly: true,
            },
            () => {
                /* dependency callback */
            },
            undefined,
            target
        );

        const tsCompilerResult = tsCompiler.build("/src/test.ts").fragment;

        // Both should succeed without errors
        expect(compilerResult.diagnostics).toEqual([]);
        expect(compilerResult.emitSkipped).toBe(false);
        expect(tsCompilerResult.files.length).toBeGreaterThan(0);

        // Both should result in the same output files
        expect(target.fileExists("/bin/test.js")).toBe(true);

        // The compiled output should contain the expected content
        const jsContent = target.readFile("/bin/test.js");
        expect(jsContent).toContain("hello world");
    });

    // Added from Compiler.test.ts - adapted for TsCompiler compatibility
    it("should yield compiled js files (from Compiler.test.ts)", () => {
        const target = createSystem(
            {
                "tsconfig.json": "{}",
                "src/one.ts": `whatever`,
                "src/two.ts": `whatever`,
            },
            { virtual: true }
        );

        // Test with core Compiler (original test)
        const compilerResult = new Compiler(
            {
                reporter: new NoReporter(),
                tsConfig: { outDir: "./bin" },
            },
            undefined,
            target
        ).compile();

        // Test with TsCompiler (webpack loader equivalent)
        const tsCompiler = new TsCompiler(
            {
                tsConfig: { outDir: "./bin" },
                reporter: new NoReporter(),
                cliArgs: {
                    options: { outDir: "./bin" },
                    fileNames: ["/src/one.ts", "/src/two.ts"],
                    errors: [],
                },
            },
            {
                tsConfigFile: "/tsconfig.json",
                transpileOnly: true,
            },
            () => {
                /* dependency callback */
            },
            undefined,
            target
        );

        const tsCompilerResult1 = tsCompiler.build("/src/one.ts").fragment;
        const tsCompilerResult2 = tsCompiler.build("/src/two.ts").fragment;

        // Both should succeed without errors
        expect(compilerResult.diagnostics).toEqual([]);
        expect(compilerResult.emitSkipped).toBe(false);
        expect(tsCompilerResult1.files.length).toBeGreaterThan(0);
        expect(tsCompilerResult2.files.length).toBeGreaterThan(0);

        // Both should result in the same output files
        expect(target.fileExists("/bin/one.js")).toBe(true);
        expect(target.fileExists("/bin/two.js")).toBe(true);
    });

    // Test TsCompiler basic functionality - adapted for webpack loader usage
    it("should compile TypeScript files successfully", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true); // Don't log missing configuration files
        const target = createSystem(
            {
                "tsconfig.json": "{}",
                "src/one.ts": `export const test = "hello";`,
                "src/two.ts": `export const test2 = "world";`,
            },
            { virtual: true }
        );

        // Test with TsCompiler (webpack loader equivalent)
        const tsCompiler = new TsCompiler(
            {
                tsConfig: { noEmit: false, outDir: "./bin", declaration: true },
                debug: true,
                cliArgs: {
                    options: { noEmit: false, outDir: "./bin", declaration: true },
                    fileNames: ["/src/one.ts", "/src/two.ts"],
                    errors: [],
                },
            },
            {
                tsConfigFile: "/tsconfig.json",
                transpileOnly: false,
            },
            () => {
                /* dependency callback */
            },
            undefined,
            target
        );

        const result1 = tsCompiler.build("/src/one.ts").fragment;
        const result2 = tsCompiler.build("/src/two.ts").fragment;

        // Both should succeed without errors
        expect(result1.diagnostics).toEqual([]);
        expect(result2.diagnostics).toEqual([]);

        // Check that files were generated (either .js or .d.ts files)
        expect(result1.files.length).toBeGreaterThan(0);
        expect(result2.files.length).toBeGreaterThan(0);

        // Verify that the compiled output contains the expected content
        const result1Content = result1.files[0]?.text || "";
        const result2Content = result2.files[0]?.text || "";

        expect(result1Content).toContain("test");
        expect(result2Content).toContain("test2");
    });
});

const OUTPUT = { name: "/dist/a.js", text: `const x = require("x");`, writeByteOrderMark: false };

const diagnostic = (category: ts.DiagnosticCategory): ts.Diagnostic => ({
    category,
    code: 91001,
    file: ts.createSourceFile(OUTPUT.name, OUTPUT.text, ts.ScriptTarget.Latest),
    start: 10,
    length: 7,
    messageText: "ESM91001: expected.",
});

const createBuildResult = (result: Partial<LoaderBuildResult> = {}): LoaderBuildResult => ({
    fragment: { version: 1, files: [OUTPUT], writtenFiles: [] },
    diagnostics: [],
    dependencies: { files: [], missing: [] },
    ...result,
});

const setUpLoader = (result: LoaderBuildResult, options: WebsmithLoaderConfig = {}, debug = false) => {
    const build = jest.fn().mockReturnValue(result);
    const instance = { build, getProfile: () => undefined, getOptions: () => ({ debug }) };
    jest.mocked(getCompilerInstance).mockReturnValue(instance as unknown as TsCompiler);
    jest.mocked(getLoaderOptions).mockReturnValue(options);
    return build;
};

const createLoaderContext = (module?: { type: string }) =>
    ({
        resourcePath: "/src/a.ts",
        cacheable: jest.fn(),
        callback: jest.fn(),
        emitError: jest.fn(),
        emitWarning: jest.fn(),
        addDependency: jest.fn(),
        addMissingDependency: jest.fn(),
        ...(module && { _module: module }),
    }) as unknown as LoaderContext<WebsmithLoaderConfig>;

describe("loader", () => {
    it("builds resource w/ webpack module type", () => {
        const build = setUpLoader(createBuildResult());
        const target = createLoaderContext({ type: "javascript/esm" });

        loader.call(target);

        expect(build).toHaveBeenCalledWith("/src/a.ts", "javascript/esm");
    });

    it("builds resource w/o module type w/o module in loader context", () => {
        const build = setUpLoader(createBuildResult());
        const target = createLoaderContext();

        loader.call(target);

        expect(build.mock.calls[0][1]).toBeUndefined();
    });

    it("emits error diagnostic with location through loader context", () => {
        setUpLoader(createBuildResult({ diagnostics: [diagnostic(ts.DiagnosticCategory.Error)] }));
        const target = createLoaderContext();

        loader.call(target);
        const actual = jest.mocked(target.emitError).mock.calls.map(([cur]) => cur.message);

        expect(actual).toEqual(["/dist/a.js (1,11): ESM91001: expected."]);
    });

    it("emits warning diagnostic as warning through loader context", () => {
        setUpLoader(createBuildResult({ diagnostics: [diagnostic(ts.DiagnosticCategory.Warning)] }));
        const target = createLoaderContext();

        loader.call(target);
        const actual = jest.mocked(target.emitWarning).mock.calls.map(([cur]) => cur.message);

        expect(actual).toEqual(["/dist/a.js (1,11): ESM91001: expected."]);
    });

    it("emits nothing w/ message diagnostic w/o debug", () => {
        setUpLoader(createBuildResult({ diagnostics: [diagnostic(ts.DiagnosticCategory.Message)] }));
        const target = createLoaderContext();

        loader.call(target);
        const actual = [...jest.mocked(target.emitWarning).mock.calls, ...jest.mocked(target.emitError).mock.calls];

        expect(actual).toEqual([]);
    });

    it("emits message diagnostic as warning w/ debug", () => {
        setUpLoader(createBuildResult({ diagnostics: [diagnostic(ts.DiagnosticCategory.Message)] }), {}, true);
        const target = createLoaderContext();

        loader.call(target);
        const actual = jest.mocked(target.emitWarning).mock.calls.length;

        expect(actual).toBe(1);
    });

    it("calls error option after emitting error diagnostic", () => {
        const target = jest.fn();
        setUpLoader(createBuildResult({ diagnostics: [diagnostic(ts.DiagnosticCategory.Error)] }), { error: target });
        const context = createLoaderContext();

        loader.call(context);
        const actual = target.mock.calls.map(([cur]) => cur);

        expect(actual).toEqual(jest.mocked(context.emitError).mock.calls.map(([cur]) => cur));
    });

    it("calls warn option after emitting warning diagnostic", () => {
        const target = jest.fn();
        setUpLoader(createBuildResult({ diagnostics: [diagnostic(ts.DiagnosticCategory.Warning)] }), { warn: target });

        loader.call(createLoaderContext());
        const actual = target.mock.calls.length;

        expect(actual).toBe(1);
    });

    it("registers found and missing dependencies through loader context", () => {
        setUpLoader(createBuildResult({ dependencies: { files: ["/package.json"], missing: ["/dist/package.json"] } }));
        const target = createLoaderContext();

        loader.call(target);
        const actual = [jest.mocked(target.addDependency).mock.calls, jest.mocked(target.addMissingDependency).mock.calls];

        expect(actual).toEqual([[["/package.json"]], [["/dist/package.json"]]]);
    });

    it("yields output of built fragment", () => {
        setUpLoader(createBuildResult());
        const target = createLoaderContext();

        loader.call(target);

        expect(target.callback).toHaveBeenCalledWith(null, OUTPUT.text, undefined);
    });
});
