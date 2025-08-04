/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { webpack } from "@quatico/websmith-node";
import fs from "node:fs";
import path from "node:path";
import { getOutput, writeTsConfig, writeWebsmithConfig, writeSourceFile } from "./test-files";
import ts from "typescript";

const PROJECT_DIR = path.join(__dirname, "..", "output");
const OUTPUT_DIR = path.join(PROJECT_DIR, "lib");
const SOURCE_DIR = path.join(PROJECT_DIR, "src");
const ADDONS_DIR = path.join(__dirname, "..", "..", "example-addons", "src");

const webpackDefaults = {
    entry: {
        main: path.join(SOURCE_DIR, "index.tsx"),
        functions: path.join(SOURCE_DIR, "functions", "getDate.ts"),
    },
    output: {
        path: OUTPUT_DIR,
    },
    module: {
        rules: [
            {
                test: /\.[jt]sx?$/,
                exclude: [/node_modules/],
                use: [
                    {
                        loader: require.resolve("websmith-loader"),
                        options: {
                            transpileOnly: true,
                            tsConfigFile: path.join(PROJECT_DIR, "tsconfig.json"),
                        },
                    },
                ],
            },
        ],
    },
};

beforeAll(() => {
    fs.rmSync(path.resolve(path.join(__dirname, "..", "..", "example-addons", "lib")), { recursive: true, force: true });
});

beforeEach(() => {
    jest.spyOn(process.stdout, "write").mockImplementation(() => true); // Don't show extensive log messages in tests
    fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(SOURCE_DIR, { recursive: true });

    // Copy all source files for each test
    const originalSourceDir = path.join(__dirname, "..", "src");
    const sourceFiles = fs.readdirSync(originalSourceDir);
    for (const file of sourceFiles) {
        const srcPath = path.join(originalSourceDir, file);
        const destPath = path.join(SOURCE_DIR, file);
        if (fs.statSync(srcPath).isDirectory()) {
            fs.cpSync(srcPath, destPath, { recursive: true });
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }

    writeTsConfig({
        moduleResolution: ts.ModuleResolutionKind.Node10,
        outDir: OUTPUT_DIR,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.React,
        noEmit: true,
    });
});

afterEach(() => {
    fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith", () => {
    it("should yield compiled output with no profile", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                profile: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
            },
        });

        expect(getOutput("main.js")).toContain('/***/ "./output/src/functions/getDate.ts":');
        expect(getOutput("main.js")).toContain('/***/ "./output/src/model/index.ts":');
        expect(actual).toMatch(/successfully/);
    });

    it("should yield compiled and generated output with transpileOnly true", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                valid: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: "valid",
            },
        });

        expect(getOutput("output.yaml")).toContain("exports: [getDate]");
        expect(getOutput("main.js")).toContain('/***/ "./output/src/functions/getDate.ts":');
        expect(getOutput("main.js")).toContain('/***/ "./output/src/model/index.ts":');
        expect(actual).toMatch(/successfully/);
    });

    it("should throw error with transpileOnly false", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                valid: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await expect(() =>
            webpack(undefined, {
                webpack: { ...webpackDefaults },
                websmith: {
                    configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                    transpileOnly: false,
                    profile: "valid",
                },
            })
        ).rejects.toThrow(/No processed output found for ".*\/functions\/getDate\.ts" with profile "valid"/);
    });

    it("should throw error with unknown profile name", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                existing: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await expect(() =>
            webpack(undefined, {
                webpack: { ...webpackDefaults },
                websmith: {
                    configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                    transpileOnly: true,
                    profile: "unknown",
                },
            })
        ).rejects.toThrow("Found missing profile(s) 'unknown' in available profile(s) 'existing'.");
    });

    it("should use default profile w/o configured profile", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                writeOnly: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: "writeOnly",
            },
        });

        expect(getOutput("output.yaml")).toContain("exports: [getDate]");
        expect(actual).toMatch(/successfully/);
    });

    it("should provide debug logging when debug is enabled", async () => {
        // Create a completely isolated test configuration
        const testProjectDir = path.join(__dirname, "..", "output", "debug-test");
        const testSourceDir = path.join(testProjectDir, "src");

        // Clean up any existing test directory
        if (fs.existsSync(testProjectDir)) {
            fs.rmSync(testProjectDir, { recursive: true, force: true });
        }

        // Create test directory structure
        fs.mkdirSync(testSourceDir, { recursive: true });

        // Create a simple test file
        writeSourceFile("src/test.ts", "export const test = 'hello';", testProjectDir);

        // Create a minimal websmith.config.json
        writeWebsmithConfig(
            {
                addonsDir: path.join(testProjectDir, "addons"),
                profiles: {},
            },
            testProjectDir
        );

        const actual = await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                context: testProjectDir, // Set webpack context to the isolated project directory
                entry: path.join(testSourceDir, "test.ts"), // Use the isolated test file as entry
                output: {
                    path: path.join(testProjectDir, "dist"),
                    filename: "bundle.js",
                },
            },
            websmith: {
                configFile: path.join(testProjectDir, "websmith.config.json"),
                debug: true, // Enable debug logging
                transpileOnly: true,
                profile: undefined, // Explicitly set profile to undefined
            },
        });

        // Verify that debug messages are present in the webpack output
        expect(actual).toContain("[websmith-loader] Building file:");
        expect(actual).toContain("[websmith-loader] Build directory:");
        expect(actual).toContain("[websmith-loader] Profile:");
        expect(actual).toContain("[websmith-loader] Emitting source file:");
        expect(actual).toContain("[websmith-loader] Build completed for:");
        expect(actual).toContain("webpack 5.97.1 compiled");
    });

    it("should show debug logs in webpack stats with infrastructureLogging enabled", async () => {
        // Create a completely isolated test configuration
        const testProjectDir = path.join(__dirname, "..", "output", "infrastructure-logging-test");
        const testSourceDir = path.join(testProjectDir, "src");

        // Clean up any existing test directory
        if (fs.existsSync(testProjectDir)) {
            fs.rmSync(testProjectDir, { recursive: true, force: true });
        }

        // Create test directory structure
        fs.mkdirSync(testSourceDir, { recursive: true });

        // Create a test file with multiple exports
        writeSourceFile(
            "src/multi-export.ts",
            `
            export const value1 = 'hello';
            export const value2 = 'world';
            export function greet(name: string) {
                return \`Hello \${name}!\`;
            }
        `,
            testProjectDir
        );

        // Create a websmith config with profiles
        writeWebsmithConfig(
            {
                addonsDir: path.join(testProjectDir, "addons"),
                profiles: {
                    debug: {
                        addons: [],
                    },
                },
            },
            testProjectDir
        );

        const actual = await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                context: testProjectDir,
                entry: path.join(testSourceDir, "multi-export.ts"),
                output: {
                    path: path.join(testProjectDir, "dist"),
                    filename: "bundle.js",
                },
                infrastructureLogging: {
                    level: "log",
                    debug: ["websmith-loader"],
                },
            },
            websmith: {
                configFile: path.join(testProjectDir, "websmith.config.json"),
                debug: true,
                transpileOnly: true,
                profile: "debug",
            },
        });

        // Verify infrastructure logging captures websmith-loader logs
        expect(actual).toContain("[websmith-loader] Building file:");
        expect(actual).toContain("[websmith-loader] Build directory:");
        expect(actual).toContain("[websmith-loader] Profile:");
        expect(actual).toContain("[websmith-loader] Selected profiles:");
        expect(actual).toContain("[websmith-loader] Emitting source file:");
        expect(actual).toContain("[websmith-loader] Write file:");
        expect(actual).toContain("[websmith-loader] Emit result");
        expect(actual).toContain("[websmith-loader] Build completed for:");
        expect(actual).toContain("webpack 5.97.1 compiled");
    });

    it("should not show debug logs when debug is disabled", async () => {
        // Create a completely isolated test configuration
        const testProjectDir = path.join(__dirname, "..", "output", "no-debug-test");
        const testSourceDir = path.join(testProjectDir, "src");

        // Clean up any existing test directory
        if (fs.existsSync(testProjectDir)) {
            fs.rmSync(testProjectDir, { recursive: true, force: true });
        }

        // Create test directory structure
        fs.mkdirSync(testSourceDir, { recursive: true });

        // Create a simple test file
        writeSourceFile("src/test.ts", "export const test = 'hello';", testProjectDir);

        // Create a minimal websmith.config.json
        writeWebsmithConfig(
            {
                addonsDir: path.join(testProjectDir, "addons"),
                profiles: {},
            },
            testProjectDir
        );

        const actual = await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                context: testProjectDir,
                entry: path.join(testSourceDir, "test.ts"),
                output: {
                    path: path.join(testProjectDir, "dist"),
                    filename: "bundle.js",
                },
            },
            websmith: {
                configFile: path.join(testProjectDir, "websmith.config.json"),
                debug: false, // Disable debug logging
                transpileOnly: true,
                profile: undefined,
            },
        });

        // Verify that debug messages are NOT present in the webpack output
        expect(actual).not.toContain("[websmith-loader] Building file:");
        expect(actual).not.toContain("[websmith-loader] Build directory:");
        expect(actual).not.toContain("[websmith-loader] Profile:");
        expect(actual).not.toContain("[websmith-loader] Emitting source file:");
        expect(actual).not.toContain("[websmith-loader] Build completed for:");
        expect(actual).toContain("webpack 5.97.1 compiled");
    });

    it("should show debug logs with different webpack stats configurations", async () => {
        // Create a completely isolated test configuration
        const testProjectDir = path.join(__dirname, "..", "output", "stats-config-test");
        const testSourceDir = path.join(testProjectDir, "src");

        // Clean up any existing test directory
        if (fs.existsSync(testProjectDir)) {
            fs.rmSync(testProjectDir, { recursive: true, force: true });
        }

        // Create test directory structure
        fs.mkdirSync(testSourceDir, { recursive: true });

        // Create a test file
        writeSourceFile(
            "src/stats-test.ts",
            `
            export interface TestInterface {
                name: string;
                value: number;
            }
            
            export class TestClass {
                constructor(private data: TestInterface) {}
                
                getInfo() {
                    return \`\${this.data.name}: \${this.data.value}\`;
                }
            }
        `,
            testProjectDir
        );

        // Create a websmith config
        writeWebsmithConfig(
            {
                addonsDir: path.join(testProjectDir, "addons"),
                profiles: {},
            },
            testProjectDir
        );

        const actual = await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                context: testProjectDir,
                entry: path.join(testSourceDir, "stats-test.ts"),
                output: {
                    path: path.join(testProjectDir, "dist"),
                    filename: "bundle.js",
                },
                stats: {
                    logging: "verbose",
                    loggingDebug: ["websmith-loader"],
                },
                infrastructureLogging: {
                    level: "verbose",
                },
            },
            websmith: {
                configFile: path.join(testProjectDir, "websmith.config.json"),
                debug: true,
                transpileOnly: true,
                profile: undefined,
            },
        });

        // Verify that debug messages are present with verbose logging
        expect(actual).toContain("[websmith-loader] Building file:");
        expect(actual).toContain("[websmith-loader] Build directory:");
        expect(actual).toContain("[websmith-loader] Profile:");
        expect(actual).toContain("[websmith-loader] Emitting source file:");
        expect(actual).toContain("[websmith-loader] Write file:");
        expect(actual).toContain("[websmith-loader] Emit result");
        expect(actual).toContain("[websmith-loader] Build completed for:");
        expect(actual).toContain("webpack 5.97.1 compiled");
    });

    it("should show debug logs in webpack stats with multiple files", async () => {
        // Create a completely isolated test configuration
        const testProjectDir = path.join(__dirname, "..", "output", "multi-file-test");
        const testSourceDir = path.join(testProjectDir, "src");

        // Clean up any existing test directory
        if (fs.existsSync(testProjectDir)) {
            fs.rmSync(testProjectDir, { recursive: true, force: true });
        }

        // Create test directory structure
        fs.mkdirSync(testSourceDir, { recursive: true });

        // Create multiple test files
        writeSourceFile("src/file1.ts", "export const file1 = 'first';", testProjectDir);
        writeSourceFile("src/file2.ts", "export const file2 = 'second';", testProjectDir);
        writeSourceFile(
            "src/index.ts",
            `
            export { file1 } from './file1';
            export { file2 } from './file2';
        `,
            testProjectDir
        );

        // Create a websmith config
        writeWebsmithConfig(
            {
                addonsDir: path.join(testProjectDir, "addons"),
                profiles: {},
            },
            testProjectDir
        );

        const actual = await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                context: testProjectDir,
                entry: path.join(testSourceDir, "index.ts"),
                output: {
                    path: path.join(testProjectDir, "dist"),
                    filename: "bundle.js",
                },
                infrastructureLogging: {
                    level: "log",
                },
            },
            websmith: {
                configFile: path.join(testProjectDir, "websmith.config.json"),
                debug: true,
                transpileOnly: true,
                profile: undefined,
            },
        });

        // Verify that debug messages are present for multiple files
        expect(actual).toContain("[websmith-loader] Building file:");
        expect(actual).toContain("[websmith-loader] Build directory:");
        expect(actual).toContain("[websmith-loader] Profile:");
        expect(actual).toContain("[websmith-loader] Emitting source file:");
        expect(actual).toContain("[websmith-loader] Write file:");
        expect(actual).toContain("[websmith-loader] Emit result");
        expect(actual).toContain("[websmith-loader] Build completed for:");
        expect(actual).toContain("webpack 5.97.1 compiled");

        // Verify that the bundle was created successfully
        const bundlePath = path.join(testProjectDir, "dist", "bundle.js");
        expect(fs.existsSync(bundlePath)).toBe(true);
    });

    // TODO: Skipped Test: Preloaders seem to be broken with the current project setup
    it.skip("should bundle the file w/ thread-loader being used", async () => {
        const webpackConfig = { ...webpackDefaults };
        webpackConfig.module.rules[0].use.unshift({
            loader: "thread-loader",
        } as any);
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                noWrite: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: "noWrite",
            },
        });

        expect(getOutput("main.js")).toContain('/***/ "./output/src/functions/getDate.ts":');
        expect(getOutput("main.js")).toContain('/***/ "./output/src/model/index.ts":');
    });

    it("should bundle invalid TypeScript file w/ transpileOnly being used", async () => {
        writeSourceFile("src/invalid.ts", "this is no valid source code");
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                noWrite: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults, entry: { main: path.join(SOURCE_DIR, "invalid.ts") }, devtool: "source-map" },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: "noWrite",
            },
        });

        expect(getOutput("main.js")).toContain('/***/ "./output/src/invalid.ts":');
        expect(actual).toContain("webpack 5.97.1 compiled");

        fs.rmSync(path.resolve(SOURCE_DIR, "invalid.ts"), { force: true });
    });

    it("should bundle the file w/ fork-ts-checker-webpack-plugin being used", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                noWrite: {
                    addons: ["foobar-replace-transformer"],
                },
            },
        });

        const actual = await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: { main: path.join(SOURCE_DIR, "index.tsx") },
                output: { ...webpackDefaults.output, path: OUTPUT_DIR },
            },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: "noWrite",
            },
        });

        expect(getOutput("main.js")).toContain('/***/ "./output/src/functions/getDate.ts":');
        expect(getOutput("main.js")).toContain('/***/ "./output/src/model/index.ts":');
        expect(actual).toContain("webpack 5.97.1 compiled");
    });
});
