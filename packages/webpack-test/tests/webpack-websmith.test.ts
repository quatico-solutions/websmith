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

const getOutput = (filePath: string) => getOutputBase(filePath, OUTPUT_DIR);

// TODO: ts-loader options caching seems broken, we need to understand where to fix it
// This workaround is not working, we need to find a better solution
// jest.mock("websmith-loader", () => ({
//     ...jest.requireActual("websmith-loader"),
//     getInstanceFromCache: jest.fn(),
// }));

const PROJECT_DIR = path.join(__dirname, "..", "output");
const OUTPUT_DIR = path.join(PROJECT_DIR, "lib");
const SOURCE_DIR = path.join(PROJECT_DIR, "src");
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
                            tsConfigFile: path.join(PROJECT_DIR, "tsconfig.json"),
                        },
                    },
                ],
            },
        ],
    },
};

beforeAll(() => {
    fs.rmSync(path.resolve(path.join(__dirname, "..", "..", "example-addons", "lib")), { recursive: true, force: true });
    if (fs.readdirSync(ADDONS_DIR).length === 0) {
        throw new Error(
            "No addons found in package 'example-addons'. Did you use the 'lib' folder and forget to run 'pnpm build' in the package directory"
        );
    }
});

beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(SOURCE_DIR, { recursive: true });

    // Copy all source files for each test
    const originalSourceDir = path.join(__dirname, "..", "src");
    const sourceFiles = fs.readdirSync(originalSourceDir);
    for (const file of sourceFiles) {
        const srcPath = path.join(originalSourceDir, file);
        const destPath = path.join(SOURCE_DIR, file);
        if (fs.statSync(srcPath).isDirectory()) {
            fs.cpSync(srcPath, destPath, { recursive: true });
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }

    writeTsConfig({
        target: ts.ScriptTarget.ES2020,
        outDir: OUTPUT_DIR,
    });
});

afterEach(() => {
    fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith", () => {
    it("should build foobar-arrow.js with ES2020 and addonsDir", async () => {
        writeWebsmithConfig({
            // Don't specify addonsDir to prevent any addon loading
        });

        await webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                tsConfig: {
                    target: ts.ScriptTarget.ES2020,
                },
            },
        });

        expect(getOutput("main.js")).toMatchSnapshot();
    });

    it("should build foobar-function.js with ES2020 and addonsDir", async () => {
        writeWebsmithConfig({
            // Don't specify addonsDir to prevent any addon loading
        });

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
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

    // TODO: Skipped Test: This test does not work for this webpack setup. Can we observe a change within the output chunk?
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
        writeWebsmithConfig({
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
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
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

    it("should generate YAML file with profile in file-config, addonsDir and named profile selected", async () => {
        writeWebsmithConfig({
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
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                config: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                profile: "profile-transform",
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
    });

    it("should transform foobar functions with addonsDir and dependent profiles in config-file", async () => {
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

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                config: {
                    addons: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                },
                profile: "profile-process",
            },
        });

        expect(getOutput("main.js")).toContain("function barfoo");
        expect(getOutput("main.js")).toContain("function getbarfoo");
        expect(getOutput("output.yaml")).toContain("exports: [getFoobar]");
    }, 180000); // Increase timeout to 3 minutes

    it("should transform foobar functions with named profile and addonsDir, chained addons in config-file", async () => {
        writeWebsmithConfig({
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
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
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
        writeWebsmithConfig({
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

        writeTsConfig({
            target: ts.ScriptTarget.ES2020,
            outDir: OUTPUT_DIR,
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
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                profile: undefined,
            },
        });

        expect(getOutput("client.js")).toContain("function getSERVERClient");
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
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                profile: undefined,
                config: {
                    addons: [],
                },
            },
        });

        expect(getOutput("client.js")).toContain("function getSERVERClient");
        expect(getOutput("server.js")).toContain("function getSERVERServer");
    });

    it("should yield transformed functions with existing profile, dependent profile and single entry", async () => {
        writeWebsmithConfig({
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
        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                profile: "client",
            },
        });

        expect(getOutput("client.js")).toContain("function getCLIENTClient");
        expect(getOutput("server.js")).toBeUndefined();
    });

    it("should yield non-transformed functions with existing profile and single entry", async () => {
        writeWebsmithConfig({
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

        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
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
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                profile: "client",
            },
        });

        expect(getOutput("client.js")).toContain("function getCLIENTClient");
        expect(getOutput("server.js")).toContain("function getCLIENTServer");
    });

    it("should yield transformed functions with existing profile, dependent profile and imported server function", async () => {
        writeWebsmithConfig({
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

        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                entry: {
                    client: path.join(SOURCE_DIR, "client-function-with-import.ts"),
                    server: path.join(SOURCE_DIR, "functions/server-function.ts"),
                },
            },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                profile: "client",
            },
        });

        expect(getOutput("client.js")).toContain("function getCLIENTClient");
        expect(getOutput("client.js")).toContain("getCLIENTServer: ()");
        expect(getOutput("server.js")).toContain("function getCLIENTServer");
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
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
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
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                profile: "server",
            },
        });

        expect(getOutput("client.js")).toContain("function getFoobarClient");
        expect(getOutput("client.js")).not.toContain("Server");
        expect(getOutput("server.js")).toContain("function getFoobarServer");
        expect(getOutput("server.js")).not.toContain("Client");
    });
});
