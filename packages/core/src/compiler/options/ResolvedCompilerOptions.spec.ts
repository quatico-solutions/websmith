/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { ReporterMock } from "../../../test";
import { compileSystem } from "../../testing";
import { DefaultReporter } from "../DefaultReporter";
import { ResolvedCompilerOptions } from "./ResolvedCompilerOptions";

describe("constructor", () => {
    it("should yield passed values", () => {
        const { fileSystem } = compileSystem({
            buildDir: "/build",
            files: { "/build/tsconfig.json": "{}", "/build/test.ts": "export const test = () => {};" },
        });

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            buildDir: "/build",
            reporter: new ReporterMock(fileSystem),
            cliArgs: {
                options: {
                    outDir: "./dist",
                },
                fileNames: [],
                errors: [],
            },
        });

        expect(testObj).toEqual({
            addons: [],
            addonsDir: "/build/addons",
            buildDir: "/build",
            cliArgs: {
                compileOnSave: false,
                errors: [],
                fileNames: ["/build/test.ts"],
                options: {
                    allowJs: false,
                    checkJs: false,
                    configFilePath: "/build/tsconfig.json",
                    declaration: false,
                    declarationMap: false,
                    emitDecorationOnly: false,
                    esModuleInterop: false,
                    jsx: ts.JsxEmit.Preserve,
                    module: ts.ModuleKind.ESNext,
                    moduleResolution: ts.ModuleResolutionKind.Node10,
                    noEmit: false,
                    outDir: "/build/dist",
                    pretty: true,
                    removeComments: false,
                    sourceMap: false,
                    strict: false,
                    target: ts.ScriptTarget.ESNext,
                },
                raw: {},
                typeAcquisition: {
                    enable: false,
                    exclude: [],
                    include: [],
                },
                wildcardDirectories: {
                    "/build": 1,
                },
            },
            config: {},
            configFile: "/build/websmith.config.json",
            debug: false,
            projectDir: "/build",
            reporter: expect.any(ReporterMock),
            system: expect.any(Object),
            tsConfig: {
                allowJs: false,
                checkJs: false,
                configFilePath: "/build/tsconfig.json",
                declaration: false,
                declarationMap: false,
                emitDecorationOnly: false,
                esModuleInterop: false,
                jsx: ts.JsxEmit.Preserve,
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Node10,
                noEmit: false,
                outDir: "/build/dist",
                pretty: true,
                removeComments: false,
                sourceMap: false,
                strict: false,
                target: ts.ScriptTarget.ESNext,
            },
            tsConfigFile: "/build/tsconfig.json",
            watch: false,
        });
    });

    it("should return defaults w/o any param", () => {
        const { fileSystem } = compileSystem();

        const actual = new ResolvedCompilerOptions(fileSystem, { buildDir: "/target" }).getOptions();

        expect(actual).toEqual(
            expect.objectContaining({
                buildDir: "/target",
                cliArgs: {
                    errors: [],
                    fileNames: [],
                    options: {
                        configFilePath: "/target/tsconfig.json",
                        declaration: true,
                        module: ts.ModuleKind.ESNext,
                        target: ts.ScriptTarget.ESNext,
                        moduleResolution: ts.ModuleResolutionKind.Node10,
                        jsx: ts.JsxEmit.Preserve,
                        esModuleInterop: true,
                    },
                },
                config: {},
                configFile: "/target/websmith.config.json",
                reporter: expect.any(DefaultReporter),
                tsConfig: {
                    configFilePath: "/target/tsconfig.json",
                    declaration: true,
                    module: ts.ModuleKind.ESNext,
                    target: ts.ScriptTarget.ESNext,
                    moduleResolution: ts.ModuleResolutionKind.Node10,
                    jsx: ts.JsxEmit.Preserve,
                    esModuleInterop: true,
                },
                tsConfigFile: "/target/tsconfig.json",
            })
        );
    });

    it("should return project config w/ custom but empty tsconfig.json", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "./expected/tsconfig.json": "{}",
            },
        });

        const actual = new ResolvedCompilerOptions(target, { buildDir: "./expected", tsConfigFile: "./expected/tsconfig.json" }).getOptions();

        expect(actual).toMatchObject({
            tsConfigFile: "/expected/tsconfig.json",
        });
    });

    it("should return expected path w/ custom addons directory and '*' target", () => {
        const { addons } = compileSystem(
            {
                files: {
                    "./expected/addon-foo/addon.js": "export const activate = () => {};",
                },
            },
            { addonsDir: "./expected" }
        );
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

        const actual = new ResolvedCompilerOptions(target, { buildDir: "./", debug: true }).getOptions();

        expect(actual).toEqual(expect.objectContaining({ debug: true }));
    });

    it("should return watch path w/ watch true", () => {
        const { fileSystem: target } = compileSystem();

        const actual = new ResolvedCompilerOptions(target, { buildDir: "./", watch: true }).getOptions();

        expect(actual).toEqual(expect.objectContaining({ watch: true }));
    });

    it("should return config w/ valid compiler config json", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "websmith.config.json": '{ "profiles": { "whatever": { "addons": [ "one", "two", "three" ] } } }',
            },
        });

        const actual = new ResolvedCompilerOptions(target, { buildDir: "./", configFile: "./websmith.config.json" }).getOptions();

        expect(actual.config).toEqual({
            profiles: { whatever: { addons: ["one", "two", "three"] } },
        });
    });

    it("should return config w/ valid addonsDir, addons in compiler config json", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "./expected/tsconfig.json": '{ "include": ["**/*.ts"] }',
                "./expected/one/addon.ts": "export const activate = () => {};",
                "./expected/websmith.config.json": '{ "addons":["one", "two"], "addonsDir":"./expected" }',
            },
            buildDir: "./expected",
        });
        jest.mock(
            "./expected/one/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const actual = new ResolvedCompilerOptions(target, {
            buildDir: "./expected",
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
                target: ts.ScriptTarget.ESNext,
                module: ts.ModuleKind.ESNext,
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
});

describe("additionalArguments", () => {
    it("should yield undefined if not passed", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.additionalArguments).toBeUndefined();
    });

    it("should yield passed value", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, { additionalArguments: { test: "test" } } as any);

        expect(testObj.additionalArguments).toEqual({ test: "test" });
    });
});
describe("configFile", () => {
    it("should yield undefined if not passed", () => {
        const { fileSystem, reporter } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, { reporter } as any);

        expect(testObj.tsConfigFile).toBe("/tsconfig.json");
    });

    it("should yield passed value", () => {
        const { fileSystem, reporter } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            configFile: "tsconfig.json",
            reporter,
        } as any);

        expect(testObj.configFile).toBe("/tsconfig.json");
    });

    it("should yield overridden value", () => {
        const { fileSystem, reporter } = compileSystem();

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                configFile: "whatever",
                reporter,
            } as any,
            undefined,
            {
                configFile: "tsconfig.json",
            } as any
        );

        expect(testObj.configFile).toBe("/tsconfig.json");
    });
});

describe("config", () => {
    it("should yield undefined if not passed", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.config).toEqual({});
    });

    it("should yield passed value", () => {
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                config: {
                    addons: ["addon1", "addon2"],
                    addonsDir: "./other",
                    transpileOnly: true,
                },
            } as any,
            undefined,
            {
                config: {
                    addons: ["addon3", "addon4"],
                    addonsDir: "./expected",
                },
            } as any
        );

        expect(testObj.config).toEqual({
            addons: ["addon3", "addon4"],
            addonsDir: "./expected",
            transpileOnly: true,
        });
    });
});

describe("debug", () => {
    it("should yield false if not passed", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.debug).toBe(false);
    });

    it("should yield true if passed", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, { debug: true } as any);

        expect(testObj.debug).toBe(true);
    });

    it("should yield overridden value", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, { debug: true } as any, undefined, { debug: false } as any);

        expect(testObj.debug).toBe(false);
    });
});

describe("watch", () => {
    it("should yield false if not passed", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.watch).toBe(false);
    });

    it("should yield true if passed", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, { watch: true } as any);

        expect(testObj.watch).toBe(true);
    });

    it("should yield overridden value", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, { watch: true } as any, undefined, { watch: false } as any);

        expect(testObj.watch).toBe(false);
    });
});

describe("tsConfigFile", () => {
    it("should yield undefined if not passed", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.tsConfigFile).toBe("/tsconfig.json");
    });

    it("should yield passed value", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            tsConfigFile: "tsconfig.json",
        } as any);

        expect(testObj.tsConfigFile).toBe("/tsconfig.json");
    });

    it("should yield overridden value", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                tsConfigFile: "whatever",
            } as any,
            undefined,
            {
                tsConfigFile: "tsconfig.json",
            } as any
        );

        expect(testObj.tsConfigFile).toBe("/tsconfig.json");
    });
});

describe("tsConfig", () => {
    it("should yield default config if not passed", () => {
        const { fileSystem } = compileSystem();

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
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
            noEmit: false,
            pretty: true,
            removeComments: false,
            sourceMap: false,
            strict: false,
            target: ts.ScriptTarget.ESNext,
        });
    });

    it("should yield passed value with defaults", () => {
        const { fileSystem } = compileSystem();

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
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
            noEmit: false,
            outDir: "/expected",
            pretty: true,
            removeComments: false,
            sourceMap: false,
            strict: false,
            target: ts.ScriptTarget.ESNext,
        });
    });

    it("should yield overridden value", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                tsConfig: {
                    outDir: "whatever",
                },
            } as any,
            undefined,
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
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
            noEmit: false,
            outDir: "/expected",
            pretty: true,
            removeComments: false,
            sourceMap: false,
            strict: false,
            target: ts.ScriptTarget.ESNext,
        });
    });

    it("should yield profile value with matching profile", () => {
        jest.spyOn(console, "warn").mockImplementation(() => {});
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                profile: "target",
                buildDir: "./target",
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
            undefined,
            {
                tsConfig: {
                    outDir: "./loader-out-dir",
                },
            } as any
        );

        expect(testObj.tsConfig).toEqual({
            configFilePath: "/target/tsconfig.json",
            declaration: true,
            outDir: "/target/profile-out-dir",
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
            jsx: ts.JsxEmit.Preserve,
            esModuleInterop: true,
        });
    });

    it("should yield overridden values w/o matching profile", () => {
        const { fileSystem, reporter } = compileSystem();

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                reporter,
                profile: "unknown",
                buildDir: "./target",
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
            undefined,
            {
                tsConfig: {
                    outDir: "./loader-out-dir",
                },
            } as any
        );

        expect(testObj.tsConfig).toEqual({
            configFilePath: "/target/tsconfig.json",
            declaration: true,
            outDir: "/target/loader-out-dir",
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
            jsx: ts.JsxEmit.Preserve,
            esModuleInterop: true,
        });
    });
});

describe("profile", () => {
    it("should yield undefined if not passed", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.profile).toBeUndefined();
    });

    it("should yield passed value", () => {
        const { fileSystem, reporter } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, { profile: "target", reporter } as any);

        expect(testObj.profile).toBe("target");
    });

    it("should yield overridden value", () => {
        const { fileSystem, reporter } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, { profile: "target", reporter } as any, undefined, { profile: "expected" } as any);

        expect(testObj.profile).toBe("expected");
    });
});

describe("buildDir", () => {
    it("should yield current directory if not passed", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.buildDir).toBe(".");
    });

    it("should yield overridden value", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, { buildDir: "./expected" } as any);

        expect(testObj.buildDir).toBe("/expected");
    });
});

describe("projectDir", () => {
    it("should yield current directory if not passed", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.projectDir).toBe("/");
    });

    it("should yield directory of configFile if passed", () => {
        const { fileSystem, reporter } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            configFile: "./expected/websmith.config.json",
            reporter,
        } as any);

        expect(testObj.projectDir).toBe("/expected");
    });

    it("should yield overridden value", () => {
        const { fileSystem, reporter } = compileSystem();

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                configFile: "/whatever/websmith.config.json",
                reporter,
            } as any,
            undefined,
            {
                configFile: "/expected/websmith.config.json",
            } as any
        );

        expect(testObj.projectDir).toBe("/expected");
    });
});

describe("reporter", () => {
    it("should yield default reporter if not passed", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.reporter).toBeInstanceOf(DefaultReporter);
    });

    it("should yield overridden value", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, { reporter: new ReporterMock(fileSystem) } as any);

        expect(testObj.reporter).toBeInstanceOf(ReporterMock);
    });
});

describe("cliArgs", () => {
    it("should yield empty object if not passed", () => {
        const { fileSystem } = compileSystem({ files: { "/test.ts": "export const test = () => {};" } });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.cliArgs).toEqual({
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
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Node10,
                noEmit: false,
                pretty: true,
                removeComments: false,
                sourceMap: false,
                strict: false,
                target: ts.ScriptTarget.ESNext,
            },
            raw: {},
            typeAcquisition: {
                enable: false,
                exclude: [],
                include: [],
            },
            wildcardDirectories: {
                "": 1,
            },
        });
    });

    it("should yield passed values", () => {
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                cliArgs: {
                    options: {
                        outDir: "./expected",
                    },
                },
            } as any,
            undefined,
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
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.getSelectedProfiles()).toEqual([]);
    });
    it("should yield profiles with available profile and selected profile", () => {
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.getAddons()).toEqual([]);
    });

    it("should yield addons from config", () => {
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(fileSystem, {
            config: {
                addons: ["addon1", "addon2"],
            },
        } as any);

        expect(testObj.getAddons()).toEqual(["addon1", "addon2"]);
    });

    it("should yield addons from selected profile", () => {
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem({ files: { "/test.ts": "export const test = () => {};" } });

        const testObj = new ResolvedCompilerOptions(fileSystem, {} as any);

        expect(testObj.getOptions()).toEqual({
            buildDir: ".",
            cliArgs: {
                compileOnSave: false,
                errors: [],
                fileNames: ["/test.ts"],
                options: {
                    allowJs: false,
                    checkJs: false,
                    declaration: false,
                    declarationMap: false,
                    emitDecorationOnly: false,
                    esModuleInterop: false,
                    jsx: ts.JsxEmit.Preserve,
                    configFilePath: "/tsconfig.json",
                    module: ts.ModuleKind.ESNext,
                    moduleResolution: ts.ModuleResolutionKind.Node10,
                    noEmit: false,
                    pretty: true,
                    removeComments: false,
                    sourceMap: false,
                    strict: false,
                    target: ts.ScriptTarget.ESNext,
                },
                raw: {},
                typeAcquisition: {
                    enable: false,
                    exclude: [],
                    include: [],
                },
                wildcardDirectories: {
                    "": 1,
                },
            },
            config: {},
            configFile: "/websmith.config.json",
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
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Node10,
                noEmit: false,
                pretty: true,
                removeComments: false,
                sourceMap: false,
                strict: false,
                target: ts.ScriptTarget.ESNext,
            },
            tsConfigFile: "/tsconfig.json",
        });
    });

    it("should yield passed values", () => {
        const { fileSystem } = compileSystem();

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
        const { fileSystem } = compileSystem();

        const testObj = new ResolvedCompilerOptions(
            fileSystem,
            {
                cliArgs: {
                    options: {
                        outDir: "./expected",
                    },
                },
            } as any,
            undefined,
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
});
