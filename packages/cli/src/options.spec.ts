/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import { CompilerAddon, createBrowserSystem, NoReporter } from "@websmith/compiler";
import ts from "typescript";
import { createOptions } from "./options";

let testSystem: ts.System;
const testReporter = new NoReporter();

describe("createOptions", () => {
    beforeEach(() => {
        testSystem = createBrowserSystem({});
    });

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
        testSystem.writeFile("./expected/tsconfig.json", "{}");

        const actual = createOptions({ project: "./expected/tsconfig.json" }, testReporter, testSystem).project;

        expect(actual).toEqual(
            expect.objectContaining({
                configFilePath: expect.stringContaining("/expected/tsconfig.json"),
                outDir: "./lib",
            })
        );
    });

    it("should return expected path w/ custom addons directory", () => {
        testSystem.writeFile("./tsconfig.json", "{}");
        testSystem.writeFile("./expected/addon-foo/addon.ts", "export const activate = () => {};");
        jest.mock(
            "/expected/addon-foo/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const actual: CompilerAddon[] = createOptions({ addonsDir: "./expected" }, testReporter, testSystem).addons.getAddons();

        expect(actual.map(it => it.name)).toEqual(["addon-foo"]);
    });

    it("should return debug path w/ debug true", () => {
        testSystem.writeFile("./tsconfig.json", "{}");
        const actual = createOptions({ debug: true }, testReporter, testSystem);

        expect(actual).toEqual(expect.objectContaining({ debug: true }));
    });

    it("should return watch path w/ watch true", () => {
        testSystem.writeFile("./tsconfig.json", "{}");
        const actual = createOptions({ watch: true }, testReporter, testSystem);

        expect(actual).toEqual(expect.objectContaining({ watch: true }));
    });

    it("should return config w/ valid compiler config json", () => {
        testSystem.writeFile("./tsconfig.json", "{}");
        testSystem.writeFile("websmith.config.json", '{ "targets": { "whatever": { "addons": [ "one", "two", "three" ], "writeFile": true } } }');

        const actual = createOptions({ config: "./websmith.config.json" }, testReporter, testSystem).config;

        expect(actual).toEqual({
            configFilePath: expect.stringContaining("/websmith.config.json"),
            targets: { whatever: { addons: ["one", "two", "three"], writeFile: true } },
        });
    });

    it("should return config w/ valid addonsDir, addons in compiler config json", () => {
        testSystem.writeFile("./tsconfig.json", "{}");
        testSystem.writeFile("/expected/one/addon.ts", "export const activate = () => {};");
        jest.mock(
            "/expected/one/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        testSystem.writeFile("websmith.config.json", '{ "addons":["one", "two"], "addonsDir":"./expected" }');

        const actual = createOptions({ config: "./websmith.config.json" }, testReporter, testSystem).addons;

        expect(actual).toMatchInlineSnapshot(`
            AddonRegistry {
              "addons": Array [
                "one",
                "two",
              ],
              "availableAddons": Map {
                "one" => Object {
                  "activate": [MockFunction],
                  "name": "one",
                },
              },
              "config": Object {
                "addons": Array [
                  "one",
                  "two",
                ],
                "addonsDir": "./expected",
                "configFilePath": "/websmith.config.json",
              },
              "reporter": NoReporter {},
            }
        `);
    });
});
