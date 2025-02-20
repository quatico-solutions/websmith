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
                        loader: require.resolve("@quatico/websmith-webpack"),
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

    it("should generate YAML file with addonsDir, addons and all profiles selected", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["export-yaml-generator"],
                },
                profiles: ["*"],
                webpackTarget: "*",
            },
        });

        expect(getOutput("main.js")).toContain("function foobar");
        expect(getOutput("main.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    });

    // TODO: This test does not work for this webpack setup. Can we observe a change within the output chunk?
    it.skip("should generate additional files with addonDir, addons and all profiles selected", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foo-added-generator"],
                },
                profiles: ["*"],
                webpackTarget: "*",
            },
        });

        expect(getOutput("foobar-arrow-added.js")).toMatchSnapshot();
    });

    it("should transform foobar functions with addonDir, addons and all profiles selected", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                config: {
                    addonsDir: ADDONS_DIR,
                    addons: ["foobar-replace-transformer"],
                },
                profiles: ["*"],
                webpackTarget: "*",
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                config: {
                    addons: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                },
                profiles: ["named"],
                webpackTarget: "named",
            },
        });

        expect(getOutput("main.js")).toContain("function foobar");
        expect(getOutput("main.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profiles: ["*"],
                webpackTarget: "*",
            },
        });

        expect(getOutput("main.js")).toContain("function foobar");
        expect(getOutput("main.js")).toContain("function getFoobar");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profiles: ["*"],
                webpackTarget: "*",
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                profiles: ["profile-zip"],
                webpackTarget: "profile-zip",
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
                profiles: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                webpackTarget: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
    });

    it("should transform foobar functions with addonsDir, addons and profiles config but no profile selected", async () => {
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                config: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                profiles: ["profile-transform"],
                webpackTarget: "profile-transform",
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                config: {
                    addons: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                },
                profiles: ["profile-transform", "profile-process"],
                webpackTarget: "profile-transform",
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
                profiles: ["profile-transform"],
                webpackTarget: "profile-transform",
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
                    addons: ["client-transformer"],
                },
                server: {
                    addons: ["server-transformer"],
                },
            },
        });
    });

    it("should non-transformed functions with named profile, single entry and no webpackTarget", async () => {
        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profiles: ["client"],
                webpackTarget: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
            },
        });

        expect(getOutput("client.js")).toContain("function getFoobarClient");
        expect(getOutput("client.js")).not.toContain("Server");
        expect(getOutput("server.js")).toBeUndefined();
    });

    it("should non-transformed functions with named profile, single entry and webpackTarget", async () => {
        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profiles: ["client"],
                webpackTarget: "client",
            },
        });

        expect(getOutput("client.js")).toContain("function getCLIENTClient");
        expect(getOutput("client.js")).not.toContain("Server");
        expect(getOutput("server.js")).toBeUndefined();
    });

    it("should transformed functions with multiple named profiles, webpackTarget and both entries", async () => {
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
                profiles: ["client"],
                webpackTarget: "client",
            },
        });

        expect(getOutput("client.js")).toContain("function getCLIENTClient");
        expect(getOutput("client.js")).not.toContain("Server");
        expect(getOutput("server.js")).toContain("function getCLIENTServer");
        expect(getOutput("server.js")).not.toContain("Client");
    });

    it("should transformed functions with multiple named profile, webpackTarget, imported server function", async () => {
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
                profiles: ["client"],
                webpackTarget: "client",
            },
        });

        expect(getOutput("client.js")).toContain("function getCLIENTClient");
        expect(getOutput("client.js")).toContain("function getCLIENTServer");
        expect(getOutput("server.js")).toContain("function getCLIENTServer");
        expect(getOutput("server.js")).not.toContain("Client");
    });

    it("should transformed functions with multiple named profiles, webpackTarget, imported server function", async () => {
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
                profiles: ["client", "server"],
                webpackTarget: "client",
            },
        });

        expect(getOutput("client.js")).toContain("function getSERVERClient");
        expect(getOutput("client.js")).toContain("function getSERVERServer");
        expect(getOutput("server.js")).toContain("function getSERVERServer");
        expect(getOutput("server.js")).not.toContain("Client");
    });

    it("should transformed functions with named profile, webpackTarget, imported server function", async () => {
        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function-with-import.ts"),
                },
            },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profiles: ["server", "client"],
                webpackTarget: "server",
            },
        });

        expect(getOutput("client.js")).toContain("function getSERVERClient");
        expect(getOutput("client.js")).toContain("function getSERVERServer");
        expect(getOutput("server.js")).toBeUndefined();
    });

    it("should processed functions with named profile, webpackTarget, imported server function", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            profiles: {
                client: {
                    addons: ["client-processor"],
                },
                server: {
                    addons: ["server-processor"],
                },
            },
        });

        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function-with-import.ts"),
                },
            },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profiles: ["server", "client"],
                webpackTarget: "server",
            },
        });

        expect(getOutput("client.js")).toContain("function getSERVERClient");
        expect(getOutput("client.js")).toContain("function getSERVERServer");
        expect(getOutput("server.js")).toBeUndefined();
    });

    it("should transformed functions with multiple named profiles and webpackTarget server", async () => {
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
                profiles: ["client", "server"],
                webpackTarget: "server",
            },
        });

        expect(getOutput("client.js")).toContain("function getSERVERClient");
        expect(getOutput("client.js")).not.toContain("Server");
        expect(getOutput("server.js")).toContain("function getSERVERServer");
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
