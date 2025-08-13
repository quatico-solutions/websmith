/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { TscArguments } from "@quatico/websmith-api";
import type { CompilationConfig } from "@quatico/websmith-core";
import { execSync } from "node:child_process";
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
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext" });
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
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext" });
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
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext" });
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
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext" });
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

    const executeCompiler = (args = ""): string => {
        process.chdir(testDirs.PROJECT_DIR);

        const binPath = path.join(__dirname, "..", "bin", "bin.js");
        if (!fs.existsSync(binPath)) {
            throw new Error(`Bundled compiler not found at ${binPath}. Please run 'pnpm build' first.`);
        }

        try {
            return execSync(`node ${binPath} ${args.trim()}`, {
                encoding: "utf8",
                stdio: "pipe",
                timeout: 30000, // 30 second timeout
                cwd: testDirs.PROJECT_DIR,
            });
        } catch (error: any) {
            // For testing, we still want to return some output even on errors
            const stderr = error.stderr?.toString() || "";
            const stdout = error.stdout?.toString() || "";
            const output = stdout + stderr;

            // Log the error for debugging
            console.log("Compiler execution details:");
            console.log("Command:", `node ${binPath} ${`${args}`.trim()}`);
            console.log("CWD:", testDirs.PROJECT_DIR);
            console.log("Exit code:", error.status);
            console.log("Output:", output);

            return output;
        }
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

    const createWebsmithConfig = (config: CompilationConfig) => {
        fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "websmith.config.json"), JSON.stringify(config), { encoding: "utf-8" });
    };
});
