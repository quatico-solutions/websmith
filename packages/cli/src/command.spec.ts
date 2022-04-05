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
/* eslint-disable no-console */

import { WarnMessage } from "@websmith/addon-api";
import { Compiler, CompilerAddon, createBrowserSystem, NoReporter } from "@websmith/compiler";
import { Command } from "commander";
import ts from "typescript";
import { addCompileCommand, hasInvalidTargets } from "./command";
import { createOptions } from "./options";

let testSystem: ts.System;
beforeEach(() => {
    testSystem = createBrowserSystem({});
    testSystem.createDirectory("./addons");
    testSystem.writeFile("./tsconfig.json", "{}");
});

describe("addCompileCommand", () => {
    it("should warn w/ unknown argument", () => {
        const testObj = addCompileCommand(new Command(), new Compiler(createOptions({}, new NoReporter())));

        // @ts-ignore
        testObj.help = jest.fn();
        console.error = jest.fn();

        testObj.parse(["unknown"], { from: "user" });

        expect(testObj.help).toHaveBeenCalledWith({ error: true });
        expect(console.error).toHaveBeenCalledWith(
            'Unknown Argument "unknown".\nIf this is a tsc command, please configure it in your typescript configuration file.\n'
        );
    });

    it("should yield default options w/o config and CLI arguments", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse([], { from: "user" });

        const actual = target.getOptions();

        expect(actual.addons).toEqual(
            expect.objectContaining({
                availableAddons: [],
            })
        );
        expect(actual.buildDir).toEqual(expect.stringContaining("/")), expect(actual.watch).toBe(false);
        expect(actual.config).toBeUndefined();
        expect(actual.debug).toBe(false);
        expect(actual.project).toEqual(
            expect.objectContaining({
                emitDecoratorMetadata: true,
                noImplicitReturns: true,
                pretty: true,
                target: 99,
                declarationMap: true,
                outDir: expect.stringContaining("/bin"),
                noImplicitThis: true,
                declaration: true,
                experimentalDecorators: true,
                noImplicitAny: true,
                removeComments: false,
                configFilePath: expect.stringContaining("/tsconfig.json"),
                module: 99,
                strict: true,
                strictBindCallApply: true,
                noEmitOnError: true,
                resolveJsonModule: true,
                useUnknownInCatchVariables: false,
                lib: ["lib.es2015.d.ts", "lib.es2016.d.ts", "lib.es2017.d.ts", "lib.esnext.d.ts", "lib.dom.d.ts"],
                strictFunctionTypes: true,
                noUnusedLocals: true,
                strictPropertyInitialization: true,
                moduleResolution: 2,
                importHelpers: true,
                sourceMap: false,
                strictNullChecks: true,
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                types: ["node", "jest"],
                incremental: true,
                skipLibCheck: true,
                noEmit: false,
                downlevelIteration: true,
                alwaysStrict: true,
                allowJs: true,
            })
        );

        expect(actual.tsconfig).toEqual(
            expect.objectContaining({
                options: {
                    emitDecoratorMetadata: true,
                    noImplicitReturns: true,
                    pretty: true,
                    target: 2,
                    declarationMap: true,
                    outDir: expect.stringContaining("/bin"),
                    noImplicitThis: true,
                    declaration: true,
                    experimentalDecorators: true,
                    noImplicitAny: true,
                    removeComments: false,
                    configFilePath: expect.stringContaining("/tsconfig.json"),
                    module: 99,
                    strict: true,
                    strictBindCallApply: true,
                    noEmitOnError: true,
                    resolveJsonModule: true,
                    useUnknownInCatchVariables: false,
                    lib: ["lib.es2015.d.ts", "lib.es2016.d.ts", "lib.es2017.d.ts", "lib.esnext.d.ts", "lib.dom.d.ts"],
                    strictFunctionTypes: true,
                    noUnusedLocals: true,
                    strictPropertyInitialization: true,
                    moduleResolution: 2,
                    importHelpers: true,
                    sourceMap: false,
                    strictNullChecks: true,
                    esModuleInterop: true,
                    typeRoots: [expect.stringContaining("/@types"), expect.stringContaining("/node_modules/@types")],
                    allowSyntheticDefaultImports: true,
                    types: ["node", "jest", "raw-loader", "scss-parser", "lodash"],
                    incremental: true,
                    skipLibCheck: true,
                    noEmit: false,
                    downlevelIteration: true,
                    alwaysStrict: true,
                    allowJs: true,
                },
                errors: [],
                typeAcquisition: {
                    include: [],
                    exclude: [],
                    enable: false,
                },
                compileOnSave: false,
                raw: {
                    include: ["src", "@types"],
                    compilerOptions: {
                        emitDecoratorMetadata: true,
                        noImplicitReturns: true,
                        pretty: true,
                        target: "es2015",
                        declarationMap: true,
                        outDir: "./bin",
                        noImplicitThis: true,
                        declaration: true,
                        experimentalDecorators: true,
                        noImplicitAny: true,
                        removeComments: false,
                        module: "commonjs",
                        strict: true,
                        inlineSources: true,
                        strictBindCallApply: true,
                        noEmitOnError: true,
                        resolveJsonModule: true,
                        useUnknownInCatchVariables: false,
                        lib: ["es2015", "es2016", "es2017", "esnext", "dom"],
                        strictFunctionTypes: true,
                        noUnusedLocals: true,
                        strictPropertyInitialization: true,
                        moduleResolution: "node",
                        importHelpers: true,
                        sourceMap: true,
                        strictNullChecks: true,
                        esModuleInterop: true,
                        typeRoots: ["./@types", "./node_modules/@types"],
                        allowSyntheticDefaultImports: true,
                        types: ["node", "jest"],
                        incremental: true,
                        skipLibCheck: true,
                        noEmit: false,
                        downlevelIteration: true,
                        alwaysStrict: true,
                        allowJs: true,
                    },
                    exclude: ["node_modules", "bin"],
                },
                wildcardDirectories: {},
            })
        );
        expect(actual.reporter).toBeDefined();
        expect(actual.sourceMap).toBe(false);
        expect(actual.targets).toEqual(["*"]);
        expect(actual.watch).toBe(false);
    });

    it("should set config option w/ --config cli argument", () => {
        testSystem.writeFile("./expected/websmith.config.json", "{}");
        const target = new Compiler(createOptions({}, new NoReporter()), testSystem);

        addCompileCommand(new Command(), target).parse(["--config", "./expected/websmith.config.json"], { from: "user" });

        expect(target.getOptions().config?.configFilePath).toEqual(expect.stringContaining("/expected/websmith.config.json"));
    });

    it("should set project option w/ --project cli argument", () => {
        testSystem.writeFile("expected/tsconfig.json", "{}");
        const target = new Compiler(createOptions({}, new NoReporter()), testSystem);

        addCompileCommand(new Command(), target).parse(["--project", "expected/tsconfig.json"], { from: "user" });

        expect(target.getOptions().project.configFilePath).toEqual(expect.stringContaining("/expected/tsconfig.json"));
    });

    it("should set sourceMap option w/ --sourceMap cli argument", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse(["--sourceMap"], { from: "user" });

        expect(target.getOptions().sourceMap).toBe(true);
    });

    it("should set debug compiler option w/ --debug cli argument", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse(["--debug"], { from: "user" });

        expect(target.getOptions().debug).toBe(true);
    });

    it.skip("should set watch compiler option w/ --watch cli argument", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse(["--watch"], { from: "user" });

        expect(target.getOptions().watch).toBe(true);
    });

    it("should execute compile w/o --watch cli argument", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));
        target.compile = jest.fn();

        addCompileCommand(new Command(), target).parse([], { from: "user" });

        expect(target.compile).toHaveBeenCalled();
    });

    it("should inform CLI user about tsconfig usage for unsupported command line arguments", () => {
        console.error = line => {
            throw new Error(line.toString());
        };
        const target = new Compiler(createOptions({}, new NoReporter()));

        expect(() => addCompileCommand(new Command(), target).parse(["--debug", "--allowJs", "--strict"], { from: "user" })).toThrow(
            `Unknown Argument "--allowJs".` + `\nIf this is a tsc command, please configure it in your typescript configuration file.\n`
        );
    });
});

describe("addCompileCommand#addons", () => {
    it("should show warning w/ --addonsDir cli argument and non-existing path", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));
        target.getReporter().reportDiagnostic = jest.fn();

        addCompileCommand(new Command(), target).parse(["--addonsDir", "./unknown"], { from: "user" });

        expect(target.getReporter().reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Addons directory "./unknown" does not exist.'));
    });

    it("should add addon name to addons w/ --addons cli argument and known name", () => {
        testSystem.writeFile("./addons/expected/addon.ts", "export const activate = () => {};");
        jest.mock(
            "/addons/expected/addon.ts",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const target = new Compiler(createOptions({}, new NoReporter()), testSystem);

        addCompileCommand(new Command(), target).parse(["--addons", "expected"], { from: "user" });

        expect(
            target
                .getOptions()
                .addons.getAddons()
                .map((it: CompilerAddon) => it.name)
        ).toEqual(["expected"]);
    });

    it("should add addon name to addons w/ --addons cli argument and multiple known names", () => {
        testSystem.writeFile("./addons/zip/addon.ts", "export const activate = () => {};");
        testSystem.writeFile("./addons/zap/addon.ts", "export const activate = () => {};");
        testSystem.writeFile("./addons/zup/addon.ts", "export const activate = () => {};");
        jest.mock(
            "/addons/zip/addon.ts",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        jest.mock(
            "/addons/zap/addon.ts",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        jest.mock(
            "/addons/zup/addon.ts",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const target = new Compiler(createOptions({}, new NoReporter()), testSystem);

        addCompileCommand(new Command(), target).parse(["--addons", "zip, zap, zup"], { from: "user" });

        expect(
            target
                .getOptions()
                .addons.getAddons()
                .map((it: CompilerAddon) => it.name)
        ).toEqual(["zip", "zap", "zup"]);
    });

    it("should not add addon name to addons w/ --addons cli argument and unknown name", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse(["--addons", "unknown"], { from: "user" });

        expect(target.getOptions().addons.getAddons()).toEqual([]);
    });

    it("should not add unkonwn addon name to addons w/ --addons cli argument, known and unknown name", () => {
        testSystem.writeFile("./addons/known/addon.ts", "export const activate = () => {};");
        jest.mock(
            "/addons/known/addon.ts",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const target = new Compiler(createOptions({}, new NoReporter()), testSystem);

        addCompileCommand(new Command(), target).parse(["--addons", "unknown, known"], { from: "user" });

        expect(
            target
                .getOptions()
                .addons.getAddons()
                .map((it: CompilerAddon) => it.name)
        ).toEqual(["known"]);
    });

    it("should show warning w/ --addons cli argument and unknown name", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));
        target.getReporter().reportDiagnostic = jest.fn();

        addCompileCommand(new Command(), target).parse(["--addons", "unknown"], { from: "user" });

        expect(target.getReporter().reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons: "unknown".'));
    });

    it("should show warning w/ --addons cli argument, known and unknown name", () => {
        testSystem.writeFile("./addons/known/addon.ts", "export const activate = () => {};");
        jest.mock(
            "/addons/known/addon.ts",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const target = new Compiler(createOptions({}, new NoReporter()), testSystem);
        target.getReporter().reportDiagnostic = jest.fn();

        addCompileCommand(new Command(), target).parse(["--addons", "known, unknown"], { from: "user" });

        expect(target.getReporter().reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons: "unknown".'));
    });
});

describe("addCompileCommand#targets", () => {
    it("should set targets w/ single targets cli argument", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse(["--targets", "expected"], { from: "user" });

        expect(target.getOptions().targets).toEqual(["expected"]);
    });

    it("should set target w/ comma separated targets cli argument", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse(["--targets", "one, two, three"], { from: "user" });

        expect(target.getOptions().targets).toEqual(["one", "two", "three"]);
    });

    it("should show warning w/ --targets cli argument and unknown name", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));
        target.getReporter().reportDiagnostic = jest.fn();

        addCompileCommand(new Command(), target).parse(["--targets", "unknown"], { from: "user" });

        expect(target.getReporter().reportDiagnostic).toHaveBeenCalledWith(
            new WarnMessage("Custom target configuration found, but no target provided.\nSome custom addons may not be applied during compilation.")
        );
    });

    it("should not show any warning w/ --targets cli argument and known names", () => {
        testSystem.writeFile("./websmith.config.json", '{ "targets": {"expected": {}} }');
        const target = new Compiler(createOptions({}, new NoReporter()), testSystem);
        target.getReporter().reportDiagnostic = jest.fn();

        addCompileCommand(new Command(), target).parse(["--targets", "expected"], { from: "user" });

        expect(target.getReporter().reportDiagnostic).not.toHaveBeenCalled();
    });

    it("should not show any warning w/ --targets cli argument and multiple known names", () => {
        testSystem.writeFile("./websmith.config.json", '{ "targets": {"zip": {}, "zap": {}, "zup": {}} }');
        const target = new Compiler(createOptions({}, new NoReporter()), testSystem);
        target.getReporter().reportDiagnostic = jest.fn();

        addCompileCommand(new Command(), target).parse(["--targets", "zip, zap, zup"], { from: "user" });

        expect(target.getReporter().reportDiagnostic).not.toHaveBeenCalled();
    });

    it("should show warning w/ --targets cli argument, known and unknown names", () => {
        testSystem.writeFile("./websmith.config.json", '{ "targets": {"whatever": {}, "known": {}} }');
        const target = new Compiler(createOptions({}, new NoReporter()), testSystem);
        target.getReporter().reportDiagnostic = jest.fn();

        addCompileCommand(new Command(), target).parse(["--targets", "unknown, known"], { from: "user" });

        expect(target.getReporter().reportDiagnostic).toHaveBeenCalledWith(
            new WarnMessage("Custom target configuration found, but no target provided.\nSome custom addons may not be applied during compilation.")
        );
    });

    it("should show warning w/ --targets cli argument, known name but missing addons for target", () => {
        testSystem.writeFile("./websmith.config.json", '{ "targets": {"known": { "addons": ["missing"]}} }');
        const target = new Compiler(createOptions({}, new NoReporter()), testSystem);
        target.getReporter().reportDiagnostic = jest.fn();

        addCompileCommand(new Command(), target).parse(["--targets", "known"], { from: "user" });

        expect(target.getReporter().reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for target "known": "missing".'));
    });

    it("should show warning w/ --targets cli argument, multiple known names but missing addons for targets", () => {
        testSystem.writeFile(
            "./websmith.config.json",
            '{ "targets": {"zip": { "addons": ["missing1"]}, "zap": { "addons": ["missing2"]}, "zup": { "addons": ["missing3"]}} }'
        );
        const target = new Compiler(createOptions({}, new NoReporter()), testSystem);
        target.getReporter().reportDiagnostic = jest.fn();

        addCompileCommand(new Command(), target).parse(["--targets", "zip, zap, zup"], { from: "user" });

        expect(target.getReporter().reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for target "zip": "missing1".'));
        expect(target.getReporter().reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for target "zap": "missing2".'));
        expect(target.getReporter().reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for target "zup": "missing3".'));
    });
});

describe("hasInvalidTargets", () => {
    it("should return true w/o CompilationConfig", () => {
        expect(hasInvalidTargets(["whatever"])).toBe(true);
    });

    it("should return false w/ valid target and CompilationConfig", () => {
        expect(
            hasInvalidTargets(["valid"], {
                targets: {
                    valid: {},
                },
            } as any)
        ).toBe(false);
    });

    it("should return true w/ invalid and valid target and CompilationConfig", () => {
        expect(
            hasInvalidTargets(["valid", "invalid"], {
                targets: {
                    valid: {},
                },
            } as any)
        ).toBe(true);
    });

    it('should return false w/ "*" target and others in CompilationConfig', () => {
        expect(
            hasInvalidTargets(["*"], {
                targets: {
                    one: {},
                    two: {},
                    three: {},
                },
            } as any)
        ).toBe(false);
    });

    it('should return true w/ "*" and invalid target and CompilationConfig', () => {
        expect(
            hasInvalidTargets(["*", "invalid"], {
                targets: {
                    one: {},
                    two: {},
                    three: {},
                },
            } as any)
        ).toBe(true);
    });
});
