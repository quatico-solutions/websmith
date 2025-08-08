/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationConfig, Compiler, createSystem, NoReporter } from "@quatico/websmith-core";
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { addCompileCommand } from "./command";

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

describe("bin.ts", () => {
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

        // Mock console.time to avoid logging during tests
        jest.spyOn(console, "time").mockImplementation(() => {});

        // Mock process.exit to prevent actual exits during tests
        jest.spyOn(process, "exit").mockImplementation(() => {
            throw new Error("process.exit() was called during test");
        });

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

    it("should create Command instance and call addCompileCommand", () => {
        const target = jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        executeCompiler("--help");

        // Verify that help text was written to stdout with correct program name
        expect(target).toHaveBeenCalledWith(expect.stringContaining("Usage: websmith [options]"));
    }, 60000);

    it("should parse process.argv with debug and watch flags", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}, { virtual: true }));
        const watchSpy = jest.spyOn(target, "watch").mockImplementation(() => target);

        executeCompiler("--debug --watch", target);

        // Verify that watch method was called (for --watch flag)
        expect(watchSpy).toHaveBeenCalled();
        expect(target.getOptions()).toMatchObject({ tsConfig: { listFiles: true, debug: true, watch: true } });
    }, 60000);

    it("should handle compilation arguments", () => {
        const target = new Compiler(
            { reporter: new NoReporter() },
            {},
            createSystem({ "./tsconfig.json": createTsConfig({ sourceMap: false }) }, { virtual: true })
        );
        executeCompiler("--project ./tsconfig.json --sourceMap", target);

        expect(target.getOptions()).toMatchObject({ tsConfig: { sourceMap: true, project: "./tsconfig.json" } });
    }, 60000);

    it("should handle addon-related arguments", () => {
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}, { virtual: true }));
        executeCompiler("--addons foo,bar --addonsDir ./custom-addons", target);

        expect(target.getOptions().tsConfig).toEqual({
            // tsconfig does not contain extraArgs
            allowJs: false,
            checkJs: false,
            configFilePath: "/tsconfig.json",
            declaration: false,
            declarationMap: false,
            emitDecorationOnly: false,
            esModuleInterop: false,
            jsx: 1,
            noEmit: false,
            pretty: true,
            project: "./tsconfig.json",
            removeComments: false,
            strict: false,
            target: 1,
        });
        expect(target.getOptions().config).toEqual({ addons: ["foo", "bar"], addonsDir: "/custom-addons" });
    }, 60000);

    it("should handle empty arguments", () => {
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}, { virtual: true }));
        executeCompiler("", target);

        expect(target.getOptions()).toEqual({
            additionalArguments: expect.any(Map),
            buildDir: "/",
            cliArgs: {
                errors: [],
                fileNames: [],
                options: {
                    allowJs: false,
                    checkJs: false,
                    configFilePath: "/tsconfig.json",
                    declaration: false,
                    declarationMap: false,
                    emitDecorationOnly: false,
                    esModuleInterop: false,
                    jsx: 1,
                    noEmit: false,
                    pretty: true,
                    project: "./tsconfig.json",
                    removeComments: false,
                    strict: false,
                    target: 1,
                },
            },
            config: {},
            debug: false,
            reporter: expect.any(NoReporter),
            system: expect.any(Object),
            tsConfig: {
                allowJs: false,
                checkJs: false,
                configFilePath: "/tsconfig.json",
                declaration: false,
                declarationMap: false,
                emitDecorationOnly: false,
                esModuleInterop: false,
                jsx: ts.JsxEmit.Preserve,
                noEmit: false,
                pretty: true,
                project: "./tsconfig.json",
                removeComments: false,
                strict: false,
                target: ts.ScriptTarget.ES5,
            },
            tsConfigFile: "/tsconfig.json",
            watch: false,
        });
    }, 60000);

    it("should handle unknown arguments", () => {
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}, { virtual: true }));
        executeCompiler("--unknown --another-unknown expected", target);

        expect(target.getOptions()).toMatchObject({
            additionalArguments: new Map<string, unknown>([
                ["unknown", true],
                ["another-unknown", "expected"],
            ]),
        });
    }, 60000);

    it("should not emit a warning without configFile specified", () => {
        const target = new NoReporter();
        jest.spyOn(target, "reportDiagnostic").mockImplementation(() => {});

        executeCompiler("", new Compiler({ reporter: target }, {}, createSystem({}, { virtual: true })));

        expect(target.reportDiagnostic).not.toHaveBeenCalled();
    }, 60000);

    it("should emit a warning with configFile but non-existing file path", () => {
        const target = new NoReporter();
        jest.spyOn(target, "reportDiagnostic").mockImplementation(() => {});

        executeCompiler(
            `--configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`,
            new Compiler({ reporter: target }, {}, createSystem({}, { virtual: true }))
        );

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining("/websmith.config.json"),
            })
        );
    }, 60000);

    it("should emit a warning with addonsDir but non-existing dir path", () => {
        const target = new NoReporter();
        jest.spyOn(target, "reportDiagnostic").mockImplementation(() => {});

        executeCompiler(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "does-not-exist")}`,
            new Compiler({ reporter: target }, {}, createSystem({}, { virtual: true }))
        );

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining("/does-not-exist"),
            })
        );
    }, 60000);

    it("should yield script file with single file and emit true", () => {
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
        });
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
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            declaration: true,
            declarationMap: true,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
        });
        copySourceFile("foobar-arrow.ts");

        executeCompiler("--project ./tsconfig.json");

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
        createTsConfigFile({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: 1, module: 3 });
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
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
        });
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
    });

    it("should yield transpiled script with single file, addons-config client-processor and emit", () => {
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
        });
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
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
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
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
        });
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
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
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
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
        });
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

    it("should pass only included files to compiler context with tsconfig include pattern", () => {
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem());
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
        });
        createSourceFile("export const included1 = 'test';", "included1.ts");
        createSourceFile("export const included2 = 'test';", "included2.ts");
        createSourceFile("export const excluded = 'test';", "excluded.js");
        createSourceFile("export const subIncluded = 'test';", "subdir/subIncluded.ts");
        createSourceFile("export const outsideSrc = 'test';", "../outsideSrc.ts");
        createSourceFile("File is not a TypeScript file", "excluded.txt");

        executeCompiler(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, target);

        // @ts-expect-error - getContext is protected
        const actual = target.getContext()!.getCliArgs().fileNames || [];

        // Should include TypeScript files from src directory and subdirectories
        expect(actual).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/src[/\\]included1\.ts$/),
                expect.stringMatching(/src[/\\]included2\.ts$/),
                expect.stringMatching(/src[/\\]subdir[/\\]subIncluded\.ts$/),
            ])
        );

        // Should not include .js files or files outside src
        expect(actual).not.toEqual(expect.arrayContaining([expect.stringMatching(/excluded\.js$/), expect.stringMatching(/outsideSrc\.ts$/)]));
    }, 60000);

    it("should pass only included files with custom include pattern", () => {
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}));
        createTsConfigFile(
            {
                outDir: testDirs.OUTPUT_DIR,
                noEmit: false,
                target: ts.ScriptTarget.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Node10,
            },
            ["src/custom/**/*.ts"],
            ["node_modules", "dist"]
        );

        createSourceFile("export const included1 = 'test';", "custom/included1.ts");
        createSourceFile("export const included2 = 'test';", "custom/included2.ts");
        createSourceFile("export const excluded = 'test';", "excluded.ts");
        createSourceFile("export const excluded2 = 'test';", "other/excluded.ts");
        createSourceFile("File is not a TypeScript file", "excluded.txt");
        createSourceFile("File is not a TypeScript file", ".gitignore");

        executeCompiler(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, target);

        // @ts-expect-error - getContext is protected
        const actual = target.getContext()?.getCliArgs().fileNames || [];

        // Should only include files from src/custom directory
        expect(actual).toEqual(
            expect.arrayContaining([expect.stringMatching(/src\/custom\/included1\.ts$/), expect.stringMatching(/src\/custom\/included2\.ts$/)])
        );

        // Should not include files from other directories
        expect(actual).not.toEqual(
            expect.arrayContaining([
                expect.stringMatching(/[^/\\]excluded\.ts$/), // excluded.ts in src/
                expect.stringMatching(/other[/\\]excluded\.ts$/), // excluded.ts in src/other/
            ])
        );

        // Verify exact count to ensure no unexpected files are included
        expect(actual).toHaveLength(2);
    }, 60000);

    it("should pass explicitly specified files when provided as CLI arguments", () => {
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}));
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
        });
        createSourceFile("export const file1 = 'test';", "file1.ts");
        createSourceFile("export const file2 = 'test';", "file2.ts");
        createSourceFile("export const file3 = 'test';", "file3.ts");

        // Execute compiler with specific files using relative paths
        const file1Rel = "src/file1.ts";
        const file3Rel = "src/file3.ts";
        executeCompiler(`${file1Rel} ${file3Rel} --project tsconfig.json`, target);

        // @ts-expect-error - getContext is protected
        const actual = target.getContext()?.getCliArgs().fileNames || [];

        // Should only include the explicitly specified files
        expect(actual).toHaveLength(2);
        expect(actual).toEqual(expect.arrayContaining([expect.stringMatching(/file1\.ts$/), expect.stringMatching(/file3\.ts$/)]));

        // Should not include file2.ts since it wasn't specified
        expect(actual).not.toEqual(expect.arrayContaining([expect.stringMatching(/file2\.ts$/)]));
    }, 60000);

    it("should pass files according to exclude pattern", () => {
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}));
        createTsConfigFile(
            {
                outDir: testDirs.OUTPUT_DIR,
                noEmit: false,
                target: ts.ScriptTarget.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Node10,
            },
            ["src/**/*.ts"],
            ["node_modules", "dist", "src/excluded/**/*"]
        );

        createSourceFile("export const included = 'test';", "included.ts");
        createSourceFile("export const excluded = 'test';", "excluded/excluded.ts");
        createSourceFile("export const included2 = 'test';", "normal/included.ts");

        executeCompiler(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, target);

        // @ts-expect-error - getContext is protected
        const actual = target.getContext()?.getCliArgs().fileNames || [];

        // Should include files not in excluded directory
        expect(actual).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/src[/\\]included\.ts$/), // included.ts in src/
                expect.stringMatching(/src[/\\]normal[/\\]included\.ts$/), // included.ts in src/normal/
            ])
        );

        // Should not include files from excluded directory
        expect(actual).not.toEqual(expect.arrayContaining([expect.stringMatching(/excluded[/\\]excluded\.ts$/)]));
    }, 60000);

    it("should pass files from cli args according to exclude pattern", () => {
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}));
        createTsConfigFile(
            {
                outDir: testDirs.OUTPUT_DIR,
                noEmit: false,
                target: ts.ScriptTarget.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Node10,
            },
            ["src/**/*.ts"],
            ["node_modules", "dist", "src/excluded/**/*"]
        );

        const filePath = createSourceFile("export const included = 'test';", "included.ts");
        createSourceFile("export const excluded = 'test';", "excluded/excluded.ts");
        createSourceFile("export const included2 = 'test';", "other.ts");

        executeCompiler(`${filePath} --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, target);

        // @ts-expect-error - getContext is protected
        const actual = target.getContext()?.getCliArgs().fileNames || [];

        // Should include files not in excluded directory
        expect(actual).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/src[/\\]included\.ts$/), // included.ts in src/
            ])
        );

        // Should not include files from excluded directory
        expect(actual).not.toEqual(expect.arrayContaining([expect.stringMatching(/excluded[/\\]excluded\.ts$/)]));
    }, 60000);

    it("should include all tsconfig properties in cliArgs.options", () => {
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}));
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: ts.ScriptTarget.ES2020,
            moduleResolution: ts.ModuleResolutionKind.Node10,
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            allowSyntheticDefaultImports: true,
            declaration: true,
            sourceMap: true,
        });
        createSourceFile("export const test = 'hello';", "test.ts");

        executeCompiler(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, target);

        // @ts-expect-error - getContext is protected
        const cliArgs = target.getContext()?.getCliArgs();
        const options = cliArgs?.options;

        // Verify that tsconfig options are properly included in cliArgs.options
        expect(options?.target).toBe(ts.ScriptTarget.ES2020);
        expect(options?.moduleResolution).toBe(ts.ModuleResolutionKind.Node10);
        expect(options?.strict).toBe(true);
        expect(options?.esModuleInterop).toBe(true);
        expect(options?.skipLibCheck).toBe(true);
        expect(options?.forceConsistentCasingInFileNames).toBe(true);
        expect(options?.allowSyntheticDefaultImports).toBe(true);
        expect(options?.declaration).toBe(true);
        expect(options?.sourceMap).toBe(true);
        expect(options?.outDir).toBe(testDirs.OUTPUT_DIR);
    }, 60000);

    it("should include all tsconfig properties in cliArgs.options even with explicit files", () => {
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}));
        createTsConfigFile({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: ts.ScriptTarget.ES2020,
            moduleResolution: ts.ModuleResolutionKind.Node10,
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
        });
        createSourceFile("export const test1 = 'hello';", "test1.ts");
        createSourceFile("export const test2 = 'hello';", "test2.ts");

        // Execute with explicit files
        executeCompiler(`src/test1.ts --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, target);

        // @ts-expect-error - getContext is protected
        const cliArgs = target.getContext()?.getCliArgs();
        const options = cliArgs?.options;

        // Verify that tsconfig options are still included even with explicit files
        expect(options?.target).toBe(ts.ScriptTarget.ES2020);
        expect(options?.moduleResolution).toBe(ts.ModuleResolutionKind.Node10);
        expect(options?.strict).toBe(true);
        expect(options?.esModuleInterop).toBe(true);
        expect(options?.skipLibCheck).toBe(true);
        expect(options?.forceConsistentCasingInFileNames).toBe(true);
        expect(options?.outDir).toBe(testDirs.OUTPUT_DIR);

        // Verify that only the explicit file is included
        expect(cliArgs?.fileNames).toHaveLength(1);
        expect(cliArgs?.fileNames?.[0]).toMatch(/test1\.ts$/);
    }, 60000);

    const executeCompiler = (args = "", compiler?: Compiler) => {
        process.chdir(testDirs.PROJECT_DIR);

        try {
            // Handle argument parsing more carefully to support file paths with spaces
            const argArray = typeof args === "string" ? args.split(/\s+/) : args;
            addCompileCommand(new Command(), compiler).parse(argArray, { from: "user" });
        } catch (err: any) {
            // Check if this was a successful exit (help shown, etc.)
            if (err?.message?.includes("process.exit() was called during test")) {
                // This is expected for help/version commands
                return;
            }

            // Re-throw other errors
            throw err;
        }
    };

    const createTsConfig = (config: ts.CompilerOptions, include: string[] = ["src/**/*"], exclude: string[] = ["node_modules", "dist"]) => {
        // Convert enum values to strings for proper JSON serialization
        const normalizedConfig = {
            ...config,
            ...(config.target !== undefined && {
                target: ts.ScriptTarget[config.target] === "Latest" ? "esnext" : ts.ScriptTarget[config.target].toLowerCase(),
            }),
            ...(config.module !== undefined && { module: ts.ModuleKind[config.module].toLowerCase() }),
            ...(config.jsx !== undefined && { jsx: ts.JsxEmit[config.jsx].toLowerCase() }),
            ...(config.moduleResolution !== undefined && { moduleResolution: ts.ModuleResolutionKind[config.moduleResolution].toLowerCase() }),
        };

        const tsConfig = {
            compilerOptions: normalizedConfig,
            include,
            exclude,
        };
        return JSON.stringify(tsConfig, null, 2);
    };

    const createTsConfigFile = (config: ts.CompilerOptions, include?: string[], exclude?: string[]) => {
        fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "tsconfig.json"), createTsConfig(config, include, exclude), { encoding: "utf-8" });
    };

    const createWebsmithConfig = (config: CompilationConfig) => {
        fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "websmith.config.json"), JSON.stringify(config), { encoding: "utf-8" });
    };

    const copySourceFile = (fileName: string) => {
        fs.copyFileSync(path.resolve(TEST_FILES_DIR, fileName), path.resolve(testDirs.SOURCE_DIR, fileName));
    };

    const createSourceFile = (fileContent: string, fileName: string): string => {
        const filePath = path.join(testDirs.SOURCE_DIR, fileName);
        const dirPath = path.dirname(filePath);

        // Create subdirectories if they don't exist
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        fs.writeFileSync(filePath, fileContent, { encoding: "utf-8" });
        return filePath;
    };

    const getOutput = (filePath: string): string | undefined =>
        fs.existsSync(path.join(testDirs.OUTPUT_DIR, filePath)) ? fs.readFileSync(path.join(testDirs.OUTPUT_DIR, filePath), "utf-8") : undefined;
});
