/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { CompilerAddon, NoReporter } from "@quatico/websmith-core";
import { compileSystem } from "@quatico/websmith-testing";
import { createOptions } from "./options";

describe("createOptions", () => {
    it("should return defaults w/o any param", () => {
        const actual = createOptions({});

        expect(actual).toEqual(
            expect.objectContaining({
                debug: false,
                sourceMap: false,
                targets: ["*"],
                watch: false,
            })
        );
    });

    it("should return project config w/ custom but empty tsconfig.json", () => {
        const { fileSystem: target } = compileSystem({ "./expected/tsconfig.json": "{}" });

        const actual = createOptions({ project: "./expected/tsconfig.json" }, new NoReporter(), target).project;

        expect(actual).toEqual({
            configFilePath: "/expected/tsconfig.json",
            outDir: "/lib",
        });
    });

    it("should return expected path w/ custom addons directory", () => {
        const { fileSystem: target } = compileSystem({
            "./tsconfig.json": "{}",
            "./expected/addon-foo/addon.js": "export const activate = () => {};",
        });
        jest.mock(
            "/expected/addon-foo/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const actual: CompilerAddon[] = createOptions({ addonsDir: "./expected" }, new NoReporter(), target).addons.getAvailableAddons();

        expect(actual.map(it => it.name)).toEqual(["addon-foo"]);
    });

    it("should return debug path w/ debug true", () => {
        const { fileSystem: target } = compileSystem({ "./tsconfig.json": "{}" });

        const actual = createOptions({ debug: true }, new NoReporter(), target);

        expect(actual).toEqual(expect.objectContaining({ debug: true }));
    });

    it("should return config w/ valid compiler config json", () => {
        const { fileSystem: target } = compileSystem({
            "./tsconfig.json": "{}",
            "websmith.config.json": `
                { "targets": { "whatever": { "addons": [ "one", "two", "three" ], "writeFile": true } } }
            `,
        });
        const actual = createOptions({ config: "./websmith.config.json" }, new NoReporter(), target).config;

        expect(actual).toEqual({
            configFilePath: "/websmith.config.json",
            targets: { whatever: { addons: ["one", "two", "three"], writeFile: true } },
        });
    });

    it("should return config w/ valid addonsDir, addons in compiler config json", () => {
        const { fileSystem: target } = compileSystem({
            "./tsconfig.json": "{}",
            "/expected/one/addon.js": "export const activate = () => {};",
            "websmith.config.json": '{ "addons":["one", "two"], "addonsDir":"./expected" }',
        });
        jest.mock(
            "/expected/one/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const actual = createOptions({ config: "./websmith.config.json" }, new NoReporter(), target).addons;

        expect(actual).toMatchObject({
            addons: ["one", "two"],
            availableAddons: new Map(
                Object.entries({
                    one: {
                        activate: expect.any(Function),
                        name: "one",
                    },
                })
            ),
        });
    });
});
