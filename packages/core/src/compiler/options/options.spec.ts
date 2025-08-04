/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { createSystem } from "../../environment";
import { NoReporter } from "../NoReporter";
import { createOptions } from "./options";
import { AddonRegistry } from "../addons/AddonRegistry";

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
        const target = createSystem({ "./expected/tsconfig.json": "{}" }, { virtual: true });

        const actual = createOptions({ project: "./expected/tsconfig.json" }, new NoReporter(), target).tsConfig;

        expect(actual).toEqual({
            allowJs: false,
            checkJs: false,
            configFilePath: "/expected/tsconfig.json",
            declaration: false,
            declarationMap: false,
            emitDecorationOnly: false,
            esModuleInterop: false,
            jsx: ts.JsxEmit.Preserve,
            noEmit: false,
            pretty: true,
            project: "./expected/tsconfig.json",
            removeComments: false,
            strict: false,
            target: ts.ScriptTarget.ES5,
        });
    });

    it("should return expected path w/ custom addons directory and no profile specified", () => {
        const fileSystem = createSystem({ "./expected/addon-foo/addon.js": "export const activate = () => {};" }, { virtual: true });
        const addons = new AddonRegistry({ addonsDir: "./expected", reporter: new NoReporter(), system: fileSystem });
        jest.mock(
            "/expected/addon-foo/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const actual = addons.getAvailableAddons();

        expect(actual.getNames()).toEqual(["addon-foo"]);
    });

    it("should return debug path w/ debug true", () => {
        const target = createSystem({}, { virtual: true });

        const actual = createOptions({ debug: true }, new NoReporter(), target);

        expect(actual).toEqual(expect.objectContaining({ debug: true }));
    });

    it("should return watch path w/ watch true", () => {
        const target = createSystem({}, { virtual: true });
        const actual = createOptions({ watch: true }, new NoReporter(), target);

        expect(actual).toEqual(expect.objectContaining({ watch: true }));
    });

    it("should return config w/ valid compiler config json", () => {
        const target = createSystem(
            { "websmith.config.json": '{ "profiles": { "whatever": { "addons": [ "one", "two", "three" ] } } }' },
            { virtual: true }
        );

        const actual = createOptions({ configFile: "./websmith.config.json" }, new NoReporter(), target).config;

        expect(actual).toEqual({
            profiles: { whatever: { addons: ["one", "two", "three"] } },
        });
    });

    it("should return config w/ valid addonsDir, addons in compiler config json", () => {
        const target = createSystem(
            {
                "./tsconfig.json": '{ "include": ["**/*.ts"] }',
                "/expected/one/addon.ts": "export const activate = () => {};",
                "websmith.config.json": '{ "addons":["one", "two"], "addonsDir":"./expected" }',
            },
            { virtual: true }
        );
        jest.mock(
            "/expected/one/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const actual = createOptions({ configFile: "./websmith.config.json", project: "./tsconfig.json" }, new NoReporter(), target);

        expect(actual).toMatchObject({
            buildDir: "/",
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
