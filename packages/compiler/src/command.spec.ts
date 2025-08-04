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
import ts from "typescript";
import { addCompileCommand, hasInvalidProfile } from "./command";

beforeAll(() => {
    jest.spyOn(console, "time").mockImplementation(() => {});
});

describe("addCompileCommand", () => {
    it("should yield additionalArguments w/ unknown argument", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem);
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
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);
        const { fileSystem: testSystem, addons } = compileSystem({ files: { "/test.ts": "export const test = () => {};" } });
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem, addons);

        addCompileCommand(new Command(), target).parse([], { from: "user" });

        const actual = target.getOptions();

        expect(addons).toEqual(
            expect.objectContaining({
                availableAddons: new Map(),
            })
        );
        expect(actual).toEqual({
            addons: [],
            addonsDir: "/addons",
            buildDir: expect.stringContaining(path.sep),
            cliArgs: {
                compileOnSave: false,
                errors: [],
                fileNames: ["/test.ts"],
                options: {
                    allowJs: false,
                    checkJs: false,
                    configFilePath: "/tsconfig.json",
                    declaration: false,
                    declarationMap: false,
                    emitDecorationOnly: false,
                    esModuleInterop: false,
                    jsx: ts.JsxEmit.Preserve,
                    noEmit: false,
                    pretty: true,
                    project: "./tsconfig.json",
                    removeComments: false,
                    strict: false,
                    target: ts.ScriptTarget.ES5,
                },
                raw: {},
                typeAcquisition: {
                    include: [],
                    exclude: [],
                    enable: false,
                },
                wildcardDirectories: { [""]: 1 },
            },
            config: {},
            configFile: "/websmith.config.json",
            debug: false,
            projectDir: "/",
            reporter: expect.any(NoReporter),
            system: expect.any(Object),
            tsConfig: {
                allowJs: false,
                checkJs: false,
                configFilePath: "/tsconfig.json",
                declaration: false,
                declarationMap: false,
                emitDecorationOnly: false,
                esModuleInterop: false,
                jsx: ts.JsxEmit.Preserve,
                noEmit: false,
                pretty: true,
                project: "./tsconfig.json",
                removeComments: false,
                strict: false,
                target: ts.ScriptTarget.ES5,
            },
            tsConfigFile: "/tsconfig.json",
            watch: false,
        });
    });

    it("should yield config option w/ --configFile cli argument", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);
        const testSystem = compileSystem({ buildDir: "./", files: { "./expected/websmith.config.json": "{}" } }).fileSystem;
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem);

        addCompileCommand(new Command(), target).parse(["--configFile", "./expected/websmith.config.json"], { from: "user" });

        expect(target.getOptions().configFile).toEqual(expect.stringContaining("/expected/websmith.config.json"));
    });

    it("should report missing config file w/o existing cli argument", () => {
        const testSystem = compileSystem({ buildDir: "./" }).fileSystem;
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem);
        target.getReporter().reportDiagnostic = jest.fn();

        addCompileCommand(new Command(), target).parse(["--configFile", "./does-not-exist/websmith.config.json"], { from: "user" });

        expect(target.getOptions().config).toEqual({});
        expect(target.getReporter().reportDiagnostic).toHaveBeenNthCalledWith(
            1,
            new WarnMessage(`No configuration file found at ${"/does-not-exist/websmith.config.json"}.`)
        );
    });

    it("should yield project option w/ --project cli argument", () => {
        const testSystem = compileSystem({ buildDir: "./", files: { "./expected/tsconfig.json": "{}" } }).fileSystem;
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem);

        addCompileCommand(new Command(), target).parse(["--project", "expected/tsconfig.json"], { from: "user" });

        expect(target.getOptions().tsConfig!.configFilePath).toEqual(expect.stringContaining("/expected/tsconfig.json"));
    });

    it("should yield sourceMap option w/ --sourceMap cli argument", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem);

        addCompileCommand(new Command(), target).parse(["--sourceMap"], { from: "user" });

        expect(target.getOptions().tsConfig!.sourceMap).toBe(true);
    });

    it("should yield debug compiler option w/ --debug cli argument", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem);

        addCompileCommand(new Command(), target).parse(["--debug"], { from: "user" });

        expect(target.getOptions().debug).toBe(true);
    });

    it("should yield watch compiler option w/ --watch cli argument", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem);
        target.registerWatch = jest.fn(); // prevent register of watch task

        addCompileCommand(new Command(), target).parse(["--watch"], { from: "user" });

        expect(target.getOptions().watch).toBe(true);
    });

    it("should yield transpileOnly option w/ --transpileOnly cli argument", () => {
        const testSystem = compileSystem({ buildDir: "./", files: { "./expected/tsconfig.json": "{}" } }).fileSystem;
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem);

        addCompileCommand(new Command(), target).parse(["--transpileOnly"], { from: "user" });

        expect(target.getOptions().config?.transpileOnly).toBe(true);
    });

    it("should yield additionalArguments w/ unsupported cli arguments", () => {
        console.error = line => {
            throw new Error(line.toString());
        };
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem);

        addCompileCommand(new Command(), target).parse(["--debug", "--fooBar", "--zipZap"], { from: "user" });

        expect(target.getOptions().additionalArguments).toEqual(
            new Map([
                ["fooBar", true],
                ["zipZap", true],
            ])
        );
    });

    it("should call compile w/o --watch cli argument", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem);
        target.compile = jest.fn();

        addCompileCommand(new Command(), target).parse([], { from: "user" });

        expect(target.compile).toHaveBeenCalled();
    });

    it("should call watch w/ --watch cli argument", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem);
        target.watch = jest.fn();

        addCompileCommand(new Command(), target).parse(["--watch", "--allowJs"], { from: "user" });

        expect(target.watch).toHaveBeenCalled();
    });
});

describe("addCompileCommand#addons", () => {
    it("should yield warning w/ --addonsDir cli argument to non-existing path", () => {
        const { fileSystem: testSystem, addons } = compileSystem({ buildDir: "./" });
        const compiler = new Compiler({ reporter: new NoReporter() }, {}, testSystem, addons);
        compiler.getReporter().reportDiagnostic = jest.fn();

        addCompileCommand(new Command(), compiler).parse(["--addonsDir", "./unknown", "--allowJs"], { from: "user" });

        expect(compiler.getReporter().reportDiagnostic).toHaveBeenCalledWith(
            new WarnMessage(`Addons directory "${testSystem.resolvePath("./unknown")}" does not exist.`)
        );
    });

    it("should show warning w/ --addonsDir cli argument and non-existing path", () => {
        const { fileSystem: testSystem } = compileSystem({ buildDir: "./", files: { "./websmith.config.json": "{}" } });
        testSystem.writeFile("./websmith.config.json", "{}");
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem);
        target.getReporter().reportDiagnostic = jest.fn();

        addCompileCommand(new Command(), target).parse(["--addonsDir", "./unknown"], { from: "user" });

        expect(target.getReporter().reportDiagnostic).toHaveBeenCalledWith(
            new WarnMessage(`Addons directory "${testSystem.resolvePath("./unknown")}" does not exist.`)
        );
    });

    it("should yield options addons w/ --addons cli argument and existing addon", () => {
        const { fileSystem: testSystem, addons } = compileSystem();
        createAddon(testSystem, "addons/expected/addon");

        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem, addons);

        addCompileCommand(new Command(), target).parse(["--addons", "expected", "--allowJs"], { from: "user" });

        expect(addons.getAvailableAddons().getNames()).toEqual(["expected"]);
    });

    it("should yield options addons w/ --addons cli argument and multiple existing addons", () => {
        const { fileSystem: testSystem, addons } = compileSystem({ buildDir: "./" });
        createAddon(testSystem, "addons/zip/addon");
        createAddon(testSystem, "addons/zap/addon");
        createAddon(testSystem, "addons/zup/addon");
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem, addons);

        addCompileCommand(new Command(), target).parse(["--addons", "zip, zap, zup", "--allowJs"], { from: "user" });

        expect(addons.getAvailableAddons().getNames()).toEqual(["zip", "zap", "zup"]);
    });

    it("should yield empty options addons w/ --addons cli argument and non-existing addon", () => {
        const { fileSystem: testSystem, addons } = compileSystem();
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem, addons);

        addCompileCommand(new Command(), target).parse(["--addons", "unknown", "--allowJs"], { from: "user" });

        expect(addons.getAvailableAddons()).toHaveLength(0);
    });

    it("should not yield non-existing options addons w/ --addons cli argument, existing and non-existing addons", () => {
        const { fileSystem: testSystem, addons } = compileSystem();
        createAddon(testSystem, "addons/expected/addon");
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem, addons);

        addCompileCommand(new Command(), target).parse(["--addons", "unknown, expected", "--allowJs"], { from: "user" });

        expect(addons.getAvailableAddons().getNames()).toEqual(["expected"]);
    });

    it("should yield warning w/ --addons cli argument and non-existing addon name", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const { fileSystem: testSystem, addons } = compileSystem({ reporter: target, buildDir: "./" });
        const compiler = new Compiler({ reporter: target }, {}, testSystem, addons);

        addCompileCommand(new Command(), compiler).parse(["--addons", "unknown", "--allowJs"], { from: "user" });

        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons: "unknown".'));
    });

    it("should yield warning w/ --addons cli argument, existing and non-existing addons", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const { fileSystem: testSystem, addons } = compileSystem({ buildDir: "./", files: { "./websmith.config.json": "{}" }, reporter: target });
        createAddon(testSystem, "addons/existing/addon");
        const compiler = new Compiler({ reporter: target }, {}, testSystem, addons);

        addCompileCommand(new Command(), compiler).parse(["--addons", "existing, unknown", "--allowJs"], { from: "user" });

        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons: "unknown".'));
    });

    it("should yield addonsDir and addons from compiler config w/o any cli argument", () => {
        const { fileSystem: testSystem, addons } = compileSystem({
            buildDir: "./",
            files: { "websmith.config.json": '{ "addons":["one", "two"], "addonsDir":"./expected" }' },
        });
        createAddon(testSystem, "expected/one/addon");
        const target = new Compiler({ reporter: new NoReporter() }, {}, testSystem, addons);

        addCompileCommand(new Command(), target).parse(["--allowJs", "--configFile", "websmith.config.json"], { from: "user" });

        expect(target.getAddonRegistry()).toMatchObject({
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

describe("addCompileCommand#profile", () => {
    it("should yield options profile w/ --profile cli argument and single value", () => {
        const testSystem = compileSystem().fileSystem;
        const target = new Compiler({ tsConfigFile: "./tsconfig.json", reporter: new NoReporter() }, {}, testSystem);

        addCompileCommand(new Command(), target).parse(["--profile", "expected", "--allowJs"], { from: "user" });

        expect(target.getOptions().profile).toEqual("expected");
    });

    it("should yield warning w/ --profile cli argument and unknown name", () => {
        const target = new NoReporter();
        jest.spyOn(target, "reportDiagnostic").mockImplementation(() => {});
        const { fileSystem: testSystem, addons } = compileSystem({ reporter: target, buildDir: "./" });

        addCompileCommand(new Command(), new Compiler({ reporter: target }, {}, testSystem, addons)).parse(["--profile", "unknown"], {
            from: "user",
        });

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            new WarnMessage(
                'Custom profile configuration "unknown" found, but no profile provided.\n\tSome custom addons may not be applied during compilation.'
            )
        );
    });

    it("should not yield any warning w/ --profile cli argument and known name", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const { fileSystem: testSystem, addons } = compileSystem({
            buildDir: "./",
            files: { "./websmith.config.json": '{ "profiles": {"expected": {}} }' },
            reporter: target,
        });

        addCompileCommand(new Command(), new Compiler({ reporter: target }, {}, testSystem, addons)).parse(
            ["--profile", "expected", "--configFile", "./websmith.config.json"],
            {
                from: "user",
            }
        );

        expect(target.reportDiagnostic).not.toHaveBeenCalled();
    });

    it("should yield warning w/ --profile cli argument, known name but missing addons for profile", () => {
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();
        const { fileSystem: testSystem, addons } = compileSystem({
            buildDir: "./",
            files: { "./websmith.config.json": '{ "profiles": {"known": { "addons": ["missing"]}} }' },
            reporter: target,
        });
        expect(testSystem.fileExists("./tsconfig.json")).toBe(true);

        addCompileCommand(new Command(), new Compiler({ reporter: target }, {}, testSystem, addons)).parse(["--profile", "known"], {
            from: "user",
        });

        expect(target.reportDiagnostic).toHaveBeenNthCalledWith(
            1,
            new WarnMessage('Missing profile: The following profile is passed but not configured "known".')
        );
        expect(target.reportDiagnostic).toHaveBeenNthCalledWith(
            2,
            new WarnMessage(
                'Custom profile configuration "known" found, but no profile provided.\n\tSome custom addons may not be applied during compilation.'
            )
        );
    });
});

describe("hasInvalidProfile", () => {
    it("should return true w/o CompilationConfig", () => {
        expect(hasInvalidProfile("whatever")).toBe(true);
    });

    it("should return false w/ valid profile and CompilationConfig", () => {
        expect(
            hasInvalidProfile("valid", {
                profiles: {
                    valid: {},
                },
            } as any)
        ).toBe(false);
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
