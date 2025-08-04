/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ReporterMock } from "../../test";
import { createSystem } from "../environment";
import { Compiler } from "./Compiler";
import ts from "typescript";

describe("end-2-end compile w/ websmith", () => {
    it("should test reporter mock", () => {
        const target = createSystem(
            {
                "tsconfig.json": "{}",
                "src/test.ts": `export const test = 'hello';`,
            },
            { virtual: true }
        );

        const reporter = new ReporterMock(target);

        // Test direct reporter usage
        reporter.reportDiagnostic({
            category: ts.DiagnosticCategory.Message,
            code: 0,
            messageText: "Test message",
            file: undefined,
            start: undefined,
            length: undefined,
        });

        expect(reporter.message).toContain("Test message");
    });

    it("should yield compiled js files", () => {
        const target = createSystem(
            {
                "tsconfig.json": "{}",
                "src/one.ts": `whatever`,
                "src/two.ts": `whatever`,
            },
            { virtual: true }
        );

        const actual = new Compiler(
            {
                reporter: new ReporterMock(target),
                tsConfig: { outDir: "/bin" },
                buildDir: "./src",
            },
            undefined,
            target
        ).compile();

        expect(actual.diagnostics).toEqual([]);
        expect(actual.emitSkipped).toBe(false);
        expect(target.fileExists("/bin/one.js")).toBe(true);
        expect(target.fileExists("/bin/two.js")).toBe(true);
    });

    it("should yield compiled d.ts files", () => {
        const target = createSystem(
            {
                "tsconfig.json": "{}",
                "src/one.ts": `whatever`,
                "src/two.ts": `whatever`,
            },
            { virtual: true }
        );

        const actual = new Compiler(
            {
                reporter: new ReporterMock(target),
                tsConfig: { outDir: "/bin", declaration: true, declarationMap: true },
                buildDir: "./src",
            },
            undefined,
            target
        ).compile();

        expect(actual.diagnostics).toEqual([]);
        expect(actual.emitSkipped).toBe(false);
        expect(target.fileExists("/bin/one.d.ts")).toBe(true);
        expect(target.fileExists("/bin/two.d.ts")).toBe(true);
    });

    it("should show profile-specific outDir in debug output", () => {
        const target = createSystem(
            {
                "tsconfig.json": "{}",
                "src/test.ts": `export const test = 'hello';`,
            },
            { virtual: true }
        );

        const reporter = new ReporterMock(target);
        const compiler = new Compiler(
            {
                reporter,
                debug: true,
                profile: "client",
                buildDir: "./src",
                config: {
                    profiles: {
                        client: {
                            tsConfig: {
                                outDir: "/dist/client",
                            },
                        },
                    },
                },
            },
            undefined,
            target
        );

        compiler.compile();

        // Verify that the debug output contains the profile-specific outDir
        expect(reporter.message).toContain("outDir:");
        expect(reporter.message).toContain("dist/client");
    });

    it("should show CLI outDir when provided, even with profile", () => {
        const target = createSystem(
            {
                "tsconfig.json": "{}",
                "src/test.ts": `export const test = 'hello';`,
            },
            { virtual: true }
        );

        const reporter = new ReporterMock(target);
        const compiler = new Compiler(
            {
                reporter,
                debug: true,
                profile: "client",
                buildDir: "./src",
                cliArgs: {
                    options: {
                        outDir: "/cli-output",
                    },
                    fileNames: [],
                    errors: [],
                },
                config: {
                    profiles: {
                        client: {
                            tsConfig: {
                                outDir: "/dist/client",
                            },
                        },
                    },
                },
            },
            undefined,
            target
        );

        compiler.compile();

        // Verify that the debug output contains the CLI outDir (which takes precedence)
        expect(reporter.message).toContain("outDir:");
        expect(reporter.message).toContain("cli-output");
    });

    it("should demonstrate debug output format", () => {
        const target = createSystem(
            {
                "tsconfig.json": "{}",
                "src/test.ts": `export const test = 'hello';`,
            },
            { virtual: true }
        );

        const reporter = new ReporterMock(target);

        // Debug: Check if reporter is working
        reporter.reportDiagnostic({
            category: ts.DiagnosticCategory.Message,
            code: 0,
            messageText: "Test message",
            file: undefined,
            start: undefined,
            length: undefined,
        });

        const compiler = new Compiler(
            {
                reporter,
                debug: true,
                profile: "server",
                buildDir: "./src",
                config: {
                    profiles: {
                        server: {
                            tsConfig: {
                                outDir: "/dist/server",
                                target: ts.ScriptTarget.ES5,
                            },
                        },
                    },
                },
            },
            undefined,
            target
        );

        compiler.compile();

        // Verify the debug output shows the correct configuration
        expect(reporter.message).toContain("Starting compilation with debug mode enabled");
        expect(reporter.message).toContain("Configuration:");
        expect(reporter.message).toContain("outDir:");
        expect(reporter.message).toContain("dist/server");
    });
});
