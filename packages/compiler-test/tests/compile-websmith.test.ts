import { type CompilationConfig as WebsmithOptions } from "@quatico/websmith-core";
import { compile } from "@quatico/websmith-node";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const OUTPUT_DIR = path.join(__dirname, "..", "lib");
const SOURCE_DIR = path.join(__dirname, "..", "src");
const ADDONS_DIR = path.join(__dirname, "..", "..", "example-addons", "src");

beforeAll(() => {
    if (fs.readdirSync(ADDONS_DIR).length === 0) {
        throw new Error(
            "No addons found in package 'example-addons'. Did you use the 'lib' folder and forget to run 'pnpm build' in the package directory"
        );
    }
});

const tsDefaults = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    project: path.join(__dirname, "..", "tsconfig.json"),
    outDir: OUTPUT_DIR,
    removeComments: true,
    skipLibCheck: true,
    noEmit: false,
    sourceMap: false,
};

beforeEach(() => {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
});

afterEach(() => {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
});

describe("compile w/ websmith", () => {
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
        writeWebsmithOptions({
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
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function foobar");
        expect(getOutput("foobar-function.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });

    it("should not generate YAML file with named profile, addonsDir and profile in file-config", async () => {
        writeWebsmithOptions({
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
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toBeUndefined();
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });

    it("should generate YAML file with profiles in file-config, addonsDir and generic profile selected", async () => {
        writeWebsmithOptions({
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
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function foobar");
        expect(getOutput("foobar-function.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });

    it("should transform foobar functions with profiles in file-config, addonsDir and generic profile selected", async () => {
        writeWebsmithOptions({
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
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
    });

    it("should generate YAML file with named profile and addonsDir, one profile in file-config", async () => {
        writeWebsmithOptions({
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
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
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
        writeWebsmithOptions({
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
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
    });

    it("should transform foobar functions with multiple named profiles and addonsDir, dependent profiles selected", async () => {
        writeWebsmithOptions({
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
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });

    it("should transform foobar functions with named profile and addonsDir, chained addons in config-file", async () => {
        writeWebsmithOptions({
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
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("foobar-function.js")).toContain("function barfoo");
        expect(getOutput("foobar-function.js")).toContain("function getbarfoo");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });
});

const writeWebsmithOptions = (options: Partial<WebsmithOptions>) => {
    fs.mkdirSync(OUTPUT_DIR, {
        recursive: true,
    });
    fs.writeFileSync(path.join(OUTPUT_DIR, "websmith.config.json"), JSON.stringify(options), {
        encoding: "utf-8",
    });
};

const getOutput = (filePath: string): string | undefined =>
    fs.existsSync(path.join(OUTPUT_DIR, filePath)) ? fs.readFileSync(path.join(OUTPUT_DIR, filePath), "utf-8") : undefined;
