/* eslint-disable @typescript-eslint/no-unsafe-argument */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter } from "@quatico/websmith-api";
import path from "node:path";
import ts from "typescript";
import { ReporterMock } from "../../test";
import { createSystem } from "../environment";
import { Compiler, type CompileFragment } from "./Compiler";
import type { AddonRegistry } from "./addons";
import { type CompilationContext } from "./compilation";
import { DefaultReporter } from "./DefaultReporter";
import { type CompilerOptions, type ResolvedCompilerOptions, type WebpackLoaderOptions } from "./options";
import { NoReporter } from "./NoReporter";

class CompilerTestClass extends Compiler {
    constructor(
        options: Partial<CompilerOptions>,
        loaderOptions?: Partial<WebpackLoaderOptions>,
        system?: ts.System,
        addons?: AddonRegistry,
        dependencyCallback?: (filePath: string) => void
    ) {
        super(options, loaderOptions, system, addons, dependencyCallback);
    }

    public report(program: ts.Program, result: ts.EmitResult): ts.EmitResult {
        return super.report(program, result);
    }

    public emitSourceFile(fileName: string, profile?: string, writeFile?: boolean, skipCache = false): CompileFragment {
        return super.emitSourceFile(fileName, profile, writeFile, skipCache);
    }

    public createProfileContextsIfNecessary(): this {
        return super.createProfileContextsIfNecessary();
    }

    public createCompilationContext(profile: string): CompilationContext {
        return super.createCompilationContext(profile);
    }

    public getSystem(): ts.System {
        return super.getSystem();
    }

    public getOptions(): ResolvedCompilerOptions {
        return super.getOptions();
    }

    public setOptions(options: Partial<CompilerOptions>, loaderOptions?: Partial<WebpackLoaderOptions>): this {
        return super.setOptions(options, loaderOptions);
    }

    public getContext(profile?: string): CompilationContext | undefined {
        return super.getContext(profile);
    }

    public getReporter(): Reporter {
        return super.getReporter();
    }
}

beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
});

describe("constructor", () => {
    it("uses options.reporter when provided", () => {
        const expected = new NoReporter();
        const notExpected = new ReporterMock(ts.sys);

        const testObj = new CompilerTestClass({ reporter: expected });

        const actual = testObj.getReporter();
        expect(actual).toBe(expected);
        expect(actual).not.toBe(notExpected);
    });

    it("creates DefaultReporter when options.reporter not provided", () => {
        const testObj = new CompilerTestClass({});

        expect(testObj.getReporter()).toBeDefined();
        expect(testObj.getReporter()).toBeInstanceOf(DefaultReporter);
    });

    it("allows loaderOptions.debug to override options.debug", () => {
        const options = { debug: false };
        const loaderOptions = { debug: true };

        const testObj = new CompilerTestClass(options, loaderOptions);

        expect(testObj.getOptions().debug).toBe(true);
    });

    it("allows loaderOptions.profile to override options.profile", () => {
        const options = { profile: "options-profile", reporter: new NoReporter() };
        const loaderOptions = { profile: "loader-profile" };

        const testObj = new CompilerTestClass(options, loaderOptions);

        expect(testObj.getOptions().profile).toBe("loader-profile");
    });

    it("allows loaderOptions.configFile to override options.configFile", () => {
        const options = { configFile: "./options-config.json", reporter: new NoReporter() };
        const loaderOptions = { configFile: "./loader-config.json" };

        const testObj = new CompilerTestClass(options, loaderOptions);

        expect(testObj.getOptions().configFile).toMatch(/loader-config\.json$/);
    });

    it("allows loaderOptions.tsConfigFile to override options.tsConfigFile", () => {
        const options = { tsConfigFile: "./options-tsconfig.json" };
        const loaderOptions = { tsConfigFile: "./loader-tsconfig.json" };

        const testObj = new CompilerTestClass(options, loaderOptions);

        expect(testObj.getOptions().tsConfigFile).toMatch(/loader-tsconfig\.json$/);
    });

    it("allows loaderOptions.config properties to override options.config properties", () => {
        const options = {
            buildDir: "./src",
            config: {
                addons: ["options-addon"],
                addonsDir: "./options-addons",
                transpileOnly: false,
            },
        };
        const loaderOptions = {
            config: {
                addons: ["loader-addon"],
                addonsDir: "./loader-addons",
            },
            transpileOnly: true,
        };

        const testObj = new CompilerTestClass(options, loaderOptions);

        expect(testObj.getOptions().config?.addons).toEqual(["loader-addon"]);
        expect(testObj.getOptions().config?.addonsDir).toMatch(/loader-addons$/);
        expect(testObj.getOptions().config?.transpileOnly).toBe(true);
    });

    it("allows loaderOptions.tsConfig properties to override options.tsConfig properties", () => {
        const options = {
            buildDir: "./src",
            tsConfig: {
                target: ts.ScriptTarget.ES5,
                module: ts.ModuleKind.CommonJS,
                strict: false,
            },
        };
        const loaderOptions = {
            tsConfig: {
                target: ts.ScriptTarget.ES2020,
                strict: true,
            },
        };

        const testObj = new CompilerTestClass(options, loaderOptions);

        expect(testObj.getOptions().tsConfig?.target).toBe(ts.ScriptTarget.ES2020);
        expect(testObj.getOptions().tsConfig?.module).toBe(ts.ModuleKind.CommonJS); // should remain from options
        expect(testObj.getOptions().tsConfig?.strict).toBe(true);
    });

    it("uses options properties when corresponding loaderOptions properties are not provided", () => {
        const options = {
            buildDir: "./src",
            debug: true,
            profile: "test-profile",
            configFile: "./test-config.json",
            reporter: new NoReporter(),
        };
        const loaderOptions = { transpileOnly: true }; // only transpileOnly provided

        const testObj = new CompilerTestClass(options, loaderOptions);

        expect(testObj.getOptions().debug).toBe(true);
        expect(testObj.getOptions().profile).toBe("test-profile");
        expect(testObj.getOptions().configFile).toMatch(/test-config\.json$/);
        expect(testObj.getOptions().config?.transpileOnly).toBe(true);
    });

    describe("Configuration Path Resolution", () => {
        it("uses default values when buildDir, tsConfigFile, and configFile are not specified", () => {
            const testObj = new CompilerTestClass({});

            expect(path.isAbsolute(testObj.getOptions().buildDir)).toBe(true);
            expect(testObj.getOptions().tsConfigFile).toBe(`${testObj.getOptions().buildDir}/tsconfig.json`);
            expect(testObj.getOptions().configFile).toBe(`${testObj.getOptions().buildDir}/websmith.config.json`);
        });

        it("derives tsConfigFile and configFile from buildDir when only buildDir is specified", () => {
            const testObj = new CompilerTestClass({
                buildDir: "./custom-src",
                reporter: new NoReporter(),
            });

            expect(testObj.getOptions().buildDir).toMatch(/custom-src$/);
            expect(testObj.getOptions().tsConfigFile).toMatch(/custom-src\/tsconfig\.json$/);
            expect(testObj.getOptions().configFile).toMatch(/custom-src\/websmith\.config\.json$/);
        });

        it("derives buildDir and configFile from tsConfigFile dirname when only tsConfigFile is specified", () => {
            const testObj = new CompilerTestClass({
                tsConfigFile: "./custom-dir/tsconfig.json",
                reporter: new NoReporter(),
            });

            expect(testObj.getOptions().buildDir).toMatch(/custom-dir$/);
            expect(testObj.getOptions().tsConfigFile).toMatch(/custom-dir\/tsconfig\.json$/);
            expect(testObj.getOptions().configFile).toMatch(/custom-dir\/websmith\.config\.json$/);
        });

        it("derives buildDir and tsConfigFile from configFile dirname when only configFile is specified", () => {
            const testObj = new CompilerTestClass({
                configFile: "./config-dir/websmith.config.json",
                reporter: new NoReporter(),
            });

            expect(testObj.getOptions().buildDir).toMatch(/config-dir$/);
            expect(testObj.getOptions().tsConfigFile).toMatch(/config-dir\/tsconfig\.json$/);
            expect(testObj.getOptions().configFile).toMatch(/config-dir\/websmith\.config\.json$/);
        });

        it("prioritizes tsConfigFile dirname over buildDir and reports warning when they differ", () => {
            const system = createSystem({}, { virtual: true });
            const target = new ReporterMock(system);
            target.reportDiagnostic = jest.fn();

            const testObj = new CompilerTestClass({
                buildDir: "./wrong-dir",
                tsConfigFile: "./correct-dir/tsconfig.json",
                configFile: "./another-dir/websmith.config.json",
                reporter: target,
            });

            expect(testObj.getOptions().buildDir).toMatch(/correct-dir$/);
            expect(testObj.getOptions().tsConfigFile).toMatch(/correct-dir\/tsconfig\.json$/);
            expect(testObj.getOptions().configFile).toMatch(/another-dir\/websmith\.config\.json$/);
            expect(target.reportDiagnostic).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining('Using "tsConfigFile" directory as "buildDir".'),
                })
            );
        });

        it("allows configFile to be in different location from buildDir and tsConfigFile", () => {
            const testObj = new CompilerTestClass({
                buildDir: "./target",
                tsConfigFile: "./target/tsconfig.json",
                configFile: "./config/websmith.config.json",
                reporter: new NoReporter(),
            });

            expect(testObj.getOptions().buildDir).toMatch(/target$/);
            expect(testObj.getOptions().tsConfigFile).toMatch(/target\/tsconfig\.json$/);
            expect(testObj.getOptions().configFile).toMatch(/config\/websmith\.config\.json$/);
        });

        it("resolves paths correctly when buildDir and tsConfigFile are in same directory", () => {
            const testObj = new CompilerTestClass({
                buildDir: "./project",
                tsConfigFile: "./project/tsconfig.json",
                reporter: new NoReporter(),
            });

            expect(testObj.getOptions().buildDir).toMatch(/project$/);
            expect(testObj.getOptions().tsConfigFile).toMatch(/project\/tsconfig\.json$/);
            expect(testObj.getOptions().configFile).toMatch(/project\/websmith\.config\.json$/);
        });

        it("handles absolute paths correctly", () => {
            const testObj = new CompilerTestClass({
                buildDir: "/absolute/src",
                tsConfigFile: "/absolute/src/tsconfig.json",
                configFile: "/different/websmith.config.json",
                reporter: new NoReporter(),
            });

            expect(testObj.getOptions().buildDir).toMatch(/absolute\/src$/);
            expect(testObj.getOptions().tsConfigFile).toMatch(/absolute\/src\/tsconfig\.json$/);
            expect(testObj.getOptions().configFile).toMatch(/different\/websmith\.config\.json$/);
        });
    });
});

describe("getSystem", () => {
    it("returns the system passed to options", () => {
        const expected = createSystem({}, { virtual: true });

        const testObj = new CompilerTestClass({ reporter: new ReporterMock(expected) }, undefined, expected);

        expect(testObj.getSystem()).toBe(expected);
    });
});

describe("setOptions", () => {
    it("replaces compiler options", () => {
        const expected = {
            tsConfig: {
                react: 1,
            },
            buildDir: "/src",
        } as unknown as Partial<CompilerOptions>;
        const target = createSystem({}, { virtual: true });
        const reporterMock = new ReporterMock(target);

        const testObj = new CompilerTestClass({ reporter: reporterMock }, undefined, target);

        testObj.setOptions(expected);

        // reporter is not set in the expected object
        const options = testObj.getOptions();
        expect(options.buildDir).toBe("/src");
        expect(options.tsConfig).toMatchObject({
            esModuleInterop: false,
            jsx: ts.JsxEmit.Preserve,
            target: ts.ScriptTarget.ES5,
        });
        expect(options.reporter).toBeInstanceOf(ReporterMock);
    });

    it("replaces compiler options with custom tsConfig", () => {
        const expected = {
            tsConfig: {
                target: ts.ScriptTarget.ESNext,
                jsx: ts.JsxEmit.React,
            },
            buildDir: "/src",
        } as unknown as Partial<CompilerOptions>;
        const target = createSystem({}, { virtual: true });
        const reporterMock = new ReporterMock(target);

        const testObj = new CompilerTestClass({ reporter: reporterMock }, undefined, target);

        testObj.setOptions(expected);

        // reporter is not set in the expected object
        const options = testObj.getOptions();
        expect(options.buildDir).toBe("/src");
        expect(options.tsConfig).toMatchObject({
            esModuleInterop: false,
            jsx: ts.JsxEmit.React,
            target: ts.ScriptTarget.ESNext,
        });
        expect(options.reporter).toBeInstanceOf(ReporterMock);
    });

    it("yields buildDir with compiler options", () => {
        const target = createSystem({ "src/target.ts": `class Target {}` }, { virtual: true });

        new CompilerTestClass(
            {
                reporter: new ReporterMock(target),
                tsConfig: { outDir: "/expected", target: ts.ScriptTarget.ESNext },
                cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
                buildDir: "./src",
            },
            undefined,
            target
        ).watch();

        expect(target.readFile("/expected/target.js")).toMatchInlineSnapshot(`
            "class Target {
            }
            "
        `);
    });
});

describe("createCompilationContext", () => {
    it("initializes the CompilationContext meeting to AddonContext API requirements", () => {
        const expected = { field: "expected-value", output: "expected-output.json" };
        const fileSystem = createSystem({}, { virtual: true });
        const target = { reporter: new ReporterMock(fileSystem), buildDir: "./src" };

        const actual = new CompilerTestClass(
            {
                ...target,
                configFile: "./expected/websmith.config.json",
                config: {
                    profiles: {
                        "target-profile": {
                            config: expected,
                        },
                    },
                },
                reporter: target.reporter,
            },
            undefined,
            fileSystem
        ).createCompilationContext("target-profile");

        expect(actual).toMatchObject({
            cliArgs: {
                errors: [],
                fileNames: [],
                options: {
                    target: ts.ScriptTarget.ES5,
                },
            },
            config: {
                field: "expected-value",
                output: "expected-output.json",
            },
            projectDir: "/expected",
        });

        expect(actual.getLanguageHost()).toBeDefined();
        expect(actual.getSystem()).toBeDefined();
        expect(actual.getReporter()).toStrictEqual(target.reporter);
        expect(actual.getProfileConfig()).toStrictEqual(expected);
    });

    it("initializes the CompilationContext with tsconfig.json meeting to AddonContext API requirements", () => {
        const expected = { field: "expected-value", output: "expected-output.json" };
        const fileSystem = createSystem(
            {
                "./expected/tsconfig.json": `
                {
                    "include": ["**/*.ts"],
                    "compilerOptions": {
                        "module": "ESNext",
                        "target": "ESNext"
                    }
                }
                `,
                "./expected/src/test.ts": `export const test = "test";`,
            },
            { virtual: true }
        );
        const target = { reporter: new ReporterMock(fileSystem), buildDir: "./src" };

        const actual = new CompilerTestClass(
            {
                ...target,
                configFile: "./expected/websmith.config.json",
                tsConfigFile: "./expected/tsconfig.json",
                config: {
                    profiles: {
                        "target-profile": {
                            config: expected,
                        },
                    },
                },
                buildDir: "./src",
            },
            undefined,
            fileSystem
        ).createCompilationContext("target-profile");

        expect(actual).toMatchObject({
            ResultProcessors: [],
            generators: [],
            processors: [],
            transformers: {},
            rootFiles: ["/expected/src/test.ts"],
            cliArgs: {
                compileOnSave: false,
                errors: [],
                fileNames: ["/expected/src/test.ts"],
                options: {
                    configFilePath: "/expected/tsconfig.json",
                    module: ts.ModuleKind.ESNext,
                    target: ts.ScriptTarget.ESNext,
                },
                projectReferences: undefined,
                raw: {
                    include: ["**/*.ts"],
                },
                typeAcquisition: {
                    enable: false,
                    exclude: [],
                    include: [],
                },
                watchOptions: undefined,
                wildcardDirectories: {
                    "/expected": 1,
                },
            },
            config: {
                field: "expected-value",
                output: "expected-output.json",
            },
            projectDir: "/expected",
        });

        expect(actual.getLanguageHost()).toBeDefined();
        expect(actual.getSystem()).toBeDefined();
        expect(actual.getReporter()).toStrictEqual(target.reporter);
        expect(actual.getProfileConfig()).toStrictEqual(expected);
    });
});

describe("compile", () => {
    it("calls report", () => {
        const fileSystem = createSystem({}, { virtual: true });

        const testObj = new CompilerTestClass({ reporter: new ReporterMock(fileSystem) }, undefined, fileSystem);
        testObj.report = jest.fn();

        testObj.compile();

        expect(testObj.report).toHaveBeenCalled();
    });

    it("updates the CompilerOptions with the target specific overrides", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const target = { reporter: new ReporterMock(fileSystem), config: { profiles: { "target-profile": {} } }, buildDir: "./src" };

        const testObj = new CompilerTestClass(target, undefined, fileSystem).setOptions({
            ...target,
            config: {
                ...target.config,
                profiles: {
                    "target-profile": {
                        tsConfig: { outDir: "./lib/expected" },
                    },
                },
            },
            profile: "target-profile",
        });

        testObj.compile();

        expect(testObj.getContext("target-profile")?.getCliArgs().options).toEqual(
            expect.objectContaining({
                allowJs: false,
                checkJs: false,
                configFilePath: "/src/tsconfig.json",
                declaration: false,
                declarationMap: false,
                emitDecorationOnly: false,
                esModuleInterop: false,
                jsx: ts.JsxEmit.Preserve,
                noEmit: false,
                outDir: "/lib/expected",
                pretty: true,
                removeComments: false,
                strict: false,
                target: ts.ScriptTarget.ES5,
            })
        );
    });

    it("yields output w/ with defaults", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });

        new CompilerTestClass(
            { reporter: new ReporterMock(fileSystem), tsConfig: { target: ts.ScriptTarget.ESNext } },
            undefined,
            fileSystem
        ).compile();

        expect(fileSystem.readFile("/src/target.js")).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
    });

    it("yields output w/ with addons but w/o profiles", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });

        new CompilerTestClass(
            {
                buildDir: "./src",
                reporter: new ReporterMock(fileSystem),
                debug: false,
                watch: false,
                tsConfig: {
                    module: ts.ModuleKind.ESNext,
                    target: ts.ScriptTarget.Latest,
                    configFilePath: "./tsconfig.json",
                },
                cliArgs: {
                    options: {},
                    fileNames: fileSystem.readDirectory("./src"),
                    errors: [],
                },
            },
            undefined,
            fileSystem
        ).compile();

        expect(fileSystem.readFile("/src/target.js")).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
    });
});

describe("emitSourceFile", () => {
    it("yields modified client function w/ annotated arrow function", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: true, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/target.ts", undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getText("target.d.ts", actual)).toMatchInlineSnapshot(`
            "export declare const computeDate: () => Promise<Date>;
            "
        `);
    });

    it("yields modified client function w/ annotated arrow function2", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: true, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/target.ts", undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getText("target.d.ts", actual)).toMatchInlineSnapshot(`
            "export declare const computeDate: () => Promise<Date>;
            "
        `);
    });

    it("yields modified client function, no declaration, no sourceMap w/ transpileOnly", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: false, sourceMap: false, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            config: { transpileOnly: true },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/target.ts", undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map", ".js.map")).toHaveLength(0);
    });

    it("yields modified client function, no declaration, no declaration map, no sourceMap w/ transpileOnly and declaration", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: true, declarationMap: false, sourceMap: false, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            config: { transpileOnly: true },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/target.ts", undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map", ".js.map")).toHaveLength(0);
    });

    it("yields modified client function, no declaration, no declaration map, no sourceMap w/ transpileOnly, declaration and declarationMap", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: true, declarationMap: true, sourceMap: false, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            config: { transpileOnly: true },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/target.ts", undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map", ".js.map")).toHaveLength(0);
    });

    it("yields modified client function, no declaration, sourceMap w/ transpileOnly and sourceMap", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: false, declarationMap: false, sourceMap: true, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            config: { transpileOnly: true },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/target.ts", undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            //# sourceMappingURL=target.js.map"
        `);
        expect(getText("target.js.map", actual)).toMatchInlineSnapshot(
            `"{"version":3,"file":"target.js","sourceRoot":"","sources":["target.ts"],"names":[],"mappings":"AAAA,MAAM,CAAC,MAAM,WAAW,GAAG,KAAK,IAAmB,EAAE,CAAC,IAAI,IAAI,EAAE,CAAC"}"`
        );
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map")).toHaveLength(0);
    });

    it("yields modified client function, no declaration, no sourceMap w/ no transpileOnly", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: false, sourceMap: false, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/target.ts", undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map", ".js.map")).toHaveLength(0);
    });

    it("yields modified client function, declaration, no declaration map, no sourceMap w/ no transpileOnly and declaration", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: true, declarationMap: false, sourceMap: false, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/target.ts", undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getText("target.d.ts", actual)).toMatchInlineSnapshot(`
            "export declare const computeDate: () => Promise<Date>;
            "
        `);
        expect(getFilesByExtension(actual, ".d.ts.map", ".js.map")).toHaveLength(0);
    });

    it("yields modified client function, declaration, declaration map, no sourceMap w/ no transpileOnly, declaration and declarationMap", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: true, declarationMap: true, sourceMap: false, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/target.ts", undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getText("target.d.ts", actual)).toMatchInlineSnapshot(`
            "export declare const computeDate: () => Promise<Date>;
            //# sourceMappingURL=target.d.ts.map"
        `);
        expect(getText("target.d.ts.map", actual)).toMatchInlineSnapshot(
            `"{"version":3,"file":"target.d.ts","sourceRoot":"","sources":["target.ts"],"names":[],"mappings":"AAAA,eAAO,MAAM,WAAW,QAAa,OAAO,CAAC,IAAI,CAAe,CAAC"}"`
        );
        expect(getFilesByExtension(actual, ".js.map")).toHaveLength(0);
    });

    it("yields modified client function, no declaration, sourceMap w/ no transpileOnly and sourceMap", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: false, declarationMap: false, sourceMap: true, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/target.ts", undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            //# sourceMappingURL=target.js.map"
        `);
        expect(getText("target.js.map", actual)).toMatchInlineSnapshot(
            `"{"version":3,"file":"target.js","sourceRoot":"","sources":["target.ts"],"names":[],"mappings":"AAAA,MAAM,CAAC,MAAM,WAAW,GAAG,KAAK,IAAmB,EAAE,CAAC,IAAI,IAAI,EAAE,CAAC"}"`
        );
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map")).toHaveLength(0);
    });

    it("yields transpiled client function w/ transpileOnly", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: false, declarationMap: false, sourceMap: false, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            config: { transpileOnly: true },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/target.ts", undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map", ".js.map")).toHaveLength(0);
    });

    it("yields transpiled client function w/o transpileOnly", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: false, declarationMap: false, sourceMap: false, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/target.ts", undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map", ".js.map")).toHaveLength(0);
    });

    it("yields transpiled json w/ transpileOnly", () => {
        const fileSystem = createSystem({ "src/config.json": `{"name":"test"}` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: {
                declaration: false,
                declarationMap: false,
                sourceMap: true,
                resolveJsonModule: true,
                outDir: "/build",
                configFilePath: "tsconfig.json",
            },
            cliArgs: { fileNames: ["/src/config.json"], options: {}, errors: [] },
            config: { transpileOnly: true },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/config.json", undefined, false);

        expect(getText("config.json", actual)).toMatchInlineSnapshot(`"{"name":"test"}"`);
    });

    it("yields transpiled json w/o transpileOnly", () => {
        const fileSystem = createSystem({ "src/config.json": `{"name":"test"}` }, { virtual: true });
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: {
                declaration: false,
                declarationMap: false,
                sourceMap: true,
                resolveJsonModule: true,
                outDir: "/build",
            },
            cliArgs: { fileNames: ["src/config.json"], options: {}, errors: [] },
            buildDir: "./src",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/config.json", undefined, false);

        expect(getText("config.json", actual)).toMatchInlineSnapshot(`
            "{ "name": "test" }
            "
        `);
    });

    it("yields transpiled d.ts w/ transpileOnly", () => {
        const fileSystem = createSystem(
            { "types/style.d.ts": `declare module "*.scss" { const content: Record<exportName, string[]>; export = content; }` },
            { virtual: true }
        );
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: {
                declaration: false,
                declarationMap: false,
                sourceMap: true,
                resolveJsonModule: true,
                outDir: "/build",
                importHelpers: true,
                strict: true,
            },
            cliArgs: { fileNames: ["types/style.d.ts"], options: {}, errors: [] },
            config: { transpileOnly: true },
            buildDir: "./types",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("types/style.d.ts", undefined, false);

        expect(actual.files).toEqual([]);
    });

    it("yields transpiled d.ts w/o transpileOnly", () => {
        const fileSystem = createSystem(
            { "types/style.d.ts": `declare module "*.scss" { const content: Record<exportName, string[]>; export = content; }` },
            { virtual: true }
        );
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: {
                declaration: false,
                declarationMap: false,
                sourceMap: true,
                resolveJsonModule: true,
                outDir: "/build",
                importHelpers: true,
                strict: true,
            },
            cliArgs: { fileNames: ["types/style.d.ts"], options: {}, errors: [] },
            buildDir: "./types",
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("types/style.d.ts", undefined, false);

        expect(actual.files).toEqual([]);
    });
});

describe("report", () => {
    it("yields result's messageText", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const options = { reporter: new ReporterMock(fileSystem), buildDir: "./src" };
        const target = options.reporter;

        new CompilerTestClass(options, undefined, fileSystem).report(
            {
                getCompilerOptions: () => ({}),
                getConfigFileParsingDiagnostics: () => [],
                getGlobalDiagnostics: () => [],
                getOptionsDiagnostics: () => [],
                getSemanticDiagnostics: () => [],
                getSyntacticDiagnostics: () => [],
            } as any,
            {
                diagnostics: [{ messageText: "expected message1", file: "whatever.ts" }],
            } as any
        );

        expect(target.message).toBe("Error: expected message1\n");
    });

    it("yields program's messageText", () => {
        const fileSystem = createSystem({}, { virtual: true });
        const options = { reporter: new ReporterMock(fileSystem), buildDir: "./src" };
        const target = options.reporter;

        new CompilerTestClass(options, undefined, fileSystem).report(
            {
                getCompilerOptions: () => ({}),
                getConfigFileParsingDiagnostics: () => [{ messageText: "expected message1", file: "whatever.ts" }],
                getGlobalDiagnostics: () => [{ messageText: "expected message2", file: "whatever.ts" }],
                getOptionsDiagnostics: () => [{ messageText: "expected message3", file: "whatever.ts" }],
                getSemanticDiagnostics: () => [{ messageText: "expected message4", file: "whatever.ts" }],
                getSyntacticDiagnostics: () => [{ messageText: "expected message5", file: "whatever.ts" }],
            } as any,
            {
                diagnostics: [],
            } as any
        );
        expect(target.message).toBe(
            "Error: expected message1\nError: expected message2\nError: expected message3\nError: expected message4\nError: expected message5\n"
        );
    });

    it("yields emitSkipped true", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });

        const actual = new CompilerTestClass({ reporter: new ReporterMock(fileSystem) }, undefined, fileSystem).report(
            {
                getCompilerOptions: () => ({}),
                getConfigFileParsingDiagnostics: () => [],
                getGlobalDiagnostics: () => [],
                getOptionsDiagnostics: () => [],
                getSemanticDiagnostics: () => [],
                getSyntacticDiagnostics: () => [],
            } as any,
            {
                diagnostics: [],
                emitSkipped: true,
            } as any
        );

        expect(actual.emitSkipped).toBe(true);
    });
});

describe("watch", () => {
    it("should output to buildDir w/o outDir override", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const options = {
            reporter: new ReporterMock(fileSystem),
            config: {
                profiles: {
                    target1: { tsConfig: { outDir: "/target1", declaration: true } },
                    target2: {
                        depends: ["target1"],
                        tsConfig: { outDir: "/target2", declaration: true },
                    },
                },
            },
            tsConfig: { declaration: true, outDir: "/build", target: ts.ScriptTarget.ESNext },
            watch: true,
            profile: "target2",
            buildDir: "./src",
            cliArgs: {
                fileNames: ["/src/target.ts"],
                options: { configFilePath: "/project/tsconfig.json" },
                errors: [],
                compileOnSave: false,
                projectReferences: undefined,
                raw: {},
                typeAcquisition: {
                    enable: false,
                    exclude: [],
                    include: [],
                },
            },
        };

        const testObj = new Compiler(options, undefined, fileSystem);

        testObj.watch();

        expect(fileSystem.readFile("/target1/target.js")).toMatchInlineSnapshot(`
        "export const computeDate = async () => new Date();
        "
        `);
        expect(fileSystem.readFile("/target1/target.d.ts")).toMatchInlineSnapshot(`
        "export declare const computeDate: () => Promise<Date>;
        "
        `);
        expect(fileSystem.readFile("/target2/target.js")).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(fileSystem.readFile("/target2/target.d.ts")).toMatchInlineSnapshot(`
            "export declare const computeDate: () => Promise<Date>;
            "
        `);

        testObj.closeAllWatchers();
    });

    it("should output to outDir w/ target outDir override", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const options = {
            reporter: new ReporterMock(fileSystem),
            config: {
                profiles: { target: { tsConfig: { outDir: "/build", declaration: true } } },
            },
            tsConfig: { declaration: true, target: ts.ScriptTarget.ESNext },
            cliArgs: {
                options: { outDir: "/build", configFilePath: "/project/tsconfig.json" },
                fileNames: ["/src/target.ts"],
                errors: [],
                compileOnSave: false,
                projectReferences: undefined,
                raw: {},
                typeAcquisition: {
                    enable: false,
                    exclude: [],
                    include: [],
                },
                watchOptions: undefined,
                wildcardDirectories: { "/": 1 },
            },
            watch: true,
            profile: "target",
            buildDir: "./src",
        };

        const testObj = new Compiler(options, undefined, fileSystem);

        testObj.watch();

        expect(fileSystem.readFile("/build/target.js")).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(fileSystem.readFile("/build/target.d.ts")).toMatchInlineSnapshot(`
            "export declare const computeDate: () => Promise<Date>;
            "
        `);

        testObj.closeAllWatchers();
    });

    it("should output to multiple profiles outDir w/ dependent profiles and outDir override", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const options = {
            reporter: new ReporterMock(fileSystem),
            config: {
                profiles: {
                    target1: { tsConfig: { outDir: "/target1", declaration: true } },
                    target2: {
                        depends: ["target1"],
                        tsConfig: { outDir: "/target2", declaration: true },
                    },
                },
            },
            tsConfig: { declaration: false, target: ts.ScriptTarget.ESNext },
            cliArgs: {
                options: { outDir: "/build", configFilePath: "/project/tsconfig.json" },
                fileNames: ["/src/target.ts"],
                errors: [],
                compileOnSave: false,
                projectReferences: undefined,
                raw: {},
                typeAcquisition: {
                    enable: false,
                    exclude: [],
                    include: [],
                },
                watchOptions: undefined,
                wildcardDirectories: { "/": 1 },
            },
            watch: true,
            profile: "target2",
            buildDir: "./src",
        };

        const testObj = new Compiler(options, undefined, fileSystem);

        testObj.watch();

        expect(fileSystem.readFile("/target1/target.js")).toMatchInlineSnapshot(`
        "export const computeDate = async () => new Date();
        "
        `);
        expect(fileSystem.readFile("/target1/target.d.ts")).toMatchInlineSnapshot(`
        "export declare const computeDate: () => Promise<Date>;
        "
        `);
        expect(fileSystem.readFile("/target2/target.js")).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(fileSystem.readFile("/target2/target.d.ts")).toMatchInlineSnapshot(`
            "export declare const computeDate: () => Promise<Date>;
            "
        `);

        testObj.closeAllWatchers();
    });

    it("should output to multiple profiles outDir w/ dependent profiles, transpileOnly and outDir override", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const options = {
            reporter: new ReporterMock(fileSystem),
            config: {
                profiles: {
                    target1: { tsConfig: { outDir: "/target1" } },
                    target2: {
                        depends: ["target1"],
                        tsConfig: { outDir: "/target2", declaration: false },
                    },
                },
                transpileOnly: true,
            },
            tsConfig: { declaration: true, target: ts.ScriptTarget.ESNext },
            cliArgs: {
                options: { outDir: "/build", configFilePath: "/project/tsconfig.json" },
                fileNames: ["/src/target.ts"],
                errors: [],
                compileOnSave: false,
                projectReferences: undefined,
                raw: {},
                typeAcquisition: {
                    enable: false,
                    exclude: [],
                    include: [],
                },
                watchOptions: undefined,
                wildcardDirectories: { "/": 1 },
            },
            watch: true,
            profile: "target2",
            buildDir: "./src",
        };

        const testObj = new Compiler(options, undefined, fileSystem);

        testObj.watch();

        expect(fileSystem.readFile("/target1/target.js")).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(fileSystem.readFile("/target2/target.js")).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
            `);
    });

    it("yields multiple code transpilations w/ a shared asset dependency", () => {
        const target = jest.fn();
        const fileSystem = createSystem(
            {
                "src/shared.scss": `
                {
                    .shared {
                        display: none;
                    }
                }
            `,
                "src/shared1.ts": `
                import "./shared.scss";
                
                @customElement("shared-one")
                export class Shared1 {}
            `,
                "src/shared2.ts": `
                import "./shared.scss";
                
                @customElement("shared-two")
                export class Shared2 {}
            `,
            },
            { virtual: true }
        );

        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                config: {
                    profiles: {
                        target1: { tsConfig: { outDir: "/target1" } },
                    },
                },
                tsConfig: { declaration: true },
                cliArgs: {
                    options: { outDir: "/build", configFilePath: "/project/tsconfig.json" },
                    fileNames: ["/src/shared1.ts", "/src/shared2.ts"],
                    errors: [],
                    compileOnSave: false,
                    projectReferences: undefined,
                    raw: {},
                    typeAcquisition: {
                        enable: false,
                        exclude: [],
                        include: [],
                    },
                    watchOptions: undefined,
                    wildcardDirectories: { "/": 1 },
                },
                watch: true,
                profile: "target1",
                buildDir: "./src",
            },
            undefined,
            fileSystem
        );
        testObj.emitSourceFile = target;

        testObj.watch();

        testObj.getContext("target1")!.addAssetDependency("/build/shared.scss", "/src/shared1.ts");
        testObj.getContext("target1")!.addAssetDependency("/build/shared.scss", "/src/shared2.ts");

        expect(target).toHaveBeenNthCalledWith(1, "/src/shared1.ts", "target1", true);
        expect(target).toHaveBeenNthCalledWith(2, "/src/shared2.ts", "target1", true);

        target.mockClear();

        fileSystem.writeFile(
            "/build/shared.scss",
            `
                {
                    .shared {
                        display: block;
                    }
                }
            `
        );

        expect(target).toHaveBeenNthCalledWith(1, "/src/shared1.ts", "target1", true, true);
        expect(target).toHaveBeenNthCalledWith(2, "/src/shared2.ts", "target1", true, true);
    });

    it("yields a single emitSourceFile invocation per file change", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` }, { virtual: true });
        const options = {
            reporter: new ReporterMock(fileSystem),
            config: {
                profiles: {
                    target1: { tsConfig: { outDir: "/target1" } },
                },
            },
            tsConfig: { declaration: true },
            cliArgs: {
                options: { outDir: "/build", configFilePath: "/project/tsconfig.json" },
                fileNames: ["/src/target.ts"],
                errors: [],
                compileOnSave: false,
                projectReferences: undefined,
                raw: {},
                typeAcquisition: {
                    enable: false,
                    exclude: [],
                    include: [],
                },
                watchOptions: undefined,
                wildcardDirectories: { "/": 1 },
            },
            watch: true,
            profile: "target1",
            buildDir: "./src",
        };

        const testObj = new CompilerTestClass(options, undefined, fileSystem);

        const target = jest.fn();
        testObj.emitSourceFile = target;

        testObj.watch();
        target.mockClear();

        fileSystem.writeFile("/src/target.ts", `const a = 3;`);

        expect(target).toHaveBeenCalledWith("/src/target.ts", "target1", true, true);
    });
});

const complexFileExtension = (name: string): string => {
    return path.basename(name).replace(path.basename(name).split(".")[0], "");
};

const getText = (name: string, output: CompileFragment): string => {
    return output.files.find(file => file.name.endsWith(name))!.text;
};

const getFilesByExtension = (output: CompileFragment, ...extensions: string[]): ts.OutputFile[] =>
    output.files.filter(it => extensions.includes(complexFileExtension(it.name)));
