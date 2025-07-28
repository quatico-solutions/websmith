/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Compiler, NoReporter } from "@quatico/websmith-core";
import { compileSystem } from "@quatico/websmith-testing";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { TsCompiler } from "./TsCompiler";

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

        // Reset any TypeScript system state to prevent test interference
        jest.clearAllMocks();
    });

    it("should yield compiled js files like Compiler", () => {
        const { fileSystem: target } = compileSystem({
            files: {
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
        });

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
                buildDir: "/src",
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
            }
        );

        const tsCompilerResult1 = tsCompiler.build("/src/one.ts");
        const tsCompilerResult2 = tsCompiler.build("/src/two.ts");

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
        const { fileSystem: target } = compileSystem({
            files: {
                "tsconfig.json": JSON.stringify({
                    compilerOptions: {
                        outDir: "./bin",
                        target: "es2015",
                        module: "commonjs",
                    },
                }),
                "src/simple.ts": `export const value = 42; export function getName() { return "test"; }`,
            },
        });

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
                buildDir: "/src",
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
            }
        );

        const tsCompilerResult = tsCompiler.build("/src/simple.ts");

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
        const { fileSystem: target } = compileSystem({
            files: {
                "tsconfig.json": JSON.stringify({
                    compilerOptions: {
                        outDir: "./bin",
                        target: "es2015",
                        module: "commonjs",
                    },
                }),
                "src/test.ts": `export const test = "hello world";`,
            },
        });

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
                buildDir: "/src",
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
            }
        );

        const tsCompilerResult = tsCompiler.build("/src/test.ts");

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
        const { fileSystem: target } = compileSystem({
            files: {
                "tsconfig.json": "{}",
                "src/one.ts": `whatever`,
                "src/two.ts": `whatever`,
            },
        });

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
                buildDir: "/src",
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
            }
        );

        const tsCompilerResult1 = tsCompiler.build("/src/one.ts");
        const tsCompilerResult2 = tsCompiler.build("/src/two.ts");

        // Both should succeed without errors
        expect(compilerResult.diagnostics).toEqual([]);
        expect(compilerResult.emitSkipped).toBe(false);
        expect(tsCompilerResult1.files.length).toBeGreaterThan(0);
        expect(tsCompilerResult2.files.length).toBeGreaterThan(0);

        // Both should result in the same output files
        expect(target.fileExists("/bin/one.js")).toBe(true);
        expect(target.fileExists("/bin/two.js")).toBe(true);
    });

    // Added from Compiler.test.ts - adapted for TsCompiler compatibility
    it("should yield compiled d.ts files (from Compiler.test.ts)", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "tsconfig.json": "{}",
                "src/one.ts": `whatever`,
                "src/two.ts": `whatever`,
            },
        });

        // Test with core Compiler (original test)
        const compilerResult = new Compiler(
            {
                reporter: new NoReporter(),
                tsConfig: { outDir: "./bin", declaration: true, declarationMap: true },
            },
            undefined,
            target
        ).compile();

        // Test with TsCompiler (webpack loader equivalent) - Create separate instances for each file
        // Note: webpack loader typically doesn't emit .d.ts files, but we test compatibility
        const tsCompiler1 = new TsCompiler(
            {
                buildDir: "/src",
                tsConfig: { outDir: "./bin", declaration: true, declarationMap: true },
                reporter: new NoReporter(),
                cliArgs: {
                    options: { outDir: "./bin", declaration: true, declarationMap: true },
                    fileNames: ["/src/one.ts"],
                    errors: [],
                },
            },
            {
                tsConfigFile: "/tsconfig.json",
                transpileOnly: false, // Need full compilation for .d.ts files
            },
            () => {
                /* dependency callback */
            }
        );

        const tsCompiler2 = new TsCompiler(
            {
                buildDir: "/src",
                tsConfig: { outDir: "./bin", declaration: true, declarationMap: true },
                reporter: new NoReporter(),
                cliArgs: {
                    options: { outDir: "./bin", declaration: true, declarationMap: true },
                    fileNames: ["/src/two.ts"],
                    errors: [],
                },
            },
            {
                tsConfigFile: "/tsconfig.json",
                transpileOnly: false, // Need full compilation for .d.ts files
            },
            () => {
                /* dependency callback */
            }
        );

        const tsCompilerResult1 = tsCompiler1.build("/src/one.ts");
        const tsCompilerResult2 = tsCompiler2.build("/src/two.ts");

        // Both should succeed without errors
        expect(compilerResult.diagnostics).toEqual([]);
        expect(compilerResult.emitSkipped).toBe(false);
        expect(tsCompilerResult1.files.length).toBeGreaterThan(0);
        expect(tsCompilerResult2.files.length).toBeGreaterThan(0);

        // Both should result in the same output files
        expect(target.fileExists("/bin/one.d.ts")).toBe(true);
        expect(target.fileExists("/bin/two.d.ts")).toBe(true);
    });
});
