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

const PROJECT_DIR = path.join(__dirname, "..", "output");
const OUTPUT_DIR = path.join(PROJECT_DIR, "lib");
const SOURCE_DIR = path.join(PROJECT_DIR, "src");
const ADDONS_DIR = path.join(__dirname, "..", "..", "example-addons", "src");

beforeAll(() => {
    fs.rmSync(path.resolve(path.join(__dirname, "..", "..", "example-addons", "lib")), { recursive: true, force: true });
    jest.spyOn(console, "log").mockImplementation(() => {});
});

const tsDefaults = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    project: path.join(PROJECT_DIR, "tsconfig.json"),
    outDir: OUTPUT_DIR,
    removeComments: true,
    skipLibCheck: true,
    noEmit: false,
    sourceMap: false,
};

beforeEach(() => {
    fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
    fs.mkdirSync(PROJECT_DIR, { recursive: true });
    fs.mkdirSync(SOURCE_DIR, { recursive: true });

    // Copy all source files for each test
    const originalSourceDir = path.join(__dirname, "..", "src");
    const sourceFiles = fs.readdirSync(originalSourceDir);
    for (const file of sourceFiles) {
        const srcPath = path.join(originalSourceDir, file);
        const destPath = path.join(SOURCE_DIR, file);
        fs.copyFileSync(srcPath, destPath);
    }
});

afterEach(() => {
    fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
});

describe("compile w/ websmith", () => {
    it("should not build js and d.ts with defaults", async () => {
        const result = await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: {},
            websmith: {},
        });

        expect(result).toBe(""); // errors are expected
        expect(getOutput("foobar-arrow.js")).toBeUndefined();
        expect(getOutput("foobar-arrow.d.ts")).toBeUndefined();
    });

    it("should build js and d.ts with outDir and noEmit false", async () => {
        const result = await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: { outDir: OUTPUT_DIR, noEmit: false },
            websmith: {},
        });

        expect(result).toBe(""); // errors are expected
        expect(getOutput("foobar-arrow.js")).toBeDefined();
        expect(getOutput("foobar-arrow.js")).toMatchSnapshot();
        expect(getOutput("foobar-arrow.d.ts")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts")).toMatchSnapshot();
    });

    it("should build js and no d.ts with tsconfig.json", async () => {
        writeTsConfig({
            outDir: OUTPUT_DIR,
            noEmit: false,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ESNext,
            declaration: true,
            declarationMap: true,
        });

        const result = await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: { project: path.join(PROJECT_DIR, "tsconfig.json") },
            websmith: {},
        });

        expect(result).toBe(""); // errors are expected
        expect(getOutput("foobar-arrow.js")).toBeDefined();
        expect(getOutput("foobar-arrow.js")).toMatchSnapshot();
        expect(getOutput("foobar-arrow.d.ts")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts")).toMatchSnapshot();
    });

    it("should build js and d.ts with tsconfig.json and overriding tsconfig props", async () => {
        writeTsConfig({
            outDir: OUTPUT_DIR,
            noEmit: true,
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
            declaration: true,
            declarationMap: true,
        });

        const result = await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: {
                noEmit: false,
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ESNext,
                project: path.join(PROJECT_DIR, "tsconfig.json"),
            },
            websmith: {},
        });

        expect(result).toBe(""); // errors are expected
        expect(getOutput("foobar-arrow.js")).toBeDefined();
        expect(getOutput("foobar-arrow.js")).toMatchSnapshot();
        expect(getOutput("foobar-arrow.d.ts")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts")).toMatchSnapshot();
    });

    it("should build js and d.ts with tsconfig.json, tsconfig props and overriding profile props", async () => {
        writeTsConfig({
            outDir: OUTPUT_DIR,
            noEmit: true,
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
            declaration: true,
            declarationMap: true,
        });

        const result = await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: { noEmit: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, project: path.join(PROJECT_DIR, "tsconfig.json") },
            websmith: {
                config: {
                    profiles: {
                        "target-profile": {
                            tsConfig: {
                                noEmit: false,
                                target: ts.ScriptTarget.ESNext,
                                module: ts.ModuleKind.ESNext,
                            },
                        },
                    },
                },
                profile: "target-profile",
            },
        });

        expect(result).toBe(""); // errors are expected
        expect(getOutput("foobar-arrow.js")).toBeDefined();
        expect(getOutput("foobar-arrow.js")).toMatchSnapshot();
        expect(getOutput("foobar-arrow.d.ts")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts")).toMatchSnapshot();
    });

    it("should build js and d.ts with tsconfig.json, tsconfig props and overriding props in websmith config", async () => {
        writeTsConfig({
            outDir: OUTPUT_DIR,
            noEmit: true,
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
            declaration: true,
            declarationMap: true,
        });
        writeWebsmithConfig({
            profiles: {
                "target-profile": {
                    tsConfig: { noEmit: false, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                },
            },
        });

        const result = await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: { noEmit: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, project: path.join(PROJECT_DIR, "tsconfig.json") },
            websmith: {
                profile: "target-profile",
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
            },
        });

        expect(result).toBe(""); // errors are expected
        expect(getOutput("foobar-arrow.js")).toBeDefined();
        expect(getOutput("foobar-arrow.js")).toMatchSnapshot();
        expect(getOutput("foobar-arrow.d.ts")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts")).toMatchSnapshot();
    });

    it("should build foobar-arrow.js with ES2020 and addonsDir", async () => {
        const result = await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: { ...tsDefaults, target: ts.ScriptTarget.ES2020 },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                },
            },
        });

        expect(result).toBe("");
        expect(getOutput("foobar-arrow.js")).toMatchSnapshot();
    });

    it("should build foobar-arrow.d.ts with ES2020 and addonsDir", async () => {
        const result = await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: { ...tsDefaults, target: ts.ScriptTarget.ES2020, declaration: true, declarationMap: true },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                },
            },
        });

        expect(result).toBe("");
        expect(getOutput("foobar-arrow.d.ts")).toBeDefined();
        expect(getOutput("foobar-arrow.d.ts")).toMatchSnapshot();
    });

    it("should build foobar-function.js with ES2020 and addonsDir", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults, target: ts.ScriptTarget.ES2020 },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                },
            },
        });

        expect(getOutput("foobar-function.js")).toMatchSnapshot();
    });

    it("should generate YAML file with addonsDir and one addon selected", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["export-yaml-generator"],
                },
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function foobar");
        expect(getOutput("foobar-function.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });

    it("should generate additional files with addonDir and one addon selected", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foo-added-generator"],
                },
            },
        });

        expect(getOutput("foobar-arrow-added.js")).toMatchSnapshot();
    });

    it("should transform foobar functions with addonDir and one addon selected", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-transformer"],
                },
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
    });

    it("should generate YAML file with profile in file-config, addonsDir, and one profile selected", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                "target-profile": {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profile: "target-profile",
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function foobar");
        expect(getOutput("foobar-function.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });

    it("should not generate YAML file with named profile, addonsDir and profile in file-config", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                "target-profile": {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults, noEmit: true },
            websmith: {
                profile: "target-profile",
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toBeUndefined();
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });

    it("should generate YAML file with profiles in file-config, addonsDir and generic profile selected", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                "*": {
                    addons: ["export-yaml-generator"],
                },
            },
        });
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profile: "*",
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function foobar");
        expect(getOutput("foobar-function.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });

    it("should transform foobar functions with profiles in file-config, addonsDir and generic profile selected", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                "*": {
                    addons: ["foobar-replace-transformer"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profile: "*",
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
    });

    it("should generate YAML file with named profile and addonsDir, one profile in file-config", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                "target-profile": {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profile: "target-profile",
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function foobar");
        expect(getOutput("foobar-function.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });

    it("should transform foobar functions with addonsDir and addons config", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-transformer"],
                },
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
    });

    it("should transform foobar functions with addonsDir, addons and profiles in config but no profile selected", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
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
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
    });

    it("should transform foobar functions with named profile and addonsDir, multiple existing profile in config-file", async () => {
        writeWebsmithConfig({
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
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profile: "profile-transform",
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
    });

    it("should transform foobar functions with multiple named profiles and addonsDir, dependent profiles selected", async () => {
        writeWebsmithConfig({
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
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profile: "profile-process",
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });

    it("should transform foobar functions with named profile and addonsDir, chained addons in config-file", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                "profile-transform": {
                    addons: ["foobar-replace-transformer", "export-yaml-generator"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profile: "profile-transform",
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });
});

const writeWebsmithConfig = (config?: CompilationConfig) => {
    fs.mkdirSync(PROJECT_DIR, {
        recursive: true,
    });
    fs.writeFileSync(path.join(PROJECT_DIR, "websmith.config.json"), JSON.stringify(config), {
        encoding: "utf-8",
    });
};

const writeTsConfig = (config?: ts.CompilerOptions) => {
    fs.mkdirSync(PROJECT_DIR, {
        recursive: true,
    });
    fs.writeFileSync(path.join(PROJECT_DIR, "tsconfig.json"), JSON.stringify({ compilerOptions: config }), {
        encoding: "utf-8",
    });
};

const getOutput = (filePath: string): string | undefined => {
    // Try the direct path first (for most tests)
    const directPath = path.join(OUTPUT_DIR, filePath);
    if (fs.existsSync(directPath)) {
        return fs.readFileSync(directPath, "utf-8");
    }

    // Try looking in the src subdirectory (for tests with new directory structure)
    const srcPath = path.join(OUTPUT_DIR, "src", filePath);
    if (fs.existsSync(srcPath)) {
        return fs.readFileSync(srcPath, "utf-8");
    }

    return undefined;
};
