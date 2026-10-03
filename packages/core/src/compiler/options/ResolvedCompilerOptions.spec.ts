/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import ts from "typescript";
import { ReporterMock } from "../../../test";
import { createSystem } from "../../environment";
import { DefaultReporter } from "../DefaultReporter";
import { NoReporter } from "../NoReporter";
import { ResolvedCompilerOptions } from "./ResolvedCompilerOptions";

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
                        jsx: ts.JsxEmit.Preserve,
                        noEmit: false,
                        outDir: "/dist",
                        pretty: true,
                        removeComments: false,
                        strict: false,
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
                    jsx: ts.JsxEmit.Preserve,
                    noEmit: false,
                    outDir: "/dist",
                    pretty: true,
                    removeComments: false,
                    strict: false,
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
                    jsx: ts.JsxEmit.Preserve,
                    noEmit: false,
                    pretty: true,
                    removeComments: false,
                    strict: false,
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
                jsx: ts.JsxEmit.Preserve,
                noEmit: false,
                pretty: true,
                removeComments: false,
                strict: false,
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

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

        expect(testObj.additionalArguments).toBeUndefined();
    });

    it("should yield passed value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { additionalArguments: { test: "test" } });

        expect(testObj.additionalArguments).toEqual({ test: "test" });
    });
});
describe("configFile", () => {
    it("should yield undefined if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { reporter: new NoReporter() });

        expect(testObj.tsConfigFile).toBe("/tsconfig.json");
    });

    it("should yield passed value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            configFile: "tsconfig.json",
            reporter: new NoReporter(),
        });

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

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

        expect(testObj.config).toEqual({});
    });

    it("should yield passed value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                addons: ["addon1", "addon2"],
            },
        });

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

    it("should report nothing w/ invalid unselected profile in config file", () => {
        const fileSystem = createSystem(
            { "./websmith.config.json": JSON.stringify({ profiles: { broken: { esm: { runtime: "deno" } }, valid: {} } }) },
            { virtual: true }
        );
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();

        new ResolvedCompilerOptions(fileSystem, { configFile: "./websmith.config.json", profile: "valid", reporter: target });

        expect(target.reportDiagnostic).not.toHaveBeenCalled();
    });

    it("should report error w/ invalid profile in config file selected by loader options", () => {
        const fileSystem = createSystem(
            { "./websmith.config.json": JSON.stringify({ profiles: { broken: { esm: { runtime: "deno" } }, valid: {} } }) },
            { virtual: true }
        );
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();

        new ResolvedCompilerOptions(fileSystem, { configFile: "./websmith.config.json", profile: "valid", reporter: target }, {
            profile: "broken",
        } as any);

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({ messageText: expect.stringContaining("Unknown 'esm.runtime' value 'deno' in profile 'broken'") })
        );
    });
});

describe("debug", () => {
    it("should yield false if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

        expect(testObj.debug).toBe(false);
    });

    it("should yield true if passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { debug: true });

        expect(testObj.debug).toBe(true);
    });

    it("should yield overridden value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { debug: true } as any, { debug: false });

        expect(testObj.debug).toBe(false);
    });
});

describe("watch", () => {
    it("should yield false if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

        expect(testObj.watch).toBe(false);
    });

    it("should yield true if passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { watch: true });

        expect(testObj.watch).toBe(true);
    });

    it("should yield overridden value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { debug: true } as any, { debug: false });

        expect(testObj.debug).toBe(false);
    });
});

describe("tsConfigFile", () => {
    it("should yield undefined if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

        expect(testObj.tsConfigFile).toBe("/tsconfig.json");
    });

    it("should yield passed value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            tsConfigFile: "tsconfig.json",
        });

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

    it("should yield tsconfig.json in directory w/ project directory", () => {
        const fileSystem = createSystem({ "/project/tsconfig.json": "{}", "/project/src/index.ts": "export {};" }, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { tsConfigFile: "./project", reporter: new NoReporter() });

        expect(testObj.tsConfigFile).toBe("/project/tsconfig.json");
    });

    it("should yield tsconfig.json files and options w/ project directory", () => {
        const fileSystem = createSystem(
            {
                "/project/tsconfig.json": JSON.stringify({ compilerOptions: { outDir: "./dist", strict: true }, include: ["src/**/*"] }),
                "/project/src/index.ts": "export {};",
            },
            { virtual: true }
        );

        const testObj = new ResolvedCompilerOptions(fileSystem, { tsConfigFile: "./project", reporter: new NoReporter() });

        expect(testObj.cliArgs.fileNames).toEqual(["/project/src/index.ts"]);
        expect(testObj.tsConfig).toEqual(expect.objectContaining({ outDir: "/project/dist", strict: true }));
    });
});

describe("tsConfig", () => {
    it("should yield default config if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

        expect(testObj.tsConfig).toEqual({
            allowJs: false,
            checkJs: false,
            declaration: false,
            declarationMap: false,
            emitDecorationOnly: false,
            jsx: ts.JsxEmit.Preserve,
            configFilePath: "/tsconfig.json",
            noEmit: false,
            pretty: true,
            removeComments: false,
            strict: false,
        });
    });

    it("should yield no target and esModuleInterop if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

        expect(testObj.tsConfig).not.toHaveProperty("target");
        expect(testObj.tsConfig).not.toHaveProperty("esModuleInterop");
    });

    it("should yield passed target and esModuleInterop", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            tsConfig: { module: ts.ModuleKind.NodeNext, target: ts.ScriptTarget.ES5, esModuleInterop: false },
        });

        expect(testObj.tsConfig).toMatchObject({ target: ts.ScriptTarget.ES5, esModuleInterop: false });
    });

    it("should yield jsx preserve if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

        expect(testObj.tsConfig.jsx).toBe(ts.JsxEmit.Preserve);
    });

    it("should yield passed value with defaults", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            tsConfig: {
                outDir: "./expected",
            },
        });

        expect(testObj.tsConfig).toEqual({
            allowJs: false,
            checkJs: false,
            declaration: false,
            declarationMap: false,
            emitDecorationOnly: false,
            jsx: ts.JsxEmit.Preserve,
            configFilePath: "/tsconfig.json",
            noEmit: false,
            outDir: "/expected",
            pretty: true,
            removeComments: false,
            strict: false,
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
            jsx: ts.JsxEmit.Preserve,
            configFilePath: "/tsconfig.json",
            noEmit: false,
            outDir: "/expected",
            pretty: true,
            removeComments: false,
            strict: false,
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
            configFilePath: "/tsconfig.json",
            noEmit: false,
            outDir: "/profile-out-dir",
            pretty: true,
            removeComments: false,
            strict: false,
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
            configFilePath: "/tsconfig.json",
            noEmit: false,
            outDir: "/loader-out-dir",
            pretty: true,
            removeComments: false,
            strict: false,
            jsx: ts.JsxEmit.Preserve,
        });
    });
});

describe("profile", () => {
    it("should yield undefined if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

        expect(testObj.profile).toBeUndefined();
    });

    it("should yield passed value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { profile: "target", reporter: new NoReporter() });

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

describe("tsConfigExtends", () => {
    it("yields extends chain of tsconfig.json", () => {
        const fileSystem = createSystem(
            {
                "/tsconfig.json": JSON.stringify({ extends: "./config/base.json" }),
                "/config/base.json": JSON.stringify({ extends: "./root.json", compilerOptions: { strict: true } }),
                "/config/root.json": JSON.stringify({ compilerOptions: { target: "es2020" } }),
            },
            { virtual: true }
        );

        const testObj = new ResolvedCompilerOptions(fileSystem, { reporter: new NoReporter(), tsConfigFile: "/tsconfig.json" });

        expect(testObj.tsConfigExtends).toEqual(["/config/base.json", "/config/root.json"]);
    });

    it("yields empty list w/o extends in tsconfig.json", () => {
        const fileSystem = createSystem({ "/tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }) }, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { reporter: new NoReporter(), tsConfigFile: "/tsconfig.json" });

        expect(testObj.tsConfigExtends).toEqual([]);
    });

    it("yields empty list w/o tsconfig.json", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { reporter: new NoReporter(), tsConfigFile: "/tsconfig.json" });

        expect(testObj.tsConfigExtends).toEqual([]);
    });

    it("yields missing extends target", () => {
        const fileSystem = createSystem({ "/tsconfig.json": JSON.stringify({ extends: "./gone.json" }) }, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { reporter: new NoReporter(), tsConfigFile: "/tsconfig.json" });

        expect(testObj.tsConfigExtends).toEqual(["/gone.json"]);
    });
});

describe("buildDir", () => {
    it("should yield project directory w/ project directory", () => {
        const fileSystem = createSystem({ "/project/tsconfig.json": "{}", "/project/src/index.ts": "export {};" }, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { tsConfigFile: "./project", reporter: new NoReporter() });

        expect(testObj.buildDir).toBe("/project");
    });

    it("should yield current directory if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

        expect(testObj.buildDir).toBe("/");
    });

    it("should yield overridden value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

        expect(testObj.buildDir).toBe("/");
    });
});

describe("reporter", () => {
    it("should yield default reporter if not passed", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

        expect(testObj.reporter).toBeInstanceOf(DefaultReporter);
    });

    it("should yield overridden value", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { reporter: new ReporterMock(fileSystem) });

        expect(testObj.reporter).toBeInstanceOf(ReporterMock);
    });
});

describe("cliArgs", () => {
    it("should yield empty object if not passed", () => {
        const fileSystem = createSystem({ "/test.ts": "export const test = () => {};" }, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

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
                jsx: ts.JsxEmit.Preserve,
                noEmit: false,
                pretty: true,
                removeComments: false,
                strict: false,
            },
            raw: {
                configFilePath: "/tsconfig.json",
            },
        });
    });

    it("should yield passed values", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            tsConfig: {
                outDir: "./expected",
                rootDir: "./root",
            },
        });

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

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

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
        });

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
        });

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
        });

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
        });

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
        });

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
        });

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
        });

        expect(testObj.getSelectedProfiles("expected")).toEqual(["dependent1", "dependent2", "expected"]);
    });
});

describe("getSelectedProfiles w/ depends graphs", () => {
    it("should yield empty array w/ unknown profile", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const testObj = new ResolvedCompilerOptions(fileSystem, { config: { profiles: { a: {} } } });

        const actual = testObj.getSelectedProfiles("unknown");

        expect(actual).toEqual([]);
    });

    it("should yield dependencies before profile w/ missing depends target", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const testObj = new ResolvedCompilerOptions(fileSystem, { config: { profiles: { a: { depends: ["missing", "b"] }, b: {} } } });

        const actual = testObj.getSelectedProfiles("a");

        expect(actual).toEqual(["b", "a"]);
    });

    it("should yield dependencies before profile w/ nested dependency of first dependency", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: { profiles: { a: { depends: ["b", "c"] }, b: { depends: ["d"] }, c: {}, d: {} } },
        });

        const actual = testObj.getSelectedProfiles("a");

        expect(actual).toEqual(["d", "b", "c", "a"]);
    });

    it("should yield dependencies before dependents w/ three-level chain", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: { profiles: { a: { depends: ["b"] }, b: { depends: ["c"] }, c: { depends: ["d"] }, d: {} } },
        });

        const actual = testObj.getSelectedProfiles("a");

        expect(actual).toEqual(["d", "c", "b", "a"]);
    });

    it("should yield shared dependency once before its dependents w/ diamond", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: { profiles: { a: { depends: ["b", "c"] }, b: { depends: ["d"] }, c: { depends: ["d"] }, d: {} } },
        });

        const actual = testObj.getSelectedProfiles("a");

        expect(actual).toEqual(["d", "b", "c", "a"]);
    });

    it("should yield each profile once w/ depends cycle", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const testObj = new ResolvedCompilerOptions(fileSystem, { config: { profiles: { a: { depends: ["b"] }, b: { depends: ["a"] } } } });

        const actual = testObj.getSelectedProfiles("a");

        expect(actual).toEqual(["b", "a"]);
    });

    it("should yield profile once w/ self-dependency", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const testObj = new ResolvedCompilerOptions(fileSystem, { config: { profiles: { a: { depends: ["a"] } } } });

        const actual = testObj.getSelectedProfiles("a");

        expect(actual).toEqual(["a"]);
    });
});

describe("getOptions w/ depends graphs", () => {
    it("should merge tsConfig of second level after third level w/ three-level chain", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                profiles: {
                    a: { depends: ["b"] },
                    b: { depends: ["c"] },
                    c: { depends: ["d"], tsConfig: { target: ts.ScriptTarget.ES2020 } },
                    d: { tsConfig: { target: ts.ScriptTarget.ES2022 } },
                },
            },
        });

        const actual = testObj.getOptions("a").tsConfig?.target;

        expect(actual).toBe(ts.ScriptTarget.ES2020);
    });

    it("should merge tsConfig of dependent after shared dependency w/ diamond", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                profiles: {
                    a: { depends: ["b", "c"] },
                    b: { depends: ["d"], tsConfig: { target: ts.ScriptTarget.ES2020 } },
                    c: { depends: ["d"] },
                    d: { tsConfig: { target: ts.ScriptTarget.ES2022 } },
                },
            },
        });

        const actual = testObj.getOptions("a").tsConfig?.target;

        expect(actual).toBe(ts.ScriptTarget.ES2020);
    });

    it("should merge tsConfig of dependency first w/ one level of depends", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                profiles: {
                    a: { depends: ["missing", "b"], tsConfig: { target: ts.ScriptTarget.ES2020 } },
                    b: { tsConfig: { target: ts.ScriptTarget.ES2022 } },
                },
            },
        });

        const actual = testObj.getOptions("a").tsConfig?.target;

        expect(actual).toBe(ts.ScriptTarget.ES2020);
    });

    it("should merge tsConfig of target last w/ depends cycle", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                profiles: {
                    a: { depends: ["b"], tsConfig: { target: ts.ScriptTarget.ES2020 } },
                    b: { depends: ["a"], tsConfig: { target: ts.ScriptTarget.ES2022 } },
                },
            },
        });

        const actual = testObj.getOptions("a").tsConfig?.target;

        expect(actual).toBe(ts.ScriptTarget.ES2020);
    });
});

describe("getAddons", () => {
    it("should yield empty array with no addons", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

        expect(testObj.getAddons()).toEqual([]);
    });

    it("should yield addons from config", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                addons: ["addon1", "addon2"],
            },
        });

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
        });

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
        });

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
        });

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
        });

        expect(testObj.getAddons("expected")).toEqual(["addon1", "addon2", "addon3", "addon4", "addon5", "addon6"]);
    });
});

describe("getOptions", () => {
    it("should yield default options if not passed", () => {
        const fileSystem = createSystem({ "/test.ts": "export const test = () => {};" }, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {});

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
                    jsx: ts.JsxEmit.Preserve,
                    configFilePath: "/tsconfig.json",
                    noEmit: false,
                    pretty: true,
                    removeComments: false,
                    strict: false,
                },
                raw: {
                    configFilePath: "/tsconfig.json",
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
                jsx: ts.JsxEmit.Preserve,
                noEmit: false,
                pretty: true,
                removeComments: false,
                strict: false,
            },
            tsConfigFile: "/tsconfig.json",
        });
    });

    it("should yield passed values", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            tsConfig: {
                outDir: "./expected",
                rootDir: "./root",
            },
        });

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
        });

        expect(actual.tsConfig?.target).toBe(ts.ScriptTarget.ESNext);
    });

    it("should yield ES5 target with cliArgs target set to ES5", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const actual = new ResolvedCompilerOptions(fileSystem, {
            tsConfig: {
                target: ts.ScriptTarget.ES5,
            },
        });

        expect(actual.tsConfig?.target).toBe(ts.ScriptTarget.ES5);
    });

    it("should yield ESNext target with loaderOptions target set to ESNext", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const actual = new ResolvedCompilerOptions(
            fileSystem,
            {},
            {
                tsConfig: {
                    target: ts.ScriptTarget.ESNext,
                },
            }
        );

        expect(actual.tsConfig?.target).toBe(ts.ScriptTarget.ESNext);
    });
});

describe("option names", () => {
    const createLoaderOptions = (tsConfig: ts.CompilerOptions, rest: Record<string, unknown> = {}) =>
        ({ tsConfig, cliArgs: { options: { ...tsConfig }, fileNames: [], errors: [] }, ...rest }) as any;

    it("should yield enum value in tsConfig and cliArgs w/ module name in loader tsConfig", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, {}, createLoaderOptions({ module: "NodeNext" as any }));

        expect(testObj.tsConfig?.module).toBe(ts.ModuleKind.NodeNext);
        expect(testObj.cliArgs.options.module).toBe(ts.ModuleKind.NodeNext);
    });

    it("should yield enum value in profile options w/ module name in loader tsConfig", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {},
            createLoaderOptions({ module: "NodeNext" as any }, { config: { profiles: { client: {} } }, profile: "client" })
        );

        const actual = testObj.getOptions("client");

        expect(actual.tsConfig?.module).toBe(ts.ModuleKind.NodeNext);
        expect(actual.cliArgs?.options.module).toBe(ts.ModuleKind.NodeNext);
    });

    it("should yield enum value w/ tsConfig module name passed to options", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new ResolvedCompilerOptions(fileSystem, { tsConfig: { moduleResolution: "Bundler" as any } });

        expect(testObj.tsConfig?.moduleResolution).toBe(ts.ModuleResolutionKind.Bundler);
    });

    it("should report one error and drop the value w/ invalid module in loader tsConfig", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();

        const testObj = new ResolvedCompilerOptions(fileSystem, { reporter: target }, createLoaderOptions({ module: "nope" as any }));

        expect(testObj.cliArgs.options.module).not.toBe("nope");
        expect(testObj.tsConfig?.module).not.toBe("nope");
        expect(target.reportDiagnostic).toHaveBeenCalledTimes(1);
        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({ messageText: expect.stringMatching(/^Invalid 'tsConfig\.module' value 'nope' in the loader options\. /) })
        );
    });

    it("should yield enum value w/ inline profile overriding the profile of the config file", () => {
        const fileSystem = createSystem(
            { "./websmith.config.json": JSON.stringify({ profiles: { client: { tsConfig: { module: "CommonJS", target: "ES2020" } } } }) },
            { virtual: true }
        );

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            { configFile: "./websmith.config.json" },
            { config: { profiles: { client: { tsConfig: { module: "NodeNext" as any } } } }, profile: "client" }
        );

        expect(testObj.config?.profiles?.client.tsConfig).toEqual({ module: ts.ModuleKind.NodeNext, target: ts.ScriptTarget.ES2020 });
        expect(testObj.getOptions("client").tsConfig?.module).toBe(ts.ModuleKind.NodeNext);
    });

    it("should report one error w/ invalid module in selected inline profile", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();

        new ResolvedCompilerOptions(
            fileSystem,
            { reporter: target },
            { config: { profiles: { base: { tsConfig: { target: "bogus" as any } }, client: { depends: ["base"] } } }, profile: "client" }
        );

        expect(target.reportDiagnostic).toHaveBeenCalledTimes(1);
        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringMatching(/^Invalid 'tsConfig\.target' value 'bogus' in profile 'base' of the loader options\. /),
            })
        );
    });

    it("should drop the value and report nothing w/ invalid module in unselected inline profile", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const target = new NoReporter();
        target.reportDiagnostic = jest.fn();

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            { reporter: target },
            { config: { profiles: { valid: {}, other: { tsConfig: { module: "nope" as any, outDir: "./dist" } } } }, profile: "valid" }
        );

        expect(testObj.config?.profiles?.other.tsConfig).toEqual({ outDir: "./dist" });
        expect(target.reportDiagnostic).not.toHaveBeenCalled();
    });
});
