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
        const actual = createOptions({});

        expect(actual).toEqual({
            buildDir: expect.any(String),
            project: expect.any(Object),
            reporter: expect.any(NoReporter),
            cliArgs: expect.any(Object),
            debug: false,
            sourceMap: false,
            targets: ["*"],
            watch: false,
            transpileOnly: false,
        });
    });

    it("should return project config w/ custom but empty tsconfig.json", () => {
        const { fileSystem: target } = compileSystem({ files: { "./expected/tsconfig.json": "{}" } });

        const actual = createOptions({ project: "./expected/tsconfig.json" }, new NoReporter(), target).project;

        expect(actual).toEqual({
            configFilePath: "/expected/tsconfig.json",
            outDir: "/lib",
            sourceMap: false,
        });
    });

    it("should return project config w/ with custom tsconfig.json", () => {
        const { fileSystem: target } = compileSystem({
            files: { "./expected/tsconfig.json": `${JSON.stringify({ compilerOptions: { strict: true } })}` },
        });

        const actual = createOptions({ project: "./expected/tsconfig.json" }, new NoReporter(), target).project;

        expect(actual).toEqual({
            configFilePath: "/expected/tsconfig.json",
            outDir: "/lib",
            sourceMap: false,
            strict: true,
        });
    });

    it("should return project config w/ with tsConfig override", () => {
        const { fileSystem: target } = compileSystem({
            files: { "./expected/tsconfig.json": `${JSON.stringify({ compileOptions: { strict: false } })}` },
        });

        const actual = createOptions({ project: "./expected/tsconfig.json", tsConfig: { strict: true } }, new NoReporter(), target).project;

        expect(actual).toEqual({
            configFilePath: "/expected/tsconfig.json",
            outDir: "/lib",
            sourceMap: false,
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

        const actual = createOptions({ debug: true }, new NoReporter(), target);

        expect(actual).toEqual(expect.objectContaining({ debug: true }));
    });

    it("should return config w/ valid compiler config json", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "./tsconfig.json": "{}",
                "websmith.config.json": `
                { "targets": { "whatever": { "addons": [ "one", "two", "three" ], "writeFile": true } } }
            `,
            },
        });
        const actual = createOptions({ configFile: "./websmith.config.json" }, new NoReporter(), target).config;

        expect(actual).toEqual({
            targets: { whatever: { addons: ["one", "two", "three"], writeFile: true } },
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

        const actual = createOptions({ configFile: "./websmith.config.json" }, new NoReporter(), target);

        expect(actual).toMatchObject({
            buildDir: "/",
            config: {
                addons: ["one", "two"],
                addonsDir: "/expected",
            },
            project: {
                configFilePath: "/tsconfig.json",
                outDir: "/lib",
            },

            targets: ["*"],
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
