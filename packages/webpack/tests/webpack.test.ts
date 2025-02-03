import { type CompilerOptions as WebsmithOptions } from "@quatico/websmith-core";
import { webpack } from "@quatico/websmith-node";
import fs from "fs";
import path from "path";
import ts from "typescript";

const OUTPUT_DIR = path.join(__dirname, "__data__", "lib");
const SOURCE_DIR = path.join(__dirname, "__data__", "src");
const ADDONS_DIR = path.join(__dirname, "..", "..", "examples", "lib");

const tsDefaults = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    project: path.join(__dirname, "..", "tsconfig.json"),
    outDir: OUTPUT_DIR,
    removeComments: true,
};

const webpackDefaults = {
    output: {
        path: OUTPUT_DIR,
    },
    module: {
        rules: [
            {
                test: /\.[jt]s?$/,
                loader: require.resolve("@quatico/websmith-webpack"),
                options: {
                    transpileOnly: true,
                    project: path.join(__dirname, "..", "tsconfig.json"),
                },
            },
            {
                test: /\.[jt]s?$/,
                loader: require.resolve("ts-loader"),
                options: {
                    transpileOnly: true,
                    configFile: path.join(__dirname, "..", "tsconfig.json"),
                },
            },
        ],
    },
};

beforeAll(() => {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
});

describe("webpack", () => {
    it("should build foobar-arrow.js with ES2020 target", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: {
                compilerOptions: {
                    target: ts.ScriptTarget.ES2020,
                    project: path.join(__dirname, "..", "tsconfig.json"),
                },
            },
            websmith: {
                config: "websmith.config.json",
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8")).toMatchSnapshot();

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it("should build foobar-function.js with ES2020 target", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: {
                compilerOptions: {
                    target: ts.ScriptTarget.ES2020,
                    project: path.join(__dirname, "..", "tsconfig.json"),
                },
            },
            websmith: {
                config: "websmith.config.json",
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8")).toMatchSnapshot();

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it("should generate YAML file with addon", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: { compilerOptions: { ...tsDefaults } },
            websmith: {
                targets: "*",
                webpackTarget: "*",
                addonsDir: ADDONS_DIR,
                addons: "export-yaml-generator",
                config: "websmith.config.json",
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
        expect(actual).toContain("function foobar");
        expect(actual).toContain("function getFoobar");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it("should transform foobar functions with addon", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: { compilerOptions: { ...tsDefaults } },
            websmith: {
                targets: "*",
                webpackTarget: "*",
                addonsDir: ADDONS_DIR,
                addons: "example-transformer",
                config: "websmith.config.json",
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it("should generate YAML file with addon and file-config", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                "*": {
                    addons: ["export-yaml-generator"],
                    writeFile: true,
                },
            },
        });

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: { compilerOptions: { ...tsDefaults } },
            websmith: {
                targets: "*",
                webpackTarget: "*",
                addonsDir: ADDONS_DIR,
                addons: "export-yaml-generator",
                config: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
        expect(actual).toContain("function foobar");
        expect(actual).toContain("function getFoobar");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it("should transform foobar functions with addon and file-config", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                "*": {
                    addons: ["example-transformer"],
                    writeFile: true,
                },
            },
        });

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: { compilerOptions: { ...tsDefaults } },
            websmith: {
                targets: "*",
                webpackTarget: "*",
                addonsDir: ADDONS_DIR,
                addons: "example-transformer",
                config: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it("should generate YAML file with addon and target", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                "target-zip": {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: { compilerOptions: { ...tsDefaults } },
            websmith: {
                targets: "target-zip",
                webpackTarget: "target-zip",
                addons: "export-yaml-generator",
                config: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
        expect(actual).toContain("function foobar");
        expect(actual).toContain("function getFoobar");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it("should transform foobar functions with addon and target", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                "target-expected": {
                    addons: ["example-transformer"],
                },
            },
        });

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: { compilerOptions: { ...tsDefaults } },
            websmith: {
                targets: "target-expected",
                webpackTarget: "target-expected",
                addons: "example-transformer",
                config: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it("should transform foobar functions with addon and multiple available targets", async () => {
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: { compilerOptions: { ...tsDefaults } },
            websmith: {
                targets: "target-transform",
                webpackTarget: "target-transform",
                addons: "example-transformer,example-generator,example-processor",
                config: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it("should transform foobar functions with addon and multiple selected targets", async () => {
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: { compilerOptions: { ...tsDefaults } },
            websmith: {
                targets: "target-transform,target-process",
                addons: "example-transformer,example-generator,export-yaml-generator",
                config: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it("should transform foobar functions with addon and chained targets", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                "target-transform": {
                    addons: ["example-transformer", "export-yaml-generator"],
                },
            },
        });

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: { compilerOptions: { ...tsDefaults } },
            websmith: {
                targets: "target-transform",
                config: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });
});

const writeWebsmithOptions = (options: WebsmithOptions) => {
    fs.mkdirSync(OUTPUT_DIR, {
        recursive: true,
    });
    fs.writeFileSync(path.join(OUTPUT_DIR, "websmith.config.json"), JSON.stringify(options), {
        encoding: "utf-8",
    });
};
