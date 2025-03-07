/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { compileSystem } from "../../testing";
import { NoReporter } from "../NoReporter";
import { createOptions } from "./options";

describe("createOptions", () => {
    it("should return defaults w/o any param", () => {
        const actual = createOptions({});

        expect(actual).toEqual(
            expect.objectContaining({
                debug: false,
                watch: false,
            })
        );
    });

    it("should return project config w/ custom but empty tsconfig.json", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "./expected/tsconfig.json": "{}",
            },
        });

        const actual = createOptions({ project: "./expected/tsconfig.json" }, new NoReporter(), target).tsConfig;

        expect(actual).toEqual({
            configFilePath: "/expected/tsconfig.json",
            sourceMap: false,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ESNext,
        });
    });

    it("should return expected path w/ custom addons directory and '*' target", () => {
        const { addons } = compileSystem({
            files: {
                "./expected/addon-foo/addon.js": "export const activate = () => {};",
            },
            addonConfig: { addonsDir: "./expected" },
        });
        jest.mock(
            "/expected/addon-foo/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const actual = addons.getAvailableAddons("*");

        expect(actual.getNames()).toEqual(["addon-foo"]);
    });

    it("should return debug path w/ debug true", () => {
        const { fileSystem: target } = compileSystem();

        const actual = createOptions({ debug: true }, new NoReporter(), target);

        expect(actual).toEqual(expect.objectContaining({ debug: true }));
    });

    it("should return watch path w/ watch true", () => {
        const { fileSystem: target } = compileSystem();
        const actual = createOptions({ watch: true }, new NoReporter(), target);

        expect(actual).toEqual(expect.objectContaining({ watch: true }));
    });

    it("should return config w/ valid compiler config json", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "websmith.config.json": '{ "profiles": { "whatever": { "addons": [ "one", "two", "three" ] } } }',
            },
        });

        const actual = createOptions({ configFile: "./websmith.config.json" }, new NoReporter(), target).config;

        expect(actual).toEqual({
            profiles: { whatever: { addons: ["one", "two", "three"] } },
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

        const actual = createOptions({ configFile: "./websmith.config.json", project: "./tsconfig.json" }, new NoReporter(), target);

        expect(actual).toMatchObject({
            buildDir: "/src",
            config: {
                addons: ["one", "two"],
                addonsDir: "/expected",
            },
            tsConfig: {
                configFilePath: "/tsconfig.json",
            },

            cliArgs: {
                fileNames: ["/expected/one/addon.ts"],
                errors: [],
                options: {
                    configFilePath: "/tsconfig.json",
                },
                raw: {
                    include: ["**/*.ts"],
                },
            },
        });
    });
});
