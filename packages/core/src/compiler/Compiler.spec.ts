/* eslint-disable @typescript-eslint/no-unsafe-argument */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilerOptions, type Reporter, type WebpackLoaderOptions } from "@quatico/websmith-api";
import path from "node:path";
import ts from "typescript";
import { ReporterMock } from "../../test";
import { createSystem } from "../environment";
import { AddonRegistry } from "./addons";
import { type CompilationContext } from "./compilation";
import { Compiler, type CompileFragment } from "./Compiler";
import { DefaultReporter } from "./DefaultReporter";
import { NoReporter } from "./NoReporter";
import { type ResolvedCompilerOptions } from "./options";

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

    public report(program: ts.Program | undefined, result: ts.EmitResult, profile?: string): ts.EmitResult {
        return super.report(program, result, profile);
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

    public getBaselineTranspileCache(): Map<string, string> {
        return this["baselineTranspileCache"];
    }

    public getBaselineEmitCache(): Map<string, string | undefined> {
        return this["baselineEmitCache"];
    }

    public getBaselineEmitCacheFileTimes(): Map<string, Date> {
        return this["baselineEmitCacheFileTimes"];
    }

    public testShouldSkipFile(fileName: string, ctx: CompilationContext, profile?: string): boolean {
        const activeAddons = this.addons ? this.addons.getAvailableAddons(profile) : [];
        return this.shouldSkipFile(fileName, ctx, activeAddons);
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
        it("uses default values when tsConfigFile and configFile are not specified", () => {
            const testObj = new CompilerTestClass({});

            expect(path.isAbsolute(testObj.getOptions().buildDir)).toBe(true);
            expect(testObj.getOptions().tsConfigFile).toBe(`${testObj.getOptions().buildDir}/tsconfig.json`);
            expect(testObj.getOptions().configFile).toBeUndefined();
        });

        it("derives tsConfigFile and configFile from buildDir with defaults", () => {
            const testObj = new CompilerTestClass({
                reporter: new NoReporter(),
            });

            const actual = testObj.getOptions();

            expect(actual.buildDir).toBeDefined();
            expect(actual.tsConfigFile).toEqual(`${actual.buildDir}/tsconfig.json`);
            expect(actual.configFile).toBeUndefined();
        });

        it("derives buildDir and configFile from tsConfigFile dirname when only tsConfigFile is specified", () => {
            const testObj = new CompilerTestClass({
                tsConfigFile: "./custom-dir/tsconfig.json",
                reporter: new NoReporter(),
            });

            expect(testObj.getOptions().buildDir).toMatch(/custom-dir$/);
            expect(testObj.getOptions().tsConfigFile).toMatch(/custom-dir\/tsconfig\.json$/);
            expect(testObj.getOptions().configFile).toBeUndefined();
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

        it("allows configFile to be in different location from tsConfigFile", () => {
            const testObj = new CompilerTestClass({
                tsConfigFile: "./target/tsconfig.json",
                configFile: "./config/websmith.config.json",
                reporter: new NoReporter(),
            });

            expect(testObj.getOptions().buildDir).toMatch(/target$/);
            expect(testObj.getOptions().tsConfigFile).toMatch(/target\/tsconfig\.json$/);
            expect(testObj.getOptions().configFile).toMatch(/config\/websmith\.config\.json$/);
        });

        it("resolves buildDir from tsConfigFile directory", () => {
            const testObj = new CompilerTestClass({
                tsConfigFile: "./project/tsconfig.json",
                reporter: new NoReporter(),
            });

            expect(testObj.getOptions().buildDir).toMatch(/project$/);
            expect(testObj.getOptions().tsConfigFile).toMatch(/project\/tsconfig\.json$/);
            expect(testObj.getOptions().configFile).toBeUndefined();
        });

        it("handles absolute paths correctly", () => {
            const testObj = new CompilerTestClass({
                tsConfigFile: "/absolute/src/tsconfig.json",
                configFile: "/different/websmith.config.json",
                reporter: new NoReporter(),
            });

            expect(testObj.getOptions().buildDir).toMatch(/absolute\/src$/);
            expect(testObj.getOptions().tsConfigFile).toMatch(/absolute\/src\/tsconfig\.json$/);
            expect(testObj.getOptions().configFile).toMatch(/different\/websmith\.config\.json$/);
        });
    });

    it("yields addons with addons property in configFile", () => {
        const target = createSystem(
            {
                "./websmith.config.json": JSON.stringify({ profiles: { "target-profile": { addons: ["addon1", "addon2"] } } }, null, 2),
            },
            { virtual: true }
        );

        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(target),
                configFile: "./websmith.config.json",
            },
            undefined,
            target
        );

        const actual = testObj.getOptions().getAddons("target-profile");

        expect(actual).toEqual(["addon1", "addon2"]);
    });

    it("yields addons with profile and addons property in configFile", () => {
        const target = createSystem(
            {
                "./websmith.config.json": JSON.stringify({ profiles: { "target-profile": { addons: ["addon1", "addon2"] } } }, null, 2),
            },
            { virtual: true }
        );

        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(target),
                configFile: "./websmith.config.json",
                profile: "target-profile",
            },
            undefined,
            target
        );

        const actual = testObj.getOptions().getAddons();

        expect(actual).toEqual(["addon1", "addon2"]);
    });

    it("yields addons with profile and addons property in config property", () => {
        const target = createSystem({}, { virtual: true });
        createAddon(target, "addons/expected1/addon");
        createAddon(target, "addons/expected2/addon");
        createAddon(target, "addons/expected3/addon");

        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(target),
                config: {
                    profiles: {
                        "target-profile": {
                            addons: ["expected1", "expected2"],
                        },
                        other: {
                            addons: ["expected3"],
                        },
                    },
                },
                profile: "target-profile",
            },
            undefined,
            target,
            new AddonRegistry({
                addonsDir: "addons",
                system: target,
                reporter: new ReporterMock(target),
                profiles: {
                    "target-profile": {
                        addons: ["expected1", "expected2"],
                    },
                    other: {
                        addons: ["expected3"],
                    },
                },
            })
        );

        expect(testObj.getOptions().getAddons()).toEqual(["expected1", "expected2"]);
        expect(testObj.getOptions().getAddons("target-profile")).toEqual(["expected1", "expected2"]);
        expect(testObj.getOptions().getAddons("other")).toEqual(["expected3"]);
        expect(testObj.getAddonRegistry()!.getAvailableAddons("target-profile").getNames()).toEqual(["expected1", "expected2"]);
        expect(testObj.getAddonRegistry()!.getAvailableAddons("other").getNames()).toEqual(["expected3"]);
    });

    it("yields addons without profile and addons property in config property", () => {
        const target = createSystem({}, { virtual: true });
        createAddon(target, "addons/expected1/addon");
        createAddon(target, "addons/expected2/addon");
        createAddon(target, "addons/expected3/addon");

        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(target),
                config: {
                    profiles: {
                        "target-profile": {
                            addons: ["expected1", "expected2"],
                        },
                        other: {
                            addons: ["expected3"],
                        },
                    },
                },
            },
            undefined,
            target,
            new AddonRegistry({
                addonsDir: "addons",
                system: target,
                reporter: new ReporterMock(target),
                profiles: {
                    "target-profile": {
                        addons: ["expected1", "expected2"],
                    },
                    other: {
                        addons: ["expected3"],
                    },
                },
            })
        ).createProfileContextsIfNecessary();

        expect(testObj.getOptions().getAddons()).toEqual([]);
        expect(testObj.getAddonRegistry()!.getAvailableAddons("target-profile").getNames()).toEqual(["expected1", "expected2"]);
        expect(testObj.getAddonRegistry()!.getAvailableAddons("other").getNames()).toEqual(["expected3"]);
    });

    it("yields tsConfig from profile and tsConfig property in configFile", () => {
        const target = createSystem(
            {
                "./websmith.config.json": JSON.stringify(
                    {
                        profiles: {
                            "target-profile": {
                                tsConfig: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
                            },
                        },
                    },
                    null,
                    2
                ),
            },
            { virtual: true }
        );

        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(target),
                configFile: "./websmith.config.json",
                profile: "target-profile",
            },
            undefined,
            target
        ).createProfileContextsIfNecessary();

        expect(testObj.getOptions().getOptions("target-profile").tsConfig).toMatchObject({
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ES2022,
        });

        expect(testObj.getContext("target-profile")!.getCompilerOptions()).toMatchObject({
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ES2022,
        });
    });

    it("yields tsConfig from profile and tsConfig property in config", () => {
        const target = createSystem(
            {
                "./websmith.config.json": JSON.stringify(
                    {
                        profiles: {
                            "target-profile": {
                                tsConfig: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
                            },
                        },
                    },
                    null,
                    2
                ),
            },
            { virtual: true }
        );

        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(target),
                configFile: "./websmith.config.json",
                profile: "target-profile",
            },
            undefined,
            target
        ).createProfileContextsIfNecessary();

        expect(testObj.getOptions().getOptions("target-profile").tsConfig).toMatchObject({
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ES2022,
        });

        expect(testObj.getContext("target-profile")!.getCompilerOptions()).toMatchObject({
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ES2022,
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
        } as unknown as Partial<CompilerOptions>;
        const target = createSystem({}, { virtual: true });
        const reporterMock = new ReporterMock(target);

        const testObj = new CompilerTestClass({ reporter: reporterMock }, undefined, target);

        testObj.setOptions(expected);

        // reporter is not set in the expected object
        const options = testObj.getOptions();
        expect(options.buildDir).toBe("/");
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
        } as unknown as Partial<CompilerOptions>;
        const target = createSystem({}, { virtual: true });
        const reporterMock = new ReporterMock(target);

        const testObj = new CompilerTestClass({ reporter: reporterMock }, undefined, target);

        testObj.setOptions(expected);

        // reporter is not set in the expected object
        const options = testObj.getOptions();
        expect(options.buildDir).toBe("/");
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

    it("yields addons with addons property in configFile", () => {
        const target = createSystem(
            {
                "./websmith.config.json": JSON.stringify({ profiles: { "target-profile": { addons: ["addon1", "addon2"] } } }, null, 2),
            },
            { virtual: true }
        );

        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(target),
            },
            undefined,
            target
        );

        testObj.setOptions({
            configFile: "./websmith.config.json",
        });

        const actual = testObj.getOptions().getAddons("target-profile");

        expect(actual).toEqual(["addon1", "addon2"]);
    });

    it("yields addons with profile and addons property in configFile", () => {
        const target = createSystem(
            {
                "./websmith.config.json": JSON.stringify({ profiles: { "target-profile": { addons: ["addon1", "addon2"] } } }, null, 2),
            },
            { virtual: true }
        );

        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(target),
            },
            undefined,
            target
        );

        testObj.setOptions({
            configFile: "./websmith.config.json",
            profile: "target-profile",
        });

        const actual = testObj.getOptions().getAddons();

        expect(actual).toEqual(["addon1", "addon2"]);
    });

    it("yields addons with profile and addons property in config property", () => {
        const target = createSystem({}, { virtual: true });

        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(target),
            },
            undefined,
            target
        );

        testObj.setOptions({
            config: {
                profiles: {
                    "target-profile": {
                        addons: ["addon1", "addon2"],
                    },
                },
            },
        });

        const actual = testObj.getOptions().getAddons("target-profile");

        expect(actual).toEqual(["addon1", "addon2"]);
    });

    it("yields addons with profile and addons property and addons in profile property", () => {
        const target = createSystem({}, { virtual: true });

        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(target),
            },
            undefined,
            target
        );

        testObj.setOptions({
            config: {
                addons: [],
                profiles: {
                    "target-profile": {
                        addons: ["addon1", "addon2"],
                    },
                },
            },
        });

        const actual = testObj.getOptions().getAddons("target-profile");

        expect(actual).toEqual(["addon1", "addon2"]);
    });

    it("should clear baseline transpile cache when options change (transpileOnly mode)", () => {
        const fileSystem = createSystem(
            {
                "src/target.ts": `export const test = 'hello';`,
            },
            { virtual: true }
        );

        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                tsConfig: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
                config: { transpileOnly: true, addonEmitOnly: true },
                cliArgs: { fileNames: [path.resolve("/src/target.ts")], options: {}, errors: [] },
            },
            undefined,
            fileSystem
        ).createProfileContextsIfNecessary();

        // Register transformer to trigger baseline cache usage
        const ctx = testObj.getContext();
        ctx?.registerTransformer({
            before: [_context => sourceFile => sourceFile],
        });

        // Compile file to populate cache
        testObj.emitSourceFile(path.resolve("/src/target.ts"), undefined, false);
        expect(testObj.getBaselineTranspileCache().size).toBeGreaterThan(0);

        // Change options - should clear cache
        testObj.setOptions({ tsConfig: { target: ts.ScriptTarget.ES5 } });

        expect(testObj.getBaselineTranspileCache().size).toBe(0);
    });

    it("should clear baseline emit caches when options change (full compilation mode)", () => {
        const fileSystem = createSystem(
            {
                "src/target.ts": `export const test = 'hello';`,
            },
            { virtual: true }
        );

        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                tsConfig: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, declaration: true },
                config: { transpileOnly: false, addonEmitOnly: true },
                cliArgs: { fileNames: [path.resolve("/src/target.ts")], options: {}, errors: [] },
            },
            undefined,
            fileSystem
        ).createProfileContextsIfNecessary();

        // Register transformer to trigger baseline cache usage
        const ctx = testObj.getContext();
        ctx?.registerTransformer({
            before: [_context => sourceFile => sourceFile],
        });

        // Compile file to populate caches
        testObj.emitSourceFile(path.resolve("/src/target.ts"), undefined, false);
        expect(testObj.getBaselineEmitCache().size).toBeGreaterThan(0);
        expect(testObj.getBaselineEmitCacheFileTimes().size).toBeGreaterThan(0);

        // Change options - should clear both caches
        testObj.setOptions({ tsConfig: { target: ts.ScriptTarget.ES5 } });

        expect(testObj.getBaselineEmitCache().size).toBe(0);
        expect(testObj.getBaselineEmitCacheFileTimes().size).toBe(0);
    });
});

describe("createCompilationContext", () => {
    it("initializes the CompilationContext meeting to AddonContext API requirements", () => {
        const expected = { field: "expected-value", output: "expected-output.json" };
        const fileSystem = createSystem({}, { virtual: true });
        const target = { reporter: new ReporterMock(fileSystem) };

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
        const target = { reporter: new ReporterMock(fileSystem) };

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
            },
            undefined,
            fileSystem
        ).createCompilationContext("target-profile");

        expect(actual).toMatchObject({
            resultProcessors: [],
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
        const target = { reporter: new ReporterMock(fileSystem), config: { profiles: { "target-profile": {} } } };

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

        expect(testObj.getContext("target-profile")?.getCompilerOptions()).toEqual(
            expect.objectContaining({
                allowJs: false,
                checkJs: false,
                configFilePath: "/tsconfig.json",
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
            {
                reporter: new ReporterMock(fileSystem),
                tsConfig: { target: ts.ScriptTarget.ESNext },
                cliArgs: { fileNames: ["src/target.ts"], options: {}, errors: [] },
            },
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
            tsConfig: { declaration: false, declarationMap: false, sourceMap: false, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            config: { transpileOnly: true },
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
            tsConfig: { declaration: false, declarationMap: false, sourceMap: false, target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            config: { transpileOnly: true },
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
        };

        const actual = new CompilerTestClass(target, undefined, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/config.json", undefined, false);

        expect(getText("config.json", actual)).toMatchInlineSnapshot(`"{"name":"test"}"`);
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
        const options = { reporter: new ReporterMock(fileSystem) };
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

describe("watch w/ esm profile", () => {
    const REQUIRE_SOURCE = `declare const require: (id: string) => unknown;\nexport const x = require("x");`;

    const createWatchCompiler = (fileSystem: ts.System, reporter: Reporter, tsConfig: ts.CompilerOptions = { module: ts.ModuleKind.ESNext }) =>
        new CompilerTestClass(
            {
                reporter,
                config: { profiles: { client: { esm: { runtime: "node" } } } },
                profile: "client",
                watch: true,
                tsConfig: { target: ts.ScriptTarget.ESNext, sourceMap: false, ...tsConfig },
                cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            },
            undefined,
            fileSystem
        );

    it("reports ESM diagnostic w/ rebuild introducing require", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "export const x = 1;" },
            { virtual: true }
        );
        const reporter = new ReporterMock(fileSystem);
        const target = jest.spyOn(reporter, "reportDiagnostic");
        const testObj = createWatchCompiler(fileSystem, reporter).watch();

        fileSystem.writeFile("/src/target.ts", REQUIRE_SOURCE);
        const actual = target.mock.calls.map(([cur]) => cur.code);

        expect(actual).toEqual([91001]);
        testObj.closeAllWatchers();
    });

    it("reports ESM diagnostic w/ initial watch build of file with require", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": REQUIRE_SOURCE }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const target = jest.spyOn(reporter, "reportDiagnostic");

        const testObj = createWatchCompiler(fileSystem, reporter).watch();
        const actual = target.mock.calls.map(([cur]) => cur.code);

        expect(actual).toEqual([91001]);
        testObj.closeAllWatchers();
    });

    it("reports ESM diagnostic w/ rebuild of dependent file after asset change", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "export const x = 1;", "src/style.css": ".a {}" },
            { virtual: true }
        );
        const reporter = new ReporterMock(fileSystem);
        const testObj = createWatchCompiler(fileSystem, reporter).watch();
        testObj.getContext("client")!.addAssetDependency("/src/style.css", "/src/target.ts");
        fileSystem.writeFile("/src/target.ts", REQUIRE_SOURCE);
        const target = jest.spyOn(reporter, "reportDiagnostic");

        fileSystem.writeFile("/src/style.css", ".a { display: none; }");
        const actual = target.mock.calls.map(([cur]) => cur.code);

        expect(actual).toEqual([91001]);
        testObj.closeAllWatchers();
    });

    it("names no addon w/ rebuild from content changed by addon to own require", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "// @marker\nexport const x = 1;" },
            { virtual: true }
        );
        fileSystem.createDirectory("./addons");
        const reporter = new ReporterMock(fileSystem);
        const addons = new AddonRegistry({ addonsDir: "./addons", reporter, system: fileSystem });
        const markerAddon = {
            getName: () => "marker-addon",
            needsTypeInfo: false,
            activate: (ctx: CompilationContext) =>
                ctx.registerProcessor((_fileName, content) => (content.includes("@marker") ? content.replace("@marker", "@marked") : content)),
        };
        addons.getAvailableAddons = jest.fn().mockReturnValue([markerAddon]);
        addons.getAddonByName = jest.fn().mockReturnValue(markerAddon);
        const testObj = new CompilerTestClass(
            {
                reporter,
                config: { profiles: { client: { esm: { runtime: "node" }, addons: ["marker-addon"] } } },
                profile: "client",
                watch: true,
                tsConfig: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, sourceMap: false },
                cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            },
            undefined,
            fileSystem
        )
            .setAddonRegistry(addons)
            .watch();
        const target = jest.spyOn(reporter, "reportDiagnostic");

        fileSystem.writeFile("/src/target.ts", REQUIRE_SOURCE);
        const actual = target.mock.calls.map(([cur]) => cur.messageText);

        expect(actual).toEqual([expect.stringMatching(/\(profile "client"\)\.$/)]);
        testObj.closeAllWatchers();
    });

    it("keeps watching w/ rebuild reporting ESM diagnostic", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "export const x = 1;" },
            { virtual: true }
        );
        const testObj = createWatchCompiler(fileSystem, new ReporterMock(fileSystem)).watch();
        fileSystem.writeFile("/src/target.ts", REQUIRE_SOURCE);

        fileSystem.writeFile("/src/target.ts", "export const x = 2;");
        const actual = fileSystem.readFile("/src/target.js");

        expect(actual).toBe("export const x = 2;\n");
        testObj.closeAllWatchers();
    });

    it("reports one config error and no ESM diagnostic w/ CommonJS module and rebuild introducing require", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "export const x = 1;" },
            { virtual: true }
        );
        const reporter = new ReporterMock(fileSystem);
        const target = jest.spyOn(reporter, "reportDiagnostic");
        const testObj = createWatchCompiler(fileSystem, reporter, { module: ts.ModuleKind.CommonJS }).watch();

        fileSystem.writeFile("/src/target.ts", REQUIRE_SOURCE);
        const actual = target.mock.calls.map(([cur]) => cur.messageText);

        expect(actual).toEqual([expect.stringMatching(/^Profile 'client' sets 'esm', but its effective 'module' is 'CommonJS'/)]);
        testObj.closeAllWatchers();
    });
});

describe("addon error reporting", () => {
    it("should report generator errors and continue processing", () => {
        const mockAddon = {
            getName: () => "test-generator-addon",
            activate: (ctx: CompilationContext) => {
                ctx.registerGenerator((_fileName: string, _content: string) => {
                    throw new Error("Generator failed with test error");
                });
            },
        };
        const system = createSystem({ "test-file.ts": "export const test = 'hello';" }, { virtual: true });
        system.createDirectory("./addons");
        const target = new ReporterMock(system);
        target.reportDiagnostic = jest.fn();
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter: target,
            system: system,
        });
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([mockAddon]);

        new CompilerTestClass(
            {
                reporter: target,
                cliArgs: { fileNames: ["test-file.ts"], options: { transpileOnly: true }, errors: [] },
                config: { addons: ["test-generator-addon"] },
            },
            undefined,
            system
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary()
            .emitSourceFile("test-file.ts");

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining("Error in generator"),
            })
        );
    });

    it("should report processor errors and continue processing", () => {
        const mockAddon = {
            getName: () => "test-processor-addon",
            activate: (ctx: CompilationContext) => {
                ctx.registerProcessor((_fileName: string, _content: string) => {
                    throw new Error("Processor failed with test error");
                });
            },
        };
        const system = createSystem({ "test-file.ts": "export const test = 'hello';" }, { virtual: true });
        system.createDirectory("./addons");
        const target = new ReporterMock(system);
        target.reportDiagnostic = jest.fn();
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter: target,
            system: system,
        });
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([mockAddon]);

        new CompilerTestClass(
            {
                reporter: target,
                cliArgs: { fileNames: ["test-file.ts"], options: { transpileOnly: true }, errors: [] },
                config: { addons: ["test-processor-addon"] },
            },
            undefined,
            system
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary()
            .emitSourceFile("test-file.ts");

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining("Error in processor"),
            })
        );
    });

    it("should report result processor errors and continue compilation", () => {
        const mockAddon = {
            getName: () => "test-result-processor-addon",
            activate: (ctx: CompilationContext) => {
                ctx.registerResultProcessor(() => {
                    throw new Error("Result processor failed with test error");
                });
            },
        };
        const system = createSystem({ "test-file.ts": "export const test = 'hello';" }, { virtual: true });
        system.createDirectory("./addons");
        const target = new ReporterMock(system);
        target.reportDiagnostic = jest.fn();
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter: target,
            system: system,
        });
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([mockAddon]);

        new CompilerTestClass(
            {
                reporter: target,
                cliArgs: { fileNames: ["test-file.ts"], options: { transpileOnly: true }, errors: [] },
                config: { addons: ["test-result-processor-addon"] },
            },
            undefined,
            system
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary()
            .compile();

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining("Error in result processor"),
            })
        );
    });

    it("should handle addon activation errors gracefully", () => {
        const mockAddon = {
            getName: () => "test-failing-addon",
            activate: () => {
                throw new Error("Addon activation failed");
            },
        };
        const system = createSystem({ "test-file.ts": "export const test = 'hello';" }, { virtual: true });
        system.createDirectory("./addons");
        const target = new ReporterMock(system);
        target.reportDiagnostic = jest.fn();
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter: target,
            system: system,
        });
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([mockAddon]);

        new CompilerTestClass(
            {
                reporter: target,
                config: { addons: ["test-failing-addon"] },
            },
            undefined,
            system
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary();

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining("Error activating addon"),
            })
        );
    });

    it("should handle transformer errors during transpilation", () => {
        const mockAddon = {
            getName: () => "test-transformer-addon",
            activate: (ctx: CompilationContext) => {
                ctx.registerTransformer({
                    before: [
                        (_context: ts.TransformationContext) => {
                            return (_sourceFile: ts.SourceFile) => {
                                // This transformer will cause an error during transpilation
                                throw new Error("Transformer failed during execution");
                            };
                        },
                    ],
                });
            },
        };
        const system = createSystem({ "test-file.ts": "export const test = 'hello';" }, { virtual: true });
        system.createDirectory("./addons");
        const target = new ReporterMock(system);
        target.reportDiagnostic = jest.fn();
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter: target,
            system: system,
        });
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([mockAddon]);

        const actual = new CompilerTestClass(
            {
                reporter: target,
                cliArgs: { fileNames: ["test-file.ts"], options: { transpileOnly: true }, errors: [] },
                config: { addons: ["test-transformer-addon"] },
            },
            undefined,
            system
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary()
            .emitSourceFile("test-file.ts");

        // Transformer errors should be caught and reported
        expect(actual).toBeDefined();
        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining("Error during transpilation"),
            })
        );
    });

    it("should handle complex transformer scenarios with error recovery", () => {
        const mockAddon = {
            getName: () => "test-complex-transformer-addon",
            activate: (ctx: CompilationContext) => {
                ctx.registerTransformer({
                    before: [
                        (context: ts.TransformationContext) => {
                            return (sourceFile: ts.SourceFile): ts.SourceFile => {
                                // Transform that modifies the AST but may cause issues
                                const visitor = (node: ts.Node): ts.Node => {
                                    if (ts.isIdentifier(node) && node.text === "test") {
                                        // Create a potentially problematic transformation
                                        return context.factory.createIdentifier("transformedTest");
                                    }
                                    return ts.visitEachChild(node, visitor, context);
                                };
                                return ts.visitNode(sourceFile, visitor, ts.isSourceFile);
                            };
                        },
                    ],
                });
            },
        };
        const system = createSystem(
            {
                "test-file.ts": "export const test = 'hello'; const anotherTest = test;",
            },
            { virtual: true }
        );
        system.createDirectory("./addons");
        const target = new ReporterMock(system);
        target.reportDiagnostic = jest.fn();
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter: target,
            system: system,
        });
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([mockAddon]);

        const actual = new CompilerTestClass(
            {
                reporter: target,
                cliArgs: { fileNames: ["test-file.ts"], options: { transpileOnly: true }, errors: [] },
                config: { addons: ["test-complex-transformer-addon"] },
            },
            undefined,
            system
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary()
            .emitSourceFile("test-file.ts");

        expect(actual.files[0].text).toContain("transformedTest");
    });

    it("should report generator runtime errors and continue processing", () => {
        const mockAddon = {
            getName: () => "test-runtime-generator-addon",
            activate: (ctx: CompilationContext) => {
                ctx.registerGenerator((fileName: string, content: string) => {
                    if (fileName.includes("test")) {
                        throw new ReferenceError("Generator runtime error: undefined variable");
                    }
                    return content;
                });
            },
        };
        const system = createSystem({ "test-file.ts": "export const test = 'hello';" }, { virtual: true });
        system.createDirectory("./addons");
        const target = new ReporterMock(system);
        target.reportDiagnostic = jest.fn();
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter: target,
            system: system,
        });
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([mockAddon]);

        new CompilerTestClass(
            {
                reporter: target,
                cliArgs: { fileNames: ["test-file.ts"], options: { transpileOnly: true }, errors: [] },
                config: { addons: ["test-runtime-generator-addon"] },
            },
            undefined,
            system
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary()
            .emitSourceFile("test-file.ts");

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining(
                    `Error in generator "test-runtime-generator-addon": ReferenceError: Generator runtime error: undefined variable`
                ),
            })
        );
    });

    it("should report processor runtime errors and continue processing", () => {
        const mockAddon = {
            getName: () => "test-runtime-processor-addon",
            activate: (ctx: CompilationContext) => {
                ctx.registerProcessor((fileName: string, content: string) => {
                    if (content.includes("hello")) {
                        throw new TypeError("Processor runtime error: invalid content type");
                    }
                    return content.toUpperCase();
                });
            },
        };
        const system = createSystem({ "test-file.ts": "export const test = 'hello';" }, { virtual: true });
        system.createDirectory("./addons");
        const target = new ReporterMock(system);
        target.reportDiagnostic = jest.fn();
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter: target,
            system: system,
        });
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([mockAddon]);

        new CompilerTestClass(
            {
                reporter: target,
                cliArgs: { fileNames: ["test-file.ts"], options: { transpileOnly: true }, errors: [] },
                config: { addons: ["test-runtime-processor-addon"] },
            },
            undefined,
            system
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary()
            .emitSourceFile("test-file.ts");

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining(
                    `Error in processor "test-runtime-processor-addon": TypeError: Processor runtime error: invalid content type`
                ),
            })
        );
    });

    it("should report result processor runtime errors and continue compilation", () => {
        const mockAddon = {
            getName: () => "test-runtime-result-processor-addon",
            activate: (ctx: CompilationContext) => {
                ctx.registerResultProcessor((files: string[]) => {
                    if (files.length > 0) {
                        throw new SyntaxError("Result processor runtime error: invalid file format");
                    }
                    return files;
                });
            },
        };
        const system = createSystem({ "test-file.ts": "export const test = 'hello';" }, { virtual: true });
        system.createDirectory("./addons");
        const target = new ReporterMock(system);
        target.reportDiagnostic = jest.fn();
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter: target,
            system: system,
        });
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([mockAddon]);

        new CompilerTestClass(
            {
                reporter: target,
                cliArgs: { fileNames: ["test-file.ts"], options: { transpileOnly: true }, errors: [] },
                config: { addons: ["test-runtime-result-processor-addon"] },
            },
            undefined,
            system
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary()
            .compile();

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining(
                    `Error in result processor "test-runtime-result-processor-addon": SyntaxError: Result processor runtime error: invalid file format`
                ),
            })
        );
    });

    it("should handle multiple processor errors in sequence", () => {
        const mockAddon = {
            getName: () => "test-multiple-processor-addon",
            activate: (ctx: CompilationContext) => {
                ctx.registerProcessor((_fileName: string, _content: string) => {
                    throw new Error("First processor error");
                });
                ctx.registerProcessor((_fileName: string, _content: string) => {
                    throw new Error("Second processor error");
                });
                ctx.registerProcessor((_fileName: string, content: string) => {
                    return content + "// Successfully processed";
                });
            },
        };
        const system = createSystem({ "test-file.ts": "export const test = 'hello';" }, { virtual: true });
        system.createDirectory("./addons");
        const target = new ReporterMock(system);
        target.reportDiagnostic = jest.fn();
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter: target,
            system: system,
        });
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([mockAddon]);

        new CompilerTestClass(
            {
                reporter: target,
                cliArgs: { fileNames: ["test-file.ts"], options: { transpileOnly: true }, errors: [] },
                config: { addons: ["test-multiple-processor-addon"] },
            },
            undefined,
            system
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary()
            .emitSourceFile("test-file.ts");

        expect(target.reportDiagnostic).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                messageText: expect.stringContaining(`Error in processor "test-multiple-processor-addon": Error: First processor error`),
            })
        );
        expect(target.reportDiagnostic).toHaveBeenCalledTimes(1);
    });

    it("should handle generator errors with different error types", () => {
        const mockAddon = {
            getName: () => "test-generator-error-types-addon",
            activate: (ctx: CompilationContext) => {
                ctx.registerGenerator((fileName: string, content: string) => {
                    if (fileName.includes("syntax")) {
                        throw new SyntaxError("Generator syntax error");
                    }
                    if (fileName.includes("reference")) {
                        throw new ReferenceError("Generator reference error");
                    }
                    if (fileName.includes("type")) {
                        throw new TypeError("Generator type error");
                    }
                    return content;
                });
            },
        };
        const system = createSystem(
            {
                "syntax-file.ts": "export const syntax = 'test';",
                "reference-file.ts": "export const reference = 'test';",
                "type-file.ts": "export const type = 'test';",
            },
            { virtual: true }
        );
        system.createDirectory("./addons");
        const target = new ReporterMock(system);
        target.reportDiagnostic = jest.fn();
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter: target,
            system: system,
        });
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([mockAddon]);

        const compiler = new CompilerTestClass(
            {
                reporter: target,
                cliArgs: { fileNames: ["syntax-file.ts", "reference-file.ts", "type-file.ts"], options: { transpileOnly: true }, errors: [] },
                config: { addons: ["test-generator-error-types-addon"] },
            },
            undefined,
            system
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary();

        compiler.emitSourceFile("syntax-file.ts");
        compiler.emitSourceFile("reference-file.ts");
        compiler.emitSourceFile("type-file.ts");

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining("Generator syntax error"),
            })
        );
        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining("Generator reference error"),
            })
        );
        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining("Generator type error"),
            })
        );
    });
});

describe("addonEmitOnly mode", () => {
    it("should emit files processed by processors when addonEmitOnly is enabled", () => {
        const fileSystem = createSystem(
            {
                "src/target.ts": `export const test = () => "original";`,
            },
            { virtual: true }
        );
        const processorMock = jest.fn((fileName: string, content: string) => content.replace("original", "modified"));
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            config: { addonEmitOnly: true },
        };

        const testObj = new CompilerTestClass(target, undefined, fileSystem).createProfileContextsIfNecessary();
        const ctx = testObj.getContext();
        ctx?.registerProcessor(processorMock);

        const actual = testObj.emitSourceFile("/src/target.ts", undefined, true);

        expect(processorMock).toHaveBeenCalled();
        expect(actual.files.length).toBeGreaterThan(0);
        expect(getText("target.js", actual)).toContain("modified");
    });

    it("should not emit files not processed by addons when addonEmitOnly is enabled", () => {
        const fileSystem = createSystem(
            {
                "src/target.ts": `export const test = () => "original";`,
            },
            { virtual: true }
        );
        const writeFileSpy = jest.spyOn(fileSystem, "writeFile");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            config: { addonEmitOnly: true },
        };

        const testObj = new CompilerTestClass(target, undefined, fileSystem).createProfileContextsIfNecessary();

        testObj.emitSourceFile("/src/target.ts", undefined, true);

        // Verify that writeFile was not called (file should not be written to disk)
        expect(writeFileSpy).not.toHaveBeenCalledWith(expect.stringContaining("target.js"), expect.any(String));
    });

    it("should emit files processed by generators when addonEmitOnly is enabled", () => {
        const fileSystem = createSystem(
            {
                "src/target.ts": `export const test = () => "original";`,
            },
            { virtual: true }
        );
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            config: { addonEmitOnly: true },
        };

        const testObj = new CompilerTestClass(target, undefined, fileSystem).createProfileContextsIfNecessary();
        const ctx = testObj.getContext();
        // Generator that performs an action (addVirtualFile) which automatically marks the source file as processed
        // because it interacts with the compilation process
        const generatorMock = jest.fn((filePath: string, fileContent: string) => {
            // Create a new file, which demonstrates the generator is actually processing the source
            // This will automatically mark the source file as processed
            ctx?.addVirtualFile(filePath.replace(".ts", "-generated.ts"), fileContent);
        });
        ctx?.registerGenerator(generatorMock);

        const actual = testObj.emitSourceFile("/src/target.ts", undefined, true);

        expect(generatorMock).toHaveBeenCalled();
        expect(actual.files.length).toBeGreaterThan(0);
    });

    it("should emit all files when addonEmitOnly is disabled", () => {
        const fileSystem = createSystem(
            {
                "src/target.ts": `export const test = () => "original";`,
            },
            { virtual: true }
        );
        const writeFileSpy = jest.spyOn(fileSystem, "writeFile");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            config: { addonEmitOnly: false },
        };

        const testObj = new CompilerTestClass(target, undefined, fileSystem).createProfileContextsIfNecessary();

        testObj.emitSourceFile("/src/target.ts", undefined, true);

        // Verify that writeFile was called (file should be written to disk)
        expect(writeFileSpy).toHaveBeenCalledWith(expect.stringContaining("target.js"), expect.any(String));
    });

    it("should work with transpileOnly and addonEmitOnly together", () => {
        const fileSystem = createSystem(
            {
                "src/target.ts": `export const test = () => "original";`,
            },
            { virtual: true }
        );
        const processorMock = jest.fn((fileName: string, content: string) => content.replace("original", "modified"));
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            config: { addonEmitOnly: true, transpileOnly: true },
        };

        const testObj = new CompilerTestClass(target, undefined, fileSystem).createProfileContextsIfNecessary();
        const ctx = testObj.getContext();
        ctx?.registerProcessor(processorMock);

        const actual = testObj.emitSourceFile("/src/target.ts", undefined, true);

        expect(processorMock).toHaveBeenCalled();
        expect(actual.files.length).toBeGreaterThan(0);
        expect(getText("target.js", actual)).toContain("modified");
    });

    it("should only emit files actually transformed by transformers", () => {
        const fileSystem = createSystem(
            {
                "src/service.ts": `export function serviceFunction() { return "service"; }`,
                "src/helper.ts": `export function helperFunction() { return "helper"; }`,
            },
            { virtual: true }
        );
        const writeFileSpy = jest.spyOn(fileSystem, "writeFile");

        // Create a transformer that only transforms files containing "service"
        const selectiveTransformer: ts.TransformerFactory<ts.SourceFile> = context => {
            return sourceFile => {
                if (!sourceFile.fileName.includes("service")) {
                    // Don't transform files that don't contain "service" in the name
                    return sourceFile;
                }

                // Transform the service file by adding a comment
                const visitor = (node: ts.Node): ts.Node => {
                    if (ts.isFunctionDeclaration(node) && node.name?.text === "serviceFunction") {
                        // Add a leading comment to mark this was transformed
                        return ts.addSyntheticLeadingComment(node, ts.SyntaxKind.MultiLineCommentTrivia, " TRANSFORMED ", false);
                    }
                    return ts.visitEachChild(node, visitor, context);
                };

                return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
            };
        };

        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { target: ts.ScriptTarget.ESNext },
            cliArgs: { fileNames: ["/src/service.ts", "/src/helper.ts"], options: {}, errors: [] },
            config: { addonEmitOnly: true, transpileOnly: true },
        };

        const testObj = new CompilerTestClass(target, undefined, fileSystem).createProfileContextsIfNecessary();
        const ctx = testObj.getContext();
        ctx?.registerTransformer({ before: [selectiveTransformer] });

        // Emit both files
        const serviceResult = testObj.emitSourceFile("/src/service.ts", undefined, true);
        const helperResult = testObj.emitSourceFile("/src/helper.ts", undefined, true);

        // Service file should be emitted (transformed)
        expect(serviceResult.files.length).toBeGreaterThan(0);
        expect(getText("service.js", serviceResult)).toContain("TRANSFORMED");

        // Helper file should NOT be emitted (not transformed)
        expect(helperResult.files.length).toBeGreaterThan(0); // Files returned but...

        // Check actual file writes - only service should be written
        const serviceCalls = writeFileSpy.mock.calls.filter(call => call[0].includes("service.js"));
        const helperCalls = writeFileSpy.mock.calls.filter(call => call[0].includes("helper.js"));

        expect(serviceCalls.length).toBeGreaterThan(0); // Service was written
        expect(helperCalls.length).toBe(0); // Helper was NOT written
    });

    it("yields written files of transformed file only w/ addonEmitOnly and two transformer addons", () => {
        const fileSystem = createSystem(
            { "src/service.ts": `export const value = "service";`, "src/helper.ts": `export const value = "helper";` },
            { virtual: true }
        );
        const changeService: ts.TransformerFactory<ts.SourceFile> = context => sourceFile => {
            const visitor = (node: ts.Node): ts.Node =>
                ts.isStringLiteral(node) && node.text === "service"
                    ? context.factory.createStringLiteral("changed")
                    : ts.visitEachChild(node, visitor, context);
            return ts.visitEachChild(sourceFile, visitor, context);
        };
        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                tsConfig: { target: ts.ScriptTarget.ESNext, declaration: true },
                cliArgs: { fileNames: ["/src/service.ts", "/src/helper.ts"], options: {}, errors: [] },
                config: { addonEmitOnly: true },
            },
            undefined,
            fileSystem
        ).createProfileContextsIfNecessary();
        const ctx = testObj.getContext()!;
        ctx.activateAddon({ getName: () => "identity-addon", activate: () => ctx.registerTransformer({ before: [() => sf => sf] }) } as never);
        ctx.activateAddon({ getName: () => "changing-addon", activate: () => ctx.registerTransformer({ before: [changeService] }) } as never);

        const actual = ["/src/service.ts", "/src/helper.ts"].map(cur =>
            testObj.emitSourceFile(cur, undefined, true).writtenFiles.map(file => file.name)
        );

        expect(actual).toEqual([["/src/service.js", "/src/service.d.ts"], []]);
    });

    it("yields empty written files w/ addonEmitOnly and file not processed by addons", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const test = () => "original";` }, { virtual: true });
        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                tsConfig: { target: ts.ScriptTarget.ESNext },
                cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
                config: { addonEmitOnly: true },
            },
            undefined,
            fileSystem
        ).createProfileContextsIfNecessary();

        const actual = testObj.emitSourceFile("/src/target.ts", undefined, true).writtenFiles;

        expect(actual).toEqual([]);
    });

    it("yields all output files w/ addonEmitOnly and file not processed by addons", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const test = () => "original";` }, { virtual: true });
        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                tsConfig: { target: ts.ScriptTarget.ESNext },
                cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
                config: { addonEmitOnly: true },
            },
            undefined,
            fileSystem
        ).createProfileContextsIfNecessary();

        const actual = testObj.emitSourceFile("/src/target.ts", undefined, true).files.map(cur => cur.name);

        expect(actual).toEqual(["/src/target.js"]);
    });

    it("yields written script, declaration and map files w/ addonEmitOnly and file processed by addon", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const test = () => "original";` }, { virtual: true });
        const writeFileSpy = jest.spyOn(fileSystem, "writeFile");
        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                tsConfig: { target: ts.ScriptTarget.ESNext, declaration: true, declarationMap: true, sourceMap: true },
                cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
                config: { addonEmitOnly: true },
            },
            undefined,
            fileSystem
        ).createProfileContextsIfNecessary();
        testObj.getContext()?.registerProcessor((_fileName: string, content: string) => content.replace("original", "modified"));

        const target = testObj.emitSourceFile("/src/target.ts", undefined, true);
        const actual1 = target.writtenFiles.map(cur => cur.name).sort();
        const actual2 = writeFileSpy.mock.calls.map(cur => cur[0]).sort();

        expect(actual1).toEqual(["/src/target.d.ts", "/src/target.d.ts.map", "/src/target.js", "/src/target.js.map"]);
        expect(actual2).toEqual(["/src/target.d.ts", "/src/target.d.ts.map", "/src/target.js", "/src/target.js.map"]);
    });

    it("yields empty written files w/o writing output files", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const test = () => "original";` }, { virtual: true });
        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                tsConfig: { target: ts.ScriptTarget.ESNext },
                cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            },
            undefined,
            fileSystem
        ).createProfileContextsIfNecessary();

        const actual = testObj.emitSourceFile("/src/target.ts", undefined, false).writtenFiles;

        expect(actual).toEqual([]);
    });

    it("passes all output files to result processors w/ addonEmitOnly and file not processed by addons", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const test = () => "original";` }, { virtual: true });
        const target = jest.fn<void, [string[], unknown]>();
        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                tsConfig: { target: ts.ScriptTarget.ESNext },
                cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
                config: { addonEmitOnly: true },
            },
            undefined,
            fileSystem
        ).createProfileContextsIfNecessary();
        testObj.getContext()?.registerResultProcessor(target);

        testObj.compile();
        const actual = target.mock.calls[0][0];

        expect(actual).toEqual(["/src/target.js"]);
    });
});

describe("emitSourceFile writtenFiles", () => {
    it("yields empty written files w/ unchanged file from cache", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const test = () => "original";` }, { virtual: true });
        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                tsConfig: { target: ts.ScriptTarget.ESNext },
                cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            },
            undefined,
            fileSystem
        ).createProfileContextsIfNecessary();
        testObj.emitSourceFile("/src/target.ts", undefined, true);

        const actual = testObj.emitSourceFile("/src/target.ts", undefined, true).writtenFiles;

        expect(actual).toEqual([]);
    });

    it("yields empty written files w/ file skipped by addon filter", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const test = () => "original";` }, { virtual: true });
        const addons = new AddonRegistry({ addonsDir: "./addons", reporter: new ReporterMock(fileSystem), system: fileSystem });
        addons.getAvailableAddons = jest.fn().mockReturnValue([{ getName: () => "whatever", activate: jest.fn(), shouldProcessFile: () => false }]);
        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                tsConfig: { target: ts.ScriptTarget.ESNext },
                cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            },
            undefined,
            fileSystem,
            addons
        ).createProfileContextsIfNecessary();

        const actual = testObj.emitSourceFile("/src/target.ts", undefined, true).writtenFiles;

        expect(actual).toEqual([]);
    });

    it("yields empty written files w/ unchanged file skipped by addon filter from cache", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const test = () => "original";` }, { virtual: true });
        const addons = new AddonRegistry({ addonsDir: "./addons", reporter: new ReporterMock(fileSystem), system: fileSystem });
        const shouldProcessFile = jest.fn().mockReturnValueOnce(true).mockReturnValue(false);
        addons.getAvailableAddons = jest.fn().mockReturnValue([{ getName: () => "whatever", activate: jest.fn(), shouldProcessFile }]);
        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                tsConfig: { target: ts.ScriptTarget.ESNext },
                cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
            },
            undefined,
            fileSystem,
            addons
        ).createProfileContextsIfNecessary();
        testObj.emitSourceFile("/src/target.ts", undefined, true);

        const actual = testObj.emitSourceFile("/src/target.ts", undefined, true).writtenFiles;

        expect(actual).toEqual([]);
    });

    it("yields empty written files w/ failing transpilation", () => {
        const fileSystem = createSystem({ "src/target.ts": `export const test = () => "original";` }, { virtual: true });
        const testObj = new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                tsConfig: { target: ts.ScriptTarget.ESNext },
                cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
                config: { transpileOnly: true },
            },
            undefined,
            fileSystem
        ).createProfileContextsIfNecessary();
        testObj.getContext()?.registerTransformer({
            before: [
                () => () => {
                    throw new Error("whatever");
                },
            ],
        });

        const actual = testObj.emitSourceFile("/src/target.ts", undefined, true).writtenFiles;

        expect(actual).toEqual([]);
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

describe("File Filtering Optimization (shouldSkipFile)", () => {
    describe("with addon that has shouldProcessFile", () => {
        it("should skip files that no addon wants to process", () => {
            const fileSystem = createSystem(
                {
                    "src/service.ts": `export const getUser = () => "user";`,
                    "src/helper.ts": `export const formatDate = () => "date";`,
                },
                { virtual: true }
            );

            const shouldProcessFileMock = jest.fn((filePath: string) => filePath.includes("service.ts"));

            // Create addon with shouldProcessFile using proper helper
            createAddon(
                fileSystem,
                "addons/test-addon/addon",
                "export const activate = () => {}; export const shouldProcessFile = (path) => path.includes('service');",
                {
                    activate: jest.fn(),
                    shouldProcessFile: shouldProcessFileMock,
                }
            );

            const addons = new AddonRegistry({
                addonsDir: "./addons",
                addons: ["test-addon"],
                reporter: new ReporterMock(fileSystem),
                system: fileSystem,
            });

            const compiler = new CompilerTestClass(
                {
                    reporter: new ReporterMock(fileSystem),
                    tsConfig: { target: ts.ScriptTarget.ESNext },
                    cliArgs: { fileNames: ["/src/service.ts", "/src/helper.ts"], options: {}, errors: [] },
                },
                undefined,
                fileSystem,
                addons
            );

            compiler.createProfileContextsIfNecessary();
            const ctx = compiler.getContext();

            // Test that service.ts is NOT skipped (addon wants it)
            const shouldSkipService = compiler.testShouldSkipFile("/src/service.ts", ctx!);
            expect(shouldSkipService).toBe(false);

            // Test that helper.ts IS skipped (no addon wants it)
            const shouldSkipHelper = compiler.testShouldSkipFile("/src/helper.ts", ctx!);
            expect(shouldSkipHelper).toBe(true);

            // Verify the addon's shouldProcessFile was called
            expect(shouldProcessFileMock).toHaveBeenCalledWith("/src/service.ts", expect.any(Object));
            expect(shouldProcessFileMock).toHaveBeenCalledWith("/src/helper.ts", expect.any(Object));
        });

        it("should not skip if ANY addon wants the file", () => {
            const fileSystem = createSystem({ "src/target.ts": `export const test = 1;` }, { virtual: true });

            const shouldProcessFile1 = jest.fn(() => false); // addon1 doesn't want it
            const shouldProcessFile2 = jest.fn(() => true); // addon2 wants it

            // Create first addon that rejects the file
            createAddon(fileSystem, "addons/addon1/addon", "export const activate = () => {}; export const shouldProcessFile = () => false;", {
                activate: jest.fn(),
                shouldProcessFile: shouldProcessFile1,
            });

            // Create second addon that accepts the file
            createAddon(fileSystem, "addons/addon2/addon", "export const activate = () => {}; export const shouldProcessFile = () => true;", {
                activate: jest.fn(),
                shouldProcessFile: shouldProcessFile2,
            });

            const addons = new AddonRegistry({
                addonsDir: "./addons",
                addons: ["addon1", "addon2"],
                reporter: new ReporterMock(fileSystem),
                system: fileSystem,
            });

            const compiler = new CompilerTestClass(
                {
                    reporter: new ReporterMock(fileSystem),
                    tsConfig: { target: ts.ScriptTarget.ESNext },
                    cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
                },
                undefined,
                fileSystem,
                addons
            );

            compiler.createProfileContextsIfNecessary();
            const ctx = compiler.getContext();

            const shouldSkip = compiler.testShouldSkipFile("/src/target.ts", ctx!);
            expect(shouldSkip).toBe(false); // Should not skip because addon2 wants it
        });
    });

    describe("backward compatibility with legacy addons", () => {
        it("should not skip files when addon lacks shouldProcessFile (legacy behavior)", () => {
            const fileSystem = createSystem({ "src/target.ts": `export const test = 1;` }, { virtual: true });

            // Create legacy addon WITHOUT shouldProcessFile
            createAddon(
                fileSystem,
                "addons/legacy-addon/addon",
                "export const activate = () => {};", // No shouldProcessFile export
                {
                    activate: jest.fn(),
                    // No shouldProcessFile - legacy addon
                }
            );

            const addons = new AddonRegistry({
                addonsDir: "./addons",
                addons: ["legacy-addon"],
                reporter: new ReporterMock(fileSystem),
                system: fileSystem,
            });

            const compiler = new CompilerTestClass(
                {
                    reporter: new ReporterMock(fileSystem),
                    tsConfig: { target: ts.ScriptTarget.ESNext },
                    cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
                },
                undefined,
                fileSystem,
                addons
            );

            compiler.createProfileContextsIfNecessary();
            const ctx = compiler.getContext();

            const shouldSkip = compiler.testShouldSkipFile("/src/target.ts", ctx!);
            expect(shouldSkip).toBe(false); // Legacy addon processes all files
        });
    });

    describe("with no addons", () => {
        it("should not skip files when no addons are registered", () => {
            const fileSystem = createSystem({ "src/target.ts": `export const test = 1;` }, { virtual: true });

            const compiler = new CompilerTestClass(
                {
                    reporter: new ReporterMock(fileSystem),
                    tsConfig: { target: ts.ScriptTarget.ESNext },
                    cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
                },
                undefined,
                fileSystem
                // No addons registry
            );

            compiler.createProfileContextsIfNecessary();
            const ctx = compiler.getContext();

            const shouldSkip = compiler.testShouldSkipFile("/src/target.ts", ctx!);
            expect(shouldSkip).toBe(false); // Should process when no addons
        });
    });

    describe("emitSourceFile integration with file filtering", () => {
        it("should skip processing when addon filters out the file", () => {
            const fileSystem = createSystem(
                {
                    "src/service.ts": `export const getUser = () => "user";`,
                    "src/helper.ts": `export const formatDate = () => "date";`,
                },
                { virtual: true }
            );

            const shouldProcessFileMock = jest.fn((filePath: string) => filePath.includes("service.ts"));

            // Create addon with file filtering
            createAddon(
                fileSystem,
                "addons/filter-addon/addon",
                "export const activate = () => {}; export const shouldProcessFile = (path) => path.includes('service');",
                {
                    activate: jest.fn(),
                    shouldProcessFile: shouldProcessFileMock,
                }
            );

            const addons = new AddonRegistry({
                addonsDir: "./addons",
                addons: ["filter-addon"],
                reporter: new ReporterMock(fileSystem),
                system: fileSystem,
            });

            const compiler = new CompilerTestClass(
                {
                    reporter: new ReporterMock(fileSystem),
                    tsConfig: { declaration: true, target: ts.ScriptTarget.ESNext },
                    cliArgs: { fileNames: ["/src/service.ts", "/src/helper.ts"], options: {}, errors: [] },
                },
                undefined,
                fileSystem,
                addons
            );

            compiler.createProfileContextsIfNecessary();

            // Emit service.ts - should be processed
            const serviceResult = compiler.emitSourceFile("/src/service.ts", undefined, false);
            expect(serviceResult.files.length).toBeGreaterThan(0); // Should have output files

            // Emit helper.ts - should be skipped
            const helperResult = compiler.emitSourceFile("/src/helper.ts", undefined, false);
            expect(helperResult.files.length).toBe(0); // Should have no output files (skipped)
            expect(helperResult.diagnostics || []).toHaveLength(0); // No errors
        });

        it("should return cached result when file is skipped but cache exists", () => {
            const fileSystem = createSystem({ "src/helper.ts": `export const formatDate = () => "date";` }, { virtual: true });

            const shouldProcessFileMock = jest.fn(() => false); // Skip all files

            // Create addon that skips all files
            createAddon(fileSystem, "addons/filter-addon/addon", "export const activate = () => {}; export const shouldProcessFile = () => false;", {
                activate: jest.fn(),
                shouldProcessFile: shouldProcessFileMock,
            });

            const addons = new AddonRegistry({
                addonsDir: "./addons",
                addons: ["filter-addon"],
                reporter: new ReporterMock(fileSystem),
                system: fileSystem,
            });

            const compiler = new CompilerTestClass(
                {
                    reporter: new ReporterMock(fileSystem),
                    tsConfig: { target: ts.ScriptTarget.ESNext },
                    cliArgs: { fileNames: ["/src/helper.ts"], options: {}, errors: [] },
                },
                undefined,
                fileSystem,
                addons
            );

            compiler.createProfileContextsIfNecessary();

            // First call - file is skipped
            const firstResult = compiler.emitSourceFile("/src/helper.ts", undefined, false);
            expect(firstResult.files.length).toBe(0);

            // Second call - should use cache
            const secondResult = compiler.emitSourceFile("/src/helper.ts", undefined, false);
            expect(secondResult.files.length).toBe(0);
            expect(secondResult.version).toBe(firstResult.version);
        });
    });
});

describe("Declaration generation for client proxy addons", () => {
    // Simulates a client proxy transformer addon (e.g., Magellan's @service() decorator)
    // that transforms source code but whose consumers need .d.ts type declarations.
    const createProxyTransformerAddon = (options: { needsTypeInfo?: boolean } = {}) => ({
        getName: () => "client-proxy-transformer",
        needsTypeInfo: options.needsTypeInfo,
        activate: (ctx: CompilationContext) => {
            ctx.registerTransformer({
                before: [
                    (context: ts.TransformationContext) => {
                        return (sourceFile: ts.SourceFile) => {
                            // Identity transformer — simulates a proxy transformer that
                            // wraps functions without changing their type signatures
                            return ts.visitEachChild(sourceFile, node => node, context);
                        };
                    },
                ],
            });
        },
    });

    it("generates .d.ts files when transpileOnly is false and declaration is true", () => {
        const fileSystem = createSystem({ "src/service.ts": `export const getUser = async (): Promise<string> => "user";` }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        fileSystem.createDirectory("./addons");
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter,
            system: fileSystem,
        });
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([createProxyTransformerAddon({ needsTypeInfo: false })]);

        const actual = new CompilerTestClass(
            {
                reporter,
                tsConfig: { declaration: true, sourceMap: false, target: ts.ScriptTarget.ESNext },
                config: { transpileOnly: false, addons: ["client-proxy-transformer"] },
                cliArgs: { fileNames: ["/src/service.ts"], options: {}, errors: [] },
            },
            undefined,
            fileSystem
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/service.ts", undefined, false);

        // Client proxy consumers get type declarations
        expect(getFilesByExtension(actual, ".d.ts")).toHaveLength(1);
        expect(getText("service.d.ts", actual)).toContain("getUser");
        expect(getText("service.js", actual)).toBeDefined();
    });

    it("does NOT generate .d.ts files when transpileOnly is true, even with declaration: true", () => {
        const fileSystem = createSystem({ "src/service.ts": `export const getUser = async (): Promise<string> => "user";` }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        fileSystem.createDirectory("./addons");
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter,
            system: fileSystem,
        });
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([createProxyTransformerAddon({ needsTypeInfo: false })]);

        const actual = new CompilerTestClass(
            {
                reporter,
                tsConfig: { declaration: true, sourceMap: false, target: ts.ScriptTarget.ESNext },
                config: { transpileOnly: true, addons: ["client-proxy-transformer"] },
                cliArgs: { fileNames: ["/src/service.ts"], options: {}, errors: [] },
            },
            undefined,
            fileSystem
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/service.ts", undefined, false);

        // transpileOnly fast path: no declarations possible
        expect(getFilesByExtension(actual, ".d.ts")).toHaveLength(0);
        // But JS output is still generated
        expect(actual.files.some(f => f.name.endsWith(".js"))).toBe(true);
    });

    it("generates .d.ts files with per-file Programs when needsTypeInfo is false and declaration is true", () => {
        const fileSystem = createSystem({ "src/service.ts": `export const getUser = async (): Promise<string> => "user";` }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        fileSystem.createDirectory("./addons");
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter,
            system: fileSystem,
        });
        // Addon explicitly opts out of type info — no big Program needed
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([createProxyTransformerAddon({ needsTypeInfo: false })]);

        const actual = new CompilerTestClass(
            {
                reporter,
                tsConfig: { declaration: true, declarationMap: false, sourceMap: false, target: ts.ScriptTarget.ESNext },
                config: { transpileOnly: false, addons: ["client-proxy-transformer"] },
                cliArgs: { fileNames: ["/src/service.ts"], options: {}, errors: [] },
            },
            undefined,
            fileSystem
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/service.ts", undefined, false);

        // Per-file Program path still generates declarations
        expect(getFilesByExtension(actual, ".d.ts")).toHaveLength(1);
        expect(getText("service.d.ts", actual)).toContain("getUser");
        expect(getText("service.d.ts", actual)).toContain("Promise<string>");
    });

    it("generates .d.ts with legacy addon (needsTypeInfo undefined) and declaration: true", () => {
        const fileSystem = createSystem({ "src/service.ts": `export const getUser = async (): Promise<string> => "user";` }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        fileSystem.createDirectory("./addons");
        const addonRegistry = new AddonRegistry({
            addonsDir: "./addons",
            reporter,
            system: fileSystem,
        });
        // Legacy addon: needsTypeInfo is undefined → treated as true → big Program created
        addonRegistry.getAvailableAddons = jest.fn().mockReturnValue([createProxyTransformerAddon()]);

        const actual = new CompilerTestClass(
            {
                reporter,
                tsConfig: { declaration: true, sourceMap: false, target: ts.ScriptTarget.ESNext },
                config: { transpileOnly: false, addons: ["client-proxy-transformer"] },
                cliArgs: { fileNames: ["/src/service.ts"], options: {}, errors: [] },
            },
            undefined,
            fileSystem
        )
            .setAddonRegistry(addonRegistry)
            .createProfileContextsIfNecessary()
            .emitSourceFile("/src/service.ts", undefined, false);

        // Legacy addons always get the big Program → declarations generated
        expect(getFilesByExtension(actual, ".d.ts")).toHaveLength(1);
        expect(getText("service.d.ts", actual)).toContain("getUser");
    });
});

// Module names as tsconfig.json gives them: MODULE_MAP in Compiler.ts, applied by normalizeCompilerOptions, turns a
// numeric ModuleKind.NodeNext (199) into Preserve
const NODENEXT_NAMES = { module: "NodeNext", moduleResolution: "NodeNext" } as unknown as ts.CompilerOptions;

describe("compile w/ esm profile", () => {
    const ESM_SOURCE = `declare const require: (id: string) => unknown;\nexport const x = require("x");`;

    const createEsmCompiler = (fileSystem: ts.System, profiles: Record<string, object>, profile = "client", options: Partial<CompilerOptions> = {}) =>
        new CompilerTestClass(
            {
                reporter: new ReporterMock(fileSystem),
                config: { profiles },
                profile,
                tsConfig: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, sourceMap: false },
                cliArgs: { fileNames: ["/src/target.ts"], options: {}, errors: [] },
                ...options,
            },
            undefined,
            fileSystem
        );

    const createTypeInfoAddons = (fileSystem: ts.System, reporter: Reporter) => {
        fileSystem.createDirectory("./addons");
        const addons = new AddonRegistry({ addonsDir: "./addons", reporter, system: fileSystem });
        addons.getAvailableAddons = jest.fn().mockReturnValue([{ getName: () => "type-info-addon", activate: jest.fn() }]);
        addons.getAddonByName = jest.fn().mockReturnValue(undefined);
        return addons;
    };

    const createAddons = (fileSystem: ts.System, reporter: Reporter, activators: Record<string, (ctx: CompilationContext) => void>) => {
        fileSystem.createDirectory("./addons");
        const addons = new AddonRegistry({ addonsDir: "./addons", reporter, system: fileSystem });
        const available = Object.entries(activators).map(([name, activate]) => ({ getName: () => name, activate, needsTypeInfo: false }));
        addons.getAvailableAddons = jest.fn().mockReturnValue(available);
        addons.getAddonByName = jest.fn((name: string) => available.find(cur => cur.getName() === name)) as never;
        return addons;
    };

    const changeLiteral: ts.TransformerFactory<ts.SourceFile> = context => sourceFile => {
        const visitor = (node: ts.Node): ts.Node =>
            ts.isStringLiteral(node) && node.text === "x" ? context.factory.createStringLiteral("y") : ts.visitEachChild(node, visitor, context);
        return ts.visitEachChild(sourceFile, visitor, context);
    };

    it("yields ESM diagnostic in result w/ file with output", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": ESM_SOURCE }, { virtual: true });
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" } } });

        const actual = testObj.compile().diagnostics.map(cur => cur.code);

        expect(actual).toEqual([91001]);
    });

    it("yields no ESM diagnostic w/ profile without esm", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": ESM_SOURCE }, { virtual: true });
        const testObj = createEsmCompiler(fileSystem, { client: {} });

        const actual = testObj.compile().diagnostics.map(cur => cur.code);

        expect(actual).toEqual([]);
    });

    it("yields ESM diagnostic only for esm profile w/ dependent profile without esm", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": ESM_SOURCE }, { virtual: true });
        const testObj = createEsmCompiler(fileSystem, { server: { esm: { runtime: "node" } }, client: { depends: ["server"] } });

        const actual = testObj.compile().diagnostics.map(cur => cur.code);

        expect(actual).toEqual([91001]);
    });

    it("reports ESM diagnostic located in emitted file w/ addon requiring type information", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": ESM_SOURCE }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" } } }, "client", { reporter }).setAddonRegistry(
            createTypeInfoAddons(fileSystem, reporter)
        );

        testObj.compile();
        const actual = reporter.message;

        expect(actual).toMatch(/Error: \/src\/target\.js \(1,18\): ESM91001: /);
    });

    it("names profile and no addon in ESM diagnostic w/ file no addon changed", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": ESM_SOURCE }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" } } }, "client", { reporter }).setAddonRegistry(
            createTypeInfoAddons(fileSystem, reporter)
        );

        const actual = testObj.compile().diagnostics[0].messageText;

        expect(actual).toMatch(/\(profile "client"\)\.$/);
    });

    it("names only changing processor addon in ESM diagnostic w/ two processor addons", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "export const x = 1;" },
            { virtual: true }
        );
        const reporter = new ReporterMock(fileSystem);
        const addons = createAddons(fileSystem, reporter, {
            "keeping-addon": ctx => ctx.registerProcessor((_fileName, content) => content),
            "changing-addon": ctx => ctx.registerProcessor(() => ESM_SOURCE),
        });
        const testObj = createEsmCompiler(
            fileSystem,
            { client: { esm: { runtime: "node" }, addons: ["changing-addon", "keeping-addon"] } },
            "client",
            { reporter }
        ).setAddonRegistry(addons);

        const actual = testObj.compile().diagnostics[0].messageText;

        expect(actual).toMatch(/\(profile "client", addons: changing-addon\)\.$/);
    });

    it("names only changing transformer addon in ESM diagnostic w/ two transformer addons", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": ESM_SOURCE }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const addons = createAddons(fileSystem, reporter, {
            "identity-addon": ctx => ctx.registerTransformer({ before: [() => sourceFile => sourceFile] }),
            "changing-addon": ctx => ctx.registerTransformer({ before: [changeLiteral] }),
        });
        const testObj = createEsmCompiler(
            fileSystem,
            { client: { esm: { runtime: "node" }, addons: ["identity-addon", "changing-addon"] } },
            "client",
            { reporter }
        ).setAddonRegistry(addons);

        const actual = testObj.compile().diagnostics[0].messageText;

        expect(actual).toMatch(/\(profile "client", addons: changing-addon\)\.$/);
    });

    it("names no addon in ESM diagnostic w/ require in source of generator adding virtual file", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": ESM_SOURCE }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const addons = createAddons(fileSystem, reporter, {
            "gen-addon": ctx =>
                ctx.registerGenerator(fileName => fileName.endsWith("target.ts") && ctx.addVirtualFile("/src/generated.ts", "export const a = 1;")),
        });
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" }, addons: ["gen-addon"] } }, "client", {
            reporter,
        }).setAddonRegistry(addons);

        const actual = testObj.compile().diagnostics.map(cur => [cur.file?.fileName, cur.messageText]);

        expect(actual).toEqual([["/src/target.js", expect.stringMatching(/\(profile "client"\)\.$/)]]);
    });

    it("names generator addon in ESM diagnostic w/ require in virtual file added by generator", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "export const x = 1;" },
            { virtual: true }
        );
        const reporter = new ReporterMock(fileSystem);
        const addons = createAddons(fileSystem, reporter, {
            "gen-addon": ctx =>
                ctx.registerGenerator(fileName => fileName.endsWith("target.ts") && ctx.addVirtualFile("/src/generated.ts", ESM_SOURCE)),
            "other-addon": () => undefined,
        });
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" }, addons: ["gen-addon", "other-addon"] } }, "client", {
            reporter,
        }).setAddonRegistry(addons);

        const actual = testObj.compile().diagnostics.map(cur => [cur.file?.fileName, cur.messageText]);

        expect(actual).toEqual([["/src/generated.js", expect.stringMatching(/\(profile "client", addons: gen-addon\)\.$/)]]);
    });

    it("names no addon in ESM diagnostic w/ processor registered outside addon", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "export const x = 1;" },
            { virtual: true }
        );
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" } } });
        testObj
            .createProfileContextsIfNecessary()
            .getContext("client")!
            .registerProcessor(() => ESM_SOURCE);

        const actual = testObj.compile().diagnostics[0].messageText;

        expect(actual).toMatch(/\(profile "client"\)\.$/);
    });

    it("yields no ESM diagnostic w/ esm and CommonJS module of profile", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": ESM_SOURCE }, { virtual: true });
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" }, tsConfig: { module: ts.ModuleKind.CommonJS } } });

        const actual = testObj.compile().diagnostics.map(cur => cur.code);

        expect(actual).toEqual([]);
    });

    it("reports no config error w/ esm and CommonJS module of profile", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": ESM_SOURCE }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const target = jest.spyOn(reporter, "reportDiagnostic");
        const testObj = createEsmCompiler(
            fileSystem,
            { client: { esm: { runtime: "node" }, tsConfig: { module: ts.ModuleKind.CommonJS } } },
            "client",
            {
                reporter,
            }
        );

        testObj.compile();

        expect(target).not.toHaveBeenCalled();
    });

    it("reports one error naming esm and module w/ CommonJS module not set by profile", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": ESM_SOURCE }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const target = jest.spyOn(reporter, "reportDiagnostic");
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" } } }, "client", {
            reporter,
            tsConfig: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext, sourceMap: false },
        });

        testObj.compile();
        const actual = target.mock.calls.map(([cur]) => cur.messageText);

        expect(actual).toEqual([
            `Profile 'client' sets 'esm', but its effective 'module' is 'CommonJS' from tsconfig.json, a dependent profile or the command line. ` +
                `Use an ES module format such as "ESNext" or "NodeNext", or remove 'esm'. The ESM check skips this profile.`,
        ]);
    });

    it("yields no ESM diagnostic w/o module and default target", () => {
        const fileSystem = createSystem(
            {
                "package.json": JSON.stringify({ type: "module" }),
                "src/target.ts": `import { a } from "./dep";\nexport const x = a;`,
                "src/dep.ts": `export const a = 1;`,
            },
            { virtual: true }
        );
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" } } }, "client", { tsConfig: { sourceMap: false } });

        const actual = testObj.compile().diagnostics.map(cur => cur.code);

        expect(actual).toEqual([]);
    });

    it("reports one error naming unset module and target w/o module and default target", () => {
        const fileSystem = createSystem(
            {
                "package.json": JSON.stringify({ type: "module" }),
                "src/target.ts": `import { a } from "./dep";\nexport const x = a;`,
                "src/dep.ts": `export const a = 1;`,
            },
            { virtual: true }
        );
        const reporter = new ReporterMock(fileSystem);
        const target = jest.spyOn(reporter, "reportDiagnostic");
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" } } }, "client", {
            reporter,
            tsConfig: { sourceMap: false },
        });

        testObj.compile();
        const actual = target.mock.calls.map(([cur]) => cur.messageText);

        expect(actual).toEqual([
            `Profile 'client' sets 'esm', but 'module' is unset and 'target' is 'ES5', so TypeScript emits CommonJS. ` +
                `Use an ES module format such as "ESNext" or "NodeNext", or remove 'esm'. The ESM check skips this profile.`,
        ]);
    });

    it("yields ESM diagnostic for JavaScript file w/ result processor writing CommonJS", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "export const x = 1;" },
            { virtual: true }
        );
        const reporter = new ReporterMock(fileSystem);
        const addons = createAddons(fileSystem, reporter, {
            "writing-addon": ctx =>
                ctx.registerResultProcessor((_files, processorCtx) => {
                    processorCtx.getSystem().writeFile("/src/meta.js", "module.exports = {};");
                    processorCtx.getSystem().writeFile("/src/meta.json", "module.exports = {};");
                }),
        });
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" }, addons: ["writing-addon"] } }, "client", {
            reporter,
        }).setAddonRegistry(addons);

        const actual = testObj.compile().diagnostics.map(cur => [cur.file?.fileName, cur.code]);

        expect(actual).toEqual([["/src/meta.js", 91002]]);
    });

    it("names result processor addon in ESM diagnostic w/ result processor writing CommonJS", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "export const x = 1;" },
            { virtual: true }
        );
        const reporter = new ReporterMock(fileSystem);
        const addons = createAddons(fileSystem, reporter, {
            "writing-addon": ctx =>
                ctx.registerResultProcessor((_files, processorCtx) => processorCtx.getSystem().writeFile("/src/meta.js", "module.exports = {};")),
            "other-addon": () => undefined,
        });
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" }, addons: ["writing-addon", "other-addon"] } }, "client", {
            reporter,
        }).setAddonRegistry(addons);

        const actual = testObj.compile().diagnostics[0].messageText;

        expect(actual).toMatch(/\(profile "client", addons: writing-addon\)\.$/);
    });

    it("yields no ESM diagnostic w/ result processor writing CommonJS matching esm ignore", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "export const x = 1;" },
            { virtual: true }
        );
        const reporter = new ReporterMock(fileSystem);
        const addons = createAddons(fileSystem, reporter, {
            "writing-addon": ctx =>
                ctx.registerResultProcessor((_files, processorCtx) => processorCtx.getSystem().writeFile("/src/meta.js", "module.exports = {};")),
        });
        const testObj = createEsmCompiler(
            fileSystem,
            { client: { esm: { runtime: "node", ignore: ["src/meta.js"] }, addons: ["writing-addon"] } },
            "client",
            { reporter }
        ).setAddonRegistry(addons);

        const actual = testObj.compile().diagnostics;

        expect(actual).toEqual([]);
    });

    it("writes file w/ result processor writing through system", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "export const x = 1;" },
            { virtual: true }
        );
        const reporter = new ReporterMock(fileSystem);
        const addons = createAddons(fileSystem, reporter, {
            "writing-addon": ctx => ctx.registerResultProcessor((_files, processorCtx) => processorCtx.getSystem().writeFile("/src/meta.json", "{}")),
        });
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" }, addons: ["writing-addon"] } }, "client", {
            reporter,
        }).setAddonRegistry(addons);

        testObj.compile();
        const actual = fileSystem.readFile("/src/meta.json");

        expect(actual).toBe("{}");
    });

    it("yields one ESM diagnostic per file w/ result processor rewriting emitted file", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": ESM_SOURCE }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const addons = createAddons(fileSystem, reporter, {
            "banner-addon": ctx =>
                ctx.registerResultProcessor((_files, processorCtx) => {
                    const system = processorCtx.getSystem();
                    system.writeFile("/src/target.js", `// banner\n${system.readFile("/src/target.js")}`);
                }),
        });
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" }, addons: ["banner-addon"] } }, "client", {
            reporter,
        }).setAddonRegistry(addons);

        const actual = testObj.compile().diagnostics.map(cur => [cur.file?.fileName, cur.code, cur.messageText]);

        expect(actual).toEqual([["/src/target.js", 91001, expect.stringMatching(/\(profile "client", addons: banner-addon\)\.$/)]]);
    });

    it("names no addon w/ result processor rewriting emitted file unchanged", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": ESM_SOURCE }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const addons = createAddons(fileSystem, reporter, {
            "copy-addon": ctx =>
                ctx.registerResultProcessor((_files, processorCtx) => {
                    const system = processorCtx.getSystem();
                    system.writeFile("/src/target.js", system.readFile("/src/target.js")!);
                }),
        });
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" }, addons: ["copy-addon"] } }, "client", {
            reporter,
        }).setAddonRegistry(addons);

        const actual = testObj.compile().diagnostics.map(cur => cur.messageText);

        expect(actual).toEqual([expect.stringMatching(/\(profile "client"\)\.$/)]);
    });

    it("leaves writeFile of system unchanged w/ result processor running", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "export const x = 1;" }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const writeFile = fileSystem.writeFile;
        const target = jest.fn();
        const addons = createAddons(fileSystem, reporter, {
            "writing-addon": ctx => ctx.registerResultProcessor(() => target(fileSystem.writeFile === writeFile)),
        });
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" }, addons: ["writing-addon"] } }, "client", {
            reporter,
        }).setAddonRegistry(addons);

        testObj.compile();

        expect(target).toHaveBeenCalledWith(true);
    });

    it("restores system of context w/ throwing result processor", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": "export const x = 1;" }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const writeFile = fileSystem.writeFile;
        const addons = createAddons(fileSystem, reporter, {
            "throwing-addon": ctx =>
                ctx.registerResultProcessor(() => {
                    throw new Error("whatever");
                }),
        });
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" }, addons: ["throwing-addon"] } }, "client", {
            reporter,
        }).setAddonRegistry(addons);

        testObj.compile();

        expect(testObj.getContext("client")!.getSystem()).toBe(fileSystem);
        expect(fileSystem.writeFile).toBe(writeFile);
    });

    it("reports ignored file w/ esm ignore and debug", () => {
        const fileSystem = createSystem({ "package.json": JSON.stringify({ type: "module" }), "src/target.ts": ESM_SOURCE }, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node", ignore: ["src/*.js"] } } }, "client", {
            reporter,
            debug: true,
        });

        testObj.compile();
        const actual = reporter.message;

        expect(actual).toContain(`ESM check skipped "/src/target.js": matches esm.ignore pattern "src/*.js".`);
    });
    it("yields one 91032 per file w/o 91001 or 91002 w/ fast path and nodenext module under module package", () => {
        const fileSystem = createSystem(
            {
                "package.json": JSON.stringify({ type: "module" }),
                "src/target.ts": `import { a } from "./dep.js";\nexport const x = a;`,
                "src/dep.ts": `export const a = 1;`,
            },
            { virtual: true }
        );
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" } } }, "client", {
            tsConfig: { ...NODENEXT_NAMES, target: ts.ScriptTarget.ESNext, sourceMap: false },
            cliArgs: { fileNames: ["/src/target.ts", "/src/dep.ts"], options: {}, errors: [] },
        });

        const actual = testObj
            .compile()
            .diagnostics.map(cur => [
                cur.code,
                cur.file?.fileName,
                /transpileModule ignores "type"/.test(ts.flattenDiagnosticMessageText(cur.messageText, "\n")),
            ]);

        expect(actual).toEqual([
            [91032, "/src/target.js", true],
            [91032, "/src/dep.js", true],
        ]);
    });

    it("yields 91030 w/ .cts file and preserve module", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "module" }), "src/target.cts": `export const x = 1;` },
            { virtual: true }
        );
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" } } }, "client", {
            tsConfig: { module: ts.ModuleKind.Preserve, target: ts.ScriptTarget.ESNext, sourceMap: false },
            cliArgs: { fileNames: ["/src/target.cts"], options: {}, errors: [] },
        });

        const actual = testObj.compile().diagnostics.map(cur => [cur.code, cur.file?.fileName]);

        expect(actual).toEqual([[91030, "/src/target.cjs"]]);
    });

    it("yields 91031 w/ esnext module under commonjs package", () => {
        const fileSystem = createSystem(
            { "package.json": JSON.stringify({ type: "commonjs" }), "src/target.ts": `export const x = 1;` },
            { virtual: true }
        );
        const testObj = createEsmCompiler(fileSystem, { client: { esm: { runtime: "node" } } });

        const actual = testObj.compile().diagnostics.map(cur => cur.code);

        expect(actual).toEqual([91031]);
    });
});

describe("report w/ TypeScript ESM diagnostics", () => {
    const FILES: Record<string, string> = {
        "/project/package.json": JSON.stringify({ type: "module" }),
        "/project/src/target.ts": `import { a } from "./dep";\nexport const x = a;`,
        "/project/src/dep.ts": `export const a = 1;`,
        "/project/src/legacy.cts": `import esm from "esm-only";\nexport const y = esm;`,
        "/project/node_modules/esm-only/package.json": JSON.stringify({ name: "esm-only", type: "module", types: "index.d.ts" }),
        "/project/node_modules/esm-only/index.d.ts": `declare const esm: number;\nexport default esm;`,
    };

    const createNodeNextProgram = (): ts.Program => {
        const options = {
            module: ts.ModuleKind.NodeNext,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            target: ts.ScriptTarget.ESNext,
            types: [],
        };
        const base = ts.createCompilerHost(options);
        const host: ts.CompilerHost = {
            ...base,
            fileExists: fileName => fileName in FILES || base.fileExists(fileName),
            readFile: fileName => FILES[fileName] ?? base.readFile(fileName),
            directoryExists: dirName => Object.keys(FILES).some(cur => cur.startsWith(`${dirName}/`)) || !!base.directoryExists?.(dirName),
            getSourceFile: (fileName, languageVersion, ...rest) =>
                fileName in FILES
                    ? ts.createSourceFile(fileName, FILES[fileName], languageVersion)
                    : base.getSourceFile(fileName, languageVersion, ...rest),
        };
        return ts.createProgram(["/project/src/target.ts", "/project/src/dep.ts", "/project/src/legacy.cts"], options, host);
    };

    const reportWith = (profiles: Record<string, object>, program: ts.Program | undefined, code: number): [ts.DiagnosticCategory, string][] => {
        const fileSystem = createSystem({}, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const target = jest.spyOn(reporter, "reportDiagnostic");
        const testObj = new CompilerTestClass({ reporter, config: { profiles }, profile: "client" }, undefined, fileSystem);

        testObj.report(program, { diagnostics: [], emitSkipped: false }, "client");

        return target.mock.calls
            .map(([cur]) => cur)
            .filter(cur => cur.code === code)
            .map(cur => [cur.category, ts.flattenDiagnosticMessageText(cur.messageText, "\n")]);
    };

    it("reports TS2835 unchanged w/ profile without esm", () => {
        const program = createNodeNextProgram();

        const actual = reportWith({ client: {} }, program, 2835);

        expect(actual).toEqual([[ts.DiagnosticCategory.Error, expect.stringMatching(/'\.\/dep\.js'\?$/)]]);
    });

    it("reports TS2835 labelled with ESM check and profile w/ esm profile on Program path", () => {
        const program = createNodeNextProgram();

        const actual = reportWith({ client: { esm: { runtime: "node" } } }, program, 2835);

        expect(actual).toEqual([[ts.DiagnosticCategory.Error, expect.stringMatching(/'\.\/dep\.js'\? \(ESM check, profile "client"\)$/)]]);
    });

    it("reports TS2835 labelled once w/ same Program reported twice", () => {
        const program = createNodeNextProgram();
        reportWith({ client: { esm: { runtime: "node" } } }, program, 2835);

        const actual = reportWith({ client: { esm: { runtime: "node" } } }, program, 2835);

        expect(actual).toEqual([[ts.DiagnosticCategory.Error, expect.stringMatching(/'\.\/dep\.js'\? \(ESM check, profile "client"\)$/)]]);
    });

    const reportResultDiagnostic = (profiles: Record<string, object>, diagnostic: ts.Diagnostic): ts.Diagnostic => {
        const fileSystem = createSystem({}, { virtual: true });
        const reporter = new ReporterMock(fileSystem);
        const target = jest.spyOn(reporter, "reportDiagnostic");
        const testObj = new CompilerTestClass({ reporter, config: { profiles }, profile: "client" }, undefined, fileSystem);

        testObj.report(undefined, { diagnostics: [diagnostic], emitSkipped: false }, "client");

        return target.mock.calls[0][0];
    };

    const createTsDiagnostic = (code: number, messageText: string | ts.DiagnosticMessageChain): ts.Diagnostic => ({
        category: ts.DiagnosticCategory.Error,
        code,
        file: ts.createSourceFile("/project/src/target.ts", "whatever;", ts.ScriptTarget.ESNext),
        start: 0,
        length: 8,
        messageText,
    });

    it.each([2835, 2834, 1543, 1470, 1309, 1203])("reports TS%i labelled with code and category kept w/ esm profile", code => {
        const diagnostic = createTsDiagnostic(code, "Failure.");

        const actual = reportResultDiagnostic({ client: { esm: { runtime: "node" } } }, diagnostic);

        expect([actual.code, actual.category, actual.messageText]).toEqual([
            code,
            ts.DiagnosticCategory.Error,
            `Failure. (ESM check, profile "client")`,
        ]);
    });

    it("reports head of message chain labelled w/ esm profile", () => {
        const next: ts.DiagnosticMessageChain = { messageText: "Detail.", category: ts.DiagnosticCategory.Error, code: 0, next: undefined };
        const diagnostic = createTsDiagnostic(2835, { messageText: "Failure.", category: ts.DiagnosticCategory.Error, code: 2835, next: [next] });

        const actual = ts.flattenDiagnosticMessageText(
            reportResultDiagnostic({ client: { esm: { runtime: "node" } } }, diagnostic).messageText,
            "\n"
        );

        expect(actual).toBe(`Failure. (ESM check, profile "client")\n  Detail.`);
    });

    it("reports TS2835 unlabelled w/ esm check off", () => {
        const diagnostic = createTsDiagnostic(2835, "Failure.");

        const actual = reportResultDiagnostic({ client: { esm: { runtime: "node", check: "off" } } }, diagnostic).messageText;

        expect(actual).toBe("Failure.");
    });

    it("reports TS1479 unlabelled w/ esm profile on Program path", () => {
        const program = createNodeNextProgram();

        const actual = reportWith({ client: { esm: { runtime: "node" } } }, program, 1479);

        expect(actual).toEqual([[ts.DiagnosticCategory.Error, expect.not.stringContaining("ESM check")]]);
    });

    it("reports no TS2835 w/ esm profile on fast path", () => {
        const fileSystem = createSystem(
            {
                "package.json": JSON.stringify({ type: "module" }),
                "src/target.ts": `import { a } from "./dep";\nexport const x = a;`,
                "src/dep.ts": `export const a = 1;`,
            },
            { virtual: true }
        );
        const reporter = new ReporterMock(fileSystem);
        const target = jest.spyOn(reporter, "reportDiagnostic");
        const testObj = new CompilerTestClass(
            {
                reporter,
                config: { profiles: { client: { esm: { runtime: "node" } } } },
                profile: "client",
                tsConfig: { ...NODENEXT_NAMES, target: ts.ScriptTarget.ESNext, sourceMap: false },
                cliArgs: { fileNames: ["/src/target.ts", "/src/dep.ts"], options: {}, errors: [] },
            },
            undefined,
            fileSystem
        );

        testObj.compile();
        const actual = target.mock.calls.map(([cur]) => cur.code).filter(cur => cur === 2835);

        expect(actual).toEqual([]);
    });
});
