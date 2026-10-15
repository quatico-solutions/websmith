/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import type { TscArguments } from "@quatico/websmith-api";
import type { CompilationConfig } from "@quatico/websmith-core";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
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

// TS5095 (bundler resolution with CommonJS) is an error on TypeScript 5 only
const describeOnTs5 = Number(ts.versionMajorMinor.split(".")[0]) < 6 ? describe : describe.skip;

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
            moduleResolution: "bundler",
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
        const expectedMap = emitWithTsc()["foobar-arrow.d.ts.map"];
        expect(expectedMap).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts.map")).toBe(expectedMap);
    }, 60000);

    it("should yield transpiled script with single file, profile client-processor and emit", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "es2020", module: "commonjs" });
        createWebsmithConfig({
            profiles: {
                target: {
                    addons: ["client-processor"],
                    tsConfig: {
                        outDir: `${testDirs.OUTPUT_DIR}/target`,
                        target: ts.ScriptTarget.ESNext,
                        module: ts.ModuleKind.ESNext,
                        moduleResolution: ts.ModuleResolutionKind.Bundler,
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
            moduleResolution: "bundler",
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
            moduleResolution: "bundler",
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
        expect(actual2).toContain(
            `5057: Cannot find a tsconfig.json file at the specified directory: '${path.join(testDirs.PROJECT_DIR, "emptydir")}'.`
        );
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

    it.each([{ skipLibCheck: false }, { skipLibCheck: true }])(
        "should exit with status 1 and report the syntax error once w/ syntax error in d.ts, skipLibCheck $skipLibCheck on fast path",
        ({ skipLibCheck }) => {
            createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, skipLibCheck, target: "esnext", types: [] });
            createSourceFile(`export const a = 1;`, "test.ts");
            createSourceFile(`export declare const c: ;`, "c.d.ts");

            const target = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);
            const actual1 = target.status;
            const actual2 = target.output.split(`${path.join(testDirs.SOURCE_DIR, "c.d.ts")} (1,25): Type expected.`).length - 1;

            expect(actual1).toBe(1);
            expect(actual2).toBe(1);
            expect(getOutput("test.js")).toBeDefined();
        },
        60000
    );

    it("should exit with status 0 w/ valid d.mts and module esnext on fast path", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, module: "esnext", target: "esnext", types: [] });
        createSourceFile(`export const a = 1;`, "test.ts");
        createSourceFile(`export declare const m: number;`, "m.d.mts");

        const target = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).not.toContain("Transpilation failed");
    }, 60000);

    it.each([
        { fileName: "b.js", source: `export const b = ;`, expected: "(1,18): Expression expected." },
        { fileName: "c.cjs", source: `const 1 = 2;`, expected: "(1,7): Variable declaration expected." },
    ])(
        "should exit with status 1, report the syntax error once and copy the file w/ syntax error in $fileName and allowJs on fast path",
        ({ fileName, source, expected }) => {
            createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, allowJs: true, target: "esnext", types: [] });
            createSourceFile(`export const a = 1;`, "test.ts");
            createSourceFile(source, fileName);

            const target = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);
            const actual1 = target.status;
            const actual2 = target.output.split(`${path.join(testDirs.SOURCE_DIR, fileName)} ${expected}`).length - 1;

            expect(actual1).toBe(1);
            expect(actual2).toBe(1);
            expect(findOutputs(fileName)).toHaveLength(1);
        },
        60000
    );

    it("should exit with status 1 and not write the file w/ syntax error in js, allowJs and noEmitOnError on fast path", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, allowJs: true, noEmitOnError: true, target: "esnext", types: [] });
        createSourceFile(`export const a = 1;`, "test.ts");
        createSourceFile(`export const b = ;`, "b.js");

        const actual = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`).status;

        expect(actual).toBe(1);
        expect(findOutputs("b.js")).toEqual([]);
    }, 60000);

    it("should exit with status 0 w/ syntax error in js w/o allowJs on fast path", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const a = 1;`, "test.ts");
        createSourceFile(`export const b = ;`, "b.js");

        const actual = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`).status;

        expect(actual).toBe(0);
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

    it("should exit with status 1, report the command-line option error once and write the output w/ invalid --target", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, types: [] } as TscArguments);
        createSourceFile(`export const a = 1;`, "test.ts");

        const target = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --target foo`);
        const actual1 = target.status;
        const actual2 = target.output.split("Argument for '--target' option must be").length - 1;
        const actual3 = getOutput("test.js") !== undefined;

        expect(actual1).toBe(1);
        expect(actual2).toBe(1);
        expect(actual3).toBe(true);
    }, 60000);

    it.each([
        { name: "fast path", args: () => "" },
        { name: "addon requiring type information", args: () => `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons type-info-addon` },
    ])(
        "should exit with status 1, report the unknown tsconfig.json option once and write the output w/ $name",
        ({ args }) => {
            createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, types: [], bogusOption: true } as TscArguments);
            createSourceFile(`export const a = 1;`, "test.ts");
            createAddon("type-info-addon", `exports.activate = () => {};`);

            const target = executeCompilerStatus(`${args()} --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);
            const actual1 = target.status;
            const actual2 = target.output.split("Unknown compiler option 'bogusOption'.").length - 1;
            const actual3 = getOutput("test.js") !== undefined;

            expect(actual1).toBe(1);
            expect(actual2).toBe(1);
            expect(actual3).toBe(true);
        },
        60000
    );

    it("should exit with status 1 and report the syntax error once w/ tsconfig.json missing closing brace", () => {
        fs.writeFileSync(
            path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
            `{ "compilerOptions": { "outDir": ${JSON.stringify(testDirs.OUTPUT_DIR)}, "rootDir": "src", "types": [] }, "include": ["src/**/*"]\n`,
            { encoding: "utf-8" }
        );
        createSourceFile(`export const a = 1;`, "test.ts");

        const target = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);
        const actual1 = target.status;
        const actual2 = target.output.split("'}' expected.").length - 1;

        expect(actual1).toBe(1);
        expect(actual2).toBe(1);
    }, 60000);

    it.each([
        {
            name: "addon requiring type information",
            declaration: false,
            args: () => `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons type-info-addon`,
        },
        { name: "declaration", declaration: true, args: () => "" },
    ])(
        "should exit with status 1, report the missing type definition file once and write the output w/ $name",
        ({ declaration, args }) => {
            createTsConfig({ outDir: testDirs.OUTPUT_DIR, rootDir: "src", noEmit: false, declaration, target: "esnext", types: ["does-not-exist"] });
            createSourceFile(`export const a = 1;`, "a.ts");
            createSourceFile(`export const b = 1;`, "b.ts");
            createAddon("type-info-addon", `exports.activate = () => {};`);

            const target = executeCompilerStatus(`${args()} --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);
            const actual1 = target.status;
            const actual2 = target.output.split("Cannot find type definition file for 'does-not-exist'").length - 1;
            const actual3 = getOutput("a.js") !== undefined && getOutput("b.js") !== undefined;

            expect(actual1).toBe(1);
            expect(actual2).toBe(1);
            expect(actual3).toBe(true);
        },
        60000
    );

    it("should exit with status 1 and report the rootDir violation once per file outside rootDir w/ declaration", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, rootDir: "src/lib", noEmit: false, declaration: true, target: "esnext", types: [] });
        fs.mkdirSync(path.join(testDirs.SOURCE_DIR, "lib"), { recursive: true });
        createSourceFile(`import { b } from "../b";\nexport const index = b;`, path.join("lib", "index.ts"));
        createSourceFile(`export const b = 1;`, "b.ts");
        createSourceFile(`export const c = 1;`, "c.ts");

        const target = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);
        const actual1 = target.status;
        const actual2 = target.output.split("is not under 'rootDir'").length - 1;

        expect(actual1).toBe(1);
        expect(actual2).toBe(2);
    }, 60000);

    describeOnTs5("w/ an option error of the per-file declaration Program", () => {
        it("should exit with status 1 and report the option error once w/ declaration, commonjs and bundler resolution", () => {
            createTsConfig({
                outDir: testDirs.OUTPUT_DIR,
                rootDir: "src",
                noEmit: false,
                declaration: true,
                target: "esnext",
                module: "commonjs",
                moduleResolution: "bundler",
                types: [],
            });
            createSourceFile(`export const a = 1;`, "a.ts");
            createSourceFile(`export const b = 1;`, "b.ts");

            const target = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);
            const actual1 = target.status;
            const actual2 = target.output.split("Option 'bundler' can only be used").length - 1;

            expect(actual1).toBe(1);
            expect(actual2).toBe(1);
        }, 60000);
    });

    it.each([
        { name: "--addonEmitOnly", args: () => "--addonEmitOnly" },
        { name: "file argument", args: () => path.join(testDirs.SOURCE_DIR, "test.ts") },
    ])(
        "should exit with status 0 and report no unknown compiler option w/ $name and valid project",
        ({ args }) => {
            createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, types: [] } as TscArguments);
            createSourceFile(`export const a = 1;`, "test.ts");

            const target = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} ${args()}`);
            const actual1 = target.status;
            const actual2 = target.output.includes("Unknown compiler option");

            expect(actual1).toBe(0);
            expect(actual2).toBe(false);
        },
        60000
    );

    it.each([
        { noEmitOnError: false, expected: true },
        { noEmitOnError: true, expected: false },
    ])(
        "should exit with status 1, report the declaration emit error once and write .js $expected w/ addon requiring type information, declaration and noEmitOnError $noEmitOnError",
        ({ noEmitOnError, expected }) => {
            createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, declaration: true, noEmitOnError, target: "esnext", types: [] });
            createSourceFile(`export const Foo = class { private x = 1; };`, "test.ts");
            createAddon("type-info-addon", `exports.activate = () => {};`);

            const target = executeCompilerStatus(
                `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons type-info-addon --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
            );
            const actual1 = target.status;
            const actual2 =
                target.output.split(
                    `${path.join(testDirs.SOURCE_DIR, "test.ts")} (1,14): Property 'x' of exported anonymous class type may not be private or protected.`
                ).length - 1;
            const actual3 = getOutput("test.js") !== undefined;

            expect(actual1).toBe(1);
            expect(actual2).toBe(1);
            expect(actual3).toBe(expected);
        },
        60000
    );

    it.each([
        { noEmitOnError: false, expected: true },
        { noEmitOnError: true, expected: false },
    ])(
        "should exit with status 1, report the TypeScript option error once and write .js $expected w/ option error, noEmitOnError $noEmitOnError on fast path",
        ({ noEmitOnError, expected }) => {
            createTsConfig({
                outDir: testDirs.OUTPUT_DIR,
                noEmit: false,
                noEmitOnError,
                module: "commonjs",
                moduleResolution: "node16",
                target: "esnext",
                types: [],
            } as TscArguments);
            createSourceFile(`export const a = 1;`, "test.ts");

            const target = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);
            const actual1 = target.status;
            const actual2 =
                target.output.split("Option 'module' must be set to 'Node16' when option 'moduleResolution' is set to 'Node16'").length - 1;
            const actual3 = getOutput("test.js") !== undefined;

            expect(actual1).toBe(1);
            expect(actual2).toBe(1);
            expect(actual3).toBe(expected);
        },
        60000
    );

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
        expect(actual2.split(`Addons directory "${path.join(testDirs.PROJECT_DIR, "missing-addons")}" does not exist.`).length - 1).toBe(1);
    }, 60000);

    it("should exit with status 1 and report the config error once w/ malformed websmith.config.json", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "websmith.config.json"), "{");
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const target = executeCompilerStatus(`--project tsconfig.json --configFile websmith.config.json`);
        const actual1 = target.status;
        const actual2 = target.output;
        const actual3 = actual2.split(/\r?\n/).filter(cur => /Error/.test(cur));

        expect(actual1).toBe(1);
        expect(actual2).toContain(path.join(testDirs.PROJECT_DIR, "websmith.config.json"));
        expect(actual2).not.toContain("SyntaxError");
        expect(actual2).not.toMatch(/^\s+at /m);
        expect(actual3).toEqual([expect.stringContaining(path.join(testDirs.PROJECT_DIR, "websmith.config.json"))]);
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

    it("should exit with status 1 and report 91001 once w/ result processor running nested compile through wrapped system in node ESM profile", () => {
        createEsmProject("error", []);
        const nestedSource = path.join(testDirs.PROJECT_DIR, "nested", "inner.ts");
        const nestedOutput = path.join(testDirs.OUTPUT_DIR, "nested");
        fs.mkdirSync(path.dirname(nestedSource), { recursive: true });
        fs.writeFileSync(nestedSource, `declare const require: (id: string) => unknown;\nexport const x = require("node:path");\n`, {
            encoding: "utf-8",
        });
        createAddon(
            "nested-compiler",
            `const { Compiler } = require("@quatico/websmith-core");
const ts = require("typescript");
exports.activate = ctx => ctx.registerResultProcessor((_files, processorCtx) => {
    const source = processorCtx.getSystem();
    const system = {};
    for (const key in source) system[key] = source[key];
    system.writeFile = (...args) => processorCtx.getSystem().writeFile(...args);
    new Compiler({
        reporter: processorCtx.getReporter(),
        config: { profiles: { nested: { esm: { runtime: "node" } } } },
        profile: "nested",
        tsConfig: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, outDir: ${JSON.stringify(nestedOutput)}, rootDir: ${JSON.stringify(path.dirname(nestedSource))}, types: [] },
        cliArgs: { fileNames: [${JSON.stringify(nestedSource)}], options: {}, errors: [] },
    }, {}, system).compile();
});`
        );
        createWebsmithConfig({
            profiles: {
                client: {
                    addons: ["nested-compiler"],
                    esm: { runtime: "node" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                },
            },
        });

        const target = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output.split(/\r?\n/).filter(cur => cur.includes(`${path.join(nestedOutput, "inner.js")} (1,18): ESM91001`));

        expect(actual1).toBe(1);
        expect(actual2).toEqual([expect.stringContaining(`(source "nested/inner.ts", profile "nested").`)]);
    }, 60000);

    it("should report 91001 without naming transformer addon w/ transformer only adding synthetic comment in node ESM profile", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    addons: ["comment-transformer"],
                    esm: { runtime: "node" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                },
            },
        });
        createSourceFile(`declare const require: (id: string) => unknown;\nexport const x = require("node:path");\n`, "test.ts");
        createAddon(
            "comment-transformer",
            `const ts = require("typescript");
exports.activate = ctx => ctx.registerTransformer({
    before: [() => sourceFile => {
        sourceFile.statements.forEach(cur => ts.addSyntheticLeadingComment(cur, ts.SyntaxKind.MultiLineCommentTrivia, " banner ", true));
        return sourceFile;
    }],
});`
        );

        const target = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.output;
        const actual2 = getOutput("test.js");

        expect(actual1).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.js")} (2,18): ESM91001`);
        expect(actual1).not.toContain("addons: comment-transformer");
        expect(actual2).toContain("/* banner */");
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

    it("should exit with zero status w/ UMD wrapper in node ESM profile", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "node" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                },
            },
        });
        createSourceFile(
            [
                `// @ts-nocheck`,
                `(function (factory) {`,
                `    if (typeof module === "object" && typeof module.exports === "object") {`,
                `        var v = factory(require, exports);`,
                `        if (v !== undefined) module.exports = v;`,
                `    } else {`,
                `        globalThis.lib = factory();`,
                `    }`,
                `})(function () { return { x: 1 }; });`,
                `export {};`,
            ].join("\n"),
            "test.ts"
        );

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).not.toContain("ESM910");
    }, 60000);

    it("should exit with zero status w/ default import of __esModule package shadowed by local in node ESM profile", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        const packageDir = path.join(testDirs.PROJECT_DIR, "node_modules", "esmodule-package");
        fs.mkdirSync(packageDir, { recursive: true });
        fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({ name: "esmodule-package" }), { encoding: "utf-8" });
        fs.writeFileSync(
            path.join(packageDir, "index.js"),
            `"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports.default = def;\nexports.named = 1;\nfunction def() { }`,
            { encoding: "utf-8" }
        );
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "node" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                },
            },
        });
        createSourceFile(
            `// @ts-nocheck\nimport pkg from "esmodule-package";\nfunction f() { const pkg = () => 1; return pkg(); }\nexport const value = [pkg.named, f()];`,
            "test.ts"
        );

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).not.toContain("ESM910");
    }, 60000);

    it("should exit with zero status w/ query and percent-encoded relative imports in node ESM profile", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "my file.js"), `export const c = "c";`, { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "node" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                },
            },
        });
        createSourceFile(`export const b = "b";`, "b.ts");
        createSourceFile(`// @ts-nocheck\nimport { b } from "./b.js?v=1";\nimport { c } from "./my%20file.js";\nexport const a = [b, c];`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).not.toContain("ESM910");
    }, 60000);

    it("should exit with status 1 and report 91013 in emitted file w/ JSON import with query in node ESM profile", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "d.json"), JSON.stringify({ d: 1 }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "node" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                },
            },
        });
        createSourceFile(`// @ts-nocheck\nimport d from "./d.json?v=1";\nexport const value = d;`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.js")} (2,15): ESM91013`);
    }, 60000);

    it("should exit with status 1 and report 91013 in emitted file w/ bare JSON import in node ESM profile", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        const packageDir = path.join(testDirs.PROJECT_DIR, "node_modules", "jpkg");
        fs.mkdirSync(packageDir, { recursive: true });
        fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({ name: "jpkg" }), { encoding: "utf-8" });
        fs.writeFileSync(path.join(packageDir, "d.json"), JSON.stringify({ d: 1 }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "node" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                },
            },
        });
        createSourceFile(`// @ts-nocheck\nimport d from "jpkg/d.json";\nexport const value = d;`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.js")} (2,15): ESM91013`);
    }, 60000);

    it("should exit with status 1 and report 91010 in emitted file w/ extensionless dynamic import in .cts source in node ESM profile", () => {
        fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "nodenext", moduleResolution: "nodenext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "node" },
                    tsConfig: {
                        outDir: testDirs.OUTPUT_DIR,
                        target: ts.ScriptTarget.ESNext,
                        module: ts.ModuleKind.NodeNext,
                        moduleResolution: ts.ModuleResolutionKind.NodeNext,
                    },
                },
            },
        });
        createSourceFile(`export const b = "b";`, "b.ts");
        createSourceFile(`// @ts-nocheck\nexport const load = () => import("./b");`, "test.cts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = fs.readFileSync(path.join(testDirs.OUTPUT_DIR, "test.cjs"), { encoding: "utf-8" });
        const actual3 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`import("./b")`);
        expect(actual3).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.cjs")} (5,27): ESM91010`);
    }, 60000);

    it("should exit with status 1 and report 91012 in emitted file w/ import of directory without index file in bundler profile", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({}), { encoding: "utf-8" });
        fs.mkdirSync(path.join(testDirs.OUTPUT_DIR, "dir"), { recursive: true });
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "dir", "other.js"), `export const o = "o";`, { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "bundler" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                },
            },
        });
        createSourceFile(`// @ts-nocheck\nimport "./dir";\nexport const a = "a";`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.js")} (2,8): ESM91012`);
    }, 60000);

    it("should exit with zero status w/ import of directory with package.json module field in bundler profile", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({}), { encoding: "utf-8" });
        fs.mkdirSync(path.join(testDirs.OUTPUT_DIR, "d2"), { recursive: true });
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "d2", "package.json"), JSON.stringify({ module: "m.js" }), { encoding: "utf-8" });
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "d2", "m.js"), `export const m = "m";`, { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "bundler" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                },
            },
        });
        createSourceFile(`// @ts-nocheck\nimport "./d2";\nexport const a = "a";`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).not.toContain("ESM910");
    }, 60000);

    it("should exit with status 1 and report 91022 in emitted file w/ import of unexported package subpath in node ESM profile", () => {
        createNodeModule("epkg", {
            "package.json": JSON.stringify({ name: "epkg", type: "module", exports: { ".": "./index.js" } }),
            "index.js": "",
            "internal.js": "",
        });
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "node" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                },
            },
        });
        createSourceFile(`// @ts-nocheck\nimport x from "epkg/internal.js";\nexport const value = x;`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.js")} (2,15): ESM91022`);
    }, 60000);

    it("should exit with status 1 and report 91023 in emitted file w/ extensionless package subpath in node ESM profile", () => {
        createNodeModule("npkg", { "package.json": JSON.stringify({ name: "npkg" }), "sub.js": "module.exports = 1;" });
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "node" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                },
            },
        });
        createSourceFile(`// @ts-nocheck\nimport x from "npkg/sub";\nexport const value = x;`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.js")} (2,15): ESM91023`);
    }, 60000);

    it("should exit with status 1 and report 91024 in emitted file w/ tsconfig paths alias in node ESM profile", () => {
        fs.mkdirSync(path.join(testDirs.SOURCE_DIR, "lib"), { recursive: true });
        createSourceFile(`export default "l";`, path.join("lib", "l.ts"));
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "node" },
                    tsConfig: {
                        outDir: testDirs.OUTPUT_DIR,
                        target: ts.ScriptTarget.ESNext,
                        module: ts.ModuleKind.ESNext,
                        paths: { "@app/*": ["./src/lib/*"] },
                    },
                },
            },
        });
        createSourceFile(`import l from "@app/l";\nexport const value = l;`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.js")} (1,15): ESM91024`);
    }, 60000);

    it("should exit with zero status w/ import of exported package subpath in node ESM profile", () => {
        createNodeModule("epkg", {
            "package.json": JSON.stringify({ name: "epkg", type: "module", exports: { "./feature": "./feature.js" } }),
            "feature.js": "export default 1;",
        });
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "node" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                },
            },
        });
        createSourceFile(`// @ts-nocheck\nimport x from "epkg/feature";\nexport const value = x;`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).not.toContain("ESM910");
    }, 60000);

    it("should exit with zero status w/ package self-reference in node ESM profile", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "node" },
                    tsConfig: {
                        outDir: testDirs.OUTPUT_DIR,
                        target: ts.ScriptTarget.ESNext,
                        module: ts.ModuleKind.ESNext,
                        paths: { selfpkg: ["./src/lib.ts"] },
                    },
                },
            },
        });
        fs.writeFileSync(
            path.join(testDirs.OUTPUT_DIR, "package.json"),
            JSON.stringify({ name: "selfpkg", type: "module", exports: { ".": "./lib.js" } }),
            { encoding: "utf-8" }
        );
        createSourceFile(`export default "lib";`, "lib.ts");
        createSourceFile(`import lib from "selfpkg";\nexport const value = lib;`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).not.toContain("ESM910");
    }, 60000);

    it("should exit with zero status w/ symlinked workspace package matching paths alias in node ESM profile", () => {
        const workspaceDir = path.join(testDirs.PROJECT_DIR, "packages", "l");
        fs.mkdirSync(workspaceDir, { recursive: true });
        fs.writeFileSync(path.join(workspaceDir, "package.json"), JSON.stringify({ name: "@app/l", type: "module", exports: "./index.js" }), {
            encoding: "utf-8",
        });
        fs.writeFileSync(path.join(workspaceDir, "index.js"), `export default "l";`, { encoding: "utf-8" });
        fs.mkdirSync(path.join(testDirs.PROJECT_DIR, "node_modules", "@app"), { recursive: true });
        fs.symlinkSync(workspaceDir, path.join(testDirs.PROJECT_DIR, "node_modules", "@app", "l"), "junction");
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "node" },
                    tsConfig: {
                        outDir: testDirs.OUTPUT_DIR,
                        target: ts.ScriptTarget.ESNext,
                        module: ts.ModuleKind.ESNext,
                        paths: { "@app/*": ["./packages/*/index.js"] },
                    },
                },
            },
        });
        createSourceFile(`// @ts-nocheck\nimport l from "@app/l";\nexport const value = l;`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).not.toContain("ESM910");
    }, 60000);

    it("should exit with zero status w/ development-only export and customConditions in node ESM profile", () => {
        createNodeModule("dpkg", {
            "package.json": JSON.stringify({ name: "dpkg", type: "module", exports: { ".": { development: "./dev.js" } } }),
            "dev.js": "export default 1;",
        });
        createPackageJson({ type: "module" });
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: "esnext",
            module: "nodenext",
            moduleResolution: "nodenext",
            customConditions: ["development"],
            types: [],
        });
        createWebsmithConfig({
            profiles: {
                client: {
                    esm: { runtime: "node" },
                    tsConfig: {
                        outDir: testDirs.OUTPUT_DIR,
                        target: ts.ScriptTarget.ESNext,
                        module: ts.ModuleKind.NodeNext,
                        moduleResolution: ts.ModuleResolutionKind.NodeNext,
                        customConditions: ["development"],
                    },
                },
            },
        });
        createSourceFile(`// @ts-nocheck\nimport x from "dpkg";\nexport const value = x;`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).not.toContain("ESM910");
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

    describe("w/ --watch and generator adding an input file", () => {
        const waitFor = async (predicate: () => boolean, timeoutMs: number, getOutput: () => string): Promise<void> => {
            const start = Date.now();
            while (!predicate()) {
                if (Date.now() - start > timeoutMs) {
                    throw new Error(`Timed out after ${timeoutMs} ms. Output:\n${getOutput()}`);
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        };

        // Repeats the edit until the output shows it: an edit right after the first emit can precede the file's watcher
        const editUntil = async (edit: () => void, predicate: () => boolean, timeoutMs: number, getOutput: () => string): Promise<void> => {
            const start = Date.now();
            for (;;) {
                edit();
                try {
                    await waitFor(predicate, 2000, getOutput);
                    return;
                } catch (err) {
                    if (Date.now() - start > timeoutMs) {
                        throw err;
                    }
                }
            }
        };

        // Waits for the exit, so the next test's cleanup does not race the watcher of this one
        const stopChild = async (child: ChildProcess): Promise<void> => {
            if (child.exitCode !== null || child.signalCode !== null) {
                return;
            }
            const exited = new Promise(resolve => child.once("exit", resolve));
            child.kill();
            await exited;
        };

        const startWatchCompiler = () => {
            createAddon(
                "gen",
                `exports.activate = ctx => ctx.registerGenerator(f => { if (f.endsWith("a.ts")) ctx.addInputFile(require("path").join(require("path").dirname(f), "gen.ts")); });`
            );
            fs.writeFileSync(
                path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
                JSON.stringify({ compilerOptions: { outDir: "dist", rootDir: "src", target: "esnext", types: [] }, include: ["src/a.ts"] }),
                { encoding: "utf-8" }
            );
            createSourceFile(`export const a = 1;`, "a.ts");
            createSourceFile(`export const g = 1;`, "gen.ts");
            const binPath = path.join(__dirname, "..", "bin", "bin.js");
            const child = spawn(
                "node",
                [
                    binPath,
                    "--addonsDir",
                    path.join(testDirs.PROJECT_DIR, "addons"),
                    "--addons",
                    "gen",
                    "--project",
                    path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
                    "--watch",
                ],
                { cwd: testDirs.PROJECT_DIR }
            );
            let output = "";
            child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
            child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
            return { child, getOutput: () => output };
        };

        it("should emit generator-added file on first watch build", async () => {
            const { child, getOutput } = startWatchCompiler();
            try {
                await waitFor(() => fs.existsSync(path.join(testDirs.OUTPUT_DIR, "a.js")), 30000, getOutput);
                await waitFor(() => fs.existsSync(path.join(testDirs.OUTPUT_DIR, "gen.js")), 5000, getOutput);

                const actual = fs.readFileSync(path.join(testDirs.OUTPUT_DIR, "gen.js"), "utf-8");

                expect(actual).toContain("export const g = 1;");
            } finally {
                await stopChild(child);
            }
        }, 60000);

        it("should report a syntax error in a generator-added file once w/ rebuilds re-adding it", async () => {
            const { child, getOutput } = startWatchCompiler();
            try {
                await waitFor(() => fs.existsSync(path.join(testDirs.OUTPUT_DIR, "a.js")), 30000, getOutput);
                for (const value of [2, 3]) {
                    await editUntil(
                        () => createSourceFile(`export const a = ${value};`, "a.ts"),
                        () => fs.readFileSync(path.join(testDirs.OUTPUT_DIR, "a.js"), "utf-8").includes(`a = ${value}`),
                        10000,
                        getOutput
                    );
                }
                createSourceFile(`export const g = ;`, "gen.ts");
                await waitFor(() => getOutput().includes("Expression expected."), 10000, getOutput);
                await new Promise(resolve => setTimeout(resolve, 1000));

                const actual = getOutput().split("Expression expected.").length - 1;

                expect(actual).toBe(1);
            } finally {
                await stopChild(child);
            }
        }, 60000);
    });

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
            compilerOptions: config.outDir && !config.rootDir ? { ...config, rootDir: "src" } : config,
            include: ["src/**/*"],
            exclude: ["node_modules", "dist"],
        };
        fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "tsconfig.json"), JSON.stringify(tsConfig, null, 2), { encoding: "utf-8" });
    };

    const getOutput = (filePath: string): string | undefined =>
        fs.existsSync(path.join(testDirs.OUTPUT_DIR, filePath)) ? fs.readFileSync(path.join(testDirs.OUTPUT_DIR, filePath), "utf-8") : undefined;

    const findOutputs = (baseName: string): string[] =>
        fs.readdirSync(testDirs.OUTPUT_DIR, { recursive: true, encoding: "utf-8" }).filter(cur => path.basename(cur) === baseName);

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

    const createNodeModule = (name: string, files: Record<string, string>) => {
        const packageDir = path.join(testDirs.PROJECT_DIR, "node_modules", name);
        fs.mkdirSync(packageDir, { recursive: true });
        Object.entries(files).forEach(([fileName, content]) => fs.writeFileSync(path.join(packageDir, fileName), content, { encoding: "utf-8" }));
    };

    const createWebsmithConfig = (config: CompilationConfig) => {
        fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "websmith.config.json"), JSON.stringify(config), { encoding: "utf-8" });
    };
});
