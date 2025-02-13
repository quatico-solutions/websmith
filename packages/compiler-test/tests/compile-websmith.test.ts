import { type CompilationConfig as WebsmithOptions } from "@quatico/websmith-core";
import { compile } from "@quatico/websmith-node";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const OUTPUT_DIR = path.join(__dirname, "..", "lib");
const SOURCE_DIR = path.join(__dirname, "..", "src");
const ADDONS_DIR = path.join(__dirname, "..", "..", "example-addons", "lib");

beforeAll(() => {
    if (fs.readdirSync(ADDONS_DIR).length === 0) {
        throw new Error("Package 'sandbox-addons' is not built, run 'pnpm build' in the root directory");
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
        expect(fs.readFileSync(path.join(OUTPUT_DIR, "foobar-arrow.js"), "utf-8")).toMatchSnapshot();
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

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8")).toMatchSnapshot();
    });

    it("should generate YAML file with addonsDir, addons and all targets selected", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                targets: ["*"],
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["export-yaml-generator"],
                },
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function foobar");
        expect(actual).toContain("function getFoobar");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");
    });

    it("should generate additional files with addonDir, addons and all targets selected", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                targets: ["*"],
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["example-generator"],
                },
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "foobar-arrow-added.js"), "utf-8")).toMatchSnapshot();
    });

    it("should transform foobar functions with addonDir, addons and all targets selected", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                targets: ["*"],
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["example-transformer"],
                },
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
    });

    it("should generate YAML file with all targets and addonsDir, named target in file-config", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                named: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                targets: ["named"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function foobar");
        expect(actual).toContain("function getFoobar");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");
    });

    it("should not generate YAML file with named target, addonsDir and target in file-config", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                named: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults, noEmit: true },
            websmith: {
                targets: ["named"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        expect(fs.existsSync(path.join(OUTPUT_DIR, "foobar-function.js"))).toBe(false);
        expect(fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8")).toContain("exports: [getFoobar]");
    });

    it("should generate YAML file with all targets and addonsDir, generic target in file-config", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                "*": {
                    addons: ["export-yaml-generator"],
                },
            },
        });
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                targets: ["*"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function foobar");
        expect(actual).toContain("function getFoobar");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");
    });

    it("should transform foobar functions with all targets and addonsDir, generic target in file-config", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                "*": {
                    addons: ["example-transformer"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                targets: ["*"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
    });

    it("should generate YAML file with named target and addonsDir, named target in file-config", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                "target-zip": {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                targets: ["target-zip"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function foobar");
        expect(actual).toContain("function getFoobar");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");
    });

    it("should transform foobar functions with addonsDir and addons config", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["example-transformer"],
                },
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
    });

    it("should transform foobar functions with addonsDir, addons and targets config but no target selected", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["example-transformer"],
                    targets: {
                        "target-expected": {
                            addons: ["example-transformer"],
                        },
                    },
                },
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
    });

    it("should transform foobar functions with named target and addonsDir, multiple named targets in config-file", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                "target-transform": {
                    addons: ["example-transformer"],
                },
                "target-generate": {
                    addons: ["example-generator"],
                },
                "target-process": {
                    addons: ["example-processor"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                targets: ["target-transform"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
    });

    it("should transform foobar functions with multiple named targets and addonsDir, multiple targets in config-file", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                "target-transform": {
                    addons: ["example-transformer"],
                },
                "target-generate": {
                    addons: ["example-generator"],
                },
                "target-process": {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                targets: ["target-transform", "target-process"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");
    });

    it("should transform foobar functions with named target and addonsDir, chained addons in config-file", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                "target-transform": {
                    addons: ["example-transformer", "export-yaml-generator"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                targets: ["target-transform"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");
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
