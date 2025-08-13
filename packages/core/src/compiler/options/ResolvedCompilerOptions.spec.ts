/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import ts from "typescript";
import { ReporterMock } from "../../../test";
import { createSystem } from "../../environment";
import { DefaultReporter } from "../DefaultReporter";
import { ResolvedCompilerOptions } from "./ResolvedCompilerOptions";
import { AddonRegistry } from "../addons/AddonRegistry";
import { NoReporter } from "../NoReporter";

describe("constructor", () => {
    it("should yield passed values", () => {
        const fileSystem = createSystem({ "/build/tsconfig.json": "{}", "/build/test.ts": "export const test = () => {};" }, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            reporter: new ReporterMock(fileSystem),
            cliArgs: {
                options: {
                    outDir: "./dist",
                },
                fileNames: [],
                errors: [],
            },
        });

        expect(testObj).toEqual(
            expect.objectContaining({
                buildDir: "/",
                cliArgs: expect.objectContaining({
                    errors: [],
                    fileNames: [],
                    options: expect.objectContaining({
                        allowJs: false,
                        checkJs: false,
                        configFilePath: "/tsconfig.json",
                        declaration: false,
                        declarationMap: false,
                        emitDecorationOnly: false,
                        esModuleInterop: false,
                        jsx: ts.JsxEmit.Preserve,
                        noEmit: false,
                        outDir: "/dist",
                        pretty: true,
                        removeComments: false,
                        strict: false,
                        target: ts.ScriptTarget.ES5,
                    }),
                }),
                config: {},
                debug: false,
                reporter: expect.any(ReporterMock),
                tsConfig: expect.objectContaining({
                    allowJs: false,
                    checkJs: false,
                    configFilePath: "/tsconfig.json",
                    declaration: false,
                    declarationMap: false,
                    emitDecorationOnly: false,
                    esModuleInterop: false,
                    jsx: ts.JsxEmit.Preserve,
                    noEmit: false,
                    outDir: "/dist",
                    pretty: true,
                    removeComments: false,
                    strict: false,
                    target: ts.ScriptTarget.ES5,
                }),
                tsConfigFile: "/tsconfig.json",
                watch: false,
            })
        );
    });

    it("should return defaults w/o any param", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const actual = new ResolvedCompilerOptions(fileSystem, {}).getOptions();

        expect(actual).toMatchObject({
            buildDir: "/",
            cliArgs: {
                errors: [],
                fileNames: [],
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
                    removeComments: false,
                    strict: false,
                    target: ts.ScriptTarget.ES5,
                },
            },
            config: {},
            reporter: expect.any(DefaultReporter),
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
                removeComments: false,
                strict: false,
                target: ts.ScriptTarget.ES5,
            },
            tsConfigFile: "/tsconfig.json",
        });
    });

    it("should return project config w/ custom but empty tsconfig.json", () => {
        const target = createSystem({ "./expected/tsconfig.json": "{}" }, { virtual: true });

        const actual = new ResolvedCompilerOptions(target, { tsConfigFile: "./expected/tsconfig.json" }).getOptions();

        expect(actual).toMatchObject({
            tsConfigFile: "/expected/tsconfig.json",
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

        const actual = new ResolvedCompilerOptions(target, { debug: true }).getOptions();

        expect(actual).toEqual(expect.objectContaining({ debug: true }));
    });

    it("should return watch path w/ watch true", () => {
        const target = createSystem({}, { virtual: true });

        const actual = new ResolvedCompilerOptions(target, { watch: true }).getOptions();

        expect(actual).toEqual(expect.objectContaining({ watch: true }));
    });

    it("should return config w/ valid compiler config json", () => {
        const target = createSystem(
            { "websmith.config.json": '{ "profiles": { "whatever": { "addons": [ "one", "two", "three" ] } } }' },
            { virtual: true }
        );

        const actual = new ResolvedCompilerOptions(target, { configFile: "./websmith.config.json" }).getOptions();

        expect(actual.config).toEqual({
            profiles: { whatever: { addons: ["one", "two", "three"] } },
        });
    });

    it("should return config w/ valid addonsDir, addons in compiler config json", () => {
        const target = createSystem(
            {
                "./expected/tsconfig.json": '{ "include": ["**/*.ts"] }',
                "./expected/one/addon.ts": "export const activate = () => {};",
                "./expected/websmith.config.json": '{ "addons":["one", "two"], "addonsDir":"./expected" }',
            },
            { virtual: true }
        );
        jest.mock(
            "./expected/one/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const actual = new ResolvedCompilerOptions(target, {
            configFile: "./expected/websmith.config.json",
            tsConfigFile: "./expected/tsconfig.json",
        }).getOptions();

        expect(actual).toMatchObject({
            buildDir: "/expected",
            config: {
                addons: ["one", "two"],
                addonsDir: "/expected",
            },
            tsConfig: {
                configFilePath: "/expected/tsconfig.json",
                target: ts.ScriptTarget.ES5,
            },

            cliArgs: {
                fileNames: ["/expected/one/addon.ts"],
                errors: [],
                options: {
                    configFilePath: "/expected/tsconfig.json",
                },
                raw: {
                    include: ["**/*.ts"],
                },
            },
        });
    });

    it("should yield declaration and declarationMap true w/ properties set to true in valid tsconfig.json", () => {
        jest.spyOn(process.stderr, "write").mockImplementation(() => true);
        const target = createSystem(
            { "./project/tsconfig.json": JSON.stringify({ compilerOptions: { declaration: true, declarationMap: true } }) },
            { virtual: true }
        );

        const actual = new ResolvedCompilerOptions(target, {
            configFile: "./project/websmith.config.json",
            tsConfigFile: "./project/tsconfig.json",
        }).getOptions();

        expect(actual).toMatchObject({
            tsConfig: { declaration: true, declarationMap: true },
        });
    });
});

describe("additionalArguments", () => {
    it("should yield undefined if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.additionalArguments).toBeUndefined();
    });

    it("should yield passed value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { additionalArguments: { test: "test" } } as any);

        expect(testObj.additionalArguments).toEqual({ test: "test" });
    });
});
describe("configFile", () => {
    it("should yield undefined if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { reporter: new NoReporter() } as any);

        expect(testObj.tsConfigFile).toBe("/tsconfig.json");
    });

    it("should yield passed value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            configFile: "tsconfig.json",
            reporter: new NoReporter(),
        } as any);

        expect(testObj.configFile).toBe("/tsconfig.json");
    });

    it("should yield overridden value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                configFile: "whatever",
                reporter: new NoReporter(),
            } as any,
            {
                configFile: "tsconfig.json",
            } as any
        );

        expect(testObj.configFile).toBe("/tsconfig.json");
    });
});

describe("config", () => {
    it("should yield undefined if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.config).toEqual({});
    });

    it("should yield passed value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                addons: ["addon1", "addon2"],
            },
        } as any);

        expect(testObj.config).toEqual({
            addons: ["addon1", "addon2"],
        });
    });

    it("should yield overridden values", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                config: {
                    addons: ["addon1", "addon2"],
                    addonsDir: "./other",
                    transpileOnly: true,
                },
            } as any,
            {
                config: {
                    addons: ["addon3", "addon4"],
                    addonsDir: "./expected",
                },
            } as any
        );

        expect(testObj.config).toEqual({
            addons: ["addon3", "addon4"],
            addonsDir: "/expected",
            transpileOnly: true,
        });
    });
});

describe("debug", () => {
    it("should yield false if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.debug).toBe(false);
    });

    it("should yield true if passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { debug: true } as any);

        expect(testObj.debug).toBe(true);
    });

    it("should yield overridden value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { debug: true } as any, { debug: false } as any);

        expect(testObj.debug).toBe(false);
    });
});

describe("watch", () => {
    it("should yield false if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.watch).toBe(false);
    });

    it("should yield true if passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { watch: true } as any);

        expect(testObj.watch).toBe(true);
    });

    it("should yield overridden value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { watch: true } as any, { watch: false } as any);

        expect(testObj.watch).toBe(false);
    });
});

describe("tsConfigFile", () => {
    it("should yield undefined if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.tsConfigFile).toBe("/tsconfig.json");
    });

    it("should yield passed value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            tsConfigFile: "tsconfig.json",
        } as any);

        expect(testObj.tsConfigFile).toBe("/tsconfig.json");
    });

    it("should yield overridden value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                tsConfigFile: "whatever",
            } as any,
            {
                tsConfigFile: "tsconfig.json",
            } as any
        );

        expect(testObj.tsConfigFile).toBe("/tsconfig.json");
    });
});

describe("tsConfig", () => {
    it("should yield default config if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.tsConfig).toEqual({
            allowJs: false,
            checkJs: false,
            declaration: false,
            declarationMap: false,
            emitDecorationOnly: false,
            esModuleInterop: false,
            jsx: ts.JsxEmit.Preserve,
            configFilePath: "/tsconfig.json",
            noEmit: false,
            pretty: true,
            removeComments: false,
            strict: false,
            target: ts.ScriptTarget.ES5,
        });
    });

    it("should yield passed value with defaults", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            tsConfig: {
                outDir: "./expected",
            },
        } as any);

        expect(testObj.tsConfig).toEqual({
            allowJs: false,
            checkJs: false,
            declaration: false,
            declarationMap: false,
            emitDecorationOnly: false,
            esModuleInterop: false,
            jsx: ts.JsxEmit.Preserve,
            configFilePath: "/tsconfig.json",
            noEmit: false,
            outDir: "/expected",
            pretty: true,
            removeComments: false,
            strict: false,
            target: ts.ScriptTarget.ES5,
        });
    });

    it("should yield overridden value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                tsConfig: {
                    outDir: "whatever",
                },
            } as any,
            {
                tsConfig: {
                    outDir: "./expected",
                },
            } as any
        );

        expect(testObj.tsConfig).toEqual({
            allowJs: false,
            checkJs: false,
            declaration: false,
            declarationMap: false,
            emitDecorationOnly: false,
            esModuleInterop: false,
            jsx: ts.JsxEmit.Preserve,
            configFilePath: "/tsconfig.json",
            noEmit: false,
            outDir: "/expected",
            pretty: true,
            removeComments: false,
            strict: false,
            target: ts.ScriptTarget.ES5,
        });
    });

    it("should yield profile value with matching profile", () => {
        jest.spyOn(console, "warn").mockImplementation(() => {});
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                profile: "target",
                tsConfig: {
                    outDir: "./general-out-dir",
                },
                config: {
                    profiles: {
                        target: {
                            tsConfig: {
                                outDir: "./profile-out-dir",
                            },
                        },
                    },
                },
            } as any,
            {
                tsConfig: {
                    outDir: "./loader-out-dir",
                },
            } as any
        );

        expect(testObj.tsConfig).toEqual({
            allowJs: false,
            checkJs: false,
            declaration: false,
            declarationMap: false,
            emitDecorationOnly: false,
            esModuleInterop: false,
            configFilePath: "/tsconfig.json",
            noEmit: false,
            outDir: "/profile-out-dir",
            pretty: true,
            removeComments: false,
            strict: false,
            target: ts.ScriptTarget.ES5,
            jsx: ts.JsxEmit.Preserve,
        });
    });

    it("should yield overridden values w/o matching profile", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                reporter: new NoReporter(),
                profile: "unknown",
                tsConfig: {
                    outDir: "./general-out-dir",
                },
                config: {
                    profiles: {
                        target: {
                            tsConfig: {
                                outDir: "./profile-out-dir",
                            },
                        },
                    },
                },
            } as any,
            {
                tsConfig: {
                    outDir: "./loader-out-dir",
                },
            } as any
        );

        expect(testObj.tsConfig).toEqual({
            allowJs: false,
            checkJs: false,
            declaration: false,
            declarationMap: false,
            emitDecorationOnly: false,
            esModuleInterop: false,
            configFilePath: "/tsconfig.json",
            noEmit: false,
            outDir: "/loader-out-dir",
            pretty: true,
            removeComments: false,
            strict: false,
            target: ts.ScriptTarget.ES5,
            jsx: ts.JsxEmit.Preserve,
        });
    });
});

describe("profile", () => {
    it("should yield undefined if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.profile).toBeUndefined();
    });

    it("should yield passed value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { profile: "target", reporter: new NoReporter() } as any);

        expect(testObj.profile).toBe("target");
    });

    it("should yield overridden value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            { profile: "target", reporter: new NoReporter() } as any,
            { profile: "expected" } as any
        );

        expect(testObj.profile).toBe("expected");
    });
});

describe("buildDir", () => {
    it("should yield current directory if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.buildDir).toBe("/");
    });

    it("should yield overridden value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.buildDir).toBe("/");
    });
});

describe("reporter", () => {
    it("should yield default reporter if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.reporter).toBeInstanceOf(DefaultReporter);
    });

    it("should yield overridden value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { reporter: new ReporterMock(fileSystem) } as any);

        expect(testObj.reporter).toBeInstanceOf(ReporterMock);
    });
});

describe("cliArgs", () => {
    it("should yield empty object if not passed", () => {
        const fileSystem = createSystem({ "/test.ts": "export const test = () => {};" }, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.cliArgs).toEqual({
            errors: [],
            fileNames: [],
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
                removeComments: false,
                strict: false,
                target: ts.ScriptTarget.ES5,
            },
        });
    });

    it("should yield passed values", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            cliArgs: {
                options: {
                    outDir: "./expected",
                    rootDir: "./root",
                },
            },
        } as any);

        expect(testObj.cliArgs).toMatchObject({
            options: {
                outDir: "/expected",
                rootDir: "/root",
            },
        });
    });

    it("should yield merged values", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                cliArgs: {
                    options: {
                        outDir: "./expected",
                    },
                },
            } as any,
            {
                cliArgs: {
                    options: {
                        rootDir: "./root",
                    },
                },
            } as any
        );

        expect(testObj.cliArgs).toMatchObject({
            options: {
                outDir: "/expected",
                rootDir: "/root",
            },
        });
    });
});

describe("getSelectedProfiles", () => {
    it("should yield empty array with no profiles", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.getSelectedProfiles()).toEqual([]);
    });
    it("should yield profiles with available profile and selected profile", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            profile: "expected",
            config: {
                profiles: {
                    expected: {},
                },
            },
        } as any);

        expect(testObj.getSelectedProfiles()).toEqual(["expected"]);
    });

    it("should yield profiles with available profile and passed profile", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                profiles: {
                    expected: {},
                },
            },
        } as any);

        expect(testObj.getSelectedProfiles("expected")).toEqual(["expected"]);
    });

    it("should yield profiles with existing dependent profile and passed profile", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                profiles: {
                    expected: {
                        depends: ["dependent"],
                    },
                    dependent: {},
                },
            },
        } as any);

        expect(testObj.getSelectedProfiles("expected")).toEqual(["dependent", "expected"]);
    });

    it("should yield profiles with non-existing dependent profile and passed profile", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                profiles: {
                    expected: {
                        depends: ["dependent"],
                    },
                },
            },
        } as any);

        expect(testObj.getSelectedProfiles("expected")).toEqual(["expected"]);
    });

    it("should yield profiles with multiple existing dependent profiles and passed profile", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                profiles: {
                    expected: {
                        depends: ["dependent1", "dependent2"],
                    },
                    dependent1: {},
                    dependent2: {},
                },
            },
        } as any);

        expect(testObj.getSelectedProfiles("expected")).toEqual(["dependent1", "dependent2", "expected"]);
    });

    it("should yield profiles with multiple non-existing dependent profiles and passed profile", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                profiles: {
                    expected: {
                        depends: ["dependent1", "dependent2"],
                    },
                    dependent2: {},
                },
            },
        } as any);

        expect(testObj.getSelectedProfiles("expected")).toEqual(["dependent2", "expected"]);
    });

    it("should yield profiles with chained existing dependent profiles and passed profile", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                profiles: {
                    expected: {
                        depends: ["dependent2"],
                    },
                    dependent1: {},
                    dependent2: {
                        depends: ["dependent1"],
                    },
                    dependent3: {},
                },
            },
        } as any);

        expect(testObj.getSelectedProfiles("expected")).toEqual(["dependent1", "dependent2", "expected"]);
    });
});

describe("getAddons", () => {
    it("should yield empty array with no addons", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.getAddons()).toEqual([]);
    });

    it("should yield addons from config", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                addons: ["addon1", "addon2"],
            },
        } as any);

        expect(testObj.getAddons()).toEqual(["addon1", "addon2"]);
    });

    it("should yield addons from selected profile", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            profile: "expected",
            config: {
                profiles: {
                    expected: {
                        addons: ["addon1", "addon2"],
                    },
                },
            },
        } as any);

        expect(testObj.getAddons()).toEqual(["addon1", "addon2"]);
    });

    it("should yield addons from profile with matching profile", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                profiles: {
                    expected: {
                        addons: ["addon1", "addon2"],
                    },
                },
            },
        } as any);

        expect(testObj.getAddons("expected")).toEqual(["addon1", "addon2"]);
    });

    it("should yield addons from profile with dependent profile", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                profiles: {
                    expected: {
                        depends: ["dependent"],
                        addons: ["addon3", "addon4"],
                    },
                    dependent: {
                        addons: ["addon1", "addon2"],
                    },
                },
            },
        } as any);

        expect(testObj.getAddons("expected")).toEqual(["addon1", "addon2", "addon3", "addon4"]);
    });

    it("should yield addons from profile with config addons and dependent profile addons", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                addons: ["addon1", "addon2"],
                profiles: {
                    expected: {
                        depends: ["dependent"],
                        addons: ["addon5", "addon6"],
                    },
                    dependent: {
                        addons: ["addon3", "addon4"],
                    },
                },
            },
            profile: "expected",
        } as any);

        expect(testObj.getAddons("expected")).toEqual(["addon1", "addon2", "addon3", "addon4", "addon5", "addon6"]);
    });
});

describe("getOptions", () => {
    it("should yield default options if not passed", () => {
        const fileSystem = createSystem({ "/test.ts": "export const test = () => {};" }, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.getOptions()).toEqual({
            buildDir: "/",
            cliArgs: {
                errors: [],
                fileNames: [],
                options: {
                    allowJs: false,
                    checkJs: false,
                    declaration: false,
                    declarationMap: false,
                    emitDecorationOnly: false,
                    esModuleInterop: false,
                    jsx: ts.JsxEmit.Preserve,
                    configFilePath: "/tsconfig.json",
                    noEmit: false,
                    pretty: true,
                    removeComments: false,
                    strict: false,
                    target: ts.ScriptTarget.ES5,
                },
            },
            config: {},
            reporter: expect.any(DefaultReporter),
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
                removeComments: false,
                strict: false,
                target: ts.ScriptTarget.ES5,
            },
            tsConfigFile: "/tsconfig.json",
        });
    });

    it("should yield passed values", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            cliArgs: {
                options: {
                    outDir: "./expected",
                    rootDir: "./root",
                },
            },
        } as any);

        expect(testObj.getOptions()).toMatchObject({
            cliArgs: {
                options: {
                    outDir: "/expected",
                    rootDir: "/root",
                },
            },
        });
    });

    it("should yield merged values", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                cliArgs: {
                    options: {
                        outDir: "./expected",
                    },
                },
            } as any,
            {
                cliArgs: {
                    options: {
                        rootDir: "./root",
                    },
                },
            } as any
        );

        expect(testObj.getOptions()).toMatchObject({
            cliArgs: {
                options: {
                    outDir: "/expected",
                    rootDir: "/root",
                },
            },
        });
    });

    it("should yield ESNext target with tsConfig target set to ESNext", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const actual = new ResolvedCompilerOptions(fileSystem, {
            tsConfig: {
                target: ts.ScriptTarget.ESNext,
            },
        } as any);

        expect(actual.tsConfig?.target).toBe(ts.ScriptTarget.ESNext);
    });

    it("should yield ES5 target with cliArgs target set to ES5", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const actual = new ResolvedCompilerOptions(fileSystem, {
            cliArgs: {
                options: {
                    target: ts.ScriptTarget.ES5,
                },
            },
        } as any);

        expect(actual.tsConfig?.target).toBe(ts.ScriptTarget.ES5);
    });

    it("should yield ESNext target with loaderOptions target set to ESNext", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const actual = new ResolvedCompilerOptions(fileSystem, {}, {
            tsConfig: {
                target: ts.ScriptTarget.ESNext,
            },
        } as any);

        expect(actual.tsConfig?.target).toBe(ts.ScriptTarget.ESNext);
    });
});
