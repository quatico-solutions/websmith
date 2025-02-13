/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { NoReporter } from "@quatico/websmith-core";
import { compileSystem } from "@quatico/websmith-testing";
import { createOptions } from "./options";

describe("createOptions", () => {
    it("should return defaults w/o any param", () => {
        const actual = createOptions({ instanceName: "target-instance" });

        expect(actual).toEqual({
            buildDir: expect.any(String),
            tsConfig: expect.any(Object),
            reporter: expect.any(NoReporter),
            cliArgs: expect.any(Object),
            debug: false,
            targets: [],
            watch: false,
        });
    });

    it("should return project config w/ custom but empty tsconfig.json", () => {
        const { fileSystem: target } = compileSystem({ files: { "./expected/tsconfig.json": "{}" } });

        const actual = createOptions(
            { tsConfigFile: "./expected/tsconfig.json", instanceName: "target-instance" },
            new NoReporter(),
            target
        ).tsConfig;

        expect(actual).toEqual({
            configFilePath: "/expected/tsconfig.json",
            outDir: "/lib",
        });
    });

    it("should return project config w/ with custom tsconfig.json", () => {
        const { fileSystem: target } = compileSystem({
            files: { "./expected/tsconfig.json": `${JSON.stringify({ compilerOptions: { strict: true } })}` },
        });

        const actual = createOptions(
            { tsConfigFile: "./expected/tsconfig.json", instanceName: "target-instance" },
            new NoReporter(),
            target
        ).tsConfig;

        expect(actual).toEqual({
            configFilePath: "/expected/tsconfig.json",
            outDir: "/lib",
            strict: true,
        });
    });

    it("should return project config w/ with tsConfig override", () => {
        const { fileSystem: target } = compileSystem({
            files: { "./expected/tsconfig.json": `${JSON.stringify({ compileOptions: { strict: false } })}` },
        });

        const actual = createOptions(
            { tsConfigFile: "./expected/tsconfig.json", instanceName: "target-instance", tsConfig: { strict: true } },
            new NoReporter(),
            target
        ).tsConfig;

        expect(actual).toEqual({
            configFilePath: "/expected/tsconfig.json",
            outDir: "/lib",
            strict: true,
        });
    });

    it("should return expected path w/ custom addons directory", () => {
        const { addons } = compileSystem({
            files: {
                "./tsconfig.json": "{}",
                "./expected/addon-foo/addon.js": "export const activate = () => {};",
            },
            addonConfig: { addons: ["addon-foo"], addonsDir: "./expected" },
        });
        jest.mock(
            "/expected/addon-foo/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const actual = addons.getAvailableAddons("*");

        expect(actual.map(it => it.getName())).toEqual(["addon-foo"]);
    });

    it("should return debug path w/ debug true", () => {
        const { fileSystem: target } = compileSystem({ files: { "./tsconfig.json": "{}" } });

        const actual = createOptions({ debug: true, instanceName: "target-instance" }, new NoReporter(), target);

        expect(actual).toEqual(expect.objectContaining({ debug: true }));
    });

    it("should return config w/ valid compiler config json", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "./tsconfig.json": "{}",
                "websmith.config.json": `
                { "targets": { "whatever": { "addons": [ "one", "two", "three" ] } } }
            `,
            },
        });
        const actual = createOptions({ configFile: "./websmith.config.json", instanceName: "target-instance" }, new NoReporter(), target).config;

        expect(actual).toEqual({
            targets: { whatever: { addons: ["one", "two", "three"] } },
        });
    });

    it("should return config w/ valid addonsDir, addons in compiler config json", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "./tsconfig.json": '{ "include": ["**/*.ts"] }',
                "/expected/one/addon.ts": "export const activate = () => {};",
                "websmith.config.json": '{ "addons":["one", "two"], "addonsDir":"./expected" }',
            },
        });
        jest.mock(
            "/expected/one/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const actual = createOptions({ configFile: "./websmith.config.json", instanceName: "target-instance" }, new NoReporter(), target);

        expect(actual).toMatchObject({
            buildDir: "/",
            config: {
                addons: ["one", "two"],
                addonsDir: "/expected",
            },
            tsConfig: {
                configFilePath: "/tsconfig.json",
                outDir: "/lib",
            },

            targets: [],
            cliArgs: {
                fileNames: ["/expected/one/addon.ts"],
                errors: [],
                options: {
                    configFilePath: "/tsconfig.json",
                    outDir: "/lib",
                },
                raw: {
                    include: ["**/*.ts"],
                },
            },
        });
    });
});
