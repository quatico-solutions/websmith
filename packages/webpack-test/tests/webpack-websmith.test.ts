/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type CompilationConfig as WebsmithOptions } from "@quatico/websmith-core";
import { webpack } from "@quatico/websmith-node";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// TODO: ts-loader options caching seems broken, we need to understand where to fix it
// This workaround is not working, we need to find a better solution
// jest.mock("@quatico/websmith-webpack", () => ({
//     ...jest.requireActual("@quatico/websmith-webpack"),
//     getInstanceFromCache: jest.fn(),
// }));

const OUTPUT_DIR = path.join(__dirname, "..", "lib");
const SOURCE_DIR = path.join(__dirname, "..", "src");
const ADDONS_DIR = path.join(__dirname, "..", "..", "example-addons", "lib");

const webpackDefaults = {
    output: {
        path: OUTPUT_DIR,
    },
    module: {
        rules: [
            {
                test: /\.[jt]s?$/,
                use: [
                    {
                        loader: require.resolve("@quatico/websmith-webpack"),
                        options: {
                            transpileOnly: true,
                            project: path.join(__dirname, "..", "tsconfig.json"),
                        },
                    },
                ],
            },
        ],
    },
};

beforeAll(() => {
    if (fs.readdirSync(ADDONS_DIR).length === 0) {
        throw new Error("Package 'sandbox-addons' is not built, run 'pnpm build' in the root directory");
    }
});

beforeEach(() => {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
});

afterEach(() => {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith", () => {
    it("should build foobar-arrow.js with ES2020 and addonsDir", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
        });

        await webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                tsConfig: {
                    target: ts.ScriptTarget.ES2020,
                },
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8")).toMatchSnapshot();
    });

    it("should build foobar-function.js with ES2020 and addonsDir", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
        });

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                tsConfig: {
                    target: ts.ScriptTarget.ES2020,
                },
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8")).toMatchSnapshot();
    });

    it("should generate YAML file with addonsDir, addons and all targets selected", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["export-yaml-generator"],
                },
                targets: ["*"],
                webpackTarget: "*",
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
        expect(actual).toContain("function foobar");
        expect(actual).toContain("function getFoobar");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");
    });

    // TODO: This test does not work for this webpack setup. Can we observe a change within the output chunk?
    it.skip("should generate additional files with addonDir, addons and all targets selected", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["example-generator"],
                },
                targets: ["*"],
                webpackTarget: "*",
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "foobar-arrow-added.js"), "utf-8")).toMatchSnapshot();
    });

    it("should transform foobar functions with addonDir, addons and all targets selected", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["example-transformer"],
                },
                targets: ["*"],
                webpackTarget: "*",
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                config: {
                    addons: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                },
                targets: ["named"],
                webpackTarget: "named",
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
        expect(actual).toContain("function foobar");
        expect(actual).toContain("function getFoobar");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                targets: ["*"],
                webpackTarget: "*",
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                targets: ["*"],
                webpackTarget: "*",
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                targets: ["target-zip"],
                webpackTarget: "target-zip",
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
        expect(actual).toContain("function foobar");
        expect(actual).toContain("function getFoobar");
        const actual2 = fs.readFileSync(path.join(OUTPUT_DIR, "output.yaml"), "utf-8");
        expect(actual2).toContain("exports: [getFoobar]");
    });

    it("should transform foobar functions with addonsDir and addons config", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["example-transformer"],
                },
                targets: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                webpackTarget: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
    });

    it("should transform foobar functions with addonsDir, addons and targets config but no target selected", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
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

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                config: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                targets: ["target-transform"],
                webpackTarget: "target-transform",
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                config: {
                    addons: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                },
                targets: ["target-transform", "target-process"],
                webpackTarget: "target-transform",
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                targets: ["target-transform"],
                webpackTarget: "target-transform",
            },
        });

        const actual = fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8");
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
