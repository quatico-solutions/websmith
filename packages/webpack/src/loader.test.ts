/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Compiler, NoReporter } from "@quatico/websmith-core";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { TsCompiler } from "./TsCompiler";
import { type TscArguments } from "@quatico/websmith-api";

// Create unique test directories for each test to prevent cross-test contamination
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const timestamp = Date.now();
    const uniqueId = `${testId}_${timestamp}`;
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-${uniqueId}`);
    const OUTPUT_DIR = path.join(PROJECT_DIR, "dist");
    const SOURCE_DIR = path.join(PROJECT_DIR, "src");
    const TSCONFIG_FILE = path.join(PROJECT_DIR, "./tsconfig.json");
    return { PROJECT_DIR, OUTPUT_DIR, SOURCE_DIR, TSCONFIG_FILE };
};

// Use source addons during tests, not compiled lib directory (avoids cross-package dependencies)
const ADDONS_DIR = path.resolve(__dirname, "..", "..", "example-addons", "src");

let originalCwd: string;
let testDirs: ReturnType<typeof getTestDirs>;

beforeEach(() => {
    // Generate unique test directories for this specific test
    testDirs = getTestDirs();

    // Store original working directory
    originalCwd = process.cwd();

    // Force consistent working directory for this package's tests
    const packageDir = path.resolve(__dirname, "..");
    if (process.cwd() !== packageDir) {
        try {
            process.chdir(packageDir);
        } catch (error) {
            console.warn(`Failed to change to package directory ${packageDir}: ${error}`);
        }
    }

    // Clean up and recreate directories (unique for this test)
    try {
        fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
    } catch (_error) {
        // Ignore errors if directory doesn't exist
    }
    fs.mkdirSync(testDirs.SOURCE_DIR, { recursive: true });
    fs.mkdirSync(testDirs.OUTPUT_DIR, { recursive: true });

    // Verify that source addons directory exists (required for tests)
    if (!fs.existsSync(ADDONS_DIR)) {
        throw new Error(`Addons source directory not found: ${ADDONS_DIR}. Tests require source addons, not compiled lib.`);
    }
});

afterEach(() => {
    // Restore all mocks
    jest.restoreAllMocks();

    // Restore working directory safely with better error handling
    try {
        if (originalCwd && fs.existsSync(originalCwd) && originalCwd !== process.cwd()) {
            process.chdir(originalCwd);
        }
    } catch (error) {
        console.warn(`Failed to restore working directory to ${originalCwd}: ${error}`);
        // Try to change to a safe fallback directory
        try {
            const fallbackDir = path.resolve(__dirname, "..", "..");
            if (fs.existsSync(fallbackDir)) {
                process.chdir(fallbackDir);
            }
        } catch (fallbackError) {
            console.warn(`Failed to change to fallback directory: ${fallbackError}`);
        }
    }

    // Clean up directories with better error handling (unique for this test)
    if (testDirs) {
        try {
            if (fs.existsSync(testDirs.PROJECT_DIR)) {
                fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
            }
        } catch (error) {
            console.warn(`Failed to clean up test directory ${testDirs.PROJECT_DIR}: ${error}`);
        }
    }
});

describe("loader.test.ts e2e tests (adapted from bin.test.ts)", () => {
    it("should yield script file with single file and emit true", () => {
        createTsConfigFile({ outDir: testDirs.OUTPUT_DIR, noEmit: false });
        createSourceFile(
            `
            export const hello = "world";            
            export function greet(name: string): string {
                return \`Hello, \${name}!\`;
            }    
        `,
            "test.ts"
        );

        // Test TsCompiler directly (webpack loader equivalent) - this is what this test should focus on
        const tsCompiler = new TsCompiler(
            {
                tsConfig: { outDir: testDirs.OUTPUT_DIR, noEmit: false },
                cliArgs: {
                    options: {},
                    fileNames: [path.join(testDirs.SOURCE_DIR, "test.ts")],
                    errors: [],
                },
            },
            {
                tsConfigFile: testDirs.TSCONFIG_FILE,
                transpileOnly: true,
            }
        );

        const result = tsCompiler.build(path.join(testDirs.SOURCE_DIR, "test.ts"));

        // Verify TsCompiler succeeded - this is the main purpose of this test
        expect(result.files.length).toBeGreaterThan(0);
        const jsFile = result.files.find(f => f.name.endsWith("test.js"));
        expect(jsFile).toBeDefined();

        // Check that the compiled content contains expected elements
        expect(jsFile?.text).toContain("hello");
        expect(jsFile?.text).toContain("greet");
    }, 60000);

    it("should yield script and declaration files with single file, declaration and emit true", () => {
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            declaration: true,
            declarationMap: true,
        });
        createSourceFile(
            `
            // @annotated()
            export const getFoobar = (date: Date) => {
                return foobar(date);
            };
            
            const foobar = (date: Date) => {
                return \`foobar \${date.toISOString()}\`;
            };
        `,
            "foobar-arrow.ts"
        );

        // First establish baseline with core Compiler
        process.chdir(testDirs.PROJECT_DIR);
        const compilerResult = new Compiler({
            reporter: new NoReporter(),
            tsConfig: {
                outDir: testDirs.OUTPUT_DIR,
                noEmit: false,
                declaration: true,
                declarationMap: true,
            },
            cliArgs: {
                options: {},
                fileNames: [path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts")],
                errors: [],
            },
        }).compile();

        // Then test TsCompiler (webpack loader equivalent)
        const tsCompiler = new TsCompiler(
            {
                tsConfig: {
                    outDir: testDirs.OUTPUT_DIR,
                    noEmit: false,
                    declaration: true,
                    declarationMap: true,
                },
                cliArgs: {
                    options: {},
                    fileNames: [path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts")],
                    errors: [],
                },
            },
            {
                tsConfigFile: testDirs.TSCONFIG_FILE,
                transpileOnly: false, // Need full compilation for declaration files
            }
        );

        const result = tsCompiler.build(path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts"));

        // Verify core Compiler succeeded (establishes baseline)
        expect(compilerResult.diagnostics).toEqual([]);
        expect(compilerResult.emitSkipped).toBe(false);
        expect(getOutput("foobar-arrow.js")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts.map")).toBeDefined();

        // Verify TsCompiler also succeeded
        expect(result.files.length).toBeGreaterThan(0);

        const jsFile = result.files.find(f => f.name.endsWith("foobar-arrow.js"));
        const dtsFile = result.files.find(f => f.name.endsWith("foobar-arrow.d.ts"));
        const dtsMapFile = result.files.find(f => f.name.endsWith("foobar-arrow.d.ts.map"));

        expect(jsFile).toBeDefined();
        expect(dtsFile).toBeDefined();
        expect(dtsMapFile).toBeDefined();

        // Check baseline content
        const baselineJs = getOutput("foobar-arrow.js");
        const baselineDts = getOutput("foobar-arrow.d.ts");
        expect(baselineJs).toContain("getFoobar");
        expect(baselineJs).toContain("foobar");
        expect(baselineDts).toContain("export declare const getFoobar");
    }, 60000);

    it("should yield transpiled script with single file and different target/module settings", () => {
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: "es5",
            module: "commonjs",
        });
        createSourceFile(
            `
            // @annotated()
            export function getFoobar(date: Date): string {
                return foobar(date);
            }
            
            function foobar(date: Date): string {
                return \`foobar \${date.toISOString()}\`;
            }
        `,
            "foobar-function.ts"
        );

        // First establish baseline with core Compiler
        process.chdir(testDirs.PROJECT_DIR);
        const compilerResult = new Compiler({
            reporter: new NoReporter(),
            tsConfig: {
                outDir: testDirs.OUTPUT_DIR,
                noEmit: false,
                target: ts.ScriptTarget.ES5,
                module: ts.ModuleKind.CommonJS,
            },
            cliArgs: {
                options: {},
                fileNames: [path.join(testDirs.SOURCE_DIR, "foobar-function.ts")],
                errors: [],
            },
        }).compile();

        // Then test TsCompiler (webpack loader equivalent)
        const tsCompiler = new TsCompiler(
            {
                tsConfig: {
                    outDir: testDirs.OUTPUT_DIR,
                    noEmit: false,
                    target: ts.ScriptTarget.ES5,
                    module: ts.ModuleKind.CommonJS,
                },
                cliArgs: {
                    options: {},
                    fileNames: [path.join(testDirs.SOURCE_DIR, "foobar-function.ts")],
                    errors: [],
                },
            },
            {
                tsConfigFile: testDirs.TSCONFIG_FILE,
                transpileOnly: true,
            }
        );

        const result = tsCompiler.build(path.join(testDirs.SOURCE_DIR, "foobar-function.ts"));

        // Verify core Compiler succeeded (establishes baseline)
        expect(compilerResult.diagnostics).toEqual([]);
        expect(compilerResult.emitSkipped).toBe(false);
        expect(getOutput("foobar-function.js")).toBeDefined();

        // Verify TsCompiler also succeeded
        expect(result.files.length).toBeGreaterThan(0);
        const jsFile = result.files.find(f => f.name.endsWith("foobar-function.js"));
        expect(jsFile).toBeDefined();

        // Check baseline content
        const baselineContent = getOutput("foobar-function.js");
        expect(baselineContent).toContain("getFoobar");
        expect(baselineContent).toContain("function");
    }, 60000);

    it("should handle ESNext target compilation", () => {
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: "esnext",
            module: "esnext",
            moduleResolution: "node10",
        });
        createSourceFile(
            `
            export const getValue = () => "test";
            export const asyncFunction = async () => {
                const result = await Promise.resolve("async result");
                return result;
            };
            export const destructured = { a: 1, b: 2 };
            export const { a, b } = destructured;
        `,
            "modern-syntax.ts"
        );

        // First establish baseline with core Compiler
        process.chdir(testDirs.PROJECT_DIR);
        const compilerResult = new Compiler({
            reporter: new NoReporter(),
            tsConfig: {
                outDir: testDirs.OUTPUT_DIR,
                noEmit: false,
                target: ts.ScriptTarget.ESNext,
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Node10,
            },
            cliArgs: {
                options: {},
                fileNames: [path.join(testDirs.SOURCE_DIR, "modern-syntax.ts")],
                errors: [],
            },
        }).compile();

        // Then test TsCompiler (webpack loader equivalent)
        const tsCompiler = new TsCompiler(
            {
                tsConfig: {
                    outDir: testDirs.OUTPUT_DIR,
                    noEmit: false,
                    target: ts.ScriptTarget.ESNext,
                    module: ts.ModuleKind.ESNext,
                    moduleResolution: ts.ModuleResolutionKind.Node10,
                },
                cliArgs: {
                    options: {},
                    fileNames: [path.join(testDirs.SOURCE_DIR, "modern-syntax.ts")],
                    errors: [],
                },
            },
            {
                tsConfigFile: testDirs.TSCONFIG_FILE,
                transpileOnly: true,
            }
        );

        const result = tsCompiler.build(path.join(testDirs.SOURCE_DIR, "modern-syntax.ts"));

        // Verify core Compiler succeeded (establishes baseline)
        expect(compilerResult.diagnostics).toEqual([]);
        expect(compilerResult.emitSkipped).toBe(false);
        expect(getOutput("modern-syntax.js")).toBeDefined();

        // Verify TsCompiler also succeeded
        expect(result.files.length).toBeGreaterThan(0);
        const jsFile = result.files.find(f => f.name.endsWith("modern-syntax.js"));
        expect(jsFile).toBeDefined();

        // Check baseline content
        const baselineContent = getOutput("modern-syntax.js");
        expect(baselineContent).toContain("getValue");
        expect(baselineContent).toContain("async");
        expect(baselineContent).toContain("await");
    }, 60000);

    it("should handle multiple compilation targets", () => {
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
        });
        createSourceFile(
            `
            export interface User {
                id: number;
                name: string;
            }
            
            export const createUser = (id: number, name: string): User => ({
                id,
                name,
            });
            
            export const formatUser = (user: User): string => 
                \`User \${user.id}: \${user.name}\`;
        `,
            "multi-file.ts"
        );

        // First establish baseline with core Compiler (using ES5 as baseline)
        process.chdir(testDirs.PROJECT_DIR);
        const compilerResult = new Compiler({
            reporter: new NoReporter(),
            tsConfig: {
                outDir: testDirs.OUTPUT_DIR,
                noEmit: false,
                target: ts.ScriptTarget.ES5,
                module: ts.ModuleKind.CommonJS,
            },
            cliArgs: {
                options: {},
                fileNames: [path.join(testDirs.SOURCE_DIR, "multi-file.ts")],
                errors: [],
            },
        }).compile();

        // Test with ES5/CommonJS
        const tsCompilerES5 = new TsCompiler(
            {
                tsConfig: {
                    outDir: testDirs.OUTPUT_DIR,
                    noEmit: false,
                    target: ts.ScriptTarget.ES5,
                    module: ts.ModuleKind.CommonJS,
                },
                cliArgs: {
                    options: {},
                    fileNames: [path.join(testDirs.SOURCE_DIR, "multi-file.ts")],
                    errors: [],
                },
            },
            {
                tsConfigFile: testDirs.TSCONFIG_FILE,
                transpileOnly: true,
            }
        );

        // Test with ESNext/ESNext
        const tsCompilerESNext = new TsCompiler(
            {
                tsConfig: {
                    outDir: testDirs.OUTPUT_DIR,
                    noEmit: false,
                    target: ts.ScriptTarget.ESNext,
                    module: ts.ModuleKind.ESNext,
                },
                cliArgs: {
                    options: {},
                    fileNames: [path.join(testDirs.SOURCE_DIR, "multi-file.ts")],
                    errors: [],
                },
            },
            {
                tsConfigFile: testDirs.TSCONFIG_FILE,
                transpileOnly: true,
            }
        );

        const resultES5 = tsCompilerES5.build(path.join(testDirs.SOURCE_DIR, "multi-file.ts"));
        const resultESNext = tsCompilerESNext.build(path.join(testDirs.SOURCE_DIR, "multi-file.ts"));

        // Verify core Compiler succeeded (establishes baseline)
        expect(compilerResult.diagnostics).toEqual([]);
        expect(compilerResult.emitSkipped).toBe(false);
        expect(getOutput("multi-file.js")).toBeDefined();

        // Verify both TsCompiler instances succeeded
        expect(resultES5.files.length).toBeGreaterThan(0);
        expect(resultESNext.files.length).toBeGreaterThan(0);

        const jsFileES5 = resultES5.files.find(f => f.name.endsWith("multi-file.js"));
        const jsFileESNext = resultESNext.files.find(f => f.name.endsWith("multi-file.js"));

        expect(jsFileES5).toBeDefined();
        expect(jsFileESNext).toBeDefined();

        // Check baseline content (ES5 version)
        const baselineContent = getOutput("multi-file.js");
        expect(baselineContent).toContain("createUser");
        expect(baselineContent).toContain("formatUser");
    }, 60000);

    it("should handle source maps generation", () => {
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            sourceMap: true,
        });
        createSourceFile(
            `
            export const add = (a: number, b: number): number => a + b;
            export const multiply = (a: number, b: number): number => a * b;
        `,
            "source-map-test.ts"
        );

        // Demonstrate optional nature: minimal configuration without explicit cliArgs and reporter
        // (they get sensible defaults from the framework)
        const tsCompiler = new TsCompiler(
            {
                tsConfig: {
                    outDir: testDirs.OUTPUT_DIR,
                    noEmit: false,
                    sourceMap: true,
                },
            },
            {
                tsConfigFile: testDirs.TSCONFIG_FILE,
                transpileOnly: true,
            }
        );

        const result = tsCompiler.build(path.join(testDirs.SOURCE_DIR, "source-map-test.ts"));

        expect(result.files.length).toBeGreaterThan(0);
        const jsFile = result.files.find(f => f.name.endsWith("source-map-test.js"));
        const mapFile = result.files.find(f => f.name.endsWith("source-map-test.js.map"));

        expect(jsFile).toBeDefined();
        expect(mapFile).toBeDefined();
        expect(jsFile?.text).toContain("sourceMappingURL");
        expect(mapFile?.text).toContain("version");
        expect(mapFile?.text).toContain("sources");
    }, 60000);

    it("should work with minimal configuration (demonstrating optional cliArgs/reporter)", () => {
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
        });
        createSourceFile(`export const minimal = "example";`, "minimal.ts");

        // This demonstrates the optional nature: only providing the essential properties
        const tsCompiler = new TsCompiler(
            {
                // No explicit cliArgs (gets default: { options: {}, fileNames: [], errors: [] })
                // No explicit reporter (gets default: DefaultReporter)
            },
            {
                tsConfigFile: testDirs.TSCONFIG_FILE,
                transpileOnly: true,
            }
        );

        const result = tsCompiler.build(path.join(testDirs.SOURCE_DIR, "minimal.ts"));

        // TsCompiler should work even with minimal configuration
        expect(result.files.length).toBeGreaterThan(0);
        const jsFile = result.files.find(f => f.name.endsWith("minimal.js"));
        expect(jsFile).toBeDefined();
        expect(jsFile?.text).toContain("minimal");
    });

    it("should handle compilation errors gracefully", () => {
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            strict: true,
        });
        createSourceFile(
            `
            // This should cause compilation errors
            export const invalidCode = (param) => {
                return param.nonExistentProperty;
            };
            
            export const anotherError: string = 123; // Type error
        `,
            "error-test.ts"
        );

        // Another example of optional cliArgs/reporter - errors are handled gracefully with defaults
        const tsCompiler = new TsCompiler(
            {
                tsConfig: {
                    outDir: testDirs.OUTPUT_DIR,
                    noEmit: false,
                    strict: true,
                },
            },
            {
                tsConfigFile: testDirs.TSCONFIG_FILE,
                transpileOnly: true, // transpileOnly mode should still produce output despite errors
            }
        );

        const result = tsCompiler.build(path.join(testDirs.SOURCE_DIR, "error-test.ts"));

        // Even with errors, transpileOnly mode should produce some output
        expect(result.files.length).toBeGreaterThan(0);
        const jsFile = result.files.find(f => f.name.endsWith("error-test.js"));
        expect(jsFile).toBeDefined();
    });
});

describe("addonsDir configuration tests", () => {
    it("should use addonsDir from websmith.config.json", () => {
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
        });
        createSourceFile(
            `
                export const foobarFunction = () => "Hello from foobar!";
            `,
            "foobar-test.ts"
        );

        // Create websmith.config.json with addonsDir configuration
        createWebsmithConfig({
            addonsDir: ADDONS_DIR,
            addons: ["foobar-export-processor"],
        });

        const tsCompiler = new TsCompiler(
            {
                tsConfig: { outDir: testDirs.OUTPUT_DIR, noEmit: false },
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                cliArgs: {
                    options: {},
                    fileNames: [path.join(testDirs.SOURCE_DIR, "foobar-test.ts")],
                    errors: [],
                },
            },
            {
                tsConfigFile: testDirs.TSCONFIG_FILE,
                transpileOnly: false,
            }
        );

        const result = tsCompiler.build(path.join(testDirs.SOURCE_DIR, "foobar-test.ts"));

        expect(result.files.length).toBeGreaterThan(0);
        const jsFile = result.files.find(f => f.name.endsWith("foobar-test.js"));
        expect(jsFile).toBeDefined();
        expect(jsFile?.text).toContain("foobarFunction");
    });

    it("should work with function-json-result-processor addon", () => {
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
        });
        createSourceFile(
            `
                // @annotated()
                export function processFunction(input: string): string {
                    return \`Processed: \${input}\`;
                }
                
                function helperFunction(data: number): string {
                    return data.toString();
                }
            `,
            "process-test.ts"
        );

        const tsCompiler = new TsCompiler(
            {
                tsConfig: { outDir: testDirs.OUTPUT_DIR, noEmit: false },
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["function-json-result-processor"],
                },
                cliArgs: {
                    options: {},
                    fileNames: [path.join(testDirs.SOURCE_DIR, "process-test.ts")],
                    errors: [],
                },
            },
            {
                tsConfigFile: testDirs.TSCONFIG_FILE,
                transpileOnly: false,
            }
        );

        const result = tsCompiler.build(path.join(testDirs.SOURCE_DIR, "process-test.ts"));

        expect(result.files.length).toBeGreaterThan(0);
        const jsFile = result.files.find(f => f.name.endsWith("process-test.js"));
        expect(jsFile).toBeDefined();
        expect(jsFile?.text).toContain("processFunction");
        expect(jsFile?.text).toContain("helperFunction");
    });

    it("should work with multiple addons", () => {
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
        });
        createSourceFile(
            `
                // File with "foo" to trigger foo-added-generator
                export function fooProcessor(data: any): string {
                    return \`Multi-addon test: \${data}\`;
                }
                
                export const fooConfig = { enabled: true };
            `,
            "foo-multi-test.ts"
        );

        const tsCompiler = new TsCompiler(
            {
                tsConfig: { outDir: testDirs.OUTPUT_DIR, noEmit: false },
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-processor", "function-json-result-processor"],
                },
                cliArgs: {
                    options: {},
                    fileNames: [path.join(testDirs.SOURCE_DIR, "foo-multi-test.ts")],
                    errors: [],
                },
            },
            {
                tsConfigFile: testDirs.TSCONFIG_FILE,
                transpileOnly: false,
            }
        );

        const result = tsCompiler.build(path.join(testDirs.SOURCE_DIR, "foo-multi-test.ts"));

        expect(result.files.length).toBeGreaterThan(0);
        const jsFile = result.files.find(f => f.name.endsWith("foo-multi-test.js"));
        expect(jsFile).toBeDefined();
        expect(jsFile?.text).toContain("fooProcessor");
        expect(jsFile?.text).toContain("fooConfig");
    });

    it("should use default addonsDir when not specified", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
        });
        createSourceFile(
            `
                export const defaultTest = "Testing default addon behavior";
            `,
            "default-addon-test.ts"
        );

        // Create a local addons directory for default behavior test
        const localAddonsDir = path.join(testDirs.PROJECT_DIR, "addons", "test-addon");
        fs.mkdirSync(localAddonsDir, { recursive: true });

        // Create a simple test addon
        fs.writeFileSync(
            path.join(localAddonsDir, "addon.ts"),
            `
                import { type AddonContext } from "@quatico/websmith-api";
                export const activate = (ctx: AddonContext) => {
                    ctx.registerProcessor((filePath: string, content: string) => {
                        return content + "\\n// Processed by default addon";
                    });
                };
                `,
            { encoding: "utf-8" }
        );

        const tsCompiler = new TsCompiler(
            {
                tsConfig: { outDir: testDirs.OUTPUT_DIR, noEmit: false },
                config: {
                    // No explicit addonsDir - should default to "./addons"
                    addons: ["test-addon"],
                },
                cliArgs: {
                    options: {},
                    fileNames: [path.join(testDirs.SOURCE_DIR, "default-addon-test.ts")],
                    errors: [],
                },
            },
            {
                tsConfigFile: testDirs.TSCONFIG_FILE,
                transpileOnly: false,
            }
        );

        const result = tsCompiler.build(path.join(testDirs.SOURCE_DIR, "default-addon-test.ts"));

        expect(result.files.length).toBeGreaterThan(0);
        const jsFile = result.files.find(f => f.name.endsWith("default-addon-test.js"));
        expect(jsFile).toBeDefined();
        expect(jsFile?.text).toContain("defaultTest");
    });
});

// Helper functions (like bin.test.ts)
const createSourceFile = (fileContent: string, fileName: string) => {
    fs.writeFileSync(path.join(testDirs.SOURCE_DIR, fileName), fileContent, { encoding: "utf-8" });
};

const createTsConfig = (config: TscArguments) => {
    const tsConfig = {
        compilerOptions: config,
        include: ["src/**/*"],
        exclude: ["node_modules", "dist"],
    };
    return JSON.stringify(tsConfig, null, 2);
};

const createTsConfigFile = (config: TscArguments) => {
    fs.writeFileSync(path.resolve(testDirs.PROJECT_DIR, "tsconfig.json"), createTsConfig(config), { encoding: "utf-8" });
};

const getOutput = (filePath: string): string | undefined =>
    fs.existsSync(path.join(testDirs.OUTPUT_DIR, filePath)) ? fs.readFileSync(path.join(testDirs.OUTPUT_DIR, filePath), "utf-8") : undefined;

const createWebsmithConfig = (config: any) => {
    fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "websmith.config.json"), JSON.stringify(config, null, 2), { encoding: "utf-8" });
};
