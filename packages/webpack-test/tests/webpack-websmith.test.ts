/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type CompilationConfig as WebsmithOptions } from "@quatico/websmith-core";
import { webpack } from "@quatico/websmith-node";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// TODO: ts-loader options caching seems broken, we need to understand where to fix it
// This workaround is not working, we need to find a better solution
// jest.mock("websmith-loader", () => ({
//     ...jest.requireActual("websmith-loader"),
//     getInstanceFromCache: jest.fn(),
// }));

const OUTPUT_DIR = path.join(__dirname, "..", "lib");
const SOURCE_DIR = path.join(__dirname, "..", "src");
const ADDONS_DIR = path.join(__dirname, "..", "..", "example-addons", "src");

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
                        loader: require.resolve("websmith-loader"),
                        options: {
                            transpileOnly: true,
                            tsConfigFile: path.join(__dirname, "..", "tsconfig.json"),
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

        expect(getOutput("main.js")).toMatchSnapshot();
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

        expect(getOutput("main.js")).toMatchSnapshot();
    });

    it("should generate YAML file with addonsDir and addon selected", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
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
    });

    // TODO: This test does not work for this webpack setup. Can we observe a change within the output chunk?
    it.skip("should generate additional files with addonDir and addon selected", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foo-added-generator"],
                },
            },
        });

        expect(getOutput("foobar-arrow-added.js")).toMatchSnapshot();
    });

    it("should transform foobar functions with addonDir and addon selected", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-transformer"],
                },
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
    });

    it("should generate YAML file with profiles in file-config, addonsDir and profile selected", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            profiles: {
                "target-profile": {
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
                profile: "target-profile",
            },
        });

        expect(getOutput("main.js")).toContain("function foobar");
        expect(getOutput("main.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });

    it("should generate YAML file with profile in file-config, addonsDir, generic profile selected", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            profiles: {
                "*": {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profile: "*",
            },
        });

        expect(getOutput("main.js")).toContain("function foobar");
        expect(getOutput("main.js")).toContain("function getFoobar");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profile: "*",
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
    });

    it("should generate YAML file with profile in file-config, addonsDir and named profile selected", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            profiles: {
                "profile-zip": {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                profile: "profile-zip",
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
            },
        });

        expect(getOutput("main.js")).toContain("function foobar");
        expect(getOutput("main.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });

    it("should transform foobar functions with addonsDir and addons config", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
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
    });

    it("should transform foobar functions with addonsDir, addons and profiles in config but no profile selected", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
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
    });

    it("should transform foobar functions with addonsDir and existing profile in config-file", async () => {
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                config: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                profile: "profile-transform",
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
    });

    it("should transform foobar functions with addonsDir and dependent profiles in config-file", async () => {
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                config: {
                    addons: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                },
                profile: "profile-process",
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profile: "profile-transform",
            },
        });

        const actual = getOutput("main.js");
        expect(actual).toContain("function barfoo");
        expect(actual).toContain("function getbarfoo");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });
});

describe("webpack w/ websmith, multiple profiles", () => {
    beforeEach(() => {
        writeWebsmithOptions({
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
        });
    });

    it("should yield non-transformed functions with no profile and single entry", async () => {
        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profile: undefined,
            },
        });

        expect(getOutput("client.js")).toContain("function getFoobarClient");
        expect(getOutput("server.js")).toBeUndefined();
    });

    it("should yield non-transformed functions with no profile and separate entries", async () => {
        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function.ts"),
                    server: path.join(SOURCE_DIR, "functions/server-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profile: undefined,
            },
        });

        expect(getOutput("client.js")).toContain("function getFoobarClient");
        expect(getOutput("server.js")).toContain("function getFoobarServer");
    });

    it("should yield transformed functions with existing profile, dependent profile and single entry", async () => {
        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profile: "client",
            },
        });

        expect(getOutput("client.js")).toContain("function getSERVERClient");
        expect(getOutput("server.js")).toBeUndefined();
    });

    it("should yield non-transformed functions with existing profile and single entry", async () => {
        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profile: "server",
            },
        });

        expect(getOutput("client.js")).toContain("function getFoobarClient");
        expect(getOutput("server.js")).toBeUndefined();
    });

    it("should yield transformed functions with existing profile, dependent profile and separate entries", async () => {
        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function.ts"),
                    server: path.join(SOURCE_DIR, "functions/server-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profile: "client",
            },
        });

        expect(getOutput("client.js")).toContain("function getSERVERClient");
        expect(getOutput("server.js")).toContain("function getSERVERServer");
    });

    it("should yield transformed functions with existing profile, dependent profile and imported server function", async () => {
        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function-with-import.ts"),
                    server: path.join(SOURCE_DIR, "functions/server-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profile: "client",
            },
        });

        expect(getOutput("client.js")).toContain("function getSERVERClient");
        expect(getOutput("client.js")).toContain("function getSERVERServer");
        expect(getOutput("server.js")).toContain("function getSERVERServer");
    });

    it("should yield transformed functions with existing profile and imported server function", async () => {
        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function-with-import.ts"),
                },
            },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profile: "server",
            },
        });

        expect(getOutput("client.js")).toContain("function getFoobarClient");
        expect(getOutput("client.js")).toContain("function getFoobarServer");
        expect(getOutput("server.js")).toBeUndefined();
    });

    it("should yield transformed functions with existing profile and separate entries", async () => {
        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function.ts"),
                    server: path.join(SOURCE_DIR, "functions/server-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profile: "server",
            },
        });

        expect(getOutput("client.js")).toContain("function getFoobarClient");
        expect(getOutput("client.js")).not.toContain("Server");
        expect(getOutput("server.js")).toContain("function getFoobarServer");
        expect(getOutput("server.js")).not.toContain("Client");
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
