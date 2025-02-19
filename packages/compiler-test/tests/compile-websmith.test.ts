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

    it("should generate YAML file with addonsDir, addons and all profiles selected", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profiles: ["*"],
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

    it("should generate additional files with addonDir, addons and all profiles selected", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profiles: ["*"],
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foo-added-generator"],
                },
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "foobar-arrow-added.js"), "utf-8")).toMatchSnapshot();
    });

    it("should transform foobar functions with addonDir, addons and all profiles selected", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profiles: ["*"],
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-transformer"],
                },
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
    });

    it("should generate YAML file with all profiles and addonsDir, named profile in file-config", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            profiles: {
                named: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profiles: ["named"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function foobar");
        expect(actual).toContain("function getFoobar");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");
    });

    it("should not generate YAML file with named profile, addonsDir and profile in file-config", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            profiles: {
                named: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults, noEmit: true },
            websmith: {
                profiles: ["named"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        expect(fs.existsSync(path.join(OUTPUT_DIR, "foobar-function.js"))).toBe(false);
        expect(fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8")).toContain("exports: [getFoobar]");
    });

    it("should generate YAML file with all profiles and addonsDir, generic profile in file-config", async () => {
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
                profiles: ["*"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function foobar");
        expect(actual).toContain("function getFoobar");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");
    });

    it("should transform foobar functions with all profiles and addonsDir, generic profile in file-config", async () => {
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
                profiles: ["*"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
    });

    it("should generate YAML file with named profile and addonsDir, named profile in file-config", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            profiles: {
                "profile-zip": {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profiles: ["profile-zip"],
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
                    addons: ["foobar-replace-transformer"],
                },
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
    });

    it("should transform foobar functions with addonsDir, addons and profiles config but no profile selected", async () => {
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

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
    });

    it("should transform foobar functions with named profile and addonsDir, multiple named profiles in config-file", async () => {
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
                profiles: ["profile-transform"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
    });

    it("should transform foobar functions with multiple named profiles and addonsDir, multiple profiles in config-file", async () => {
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
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: { ...tsDefaults },
            websmith: {
                profiles: ["profile-transform", "profile-process"],
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");
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
                profiles: ["profile-transform"],
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
