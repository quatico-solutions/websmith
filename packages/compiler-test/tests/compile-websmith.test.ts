/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationConfig } from "@quatico/websmith-core";
import { compile } from "@quatico/websmith-node";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

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

const ADDONS_DIR = path.join(__dirname, "..", "..", "example-addons", "src");
let testDirs: { PROJECT_DIR: string; OUTPUT_DIR: string; SOURCE_DIR: string };
let tsDefaults: ts.CompilerOptions;

beforeAll(() => {
    fs.rmSync(path.resolve(path.join(__dirname, "..", "..", "example-addons", "lib")), { recursive: true, force: true });
    jest.spyOn(console, "log").mockImplementation(() => {});
});

beforeEach(() => {
    testDirs = getTestDirs();

    // Clean up and create test directories (unique for this test)
    try {
        fs.rmSync(path.resolve(testDirs.PROJECT_DIR), { recursive: true, force: true });
    } catch (_error) {
        // Ignore errors if directory doesn't exist
    }
    fs.mkdirSync(testDirs.SOURCE_DIR, { recursive: true });
    fs.mkdirSync(testDirs.OUTPUT_DIR, { recursive: true });

    // Copy all source files for each test
    const originalSourceDir = path.join(__dirname, "..", "src");
    const sourceFiles = fs.readdirSync(originalSourceDir);
    for (const file of sourceFiles) {
        fs.copyFileSync(path.join(originalSourceDir, file), path.join(testDirs.SOURCE_DIR, file));
    }

    tsDefaults = {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        project: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
        outDir: testDirs.OUTPUT_DIR,
        removeComments: true,
        skipLibCheck: true,
        noEmit: false,
        sourceMap: false,
    };
});

afterEach(() => {
    // Clean up test directories (unique for this test)
    if (testDirs) {
        try {
            fs.rmSync(path.resolve(testDirs.PROJECT_DIR), { recursive: true, force: true });
        } catch (_error) {
            // Ignore cleanup errors
        }
    }
});

describe("compile w/ websmith", () => {
    it("should not build js and d.ts with defaults", async () => {
        const result = await compile([path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: {},
            websmith: {},
        });

        expect(result).toBe(""); // errors are expected
        expect(getOutput("foobar-arrow.js")).toBeUndefined();
        expect(getOutput("foobar-arrow.d.ts")).toBeUndefined();
    }, 60000);

    it("should build js and d.ts with outDir and noEmit false", async () => {
        const result = await compile([path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: {
                outDir: testDirs.OUTPUT_DIR,
                noEmit: false,
                declaration: true,
                target: ts.ScriptTarget.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Node10,
            },
            websmith: { tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json") },
        });

        expect(result).toBe(""); // errors are expected
        expect(getOutput("foobar-arrow.js")).toBeDefined();
        expect(getOutput("foobar-arrow.js")).toMatchSnapshot();
        expect(getOutput("foobar-arrow.d.ts")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts")).toMatchSnapshot();
    }, 60000);

    it("should build js and no d.ts with tsconfig.json", async () => {
        writeTsConfig({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
            declaration: true,
            declarationMap: true,
        });

        const result = await compile([path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: { project: path.join(testDirs.PROJECT_DIR, "tsconfig.json") },
            websmith: { tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json") },
        });

        expect(result).toBe(""); // errors are expected
        expect(getOutput("foobar-arrow.js")).toBeDefined();
        expect(getOutput("foobar-arrow.js")).toMatchSnapshot();
        expect(getOutput("foobar-arrow.d.ts")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts")).toMatchSnapshot();
    }, 60000);

    it("should build js and d.ts with tsconfig.json and overriding tsconfig props", async () => {
        writeTsConfig({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: true,
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
            declaration: true,
            declarationMap: true,
        });

        const result = await compile([path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: {
                noEmit: false,
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Node10,
                project: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
            },
            websmith: { tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json") },
        });

        expect(result).toBe(""); // errors are expected
        expect(getOutput("foobar-arrow.js")).toBeDefined();
        expect(getOutput("foobar-arrow.js")).toMatchSnapshot();
        expect(getOutput("foobar-arrow.d.ts")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts")).toMatchSnapshot();
    }, 60000);

    it("should build js and d.ts with tsconfig.json, tsconfig props and overriding profile props", async () => {
        writeTsConfig({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: true,
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
            declaration: true,
            declarationMap: true,
        });

        const result = await compile([path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: {
                noEmit: true,
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
                project: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
            },
            websmith: {
                config: {
                    profiles: {
                        "target-profile": {
                            tsConfig: {
                                noEmit: false,
                                target: ts.ScriptTarget.ESNext,
                                module: ts.ModuleKind.ESNext,
                                moduleResolution: ts.ModuleResolutionKind.Node10,
                            },
                        },
                    },
                },
                profile: "target-profile",
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
            },
        });

        expect(result).toBe(""); // errors are expected
        expect(getOutput("foobar-arrow.js")).toBeDefined();
        expect(getOutput("foobar-arrow.js")).toMatchSnapshot();
        expect(getOutput("foobar-arrow.d.ts")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts")).toMatchSnapshot();
    }, 60000);

    it("should build js and d.ts with tsconfig.json, tsconfig props and overriding props in websmith config", async () => {
        writeTsConfig({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: true,
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
            declaration: true,
            declarationMap: true,
        });
        writeWebsmithConfig({
            profiles: {
                "target-profile": {
                    tsConfig: {
                        noEmit: false,
                        target: ts.ScriptTarget.ESNext,
                        module: ts.ModuleKind.ESNext,
                        moduleResolution: ts.ModuleResolutionKind.Node10,
                    },
                },
            },
        });

        const result = await compile([path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: {
                noEmit: true,
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
                project: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
            },
            websmith: {
                profile: "target-profile",
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
            },
        });

        expect(result).toBe(""); // errors are expected
        expect(getOutput("foobar-arrow.js")).toBeDefined();
        expect(getOutput("foobar-arrow.js")).toMatchSnapshot();
        expect(getOutput("foobar-arrow.d.ts")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts")).toMatchSnapshot();
    }, 60000);

    it("should build foobar-arrow.js with ES2020 and addonsDir", async () => {
        const result = await compile([path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: { ...tsDefaults, target: ts.ScriptTarget.ES2020 },
            websmith: {
                config: {
                    addonsDir: undefined,
                    addons: [],
                },
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
            },
        });

        expect(result).toBe("");
        expect(getOutput("foobar-arrow.js")).toMatchSnapshot();
    }, 60000);

    it("should build foobar-arrow.d.ts with ES2020 and addonsDir", async () => {
        const result = await compile([path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: { ...tsDefaults, target: ts.ScriptTarget.ES2020, declaration: true, declarationMap: true },
            websmith: {
                config: {
                    addonsDir: undefined,
                },
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
            },
        });

        expect(result).toBe("");
        expect(getOutput("foobar-arrow.d.ts")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts")).toMatchSnapshot();
    }, 60000);

    it("should build foobar-function.js with ES2020 and addonsDir", async () => {
        await compile([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults, target: ts.ScriptTarget.ES2020 },
            websmith: {
                config: {
                    addonsDir: undefined,
                },
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toMatchSnapshot();
    }, 60000);

    it("should generate YAML file with addonsDir and one addon selected", async () => {
        await compile([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["export-yaml-generator"],
                },
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function foobar");
        expect(getOutput("foobar-function.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    }, 60000);

    it("should generate additional files with addonDir and one addon selected", async () => {
        await compile([path.join(testDirs.SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foo-added-generator"],
                },
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
                debug: true,
            },
        });

        expect(getOutput("foobar-arrow-added.js")).toMatchSnapshot();
    }, 60000);

    it("should transform foobar functions with addonDir and one addon selected", async () => {
        await compile([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-transformer"],
                },
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
    }, 60000);

    it("should generate YAML file with profile in file-config, addonsDir, and one profile selected", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR, // FIXME: This is not working as expected
            profiles: {
                "target-profile": {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profile: "target-profile",
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
                config: {
                    addonsDir: ADDONS_DIR,
                },
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function foobar");
        expect(getOutput("foobar-function.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    }, 60000);

    it("should not generate YAML file with named profile, addonsDir and profile in file-config", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR, // FIXME: This is not working as expected
            profiles: {
                "target-profile": {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults, noEmit: true },
            websmith: {
                profile: "target-profile",
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
                config: {
                    addonsDir: ADDONS_DIR,
                },
            },
        });

        expect(getOutput("foobar-function.js")).toBeUndefined();
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    }, 60000);

    it("should generate YAML file with named profile and addonsDir, one profile in file-config", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR, // FIXME: This is not working as expected
            profiles: {
                "target-profile": {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profile: "target-profile",
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
                config: {
                    addonsDir: ADDONS_DIR,
                },
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function foobar");
        expect(getOutput("foobar-function.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    }, 60000);

    it("should transform foobar functions with addonsDir and addons config", async () => {
        await compile([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-transformer"],
                },
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
    }, 60000);

    it("should transform foobar functions with addonsDir, addons and profiles in config but no profile selected", async () => {
        await compile([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
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
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
    }, 60000);

    it("should transform foobar functions with named profile and addonsDir, multiple existing profile in config-file", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR, // FIXME: This is not working as expected
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
        });

        await compile([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profile: "profile-transform",
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
                config: {
                    addonsDir: ADDONS_DIR,
                },
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
    }, 60000);

    it("should transform foobar functions with multiple named profiles and addonsDir, dependent profiles selected", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR, // FIXME: This is not working as expected
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
        });

        await compile([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profile: "profile-process",
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
                config: {
                    addonsDir: ADDONS_DIR,
                },
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    }, 60000);

    it("should transform foobar functions with named profile and addonsDir, chained addons in config-file", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR, // FIXME: This is not working as expected
            addons: [],
            profiles: {
                transform: {
                    addons: ["foobar-replace-transformer", "export-yaml-generator"],
                },
            },
        });
        writeTsConfig({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: true,
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
            declaration: true,
            declarationMap: true,
        });

        await compile([path.join(testDirs.SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profile: "transform",
                configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
                tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: [],
                },
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    }, 60000);
});

const writeWebsmithConfig = (config?: CompilationConfig) => {
    fs.mkdirSync(testDirs.PROJECT_DIR, {
        recursive: true,
    });
    fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "websmith.config.json"), JSON.stringify(config), {
        encoding: "utf-8",
    });
};

/**
 * Converts TypeScript compiler options using TypeScript's enum reverse lookup
 * This leverages the fact that TypeScript enums have reverse mappings: ts.ScriptTarget[7] === "ES2020"
 */
const convertTsCompilerOptionsToJson = (config: ts.CompilerOptions): Record<string, any> => {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(config)) {
        if (value === undefined) {
            continue;
        }

        // Use TypeScript's built-in enum reverse lookup for known enum properties
        switch (key) {
            case "target":
                result[key] = ts.ScriptTarget[value as ts.ScriptTarget]?.toLowerCase() || value;
                break;
            case "module":
                result[key] = ts.ModuleKind[value as ts.ModuleKind]?.toLowerCase() || value;
                break;
            case "moduleResolution":
                result[key] = ts.ModuleResolutionKind[value as ts.ModuleResolutionKind]?.toLowerCase() || value;
                break;
            case "jsx":
                result[key] = ts.JsxEmit[value as ts.JsxEmit]?.toLowerCase() || value;
                break;
            case "newLine":
                result[key] = ts.NewLineKind[value as ts.NewLineKind]?.toLowerCase() || value;
                break;
            case "moduleDetection":
                result[key] = ts.ModuleDetectionKind[value as ts.ModuleDetectionKind]?.toLowerCase() || value;
                break;
            case "importsNotUsedAsValues":
                result[key] = ts.ImportsNotUsedAsValues[value as ts.ImportsNotUsedAsValues]?.toLowerCase() || value;
                break;
            default:
                // For non-enum values (strings, booleans, numbers), pass through as-is
                result[key] = value;
                break;
        }
    }

    return result;
};

/**
 * Writes a tsconfig.json file with proper enum-to-string conversion
 * Uses TypeScript's built-in enum reverse mappings for accurate conversion
 */
const writeTsConfig = (config?: ts.CompilerOptions) => {
    fs.mkdirSync(testDirs.PROJECT_DIR, {
        recursive: true,
    });

    const jsonConfig = config ? convertTsCompilerOptionsToJson(config) : {};
    fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "tsconfig.json"), JSON.stringify({ compilerOptions: jsonConfig }, null, 2), {
        encoding: "utf-8",
    });
};

const getOutput = (filePath: string): string | undefined => {
    const directPath = path.join(testDirs.OUTPUT_DIR, filePath);
    if (fs.existsSync(directPath)) {
        return fs.readFileSync(directPath, "utf-8");
    }
    return undefined;
};
