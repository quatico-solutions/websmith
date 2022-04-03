/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
/* eslint-disable no-console */

import { Command } from "commander";
import path from "path";
import ts from "typescript";
import { Compiler, NoReporter } from "../compiler";
import { createBrowserSystem } from "../environment";
import { addCompileCommand, hasInvalidTargets } from "./command";
import { createOptions } from "./options";

let testSystem: ts.System;

describe("addCompileCommand", () => {
    beforeEach(() => {
        testSystem = createBrowserSystem({});
        testSystem.writeFile("./tsconfig.json", "{}");
    });

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

    it("should set the default options w/o any config", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse([], { from: "user" });

        const actual = target.getOptions();

        // @ts-ignore Private property access
        expect(actual.addons.availableAddons).toEqual([]);
        expect(actual.config).toBeUndefined();
        expect(actual.debug).toBe(false);
        expect(actual.project).toEqual({
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
            module: 1,
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
            typeRoots: [expect.stringContaining("/@types"), expect.stringContaining("/@types")],
            allowSyntheticDefaultImports: true,
            types: ["node", "jest", "raw-loader", "scss-parser", "lodash"],
            incremental: true,
            skipLibCheck: true,
            noEmit: false,
            downlevelIteration: true,
            alwaysStrict: true,
            allowJs: true,
        });
        expect(actual.reporter).toBeDefined();
        expect(actual.sourceMap).toBe(false);
        expect(actual.targets).toEqual(["*"]);
        expect(actual.watch).toBe(false);
    });

    it("should yield default options w/o any CLI argument", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse([], { from: "user" });

        const actual = target.getOptions();

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
                    module: 1,
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
                        types: ["node", "jest", "raw-loader", "scss-parser", "lodash"],
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
        expect(actual.sourceMap).toBe(false);
        expect(actual.config).toBeUndefined();
        expect(actual.addons).toEqual(
            expect.objectContaining({
                availableAddons: [],
            })
        );
        expect(actual.debug).toBe(false);
        expect(actual.buildDir).toEqual(expect.stringContaining("/")), expect(actual.watch).toBe(false);
        expect(actual.targets).toEqual(["*"]);
        expect(actual.project).toEqual(
            expect.objectContaining({
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
                module: 1,
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
            })
        );
    });

    it("should set targets w/ single target cli argument", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse(["--targets", "expected"], { from: "user" });

        expect(target.getOptions().targets).toEqual(["expected"]);
    });

    it("should set target  w/ comma separated target cli argument", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse(["--targets", "one, two, three"], { from: "user" });

        expect(target.getOptions().targets).toEqual(["one", "two", "three"]);
    });

    it("should show warning  w/ missing path in --addonsDir cli argument", () => {
        console.warn = jest.fn();

        addCompileCommand(new Command()).parse(["--addonsDir", "./unknown"], { from: "user" });

        expect(console.warn).toHaveBeenCalledWith('Warning: Addons directory "./unknown" does not exist.');
    });

    it("should not add addon name to addons  w/ --addons cli argument and unknown name", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse(["--addons", "unknown"], { from: "user" });

        expect(target.getOptions().addons.getAddons()).toEqual([]);
    });

    it("should add addon name to addons w/ --addons cli argument and known name", () => {
        testSystem.writeFile("./addons/expected/addon.ts", "export const activate = () => {};");
        jest.mock(
            "/addons/expected/addon",
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
                .map(it => it.name)
        ).toEqual(["expected"]);
    });

    it("should set config option  w/ --config cli argument", () => {
        testSystem.writeFile("./expected/websmith.config.json", "{}");
        const target = new Compiler(createOptions({}, new NoReporter()), testSystem);

        addCompileCommand(new Command(), target).parse(["--config", "./expected/websmith.config.json"], { from: "user" });

        expect(target.getOptions().config?.configFilePath).toEqual(expect.stringContaining("/expected/websmith.config.json"));
    });

    it("should set project option  w/ --project cli argument", () => {
        testSystem.writeFile("expected/tsconfig.json", "{}");
        const target = new Compiler(createOptions({}, new NoReporter()), testSystem);

        addCompileCommand(new Command(), target).parse(["--project", "expected/tsconfig.json"], { from: "user" });

        expect(target.getOptions().project.configFilePath).toEqual(expect.stringContaining("/expected/tsconfig.json"));
    });

    it("should set sourceMap option  w/ --sourceMap cli argument", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse(["--sourceMap"], { from: "user" });

        expect(target.getOptions().sourceMap).toBe(true);
    });

    it("should set debug compiler option  w/ --debug cli argument", () => {
        const target = new Compiler(createOptions({}, new NoReporter()));

        addCompileCommand(new Command(), target).parse(["--debug"], { from: "user" });

        expect(target.getOptions().debug).toBe(true);
    });

    it.skip("should set watch compiler option  w/ --watch cli argument", () => {
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

export const toAbsolute = (filePath: string) => (path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath));
