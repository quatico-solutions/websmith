/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import type { TscArguments } from "@quatico/websmith-api";
import type { CompilationConfig } from "@quatico/websmith-core";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const TEST_FILES_DIR = path.resolve(__dirname, "..", "test", "__data__", "functions");

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

const ADDONS_DIR = path.resolve(__dirname, "..", "..", "example-addons", "src");

let originalCwd: string;
let testDirs: ReturnType<typeof getTestDirs>;

beforeAll(() => {
    // Verify that source addons exist
    if (!fs.existsSync(ADDONS_DIR)) {
        throw new Error(`Addons source directory not found: ${ADDONS_DIR}`);
    }
});

beforeEach(() => {
    // Generate unique test directories for this specific test
    testDirs = getTestDirs();

    // Store original working directory
    originalCwd = process.cwd();

    // Clean up and create test directories (unique for this test)
    try {
        fs.rmSync(path.resolve(testDirs.PROJECT_DIR), { recursive: true, force: true });
    } catch (_error) {
        // Ignore errors if directory doesn't exist
    }
    fs.mkdirSync(testDirs.SOURCE_DIR, { recursive: true });
    fs.mkdirSync(testDirs.OUTPUT_DIR, { recursive: true });
});

afterEach(() => {
    // Restore all mocks
    jest.restoreAllMocks();

    // Restore working directory safely
    try {
        if (originalCwd && originalCwd !== process.cwd()) {
            process.chdir(originalCwd);
        }
    } catch (error) {
        console.warn(`Failed to restore working directory: ${error}`);
    }

    // Clean up test directories (unique for this test)
    if (testDirs) {
        try {
            fs.rmSync(path.resolve(testDirs.PROJECT_DIR), { recursive: true, force: true });
        } catch (_error) {
            // Ignore cleanup errors
        }
    }
});

describe("bin.ts e2e tests", () => {
    it("should yield script file with single file and emit true", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext" });

        createSourceFile(
            `
            export const hello = "world";            
            export function greet(name: string): string {
                return \`Hello, \${name}!\`;
            }    
            `,
            "test.ts"
        );

        executeCompiler(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);

        expect(getOutput("test.js")).toBeDefined();
        expect(getOutput("test.js")).toMatchInlineSnapshot(`
            "export const hello = "world";
            export function greet(name) {
                return \`Hello, \${name}!\`;
            }
            "
        `);
    }, 60000);

    it("should yield script and declaration files with single file, declaration and emit true", () => {
        createTsConfig({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            declaration: true,
            declarationMap: true,
            target: "esnext",
            moduleResolution: "node10",
        });
        copySourceFile("foobar-arrow.ts");

        executeCompiler();

        expect(getOutput("foobar-arrow.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export const getFoobar = (date) => {
                return foobar(date);
            };
            const foobar = (date) => {
                return \`foobar \${date.toISOString()}\`;
            };
            "
        `);
        expect(getOutput("foobar-arrow.d.ts")).toMatchInlineSnapshot(`
            "export declare const getFoobar: (date: Date) => string;
            //# sourceMappingURL=foobar-arrow.d.ts.map"
        `);
        expect(getOutput("foobar-arrow.d.ts.map")).toMatchInlineSnapshot(
            `"{"version":3,"file":"foobar-arrow.d.ts","sourceRoot":"","sources":["../src/foobar-arrow.ts"],"names":[],"mappings":"AACA,eAAO,MAAM,SAAS,SAAU,IAAI,WAEnC,CAAC"}"`
        );
    }, 60000);

    it("should yield transpiled script with single file, profile client-processor and emit", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "es5", module: "commonjs" });
        createWebsmithConfig({
            profiles: {
                target: {
                    addons: ["client-processor"],
                    tsConfig: {
                        outDir: `${testDirs.OUTPUT_DIR}/target`,
                        target: ts.ScriptTarget.ESNext,
                        module: ts.ModuleKind.ESNext,
                        moduleResolution: ts.ModuleResolutionKind.Node10,
                    },
                },
            },
        });
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${ADDONS_DIR} --profile target --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );

        expect(getOutput("target/foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getCLIENT(date) {
                return CLIENT(date);
            }
            function CLIENT(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
    }, 60000);

    it("should yield transpiled script with single file, addons-cli client-processor and emit", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        copySourceFile("foobar-function.ts");

        executeCompiler(`--addonsDir ${ADDONS_DIR} --addons client-processor --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);

        expect(getOutput("foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getCLIENT(date) {
                return CLIENT(date);
            }
            function CLIENT(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
    }, 60000);

    it("should yield transpiled script with single file, addons-config client-processor and emit", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createWebsmithConfig({
            addons: ["client-processor"],
        });
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${ADDONS_DIR} --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );

        expect(getOutput("foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getCLIENT(date) {
                return CLIENT(date);
            }
            function CLIENT(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
    }, 60000);

    it("should yield transpiled script with single file, addons-cli client-transformer and emit true", () => {
        createTsConfig({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: "esnext",
            moduleResolution: "node10",
        });
        copySourceFile("foobar-function.ts");

        executeCompiler(`--addonsDir ${ADDONS_DIR} --addons client-transformer --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);

        expect(getOutput("foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getCLIENT(date) {
                return CLIENT(date);
            }
            function CLIENT(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
    }, 60000);

    it("should yield transpiled script with single file, addons-cli export-yaml-generator and emit true", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        copySourceFile("foobar-function.ts");

        executeCompiler(`--addonsDir ${ADDONS_DIR} --addons export-yaml-generator --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);

        expect(getOutput("foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getFoobar(date) {
                return foobar(date);
            }
            function foobar(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
        expect(getOutput("output.yaml")).toContain(`exports: [getFoobar]`);
    }, 60000);

    it("should yield transpiled script with single file, addons-cli foo-added-generator and emit true", () => {
        createTsConfig({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: "esnext",
            moduleResolution: "node10",
        });
        copySourceFile("foobar-function.ts");

        executeCompiler(`--addonsDir ${ADDONS_DIR} --addons foo-added-generator --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);

        expect(getOutput("foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getFoobar(date) {
                return foobar(date);
            }
            function foobar(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
        expect(getOutput("foobar-function-added.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getFoobar(date) {
                return foobar(date);
            }
            function foobar(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
    }, 60000);

    it("should yield transpiled script with single file, addons-cli function-json-result-processor and emit true", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${ADDONS_DIR} --addons function-json-result-processor --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        );

        expect(getOutput("foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getFoobar(date) {
                return foobar(date);
            }
            function foobar(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
        expect(getOutput("named-functions.json")).toMatchInlineSnapshot(`"{"foobar-function":["getFoobar","foobar"]}"`);
    }, 60000);

    it("should exit with zero status w/ clean project", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const actual = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`).status;

        expect(actual).toBe(0);
    }, 60000);

    it("should exit with zero status and write output w/ --project current directory", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const actual = executeCompilerStatus("--project .").status;

        expect(actual).toBe(0);
        expect(getOutput("test.js")).toContain(`export const hello = "world";`);
    }, 60000);

    it("should exit with status 1 and report the syntax error w/ --project current directory", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const a = ;`, "test.ts");

        const target = executeCompilerStatus("--project .");
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${path.join(testDirs.SOURCE_DIR, "test.ts")} (1,18): Expression expected.`);
    }, 60000);

    it("should write output to relative outDir w/ --project absolute directory", () => {
        createTsConfig({ outDir: "./dist", noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const actual = executeCompilerStatus(`--project ${testDirs.PROJECT_DIR}`).status;

        expect(actual).toBe(0);
        expect(getOutput("test.js")).toContain(`export const hello = "world";`);
    }, 60000);

    it("should exit with status 1 and report 5058 with absolute path w/ --project missing file", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const target = executeCompilerStatus("--project missing.json");
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`5058: The specified path does not exist: '${path.join(testDirs.PROJECT_DIR, "missing.json")}'.`);
    }, 60000);

    it("should exit with status 1 and report 5057 once with absolute path w/ --project directory without tsconfig.json", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        fs.mkdirSync(path.join(testDirs.PROJECT_DIR, "emptydir"));

        const target = executeCompilerStatus("--project emptydir");
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`5057: Cannot find a tsconfig.json file at the specified directory: '${path.join(testDirs.PROJECT_DIR, "emptydir")}'.`);
        expect(actual2).not.toContain("5058");
        expect(actual2.split("\n").filter(line => line.includes("Error:"))).toHaveLength(1);
    }, 60000);

    it("should exit with status 1 and report 5057 w/ --project current directory without tsconfig.json", () => {
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const target = executeCompilerStatus("--project .");
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`5057: Cannot find a tsconfig.json file at the specified directory: '${testDirs.PROJECT_DIR}'.`);
    }, 60000);

    it("should exit with status 1 and report 5058 w/ --project tsconfig.json and w/o tsconfig.json", () => {
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const actual1 = executeCompilerStatus("--project tsconfig.json");
        const actual2 = executeCompilerStatus("--project ./tsconfig.json");

        expect(actual1.status).toBe(1);
        expect(actual1.output).toContain(`5058: The specified path does not exist: '${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}'.`);
        expect(actual2.status).toBe(1);
        expect(actual2.output).toContain(`5058: The specified path does not exist: '${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}'.`);
    }, 60000);

    it("should exit with status 1 and report 5058 w/ --project tsconfig.json in existing directory without tsconfig.json", () => {
        fs.mkdirSync(path.join(testDirs.PROJECT_DIR, "emptydir"));

        const target = executeCompilerStatus("--project emptydir/tsconfig.json");
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`5058: The specified path does not exist: '${path.join(testDirs.PROJECT_DIR, "emptydir", "tsconfig.json")}'.`);
        expect(actual2).not.toContain("5057");
    }, 60000);

    it("should exit with status 0 and report nothing w/o --project and w/o tsconfig.json", () => {
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const target = executeCompilerStatus("--noEmit");
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).not.toContain("5057");
        expect(actual2).not.toContain("5058");
    }, 60000);

    it("should exit with status 1 w/ type error in project and addon requiring type information", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const hello: number = "world";`, "test.ts");
        createAddon("type-info-addon", `exports.activate = () => {};`);

        const actual = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons type-info-addon --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        ).status;

        expect(actual).toBe(1);
    }, 60000);

    it("should exit with status 1 and report the syntax error w/ syntax error on fast path", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const a = ;`, "test.ts");

        const target = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${path.join(testDirs.SOURCE_DIR, "test.ts")} (1,18): Expression expected.`);
    }, 60000);

    it("should exit with status 1 and report the syntax error once w/ syntax error and declaration", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, declaration: true, target: "esnext", types: [] });
        createSourceFile(`export const a = ;`, "test.ts");

        const target = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);
        const actual1 = target.status;
        const actual2 = target.output.split(`${path.join(testDirs.SOURCE_DIR, "test.ts")} (1,18): Expression expected.`).length - 1;

        expect(actual1).toBe(1);
        expect(actual2).toBe(1);
    }, 60000);

    it.each([
        {
            name: "declaration emit error",
            isolatedDeclarations: false,
            source: `export const a = class { private x = 1; };\nexport const b = ;`,
            expected: "(1,14): Property 'x' of exported anonymous class type may not be private or protected.",
        },
        {
            name: "isolatedDeclarations error",
            isolatedDeclarations: true,
            source: `export const a = 1;\nexport const b = ;`,
            expected: "(2,14): Variable must have an explicit type annotation with --isolatedDeclarations.",
        },
    ])(
        "should exit with status 1 and report the syntax error and the $name once each w/ declaration",
        ({ isolatedDeclarations, source, expected }) => {
            createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, declaration: true, isolatedDeclarations, target: "esnext", types: [] });
            createSourceFile(source, "test.ts");

            const target = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);
            const actual1 = target.status;
            const actual2 = target.output.split(`${path.join(testDirs.SOURCE_DIR, "test.ts")} (2,18): Expression expected.`).length - 1;
            const actual3 = target.output.split(`${path.join(testDirs.SOURCE_DIR, "test.ts")} ${expected}`).length - 1;

            expect(actual1).toBe(1);
            expect(actual2).toBe(1);
            expect(actual3).toBe(1);
        },
        60000
    );

    it("should exit with status 1 and report the TypeScript option error once w/ several files on fast path", () => {
        createTsConfig({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            resolveJsonModule: true,
            moduleResolution: "classic",
            target: "esnext",
            module: "esnext",
            types: [],
        } as TscArguments);
        createSourceFile(`export const a = 1;`, "a.ts");
        createSourceFile(`export const b = 1;`, "b.ts");
        createSourceFile(`export const c = 1;`, "c.ts");

        const target = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);
        const actual1 = target.status;
        const actual2 = target.output.split("Option '--resolveJsonModule' cannot be specified").length - 1;

        expect(actual1).toBe(1);
        expect(actual2).toBe(1);
    }, 60000);

    it.each([{ noEmitOnError: false }, { noEmitOnError: true }])(
        "should exit with status 1 and report the syntax error once w/ addon requiring type information and noEmitOnError $noEmitOnError",
        ({ noEmitOnError }) => {
            createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, noEmitOnError, target: "esnext", types: [] });
            createSourceFile(`export const a = ;`, "test.ts");
            createAddon("type-info-addon", `exports.activate = () => {};`);

            const target = executeCompilerStatus(
                `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons type-info-addon --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
            );
            const actual1 = target.status;
            const actual2 = target.output.split(`${path.join(testDirs.SOURCE_DIR, "test.ts")} (1,18): Expression expected.`).length - 1;

            expect(actual1).toBe(1);
            expect(actual2).toBe(1);
        },
        60000
    );

    it("should exit with status 1 and report the syntax error once w/ processor appending invalid code and addon requiring type information", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const a = 1;`, "test.ts");
        createAddon(
            "invalid-processor",
            `exports.activate = ctx => ctx.registerProcessor((_fileName, content) => content + "\\nexport const z = ;");`
        );

        const target = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons invalid-processor --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output.split(`${path.join(testDirs.SOURCE_DIR, "test.ts")} (2,18): Expression expected.`).length - 1;

        expect(actual1).toBe(1);
        expect(actual2).toBe(1);
    }, 60000);

    it("should exit with status 1 w/ throwing processor addon", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const hello: string = "world";`, "test.ts");
        createAddon("throwing-processor", `exports.activate = ctx => ctx.registerProcessor(() => { throw new Error("Processor failure"); });`);

        const actual = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons throwing-processor --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        ).status;

        expect(actual).toBe(1);
    }, 60000);

    it("should exit with zero status and report warning w/ warnings only", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const target = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "missing-addons")} --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).toContain("does not exist");
    }, 60000);

    it("should exit with status 1 and report 91001 in emitted file w/ addon generating require in node ESM profile", () => {
        createEsmProject("error");

        const target = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.js")} (2,26): ESM91001`);
    }, 60000);

    it("should report 91001 naming source file w/ addon generating require in node ESM profile", () => {
        createEsmProject("error");

        const actual = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        ).output;

        expect(actual).toContain(`(source "src/test.ts", profile "client", addons: require-generator).`);
    }, 60000);

    it("should exit with zero status and report 91001 warning w/ addon generating require in node ESM profile with check warn", () => {
        createEsmProject("warn");

        const target = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.js")} (2,26): ESM91001`);
    }, 60000);

    it("should exit with status 1 and report 91032 naming addon w/ result processor writing CommonJS into node ESM profile output", () => {
        createEsmProject("error", []);
        const metaFile = path.join(testDirs.OUTPUT_DIR, "meta.js");
        createAddon(
            "meta-writer",
            `exports.activate = ctx => ctx.registerResultProcessor((_files, processorCtx) => processorCtx.getSystem().writeFile(${JSON.stringify(metaFile)}, "module.exports = {};\\n"));`
        );
        createWebsmithConfig({
            profiles: {
                client: {
                    addons: ["meta-writer"],
                    esm: { runtime: "node" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, module: ts.ModuleKind.ESNext },
                },
            },
        });

        const target = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${metaFile} (1,1): ESM91032`);
        expect(actual2).toContain(`(profile "client", addons: meta-writer).`);
    }, 60000);

    it("should exit with status 1 and report only the config error w/ node ESM profile and CommonJS profile module", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: { esm: { runtime: "node" }, tsConfig: { outDir: testDirs.OUTPUT_DIR, module: "CommonJS" as unknown as ts.ModuleKind } },
            },
        });
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output.split(/\r?\n/).filter(cur => /Error/.test(cur));

        expect(actual1).toBe(1);
        expect(actual2).toEqual([expect.stringContaining("sets 'esm', but its 'tsConfig.module' is 'CommonJS'")]);
    }, 60000);

    it("should exit with zero status w/ valid selected profile and broken unselected profile", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                broken: { esm: { runtime: "node" }, tsConfig: { outDir: testDirs.OUTPUT_DIR, module: "CommonJS" as unknown as ts.ModuleKind } },
                valid: { tsConfig: { outDir: testDirs.OUTPUT_DIR } },
            },
        });
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const target = executeCompilerStatus(`--profile valid --project tsconfig.json --configFile websmith.config.json`);
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).not.toContain("Error");
    }, 60000);

    it("should exit with status 1 and report the config error once w/ broken selected profile and relative config path", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                broken: { esm: { runtime: "node" }, tsConfig: { outDir: testDirs.OUTPUT_DIR, module: "CommonJS" as unknown as ts.ModuleKind } },
                valid: { tsConfig: { outDir: testDirs.OUTPUT_DIR } },
            },
        });
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const target = executeCompilerStatus(`--profile broken --project tsconfig.json --configFile websmith.config.json`);
        const actual1 = target.status;
        const actual2 = target.output.split(/\r?\n/).filter(cur => /Error/.test(cur));

        expect(actual1).toBe(1);
        expect(actual2).toEqual([expect.stringContaining("Profile 'broken' of")]);
    }, 60000);

    it.each([
        { name: "valid profile", profile: "valid" },
        { name: "profile depending on unknown profile", profile: "broken" },
        { name: "unknown profile", profile: "unknown" },
    ])(
        "should not warn that no profile was provided w/ --profile and $name",
        ({ profile }) => {
            createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
            createWebsmithConfig({ profiles: { broken: { depends: ["missing"] }, valid: {} } });
            createSourceFile(`export const hello: string = "world";`, "test.ts");

            const actual = executeCompilerStatus(`--profile ${profile} --project tsconfig.json --configFile websmith.config.json`).output;

            expect(actual).not.toContain("no profile provided");
        },
        60000
    );

    it("should exit with status 1 and report 91010 in emitted file w/ extensionless relative import in node ESM profile", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({ profiles: { client: { esm: { runtime: "node" }, tsConfig: { outDir: testDirs.OUTPUT_DIR } } } });
        createSourceFile(`export const b = "b";`, "b.ts");
        createSourceFile(`import { b } from "./b";\nexport const a = b;`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.js")} (1,19): ESM91010`);
    }, 60000);

    it("should exit with status 1 and report 91020 in emitted file w/ missing name imported from CommonJS package in node ESM profile", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        const packageDir = path.join(testDirs.PROJECT_DIR, "node_modules", "cjs-package");
        fs.mkdirSync(packageDir, { recursive: true });
        fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({ name: "cjs-package" }), { encoding: "utf-8" });
        fs.writeFileSync(path.join(packageDir, "index.js"), `module.exports = Object.assign({}, { present: 1 });`, { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: { client: { esm: { runtime: "node" }, tsConfig: { outDir: testDirs.OUTPUT_DIR, module: ts.ModuleKind.ESNext } } },
        });
        createSourceFile(`// @ts-nocheck\nimport { missing } from "cjs-package";\nexport const value = missing;`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.js")} (2,10): ESM91020`);
    }, 60000);

    it("should exit with status 1 and report 91030 naming the file w/ .cts source emitting export into .cjs in node ESM profile", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "preserve", types: [] });
        createWebsmithConfig({ profiles: { client: { esm: { runtime: "node" }, tsConfig: { outDir: testDirs.OUTPUT_DIR } } } });
        createSourceFile(`export const hello: string = "world";`, "test.cts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.cjs")} (1,1): ESM91030`);
    }, 60000);

    const createEsmProject = (check: "error" | "warn", addons = ["require-generator"]) => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    addons,
                    esm: { runtime: "node", check },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, module: ts.ModuleKind.ESNext },
                },
            },
        });
        createSourceFile(`export const hello: string = "world";`, "test.ts");
        createAddon(
            "require-generator",
            `exports.activate = ctx => ctx.registerProcessor((_fileName, content) => content + '\\ndeclare const require: (id: string) => unknown;\\nexport const generated = require("node:path");\\n');`
        );
    };

    const executeCompilerStatus = (args: string): { status: number | null; output: string } => {
        const binPath = path.join(__dirname, "..", "bin", "bin.js");
        if (!fs.existsSync(binPath)) {
            throw new Error(`Bundled compiler not found at ${binPath}. Please run 'pnpm build' first.`);
        }

        const { status, stdout, stderr } = spawnSync("node", [binPath, ...args.trim().split(/\s+/)], {
            encoding: "utf8",
            timeout: 30000,
            cwd: testDirs.PROJECT_DIR,
        });
        return { status, output: `${stdout}${stderr}` };
    };

    const createAddon = (name: string, code: string) => {
        const addonDir = path.join(testDirs.PROJECT_DIR, "addons", name);
        fs.mkdirSync(addonDir, { recursive: true });
        fs.writeFileSync(path.join(addonDir, "addon.js"), code, { encoding: "utf-8" });
    };

    it("should apply .ts addon w/ consumer package.json type module", () => {
        createPackageJson({ type: "module" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createEsmAddons();
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons esm-processor --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        );

        expect(getOutput("foobar-function.js")).toContain("function esmProcessed(date)");
    }, 60000);

    it("should apply multi-file .ts addon with cross-addon import w/ consumer package.json type module", () => {
        createPackageJson({ type: "module" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createEsmAddons();
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons esm-cross-processor --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        );

        expect(getOutput("foobar-function.js")).toContain("function crossAddonProcessed(date)");
    }, 60000);

    it("should apply .ts addon importing package from project node_modules w/ consumer package.json type module", () => {
        createPackageJson({ type: "module" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createEsmAddons();
        createProjectPackage();
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons project-package-processor --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        );

        expect(getOutput("foobar-function.js")).toContain("function projectPackageProcessed(date)");
    }, 60000);

    it("should yield CommonJS script w/ module nodenext and consumer package.json type commonjs", () => {
        createPackageJson({ type: "commonjs" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "nodenext", moduleResolution: "nodenext", types: [] });
        createSourceFile(`export const world: string = "world";`, "other.ts");
        createSourceFile(`import { world } from "./other.js";\nexport const hello: string = world;`, "test.ts");

        executeCompiler(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);

        const actual = getOutput("test.js");
        expect(actual).toContain(`require("./other.js")`);
        expect(actual).toContain("exports.hello");
    }, 60000);

    it("should yield ES module script w/ module nodenext and consumer package.json type module", () => {
        createPackageJson({ type: "module" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "nodenext", moduleResolution: "nodenext", types: [] });
        createSourceFile(`export const world: string = "world";`, "other.ts");
        createSourceFile(`import { world } from "./other.js";\nexport const hello: string = world;`, "test.ts");

        executeCompiler(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);

        const actual = getOutput("test.js");
        expect(actual).toContain(`import { world } from "./other.js";`);
        expect(actual).not.toContain("require(");
    }, 60000);

    it.each([
        { module: "node16", type: "module", declaration: false },
        { module: "node16", type: "commonjs", declaration: false },
        { module: "node16", type: undefined, declaration: false },
        { module: "nodenext", type: "module", declaration: false },
        { module: "nodenext", type: "commonjs", declaration: false },
        { module: "nodenext", type: undefined, declaration: false },
        { module: "node16", type: "module", declaration: true },
        { module: "node16", type: "commonjs", declaration: true },
        { module: "node16", type: undefined, declaration: true },
        { module: "nodenext", type: "module", declaration: true },
        { module: "nodenext", type: "commonjs", declaration: true },
        { module: "nodenext", type: undefined, declaration: true },
    ] as const)(
        "should yield tsc output w/ module $module, package.json type $type and declaration $declaration",
        ({ module, type, declaration }) => {
            createPackageJson({ name: "project", ...(type && { type }) });
            createTsConfig({
                outDir: testDirs.OUTPUT_DIR,
                rootDir: testDirs.SOURCE_DIR,
                noEmit: false,
                declaration,
                module,
                target: module === "node16" ? "es2022" : "esnext",
                esModuleInterop: true,
                strict: true,
                skipLibCheck: true,
                types: [],
            });
            createModuleFormatSources();

            executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);

            const actual = readOutputFiles();
            expect(actual).toEqual(emitWithTsc());
        },
        60000
    );

    it.each([
        { type: "commonjs", path: "fast path", declaration: false, addons: "", expected: `const other_js_1 = require("./other.js");` },
        { type: "commonjs", path: "declaration path", declaration: true, addons: "", expected: `const other_js_1 = require("./other.js");` },
        {
            type: "commonjs",
            path: "Program path",
            declaration: false,
            addons: "type-info-addon",
            expected: `const other_js_1 = require("./other.js");`,
        },
        { type: "module", path: "fast path", declaration: false, addons: "", expected: `import { world } from "./other.js";` },
        { type: "module", path: "declaration path", declaration: true, addons: "", expected: `import { world } from "./other.js";` },
        { type: "module", path: "Program path", declaration: false, addons: "type-info-addon", expected: `import { world } from "./other.js";` },
    ])(
        "should yield $expected w/ profile tsConfig module NodeNext string, package.json type $type and $path",
        ({ type, declaration, addons, expected }) => {
            createPackageJson({ type });
            createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, declaration, types: [] });
            createWebsmithConfig({
                profiles: {
                    client: {
                        ...(addons && { addons: [addons] }),
                        tsConfig: { outDir: testDirs.OUTPUT_DIR, module: "NodeNext", target: "ESNext" } as unknown as ts.CompilerOptions,
                    },
                },
            });
            createAddon("type-info-addon", `exports.activate = () => {};`);
            fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "addons", "package.json"), JSON.stringify({ type: "commonjs" }), { encoding: "utf-8" });
            createSourceFile(`export const world: string = "world";`, "other.ts");
            createSourceFile(`import { world } from "./other.js";\nexport const hello: string = world;`, "test.ts");

            const target = executeCompilerStatus(
                `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
            );
            const actual1 = target.status;
            const actual2 = getOutput("test.js");

            expect(actual1).toBe(0);
            expect(actual2).toContain(expected);
        },
        60000
    );

    const createModuleFormatSources = () => {
        createSourceFile(`export const x = 1;\nexport default 2;\n`, "dep.ts");
        createSourceFile(
            `import * as dep from "./dep.js";\nimport fsx = require("fs");\nexport const v = dep.x + fsx.sep;\nexport async function f() { return import("./dep.js"); }\nexport default class C { y = 1 }\n`,
            "a.ts"
        );
        createSourceFile(
            `import def from "./dep.js";\nimport fsx = require("fs");\nexport const u = def;\nexport const url = import.meta.url;\n`,
            "b.mts"
        );
        createSourceFile(
            `import * as dep from "./dep.js";\nimport fsx = require("fs");\nasync function h() { return import("./dep.js"); }\nexport = { dep, fsx, h };\n`,
            "c.cts"
        );
        createSourceFile(`const z = 1;\nexport = z;\n`, "e.ts");
    };

    const emitWithTsc = (): Record<string, string> => {
        const { config } = ts.readConfigFile(path.join(testDirs.PROJECT_DIR, "tsconfig.json"), ts.sys.readFile);
        const { options, fileNames } = ts.parseJsonConfigFileContent(config, ts.sys, testDirs.PROJECT_DIR);
        const result: Record<string, string> = {};
        ts.createProgram(fileNames, options).emit(undefined, (fileName, text) => {
            result[path.relative(testDirs.OUTPUT_DIR, fileName)] = text;
        });
        return result;
    };

    const readOutputFiles = (): Record<string, string> =>
        Object.fromEntries(
            fs
                .readdirSync(testDirs.OUTPUT_DIR, { recursive: true, encoding: "utf-8" })
                .filter(cur => fs.statSync(path.join(testDirs.OUTPUT_DIR, cur)).isFile())
                .map(cur => [cur, fs.readFileSync(path.join(testDirs.OUTPUT_DIR, cur), "utf-8")])
        );

    const executeCompiler = (args = ""): string => {
        process.chdir(testDirs.PROJECT_DIR);

        const binPath = path.join(__dirname, "..", "bin", "bin.js");
        if (!fs.existsSync(binPath)) {
            throw new Error(`Bundled compiler not found at ${binPath}. Please run 'pnpm build' first.`);
        }

        const { status, stdout, stderr } = spawnSync(
            "node",
            [
                binPath,
                ...args
                    .trim()
                    .split(/\s+/)
                    .filter(it => it !== ""),
            ],
            {
                encoding: "utf8",
                timeout: 30000,
                cwd: testDirs.PROJECT_DIR,
            }
        );
        if (status !== 0) {
            throw new Error(`Compiler exited with status ${status}:\n${stdout}${stderr}`);
        }
        return stdout;
    };

    const copySourceFile = (fileName: string) => {
        fs.copyFileSync(path.join(TEST_FILES_DIR, fileName), path.join(testDirs.SOURCE_DIR, fileName));
    };

    const createSourceFile = (fileContent: string, fileName: string) => {
        fs.writeFileSync(path.join(testDirs.SOURCE_DIR, fileName), fileContent, { encoding: "utf-8" });
    };

    const createTsConfig = (config: TscArguments) => {
        const tsConfig = {
            compilerOptions: config,
            include: ["src/**/*"],
            exclude: ["node_modules", "dist"],
        };
        fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "tsconfig.json"), JSON.stringify(tsConfig, null, 2), { encoding: "utf-8" });
    };

    const getOutput = (filePath: string): string | undefined =>
        fs.existsSync(path.join(testDirs.OUTPUT_DIR, filePath)) ? fs.readFileSync(path.join(testDirs.OUTPUT_DIR, filePath), "utf-8") : undefined;

    const createPackageJson = (packageJson: Record<string, unknown>) => {
        fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "package.json"), JSON.stringify(packageJson), { encoding: "utf-8" });
    };

    const createEsmAddons = () => {
        const addonsDir = path.join(testDirs.PROJECT_DIR, "addons");
        const addonFiles: Record<string, string> = {
            "esm-processor/addon.ts": `
                export const replaceFoobar = (content: string, replacement: string): string => content.replace(/foobar/g, replacement);
                export const activate = (ctx: any): void => {
                    ctx.registerProcessor((_fileName: string, content: string) => replaceFoobar(content, "esmProcessed"));
                };
            `,
            "esm-cross-processor/addon.ts": `
                import { replaceFoobar } from "../esm-processor/addon";
                import { REPLACEMENT } from "./replacement";
                export const activate = (ctx: any): void => {
                    ctx.registerProcessor((_fileName: string, content: string) => replaceFoobar(content, REPLACEMENT));
                };
            `,
            "esm-cross-processor/replacement.ts": `export const REPLACEMENT = "crossAddonProcessed";`,
            "project-package-processor/addon.ts": `
                import { REPLACEMENT } from "project-package";
                export const activate = (ctx: any): void => {
                    ctx.registerProcessor((_fileName: string, content: string) => content.replace(/foobar/g, REPLACEMENT));
                };
            `,
        };
        for (const [fileName, content] of Object.entries(addonFiles)) {
            fs.mkdirSync(path.dirname(path.join(addonsDir, fileName)), { recursive: true });
            fs.writeFileSync(path.join(addonsDir, fileName), content, { encoding: "utf-8" });
        }
    };

    const createProjectPackage = () => {
        const packageDir = path.join(testDirs.PROJECT_DIR, "node_modules", "project-package");
        fs.mkdirSync(packageDir, { recursive: true });
        fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({ name: "project-package", main: "index.js" }), { encoding: "utf-8" });
        fs.writeFileSync(path.join(packageDir, "index.js"), 'exports.REPLACEMENT = "projectPackageProcessed";', { encoding: "utf-8" });
    };

    const createWebsmithConfig = (config: CompilationConfig) => {
        fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "websmith.config.json"), JSON.stringify(config), { encoding: "utf-8" });
    };
});
