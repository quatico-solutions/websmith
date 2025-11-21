/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { webpack } from "@quatico/websmith-node";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { writeWebsmithConfig, getOutput as getOutputBase, writeTsConfig } from "./test-files";

// Create unique test directories for each test to prevent cross-test contamination
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const timestamp = Date.now();
    const uniqueId = `${testId}_${timestamp}`;
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-${uniqueId}`);
    const OUTPUT_DIR = path.resolve(PROJECT_DIR, "lib");
    const SOURCE_DIR = path.join(PROJECT_DIR, "src");
    return { PROJECT_DIR, OUTPUT_DIR, SOURCE_DIR };
};

const ADDONS_DIR = path.join(__dirname, "..", "..", "example-addons", "src");

let testDirs: { PROJECT_DIR: string; OUTPUT_DIR: string; SOURCE_DIR: string };

const getOutput = (filePath: string) => getOutputBase(filePath, testDirs.OUTPUT_DIR);

const getWebpackDefaults = () => ({
    output: {
        path: testDirs.OUTPUT_DIR,
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
                            tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
                        },
                    },
                ],
            },
        ],
    },
});

beforeAll(() => {
    fs.rmSync(path.resolve(path.join(__dirname, "..", "..", "example-addons", "lib")), { recursive: true, force: true });
    if (fs.readdirSync(ADDONS_DIR).length === 0) {
        throw new Error(
            "No addons found in package 'example-addons'. Did you use the 'lib' folder and forget to run 'pnpm build' in the package directory"
        );
    }
});

beforeEach(() => {
    jest.spyOn(process.stdout, "write").mockImplementation(() => true); // Don't show extensive log messages in tests

    testDirs = getTestDirs();

    fs.mkdirSync(testDirs.OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(testDirs.SOURCE_DIR, { recursive: true });

    // Copy all source files for each test
    const originalSourceDir = path.join(__dirname, "..", "src");
    const sourceFiles = fs.readdirSync(originalSourceDir);
    for (const file of sourceFiles) {
        const srcPath = path.join(originalSourceDir, file);
        const destPath = path.join(testDirs.SOURCE_DIR, file);
        if (fs.statSync(srcPath).isDirectory()) {
            fs.cpSync(srcPath, destPath, { recursive: true });
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }

    writeTsConfig(
        {
            target: ts.ScriptTarget.ES2020,
            outDir: testDirs.OUTPUT_DIR,
        },
        testDirs.PROJECT_DIR
    );
});

afterEach(() => {
    fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith", () => {
    it("should build foobar-arrow.js with ES2020 and addonsDir", async () => {
        writeWebsmithConfig(
            {
                // Don't specify addonsDir to prevent any addon loading
            },
            testDirs.PROJECT_DIR
        );

        await webpack([path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: { ...getWebpackDefaults() },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                tsConfig: {
                    target: ts.ScriptTarget.ES2020,
                },
            },
        });

        expect(getOutput("main.js")).toMatchSnapshot();
    }, 60000);

    it("should build foobar-function.js with ES2020 and addonsDir", async () => {
        writeWebsmithConfig(
            {
                // Don't specify addonsDir to prevent any addon loading
            },
            testDirs.PROJECT_DIR
        );

        await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...getWebpackDefaults() },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                tsConfig: {
                    target: ts.ScriptTarget.ES2020,
                },
            },
        });

        expect(getOutput("main.js")).toMatchSnapshot();
    }, 60000);

    it("should generate YAML file with addonsDir and addon selected", async () => {
        await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...getWebpackDefaults() },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["export-yaml-generator"],
                },
            },
        });

        expect(getOutput("main.js")).toContain("function foobar");
        expect(getOutput("main.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    }, 60000);

    it("should generate additional files with addonDir and addon selected", async () => {
        await webpack([path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: { ...getWebpackDefaults() },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foo-added-generator"],
                },
            },
        });

        // The foo-added-generator creates foobar-arrow-added.ts as a virtual file
        // which gets compiled but bundled into main.js (not as separate file)
        // Verify the main bundle contains the expected function
        expect(getOutput("main.js")).toContain("getFoobar");
        expect(getOutput("main.js")).toContain("foobar");
    }, 60000);

    it("should transform foobar functions with addonDir and addon selected", async () => {
        await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...getWebpackDefaults() },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-transformer"],
                },
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
    }, 60000);

    it("should generate YAML file with profiles in file-config, addonsDir and profile selected", async () => {
        writeWebsmithConfig(
            {
                addonsDir: ADDONS_DIR,
                profiles: {
                    "target-profile": {
                        addons: ["export-yaml-generator"],
                    },
                },
            },
            testDirs.PROJECT_DIR
        );

        await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...getWebpackDefaults() },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                config: {
                    addons: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                },
                profile: "target-profile",
            },
        });

        expect(getOutput("main.js")).toContain("function foobar");
        expect(getOutput("main.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    }, 60000);

    it("should generate YAML file with profile in file-config, addonsDir and named profile selected", async () => {
        writeWebsmithConfig(
            {
                addonsDir: ADDONS_DIR,
                profiles: {
                    "profile-zip": {
                        addons: ["export-yaml-generator"],
                    },
                },
            },
            testDirs.PROJECT_DIR
        );

        await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...getWebpackDefaults() },
            websmith: {
                profile: "profile-zip",
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("main.js")).toContain("function foobar");
        expect(getOutput("main.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    }, 60000);

    it("should transform foobar functions with addonsDir and addons config", async () => {
        await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...getWebpackDefaults() },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-transformer"],
                },
                profile: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
    }, 60000);

    it("should transform foobar functions with addonsDir, addons and profiles in config but no profile selected", async () => {
        await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...getWebpackDefaults() },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-transformer"],
                    profiles: {
                        "profile-expected": {
                            addons: ["foobar-replace-transformer"],
                        },
                    },
                },
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
    }, 60000);

    it("should transform foobar functions with addonsDir and existing profile in config-file", async () => {
        writeWebsmithConfig(
            {
                addonsDir: ADDONS_DIR,
                profiles: {
                    "profile-transform": {
                        addons: ["foobar-replace-transformer"],
                    },
                    "profile-generate": {
                        addons: ["foo-added-generator"],
                    },
                    "profile-process": {
                        addons: ["foobar-export-processor"],
                    },
                },
            },
            testDirs.PROJECT_DIR
        );

        await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...getWebpackDefaults() },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                config: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                profile: "profile-transform",
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
    }, 60000);

    it("should transform foobar functions with addonsDir and dependent profiles in config-file", async () => {
        writeWebsmithConfig(
            {
                addonsDir: ADDONS_DIR,
                profiles: {
                    "profile-transform": {
                        addons: ["foobar-replace-transformer"],
                    },
                    "profile-generate": {
                        addons: ["foo-added-generator"],
                    },
                    "profile-process": {
                        depends: ["profile-transform"],
                        addons: ["export-yaml-generator"],
                    },
                },
            },
            testDirs.PROJECT_DIR
        );

        await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...getWebpackDefaults() },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                config: {
                    addons: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                },
                profile: "profile-process",
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    }, 60000);

    it("should transform foobar functions with named profile and addonsDir, chained addons in config-file", async () => {
        writeWebsmithConfig(
            {
                addonsDir: ADDONS_DIR,
                profiles: {
                    "profile-transform": {
                        addons: ["foobar-replace-transformer", "export-yaml-generator"],
                    },
                },
            },
            testDirs.PROJECT_DIR
        );

        await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...getWebpackDefaults() },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                profile: "profile-transform",
            },
        });

        const actual = getOutput("main.js");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    }, 60000);
});

describe("webpack w/ websmith, multiple profiles", () => {
    beforeEach(() => {
        writeWebsmithConfig(
            {
                addonsDir: ADDONS_DIR,
                profiles: {
                    client: {
                        depends: ["server"],
                        addons: ["client-transformer"],
                    },
                    server: {
                        addons: ["server-transformer"],
                    },
                },
            },
            testDirs.PROJECT_DIR
        );

        writeTsConfig(
            {
                target: ts.ScriptTarget.ES2020,
                outDir: testDirs.OUTPUT_DIR,
            },
            testDirs.PROJECT_DIR
        );
    });

    it("should yield non-transformed functions with no profile and single entry", async () => {
        await webpack(undefined, {
            webpack: {
                ...getWebpackDefaults(),
                entry: {
                    client: path.join(testDirs.SOURCE_DIR, "client-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                profile: undefined,
            },
        });

        expect(getOutput("client.js")).toContain("function getFoobarClient");
        expect(getOutput("server.js")).toBeUndefined();
    }, 60000);

    it("should yield non-transformed functions with no profile and separate entries", async () => {
        await webpack(undefined, {
            webpack: {
                ...getWebpackDefaults(),
                entry: {
                    client: path.join(testDirs.SOURCE_DIR, "client-function.ts"),
                    server: path.join(testDirs.SOURCE_DIR, "functions/server-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                profile: undefined,
                config: {
                    addons: [],
                },
            },
        });

        expect(getOutput("client.js")).toContain("function getFoobarClient");
        expect(getOutput("server.js")).toContain("function getFoobarServer");
    }, 60000);

    it("should yield transformed functions with existing profile, dependent profile and single entry", async () => {
        writeWebsmithConfig(
            {
                addonsDir: ADDONS_DIR,
                profiles: {
                    client: {
                        depends: ["server"],
                        addons: ["client-transformer"],
                    },
                    server: {
                        addons: ["server-transformer"],
                    },
                },
            },
            testDirs.PROJECT_DIR
        );
        await webpack(undefined, {
            webpack: {
                ...getWebpackDefaults(),
                entry: {
                    client: path.join(testDirs.SOURCE_DIR, "client-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                profile: "client",
            },
        });

        expect(getOutput("client.js")).toContain("function getSERVERClient");
        expect(getOutput("server.js")).toBeUndefined();
    }, 60000);

    it("should yield non-transformed functions with existing profile and single entry", async () => {
        writeWebsmithConfig(
            {
                addonsDir: ADDONS_DIR,
                profiles: {
                    client: {
                        depends: ["server"],
                        addons: ["client-transformer"],
                    },
                    server: {
                        addons: ["server-transformer"],
                    },
                },
            },
            testDirs.PROJECT_DIR
        );

        await webpack(undefined, {
            webpack: {
                ...getWebpackDefaults(),
                entry: {
                    client: path.join(testDirs.SOURCE_DIR, "client-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                profile: "server",
            },
        });

        expect(getOutput("client.js")).toContain("function getFoobarClient");
        expect(getOutput("server.js")).toBeUndefined();
    }, 60000);

    it("should yield transformed functions with existing profile, dependent profile and separate entries", async () => {
        await webpack(undefined, {
            webpack: {
                ...getWebpackDefaults(),
                entry: {
                    client: path.join(testDirs.SOURCE_DIR, "client-function.ts"),
                    server: path.join(testDirs.SOURCE_DIR, "functions/server-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                profile: "client",
            },
        });

        expect(getOutput("client.js")).toContain("function getSERVERClient");
        expect(getOutput("server.js")).toContain("function getSERVERServer");
    }, 60000);

    it("should yield transformed functions with existing profile, dependent profile and imported server function", async () => {
        writeWebsmithConfig(
            {
                addonsDir: ADDONS_DIR,
                profiles: {
                    client: {
                        depends: ["server"],
                        addons: ["client-transformer"],
                    },
                    server: {
                        addons: ["server-transformer"],
                    },
                },
            },
            testDirs.PROJECT_DIR
        );

        await webpack(undefined, {
            webpack: {
                ...getWebpackDefaults(),
                entry: {
                    client: path.join(testDirs.SOURCE_DIR, "client-function-with-import.ts"),
                    server: path.join(testDirs.SOURCE_DIR, "functions/server-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                profile: "client",
            },
        });

        expect(getOutput("client.js")).toContain("function getSERVERClient");
        expect(getOutput("client.js")).toContain("getSERVERClient: ()");
        expect(getOutput("server.js")).toContain("function getSERVERServer");
    }, 60000);

    it("should yield transformed functions with existing profile and imported server function", async () => {
        writeWebsmithConfig(
            {
                addonsDir: ADDONS_DIR,
                profiles: {
                    client: {
                        addons: ["client-transformer"],
                    },
                    server: {
                        depends: ["client"],
                        addons: ["server-transformer"],
                    },
                },
            },
            testDirs.PROJECT_DIR
        );

        await webpack(undefined, {
            webpack: {
                ...getWebpackDefaults(),
                entry: {
                    client: path.join(testDirs.SOURCE_DIR, "client-function-with-import.ts"),
                },
            },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                profile: "server",
            },
        });

        expect(getOutput("client.js")).toContain("function getCLIENTServer");
        expect(getOutput("server.js")).toBeUndefined();
    }, 60000);

    it("should yield transformed functions with existing profile and separate entries", async () => {
        writeWebsmithConfig(
            {
                addonsDir: ADDONS_DIR,
                profiles: {
                    client: {
                        addons: ["client-transformer"],
                    },
                    server: {
                        depends: ["client"],
                        addons: ["server-transformer"],
                    },
                },
            },
            testDirs.PROJECT_DIR
        );

        await webpack(undefined, {
            webpack: {
                ...getWebpackDefaults(),
                entry: {
                    client: path.join(testDirs.SOURCE_DIR, "client-function.ts"),
                    server: path.join(testDirs.SOURCE_DIR, "functions/server-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                profile: "server",
            },
        });

        expect(getOutput("client.js")).toContain("function getCLIENTClient");
        expect(getOutput("client.js")).toContain("foobar ${date.toISOString()}");
        expect(getOutput("server.js")).toContain("function getCLIENTServer");
        expect(getOutput("server.js")).toContain("foobar ${date.toISOString()}");
    }, 60000);

    describe("addonEmitOnly mode", () => {
        it("should emit only addon-processed files with addonEmitOnly: true", async () => {
            // This test verifies that only addon-processed files are emitted to disk with addonEmitOnly
            // (webpack still bundles all files in the bundle)
            await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
                webpack: { ...getWebpackDefaults() },
                websmith: {
                    addonEmitOnly: true,
                    config: {
                        addonsDir: ADDONS_DIR,
                        addons: ["foobar-replace-processor"],
                    },
                    tsConfig: {
                        target: ts.ScriptTarget.ES2020,
                    },
                },
            });

            // Webpack should bundle the file
            expect(getOutput("main.js")).toBeDefined();
            const mainJs = getOutput("main.js");

            // The foobar-replace-processor processes the file, replacing "foobar" with "barfoo"
            expect(mainJs).toContain("barfoo");
        }, 60000);

        it("should work with generator addons when addonEmitOnly: true", async () => {
            // This test verifies that generator addons work correctly with addonEmitOnly
            await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
                webpack: { ...getWebpackDefaults() },
                websmith: {
                    addonEmitOnly: true,
                    config: {
                        addonsDir: ADDONS_DIR,
                        addons: ["export-yaml-generator"],
                    },
                    tsConfig: {
                        target: ts.ScriptTarget.ES2020,
                    },
                },
            });

            // Webpack should bundle the file
            expect(getOutput("main.js")).toBeDefined();
            const mainJs = getOutput("main.js");
            expect(mainJs).toContain("function foobar");

            // Generator should create output.yaml
            expect(getOutput("output.yaml")).toContain("exports:");
        }, 60000);

        it("should allow addonEmitOnly in loader options to override config file", async () => {
            // This test verifies that addonEmitOnly in loader options overrides config file setting
            writeWebsmithConfig(
                {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-processor"],
                    addonEmitOnly: false, // Config says false, loader option should override to true
                },
                testDirs.PROJECT_DIR
            );

            await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
                webpack: { ...getWebpackDefaults() },
                websmith: {
                    addonEmitOnly: true, // Loader option overrides config file
                    configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                    tsConfig: {
                        target: ts.ScriptTarget.ES2020,
                    },
                },
            });

            expect(getOutput("main.js")).toBeDefined();
            const mainJs = getOutput("main.js");
            expect(mainJs).toContain("barfoo");
        }, 60000);

        it("should allow transpileOnly in loader options to override config file", async () => {
            // This test verifies that transpileOnly in loader options overrides config file setting
            writeWebsmithConfig(
                {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-processor"],
                    transpileOnly: false, // Config says false, loader option should override to true
                },
                testDirs.PROJECT_DIR
            );

            await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
                webpack: { ...getWebpackDefaults() },
                websmith: {
                    transpileOnly: true, // Loader option overrides config file
                    configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                    tsConfig: {
                        target: ts.ScriptTarget.ES2020,
                    },
                },
            });

            expect(getOutput("main.js")).toBeDefined();
            const mainJs = getOutput("main.js");
            expect(mainJs).toContain("barfoo");
        }, 60000);

        it("should allow both addonEmitOnly and transpileOnly in loader options", async () => {
            // This test verifies that both flags can be set together in loader options
            await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
                webpack: { ...getWebpackDefaults() },
                websmith: {
                    addonEmitOnly: true,
                    transpileOnly: true,
                    config: {
                        addonsDir: ADDONS_DIR,
                        addons: ["foobar-replace-processor"],
                    },
                    tsConfig: {
                        target: ts.ScriptTarget.ES2020,
                    },
                },
            });

            expect(getOutput("main.js")).toBeDefined();
            const mainJs = getOutput("main.js");
            expect(mainJs).toContain("barfoo");
        }, 60000);

        it("should produce same result when addonEmitOnly is in config vs loader options", async () => {
            // First run: addonEmitOnly in config file
            writeWebsmithConfig(
                {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-processor"],
                    addonEmitOnly: true,
                },
                testDirs.PROJECT_DIR
            );

            await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
                webpack: { ...getWebpackDefaults() },
                websmith: {
                    configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                    tsConfig: {
                        target: ts.ScriptTarget.ES2020,
                    },
                },
            });

            const resultFromConfig = getOutput("main.js");
            expect(resultFromConfig).toBeDefined();
            expect(resultFromConfig).toContain("barfoo");

            // Clean up for second run
            fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
            testDirs = getTestDirs();
            fs.mkdirSync(testDirs.OUTPUT_DIR, { recursive: true });
            fs.mkdirSync(testDirs.SOURCE_DIR, { recursive: true });

            // Copy source files again
            const originalSourceDir = path.join(__dirname, "..", "src");
            const sourceFiles = fs.readdirSync(originalSourceDir);
            for (const file of sourceFiles) {
                const srcPath = path.join(originalSourceDir, file);
                const destPath = path.join(testDirs.SOURCE_DIR, file);
                if (fs.statSync(srcPath).isDirectory()) {
                    fs.cpSync(srcPath, destPath, { recursive: true });
                } else {
                    fs.copyFileSync(srcPath, destPath);
                }
            }

            writeTsConfig(
                {
                    target: ts.ScriptTarget.ES2020,
                    outDir: testDirs.OUTPUT_DIR,
                },
                testDirs.PROJECT_DIR
            );

            // Second run: addonEmitOnly in loader options
            writeWebsmithConfig(
                {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-processor"],
                    // No addonEmitOnly in config
                },
                testDirs.PROJECT_DIR
            );

            await webpack([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
                webpack: { ...getWebpackDefaults() },
                websmith: {
                    addonEmitOnly: true, // Set via loader options instead
                    configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                    tsConfig: {
                        target: ts.ScriptTarget.ES2020,
                    },
                },
            });

            const resultFromLoaderOption = getOutput("main.js");
            expect(resultFromLoaderOption).toBeDefined();
            expect(resultFromLoaderOption).toContain("barfoo");

            // Both results should contain the same transformed code (ignoring webpack path comments)
            // The path comments will differ due to different test directory timestamps
            const normalizeOutput = (output: string) => {
                // Remove webpack path comments that contain timestamps
                return output.replace(/\/\*!.*?\*\//gs, "");
            };

            expect(normalizeOutput(resultFromLoaderOption)).toEqual(normalizeOutput(resultFromConfig));
        }, 120000);
    });
});
