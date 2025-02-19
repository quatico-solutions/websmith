/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { WarnMessage } from "@quatico/websmith-api";
import { Compiler, NoReporter } from "@quatico/websmith-core";
import { compileSystem } from "@quatico/websmith-testing";
import { Command } from "commander";
import path from "node:path";
import type ts from "typescript";
import { addCompileCommand, hasInvalidProfiles } from "./command";
import { createOptions } from "./options";

describe("addCompileCommand", () => {
    it("should yield additionalArguments w/ unknown argument", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem);
        const testObj = addCompileCommand(new Command(), target);

        testObj.parse(
            [
                "--unknown",
                '{"key1":13, "key2":{"key1":"expected", "key2":false}}',
                "--port",
                "3000",
                "--hostname",
                "http://localhost",
                "--booleanFlag",
            ],
            { from: "user" }
        );

        expect(target.getOptions().additionalArguments).toEqual(
            new Map<string, unknown>([
                ["unknown", { key1: 13, key2: { key1: "expected", key2: false } }],
                ["port", 3000],
                ["hostname", "http://localhost"],
                ["booleanFlag", true],
            ])
        );
    });

    it("should yield default options w/o config and w/o CLI arguments", () => {
        const { fileSystem: testSystem, addons } = compileSystem();
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem, addons);

        addCompileCommand(new Command(), target).parse([], { from: "user" });

        const actual = target.getOptions();

        expect(addons).toEqual(
            expect.objectContaining({
                availableAddons: new Map(),
            })
        );
        expect(actual.buildDir).toEqual(expect.stringContaining(path.sep));
        expect(actual.watch).toBe(false);
        expect(actual.config).toBeUndefined();
        expect(actual.debug).toBe(false);
        const compilerOptions = {
            configFilePath: "/tsconfig.json",
            inlineSources: undefined,
            outDir: "/",
            sourceMap: false,
        };
        expect(actual.tsConfig).toEqual(compilerOptions);

        expect({ wildcardDirectories: {}, ...actual.cliArgs }).toEqual({
            options: compilerOptions,
            errors: [
                {
                    category: 1,
                    code: 18003,
                    file: undefined,
                    length: undefined,
                    messageText:
                        "No inputs were found in config file '/tsconfig.json'. Specified 'include' paths were '[\"**/*\"]' and 'exclude' paths were '[]'.",
                    reportsDeprecated: undefined,
                    reportsUnnecessary: undefined,
                    start: undefined,
                },
            ],
            typeAcquisition: {
                include: [],
                exclude: [],
                enable: false,
            },
            fileNames: [],
            compileOnSave: false,
            projectReferences: undefined,
            raw: {},
            watchOptions: undefined,
            wildcardDirectories: { [""]: 1 },
        });
        expect(actual.reporter).toBeDefined();
        expect(actual.profiles).toEqual([]);
        expect(actual.watch).toBe(false);
    });

    it("should yield config option w/ --configFile cli argument", () => {
        const testSystem = compileSystem({ files: { "./expected/websmith.config.json": "{}" } }).fileSystem;
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem);

        addCompileCommand(new Command(), target).parse(["--configFile", "./expected/websmith.config.json"], { from: "user" });

        expect(target.getOptions().configFile).toEqual(expect.stringContaining("/expected/websmith.config.json"));
    });

    it("should yield project option w/ --project cli argument", () => {
        const testSystem = compileSystem({ files: { "./expected/tsconfig.json": "{}" } }).fileSystem;
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem);

        addCompileCommand(new Command(), target).parse(["--project", "expected/tsconfig.json"], { from: "user" });

        expect(target.getOptions().tsConfig.configFilePath).toEqual(expect.stringContaining("/expected/tsconfig.json"));
    });

    it("should yield sourceMap option w/ --sourceMap cli argument", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem);

        addCompileCommand(new Command(), target).parse(["--sourceMap"], { from: "user" });

        expect(target.getOptions().tsConfig.sourceMap).toBe(true);
    });

    it("should yield debug compiler option w/ --debug cli argument", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem);

        addCompileCommand(new Command(), target).parse(["--debug"], { from: "user" });

        expect(target.getOptions().debug).toBe(true);
    });

    it("should yield watch compiler option w/ --watch cli argument", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem));
        target.registerWatch = jest.fn(); // prevent register of watch task

        addCompileCommand(new Command(), target).parse(["--watch"], { from: "user" });

        expect(target.getOptions().watch).toBe(true);
    });

    it("should yield transpileOnly option w/ --transpileOnly cli argument", () => {
        const testSystem = compileSystem({ files: { "./expected/tsconfig.json": "{}" } }).fileSystem;
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem);

        addCompileCommand(new Command(), target).parse(["--transpileOnly"], { from: "user" });

        expect(target.getOptions().config?.transpileOnly).toBe(true);
    });

    it("should yield additionalArguments w/ unsupported cli arguments", () => {
        console.error = line => {
            throw new Error(line.toString());
        };
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem);

        addCompileCommand(new Command(), target).parse(["--debug", "--allowJs", "--strict"], { from: "user" });

        expect(target.getOptions().additionalArguments).toEqual(
            new Map([
                ["allowJs", true],
                ["strict", true],
            ])
        );
    });

    it("should call compile w/o --watch cli argument", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem));
        target.compile = jest.fn();

        addCompileCommand(new Command(), target).parse([], { from: "user" });

        expect(target.compile).toHaveBeenCalled();
    });

    it("should call watch w/ --watch cli argument", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem));
        target.watch = jest.fn();

        addCompileCommand(new Command(), target).parse(["--watch"], { from: "user" });

        expect(target.watch).toHaveBeenCalled();
    });
});

describe("addCompileCommand#addons", () => {
    it("should yield warning w/ --addonsDir cli argument to non-existing path", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const { fileSystem: testSystem, addons } = compileSystem({ reporter: target });
        const compiler = new Compiler(createOptions({}, target, testSystem), testSystem, addons);

        addCompileCommand(new Command(), compiler).parse(["--addonsDir", "./unknown"], { from: "user" });

        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Addons directory "./unknown" does not exist.'));
    });

    it("should yield options addons w/ --addons cli argument and existing addon", () => {
        const { fileSystem: testSystem, addons } = compileSystem();
        createAddon(testSystem, "addons/expected/addon");
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem, addons);

        addCompileCommand(new Command(), target).parse(["--addons", "expected"], { from: "user" });

        expect(addons.getAvailableAddons("*").getNames()).toEqual(["expected"]);
    });

    it("should yield options addons w/ --addons cli argument and multiple existing addons", () => {
        const { fileSystem: testSystem, addons } = compileSystem();
        createAddon(testSystem, "addons/zip/addon");
        createAddon(testSystem, "addons/zap/addon");
        createAddon(testSystem, "addons/zup/addon");
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem, addons);

        addCompileCommand(new Command(), target).parse(["--addons", "zip, zap, zup"], { from: "user" });

        expect(addons.getAvailableAddons("*").getNames()).toEqual(["zip", "zap", "zup"]);
    });

    it("should yield empty options addons w/ --addons cli argument and non-existing addon", () => {
        const { fileSystem: testSystem, addons } = compileSystem();
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem, addons);

        addCompileCommand(new Command(), target).parse(["--addons", "unknown"], { from: "user" });

        expect(addons.getAvailableAddons("*")).toHaveLength(0);
    });

    it("should not yield non-existing options addons w/ --addons cli argument, existing and non-existing addons", () => {
        const { fileSystem: testSystem, addons } = compileSystem();
        createAddon(testSystem, "addons/expected/addon");
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem, addons);

        addCompileCommand(new Command(), target).parse(["--addons", "unknown, expected"], { from: "user" });

        expect(addons.getAvailableAddons("*").getNames()).toEqual(["expected"]);
    });

    it("should yield warning w/ --addons cli argument and non-existing addon name", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const { fileSystem: testSystem, addons } = compileSystem({ reporter: target });
        const compiler = new Compiler(createOptions({}, target, testSystem), testSystem, addons);

        addCompileCommand(new Command(), compiler).parse(["--addons", "unknown"], { from: "user" });

        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons: "unknown".'));
    });

    it("should yield warning w/ --addons cli argument, existing and non-existing addons", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const { fileSystem: testSystem, addons } = compileSystem({ files: { "./websmith.config.json": "{}" }, reporter: target });
        createAddon(testSystem, "addons/existing/addon");
        const compiler = new Compiler(createOptions({}, target, testSystem), testSystem, addons);

        addCompileCommand(new Command(), compiler).parse(["--addons", "existing, unknown"], { from: "user" });

        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons: "unknown".'));
    });

    it("should yield addonsDir and addons from compiler config w/o any cli argument", () => {
        const { fileSystem: testSystem, addons } = compileSystem({
            files: { "websmith.config.json": '{ "addons":["one", "two"], "addonsDir":"./expected" }' },
        });
        createAddon(testSystem, "expected/one/addon");
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem, addons);

        addCompileCommand(new Command(), target).parse([], { from: "user" });

        expect(addons).toMatchObject({
            config: {
                addons: ["one", "two"],
                addonsDir: "/expected",
            },
            availableAddons: new Map(
                Object.entries({
                    one: {
                        activate: expect.any(Function),
                        getName: expect.any(Function),
                    },
                })
            ),
        });
    });
});

describe("addCompileCommand#profiles", () => {
    it("should yield options profiles w/ --profiles cli argument and single value", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler(createOptions({ project: "./tsconfig.json" }, new NoReporter(), testSystem), testSystem);

        addCompileCommand(new Command(), target).parse(["--profiles", "expected"], { from: "user" });

        expect(target.getOptions().profiles).toEqual(["expected"]);
    });

    it("should yield options profiles w/ --profiles cli argument and comma separated values", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler(createOptions({}, new NoReporter(), testSystem), testSystem);

        addCompileCommand(new Command(), target).parse(["--profiles", "one, two, three"], { from: "user" });

        expect(target.getOptions().profiles).toEqual(["one", "two", "three"]);
    });

    it("should yield warning w/ --profiles cli argument and unknown name", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const { fileSystem: testSystem, addons } = compileSystem({ reporter: target });

        addCompileCommand(new Command(), new Compiler(createOptions({}, target, testSystem), testSystem, addons)).parse(["--profiles", "unknown"], {
            from: "user",
        });

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            new WarnMessage(
                'Custom profile configuration "unknown" found, but no profile provided.\n\tSome custom addons may not be applied during compilation.'
            )
        );
    });

    it("should not yield any warning w/ --profiles cli argument and known names", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const { fileSystem: testSystem, addons } = compileSystem({
            files: { "./websmith.config.json": '{ "profiles": {"expected": {}} }' },
            reporter: target,
        });

        addCompileCommand(new Command(), new Compiler(createOptions({}, target, testSystem), testSystem, addons)).parse(["--profiles", "expected"], {
            from: "user",
        });

        expect(target.reportDiagnostic).not.toHaveBeenCalled();
    });

    it("should not yield any warning w/ --profiles cli argument and multiple known names", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const { fileSystem: testSystem, addons } = compileSystem({
            files: { "./websmith.config.json": '{ "profiles": {"zip": {}, "zap": {}, "zup": {}} }' },
            reporter: target,
        });

        addCompileCommand(new Command(), new Compiler(createOptions({}, target, testSystem), testSystem, addons)).parse(
            ["--profiles", "zip, zap, zup"],
            { from: "user" }
        );

        expect(target.reportDiagnostic).not.toHaveBeenCalled();
    });

    it("should yield warning w/ --profiles cli argument, known and unknown names", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const { fileSystem: testSystem, addons } = compileSystem({
            files: { "./websmith.config.json": '{ "profiles": {"whatever": {}, "known": {}} }' },
            reporter: target,
        });

        addCompileCommand(new Command(), new Compiler(createOptions({}, target, testSystem), testSystem, addons)).parse(
            ["--profiles", "unknown, known"],
            { from: "user" }
        );

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            new WarnMessage(
                'Custom profile configuration "unknown, known" found, but no profile provided.\n\tSome custom addons may not be applied during compilation.'
            )
        );
    });

    it("should yield warning w/ --profiles cli argument, known name but missing addons for profile", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const { fileSystem: testSystem, addons } = compileSystem({
            files: { "./websmith.config.json": '{ "profiles": {"known": { "addons": ["missing"]}} }' },
            reporter: target,
        });
        expect(testSystem.fileExists("./tsconfig.json")).toBe(true);

        addCompileCommand(new Command(), new Compiler(createOptions({}, target, testSystem), testSystem, addons)).parse(["--profiles", "known"], {
            from: "user",
        });

        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for profile "known": "missing".'));
    });

    it("should yield warning w/ --profiles cli argument, multiple known names but missing addons for profiles", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const { fileSystem: testSystem, addons } = compileSystem({
            files: {
                "./websmith.config.json":
                    '{ "profiles": {"zip": { "addons": ["missing1"]}, "zap": { "addons": ["missing2"]}, "zup": { "addons": ["missing3"]}} }',
            },
            reporter: target,
        });

        addCompileCommand(new Command(), new Compiler(createOptions({}, target, testSystem), testSystem, addons)).parse(
            ["--profiles", "zip, zap, zup"],
            { from: "user" }
        );

        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for profile "zip": "missing1".'));
        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for profile "zap": "missing2".'));
        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for profile "zup": "missing3".'));
    });
});

describe("hasInvalidProfiles", () => {
    it("should return true w/o CompilationConfig", () => {
        expect(hasInvalidProfiles(["whatever"])).toBe(true);
    });

    it("should return false w/ valid profile and CompilationConfig", () => {
        expect(
            hasInvalidProfiles(["valid"], {
                profiles: {
                    valid: {},
                },
            } as any)
        ).toBe(false);
    });

    it("should return true w/ invalid and valid profile and CompilationConfig", () => {
        expect(
            hasInvalidProfiles(["valid", "invalid"], {
                profiles: {
                    valid: {},
                },
            } as any)
        ).toBe(true);
    });

    it('should return false w/ "*" profile and others in CompilationConfig', () => {
        expect(
            hasInvalidProfiles(["*"], {
                profiles: {
                    one: {},
                    two: {},
                    three: {},
                },
            } as any)
        ).toBe(false);
    });

    it('should return true w/ "*" and invalid profile and CompilationConfig', () => {
        expect(
            hasInvalidProfiles(["*", "invalid"], {
                profiles: {
                    one: {},
                    two: {},
                    three: {},
                },
            } as any)
        ).toBe(true);
    });
});

const createAddon = (testSystem: ts.System, path: string, code = "export const activate = () => {};", mock: object = { activate: jest.fn() }) => {
    testSystem.writeFile(`./${path}.js`, code);
    jest.mock(
        `/${path}`,
        () => {
            return mock;
        },
        { virtual: true }
    );
};
