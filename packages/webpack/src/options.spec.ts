/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { NoReporter, createSystem } from "@quatico/websmith-core";
import { createOptions } from "./options";

describe("createOptions", () => {
    it("should return defaults w/o any param", () => {
        const actual = createOptions({ instanceName: "target-instance" });

        expect(actual).toEqual({
            tsConfig: expect.any(Object),
            reporter: expect.any(NoReporter),
            cliArgs: expect.any(Object),
            debug: false,
            watch: false,
            tsConfigFile: "./tsconfig.json",
        });
    });

    it("should return project config w/ custom but empty tsconfig.json", () => {
        const target = createSystem({ "./expected/tsconfig.json": "{}" }, { virtual: true });

        const actual = createOptions(
            { tsConfigFile: "./expected/tsconfig.json", instanceName: "target-instance" },
            new NoReporter(),
            target
        ).tsConfig;

        expect(actual).toEqual({
            outDir: "/lib",
        });
    });

    it("should return project config w/ with custom tsconfig.json", () => {
        const target = createSystem({ "./expected/tsconfig.json": `${JSON.stringify({ compilerOptions: { strict: true } })}` }, { virtual: true });

        const actual = createOptions(
            { tsConfigFile: "./expected/tsconfig.json", instanceName: "target-instance" },
            new NoReporter(),
            target
        ).tsConfig;

        expect(actual).toEqual({
            outDir: "/lib",
            strict: true,
        });
    });

    it("should return project config w/ with tsConfig override", () => {
        const target = createSystem({ "./expected/tsconfig.json": `${JSON.stringify({ compileOptions: { strict: false } })}` }, { virtual: true });

        const actual = createOptions(
            { tsConfigFile: "./expected/tsconfig.json", instanceName: "target-instance", tsConfig: { strict: true } },
            new NoReporter(),
            target
        ).tsConfig;

        expect(actual).toEqual({
            outDir: "/lib",
            strict: true,
        });
    });

    it("should return debug path w/ debug true", () => {
        const target = createSystem({ "./tsconfig.json": "{}" }, { virtual: true });

        const actual = createOptions({ debug: true, instanceName: "target-instance" }, new NoReporter(), target);

        expect(actual).toEqual(expect.objectContaining({ debug: true }));
    });

    it("should return config w/ valid compiler config json", () => {
        const target = createSystem(
            {
                "./tsconfig.json": "{}",
                "websmith.config.json": `
                { "profiles": { "whatever": { "addons": [ "one", "two", "three" ] } } }
            `,
            },
            { virtual: true }
        );

        const actual = createOptions({ configFile: "./websmith.config.json", instanceName: "target-instance" }, new NoReporter(), target).config;

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

        const actual = createOptions(
            { configFile: "./websmith.config.json", tsConfigFile: "./tsconfig.json", instanceName: "target-instance" },
            new NoReporter(),
            target
        );

        expect(actual).toEqual({
            config: {
                addons: ["one", "two"],
                addonsDir: "/expected",
            },
            configFile: "./websmith.config.json",
            debug: false,
            reporter: expect.any(NoReporter),
            tsConfig: {
                outDir: "/lib",
            },
            tsConfigFile: "./tsconfig.json",
            cliArgs: {
                compileOnSave: false,
                fileNames: ["/expected/one/addon.ts"],
                errors: [],
                options: {
                    outDir: "/lib",
                },
                raw: {
                    include: ["**/*.ts"],
                },
                typeAcquisition: {
                    enable: false,
                    include: [],
                    exclude: [],
                },
                wildcardDirectories: {
                    "": 1,
                },
            },
            watch: false,
        });
    });
});
