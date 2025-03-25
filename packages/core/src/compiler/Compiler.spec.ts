/* eslint-disable @typescript-eslint/no-unsafe-argument */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import ts from "typescript";
import { ReporterMock } from "../../test";
import { compileSystem } from "../testing";
import { type CompilationContext } from "./compilation";
import { Compiler, type CompileFragment } from "./Compiler";
import { type CompilerOptions, type WebpackLoaderOptions } from "./options";

class CompilerTestClass extends Compiler {
    constructor(options: Partial<CompilerOptions>, loaderOptions: Partial<WebpackLoaderOptions>, system: ts.System) {
        super(options, loaderOptions, system);
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
}

describe("getSystem", () => {
    it("returns the system passed to options", () => {
        const { fileSystem: expected } = compileSystem();

        const testObj = new CompilerTestClass({ reporter: new ReporterMock(expected) }, {}, expected);

        expect(testObj.getSystem()).toBe(expected);
    });
});

describe("setOptions", () => {
    it("replaces compiler options", () => {
        const expected = {
            tsConfig: {
                react: 1,
            },
        } as unknown as CompilerOptions;
        const { fileSystem: target } = compileSystem();
        const testObj = new CompilerTestClass({ reporter: new ReporterMock(target) }, {}, target);

        testObj.setOptions(expected);

        // reporter is not set in the expected object
        expect(testObj.getOptions()).toMatchObject(expected);
    });

    it("yields buildDir with compiler options", () => {
        const { entry, fileSystem: target } = compileSystem({
            files: { "src/target.ts": `class Target {}` },
        }).getSourceFile("src/target.ts");

        new CompilerTestClass(
            {
                reporter: new ReporterMock(target),
                tsConfig: { outDir: "/expected" },
                cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
            },
            {},
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
        const { fileSystem } = compileSystem();
        const target = { reporter: new ReporterMock(fileSystem) };

        const actual = new CompilerTestClass(
            {
                ...target,
                configFile: "./expected/websmith.config.json",
                config: {
                    profiles: {
                        "*": {
                            config: expected,
                        },
                    },
                },
            },
            {},
            fileSystem
        ).createCompilationContext("*");

        expect(actual).toMatchObject({
            cliArgs: {
                errors: [],
                fileNames: [],
                options: {
                    module: ts.ModuleKind.ESNext,
                    target: ts.ScriptTarget.ESNext,
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
        const { fileSystem } = compileSystem({
            files: {
                "./expected/tsconfig.json": `
                {
                    "include": ["**/*.ts"],
                }
                `,
            },
        });
        const target = { reporter: new ReporterMock(fileSystem) };

        const actual = new CompilerTestClass(
            {
                ...target,
                configFile: "./expected/websmith.config.json",
                tsConfigFile: "./expected/tsconfig.json",
                config: {
                    profiles: {
                        "*": {
                            config: expected,
                        },
                    },
                },
            },
            {},
            fileSystem
        ).createCompilationContext("*");

        expect(actual).toMatchObject({
            ResultProcessors: [],
            generators: [],
            processors: [],
            transformers: {},
            rootFiles: [],
            cliArgs: {
                compileOnSave: false,
                errors: [],
                fileNames: [],
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
        const { fileSystem } = compileSystem();

        const testObj = new CompilerTestClass({ reporter: new ReporterMock(fileSystem) }, {}, fileSystem);
        testObj.report = jest.fn();

        testObj.compile();

        expect(testObj.report).toHaveBeenCalled();
    });

    it("updates the CompilerOptions with the target specific overrides", () => {
        const { fileSystem } = compileSystem();
        const target = { reporter: new ReporterMock(fileSystem), config: { profiles: { "*": {} } } };

        const testObj = new CompilerTestClass(target, {}, fileSystem).setOptions({
            ...target,
            config: {
                ...target.config,
                profiles: {
                    "*": {
                        tsConfig: { outDir: "./lib/expected" },
                    },
                },
            },
            profile: "*",
        });

        testObj.compile();

        expect(testObj.getContext("*")?.getCliArgs().options).toEqual(
            expect.objectContaining({
                outDir: "./lib/expected",
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ESNext,
            })
        );
    });

    it("yields output w/ with defaults", () => {
        const { fileSystem } = compileSystem({
            files: { "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` },
        });

        new CompilerTestClass({ reporter: new ReporterMock(fileSystem) }, {}, fileSystem).compile();

        expect(fileSystem.readFile("/src/target.js")).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
    });

    it("yields output w/ with addons but w/o profiles", () => {
        const { fileSystem } = compileSystem({
            files: { "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` },
        });

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
            {},
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
        const { entry, fileSystem } = compileSystem({
            files: { "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` },
        }).getSourceFile("src/target.ts");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: true },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

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
        const { entry, fileSystem } = compileSystem({
            files: { "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` },
        }).getSourceFile("src/target.ts");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: true },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

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
        const { entry, fileSystem } = compileSystem({
            files: { "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` },
        }).getSourceFile("src/target.ts");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: false, sourceMap: false },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
            config: { transpileOnly: true },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map", ".js.map")).toHaveLength(0);
    });

    it("yields modified client function, no declaration, no declaration map, no sourceMap w/ transpileOnly and declaration", () => {
        const { entry, fileSystem } = compileSystem({
            files: {
                "src/target.ts": `
                export const computeDate = async (): Promise<Date> => new Date();
            `,
            },
        }).getSourceFile("src/target.ts");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: true, declarationMap: false, sourceMap: false },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
            config: { transpileOnly: true },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map", ".js.map")).toHaveLength(0);
    });

    it("yields modified client function, no declaration, no declaration map, no sourceMap w/ transpileOnly, declaration and declarationMap", () => {
        const { entry, fileSystem } = compileSystem({
            files: {
                "src/target.ts": `
                export const computeDate = async (): Promise<Date> => new Date();
            `,
            },
        }).getSourceFile("src/target.ts");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: true, declarationMap: true, sourceMap: false },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
            config: { transpileOnly: true },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map", ".js.map")).toHaveLength(0);
    });

    it("yields modified client function, no declaration, sourceMap w/ transpileOnly and sourceMap", () => {
        const { entry, fileSystem } = compileSystem({
            files: {
                "src/target.ts": `
                export const computeDate = async (): Promise<Date> => new Date();
            `,
            },
        }).getSourceFile("src/target.ts");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: false, declarationMap: false, sourceMap: true },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
            config: { transpileOnly: true },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            //# sourceMappingURL=target.js.map"
        `);
        expect(getText("target.js.map", actual)).toMatchInlineSnapshot(
            `"{"version":3,"file":"target.js","sourceRoot":"","sources":["target.ts"],"names":[],"mappings":"AACgB,MAAM,CAAC,MAAM,WAAW,GAAG,KAAK,IAAmB,EAAE,CAAC,IAAI,IAAI,EAAE,CAAC"}"`
        );
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map")).toHaveLength(0);
    });

    it("yields modified client function, no declaration, no sourceMap w/ no transpileOnly", () => {
        const { entry, fileSystem } = compileSystem({
            files: {
                "src/target.ts": `
                export const computeDate = async (): Promise<Date> => new Date();
            `,
            },
        }).getSourceFile("src/target.ts");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: false, sourceMap: false },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map", ".js.map")).toHaveLength(0);
    });

    it("yields modified client function, declaration, no declaration map, no sourceMap w/ no transpileOnly and declaration", () => {
        const { entry, fileSystem } = compileSystem({
            files: {
                "src/target.ts": `
                export const computeDate = async (): Promise<Date> => new Date();
            `,
            },
        }).getSourceFile("src/target.ts");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: true, declarationMap: false, sourceMap: false },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

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
        const { entry, fileSystem } = compileSystem({
            files: {
                "src/target.ts": `
                export const computeDate = async (): Promise<Date> => new Date();
            `,
            },
        }).getSourceFile("src/target.ts");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: true, declarationMap: true, sourceMap: false },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getText("target.d.ts", actual)).toMatchInlineSnapshot(`
            "export declare const computeDate: () => Promise<Date>;
            //# sourceMappingURL=target.d.ts.map"
        `);
        expect(getText("target.d.ts.map", actual)).toMatchInlineSnapshot(
            `"{"version":3,"file":"target.d.ts","sourceRoot":"","sources":["target.ts"],"names":[],"mappings":"AACgB,eAAO,MAAM,WAAW,QAAa,OAAO,CAAC,IAAI,CAAe,CAAC"}"`
        );
        expect(getFilesByExtension(actual, ".js.map")).toHaveLength(0);
    });

    it("yields modified client function, no declaration, sourceMap w/ no transpileOnly and sourceMap", () => {
        const { entry, fileSystem } = compileSystem({
            files: {
                "src/target.ts": `
                export const computeDate = async (): Promise<Date> => new Date();
            `,
            },
        }).getSourceFile("src/target.ts");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: false, declarationMap: false, sourceMap: true },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            //# sourceMappingURL=target.js.map"
        `);
        expect(getText("target.js.map", actual)).toMatchInlineSnapshot(
            `"{"version":3,"file":"target.js","sourceRoot":"","sources":["target.ts"],"names":[],"mappings":"AACgB,MAAM,CAAC,MAAM,WAAW,GAAG,KAAK,IAAmB,EAAE,CAAC,IAAI,IAAI,EAAE,CAAC"}"`
        );
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map")).toHaveLength(0);
    });

    it("yields transpiled client function w/ transpileOnly", () => {
        const { entry, fileSystem } = compileSystem({
            files: {
                "src/target.ts": `
                export const computeDate = async (): Promise<Date> => new Date();
            `,
            },
        }).getSourceFile("src/target.ts");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: false, declarationMap: false, sourceMap: false },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
            config: { transpileOnly: true },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map", ".js.map")).toHaveLength(0);
    });

    it("yields transpiled client function w/o transpileOnly", () => {
        const { entry, fileSystem } = compileSystem({
            files: {
                "src/target.ts": `
                export const computeDate = async (): Promise<Date> => new Date();
            `,
            },
        }).getSourceFile("src/target.ts");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: { declaration: false, declarationMap: false, sourceMap: false },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

        expect(getText("target.js", actual)).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(getFilesByExtension(actual, ".d.ts", ".d.ts.map", ".js.map")).toHaveLength(0);
    });

    it("yields transpiled json w/ transpileOnly", () => {
        const { entry, fileSystem } = compileSystem({
            files: { "src/config.json": `{"name":"test"}` },
        }).getSourceFile("src/config.json");
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
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
            config: { transpileOnly: true },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

        expect(getText("config.json", actual)).toMatchInlineSnapshot(`"{"name":"test"}"`);
    });

    it("yields transpiled json w/o transpileOnly", () => {
        const { entry, fileSystem } = compileSystem({
            files: { "src/config.json": `{"name":"test"}` },
        }).getSourceFile("src/config.json");
        const target = {
            reporter: new ReporterMock(fileSystem),
            tsConfig: {
                declaration: false,
                declarationMap: false,
                sourceMap: true,
                resolveJsonModule: true,
                outDir: "/build",
            },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

        expect(getText("config.json", actual)).toMatchInlineSnapshot(`
            "{ "name": "test" }
            "
        `);
    });

    it("yields transpiled d.ts w/ transpileOnly", () => {
        const { entry, fileSystem } = compileSystem({
            files: { "types/style.d.ts": `declare module "*.scss" { const content: Record<exportName, string[]>; export = content; }` },
        }).getSourceFile("types/style.d.ts");
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
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
            config: { transpileOnly: true },
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

        expect(actual.files).toEqual([]);
    });

    it("yields transpiled d.ts w/o transpileOnly", () => {
        const { entry, fileSystem } = compileSystem({
            files: { "types/style.d.ts": `declare module "*.scss" { const content: Record<exportName, string[]>; export = content; }` },
        }).getSourceFile("types/style.d.ts");
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
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
            buildDir: "./types",
        };

        const actual = new CompilerTestClass(target, {}, fileSystem)
            .createProfileContextsIfNecessary()
            .emitSourceFile(entry!.fileName, undefined, false);

        expect(actual.files).toEqual([]);
    });
});

describe("report", () => {
    it("yields result's messageText", () => {
        const fileSystem = compileSystem({
            files: { "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` },
        }).fileSystem;
        const options = { reporter: new ReporterMock(fileSystem) };
        const target = options.reporter;

        new CompilerTestClass(options, {}, fileSystem).report(
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
        const fileSystem = compileSystem().fileSystem;
        const options = { reporter: new ReporterMock(fileSystem) };
        const target = options.reporter;

        new CompilerTestClass(options, {}, fileSystem).report(
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
        const fileSystem = compileSystem({
            files: { "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` },
        }).fileSystem;

        const actual = new CompilerTestClass({ reporter: new ReporterMock(fileSystem) }, {}, fileSystem).report(
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
        const { entry, fileSystem } = compileSystem({
            files: { "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` },
        }).getSourceFile("src/target.ts");
        const options = {
            reporter: new ReporterMock(fileSystem),
            config: {
                profiles: { target: { config: "whatever" } },
            },
            tsConfig: { declaration: true, outDir: "/build" },
            cliArgs: { fileNames: [entry!.fileName], options: {}, errors: [] },
            watch: true,
            profile: "target",
        };

        const testObj = new Compiler(options, {}, fileSystem);

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

    it("should output to outDir w/ target outDir override", () => {
        const { entry, fileSystem } = compileSystem({
            files: { "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` },
        }).getSourceFile("src/target.ts");
        const options = {
            reporter: new ReporterMock(fileSystem),
            config: {
                profiles: { target: { tsConfig: { outDir: "/build" } } },
            },
            tsConfig: { declaration: true },
            cliArgs: { options: { outDir: "/build" }, fileNames: [entry!.fileName], errors: [] },
            watch: true,
            profile: "target",
        };

        const testObj = new Compiler(options, {}, fileSystem);

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
        const { entry, fileSystem } = compileSystem({
            files: { "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` },
        }).getSourceFile("src/target.ts");
        const options = {
            reporter: new ReporterMock(fileSystem),
            config: {
                profiles: {
                    target1: { tsConfig: { outDir: "/target1" } },
                    target2: {
                        depends: ["target1"],
                        tsConfig: { outDir: "/target2", declaration: true },
                    },
                },
            },
            tsConfig: { declaration: false },
            cliArgs: { options: { outDir: "/build" }, fileNames: [entry!.fileName], errors: [] },
            watch: true,
            profile: "target2",
        };

        const testObj = new Compiler(options, {}, fileSystem);

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
        const { entry, fileSystem } = compileSystem({
            files: {
                "src/target.ts": `
                export const computeDate = async (): Promise<Date> => new Date();
            `,
            },
        }).getSourceFile("src/target.ts");
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
            tsConfig: { declaration: true },
            cliArgs: { options: { outDir: "/build" }, fileNames: [entry!.fileName], errors: [] },
            watch: true,
            profile: "target2",
        };

        const testObj = new Compiler(options, {}, fileSystem);

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
        const { fileSystem } = compileSystem({
            files: {
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
        });

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
                    options: { outDir: "/build" },
                    fileNames: ["/src/shared1.ts", "/src/shared2.ts"],
                    errors: [],
                },
                watch: true,
                profile: "target1",
            },
            {},
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
        const { entry, fileSystem } = compileSystem({
            files: { "src/target.ts": `export const computeDate = async (): Promise<Date> => new Date();` },
        }).getSourceFile("src/target.ts");
        const options = {
            reporter: new ReporterMock(fileSystem),
            config: {
                profiles: {
                    target1: { tsConfig: { outDir: "/target1" } },
                },
            },
            tsConfig: { declaration: true },
            cliArgs: { options: { outDir: "/build" }, fileNames: [entry!.fileName], errors: [] },
            watch: true,
            profile: "target1",
        };

        const testObj = new CompilerTestClass(options, {}, fileSystem);

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
