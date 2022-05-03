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
import { AddonRegistry, CompileFragment, CompilerOptions, NoReporter } from "@websmith/compiler";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import ts from "typescript";
import { Compilation } from "webpack";
import { PluginOptions } from "./plugin";
import { TsCompiler } from "./TsCompiler";

class TestCompiler extends TsCompiler {
    private sys: ts.System | undefined;

    constructor(options: CompilerOptions, pluginOptions?: PluginOptions, webpackTarget = "*") {
        super(options, pluginOptions, webpackTarget);
        this.sys = super.getSystem();
    }

    public setProgram(program: ts.Program): this {
        this.program = program;
        return this;
    }

    public setSystem(system: ts.System | undefined): this {
        this.sys = system;
        return this;
    }

    public getSystem(): ts.System {
        return this.sys as any;
    }

    public stubEmitSourceFile(func: (fileName: string, target: string, writeFile: boolean) => CompileFragment) {
        super.emitSourceFile = func;
    }
}

describe("TsCompiler", () => {
    let testObj: TestCompiler;
    let expected: string;

    beforeEach(() => {
        expected = resolve("./__data__/one.ts");
        const reporter = new NoReporter();
        testObj = new TestCompiler(
            {
                addons: new AddonRegistry({ addonsDir: "./addons", reporter: reporter, system: ts.sys }),
                buildDir: resolve("./__data__/.build"),
                project: { declaration: true, target: 99, noEmitOnError: true },
                reporter,
                targets: [],
                tsconfig: { options: {}, fileNames: [expected], errors: [] },
                debug: true,
                sourceMap: false,
                watch: false,
            },
            undefined,
            "*"
        );
    });

    it("should return the program", () => {
        const expected = {} as ts.Program;
        testObj.setProgram(expected);

        const actual = testObj.getProgram();

        expect(actual).toBe(expected);
    });

    it("should throw error in build w/o system", () => {
        testObj.setSystem(undefined);

        expect(() => testObj.build("./src/one.ts")).toThrow(new Error("TsCompiler.build() not called with ts.sys as the active ts.System"));
    });

    it('should provide transpiled compilation fragment w/ build, default config, "*" target and source code', () => {
        const expected = { version: 42, files: [{ name: "expected.ts", text: "expected" }] };
        const target = jest.fn().mockReturnValue(expected);
        testObj.stubEmitSourceFile(target);

        const actual = testObj.build("expected.ts");

        expect(actual).toEqual(expected);
        expect(target).toHaveBeenCalledWith("expected.ts", "*", false);
    });

    it("should fail with invalid source code", () => {
        createSource(expected, "const () => 1;");
        const target = jest.fn();
        console.error = target;

        testObj.build(expected);

        expect(target).toHaveBeenCalledWith("Variable declaration expected.");

        rmSync(resolve("./__data__"), { recursive: true, force: true });
    });

    it('should provide transpiled compilation fragment w/ build, "*" target and source code', () => {
        const expected = resolve("./__data__/one.ts");
        createSource(expected, "export const one = () => 1;");
        const reporter = new NoReporter();
        testObj = new TestCompiler(
            {
                addons: new AddonRegistry({ addonsDir: "./addons", reporter: reporter, system: ts.sys }),
                buildDir: resolve("./__data__/.build"),
                project: { declaration: true, target: 99 },
                reporter,
                targets: [],
                tsconfig: { options: { declaration: true, target: 99 }, fileNames: [expected], errors: [] },
                debug: true,
                sourceMap: false,
                watch: false,
            },
            undefined,
            "*"
        );

        const actual = testObj.build(expected);

        expect(actual.files.map(f => f.name)).toEqual([resolve("./__data__/one.js"), resolve("./__data__/one.d.ts")]);
        expect(actual.files.find(f => f.name.endsWith(".js"))?.text).toBe("export const one = () => 1;\n");
        expect(actual.files.find(f => f.name.endsWith(".d.ts"))?.text).toBe("export declare const one: () => number;\n");

        rmSync(resolve("./__data__"), { recursive: true, force: true });
    });

    it('should provide transpiled compilation fragment w/ build, "fragment" and "write" target and source code', () => {
        const expected = resolve("./__data__/one.ts");
        createSource(expected, "export const one = () => 1;");
        const reporter = new NoReporter();
        testObj = new TestCompiler(
            {
                addons: new AddonRegistry({ addonsDir: "./addons", reporter: reporter, system: ts.sys }),
                buildDir: resolve("./__data__/.build"),
                config: {
                    configFilePath: resolve("./__data__/websmith.config.json"),
                    targets: {
                        fragment: { options: { declaration: true } },
                        write: { writeFile: true, options: { module: 1, target: 1 } },
                    },
                },
                project: { target: 99, outDir: resolve("./__data__/.build") },
                reporter,
                targets: ["fragment", "write"],
                tsconfig: { options: { target: 99 }, fileNames: [expected], errors: [] },
                debug: false,
                sourceMap: false,
                watch: false,
            },
            undefined,
            "fragment"
        );

        const actual = testObj.build(expected);

        expect(actual.files.map(f => f.name)).toEqual([resolve("./__data__/.build/one.js"), resolve("./__data__/.build/one.d.ts")]);
        expect(actual.files.find(f => f.name.endsWith(".js"))?.text).toBe("export const one = () => 1;\n");
        expect(actual.files.find(f => f.name.endsWith(".d.ts"))?.text).toBe("export declare const one: () => number;\n");
        expect(readFileSync(resolve("./__data__/.build/one.js"), "utf8")).toMatchInlineSnapshot(`
            "\\"use strict\\";
            Object.defineProperty(exports, \\"__esModule\\", { value: true });
            exports.one = void 0;
            var one = function () { return 1; };
            exports.one = one;
            "
        `);
        expect(existsSync(resolve("./__data__/.build/one.d.ts"))).toBe(false);

        rmSync(resolve("./__data__"), { recursive: true, force: true });
    });

    it("should add compilation fragment to compilation output assets", () => {
        const target = { assets: {}, compiler: { outputPath: "./lib" } } as Compilation;
        const expected = { version: 11, files: [{ name: "./src/one.d.ts", text: "declare const expected: (): void", writeByteOrderMark: false }] };
        testObj.fragment = expected;

        testObj.provideDeclarationFilesToWebpack(target);

        expect(target).toEqual({
            assets: {
                "../src/one.d.ts": {
                    _value: "declare const expected: (): void",
                    _valueAsBuffer: undefined,
                    _valueAsString: "declare const expected: (): void",
                    _valueIsBuffer: false,
                },
            },
            compiler: { outputPath: "./lib" },
        });
    });

    it("should not attempt to add to compilation output assets w/o compilation fragment", () => {
        const target = { assets: {}, compiler: { outputPath: "./lib" } } as Compilation;

        testObj.provideDeclarationFilesToWebpack(target);

        expect(target).toEqual({ assets: {}, compiler: { outputPath: "./lib" } });
    });
});

const createSource = (fileName: string, text: string) => {
    const dir = dirname(fileName);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fileName, text);
};

// export class TsCompiler extends Compiler {
//     public fragment?: CompileFragment;
//     public pluginConfig?: PluginOptions;

//     public buildClient(resourcePath: string): CompileFragment {
//         if (this.getSystem() !== ts.sys) {
//             throw new Error("TsCompiler.buildClient() called with wrong system");
//         }

//         const fileName = uPath.normalize(resourcePath);
//         const result = super.emitSourceFile(fileName, "client", false);
//         if (result.files.length === 0) {
//             this.langService
//                 .getSemanticDiagnostics(fileName)
//                 .forEach(cur => this.pluginConfig?.error?.(new WebpackError(cur.messageText.toString())));
//         }
//         return result;
//     }

//     public buildServer(resourcePath: string): CompileFragment {
//         const fileName = uPath.normalize(resourcePath);
//         const result = super.emitSourceFile(fileName, "server", true);
//         if (result.files.length === 0) {
//             this.langService
//                 .getSemanticDiagnostics(fileName)
//                 .forEach(cur => this.pluginConfig?.error?.(new WebpackError(cur.messageText.toString())));
//         }
//         return result;
//     }

//     public provideDeclarationFilesToWebpack(compilation: webpack.Compilation): void {
//         if (!this.fragment) {
//             return;
//         }
//         this.outputFilesToAsset(this.fragment.files, compilation, (file: ts.OutputFile) => !file.name.match(/\.d.ts$/i));
//     }

//     private outputFileToAsset(outputFile: ts.OutputFile, compilation: webpack.Compilation) {
//         const assetPath = uPath.relative(compilation.compiler.outputPath, outputFile.name);
//         compilation.assets[assetPath] = new sources.RawSource(outputFile.text);
//     }

//     private outputFilesToAsset<T extends ts.OutputFile>(
//         outputFiles: T[] | IterableIterator<T>,
//         compilation: webpack.Compilation,
//         skipOutputFile?: (outputFile: T) => boolean
//     ) {
//         for (const outputFile of outputFiles) {
//             if (!skipOutputFile || !skipOutputFile(outputFile)) {
//                 this.outputFileToAsset(outputFile, compilation);
//             }
//         }
//     }
// }
