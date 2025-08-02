/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { compileSystem } from "../../testing";
import { createArgs, parsedCommandLine } from "./parsed-command-line";

describe("parsedCommandLine w/ empty tsconfig.json", () => {
    it("yields empty config with empty config file", () => {
        const { fileSystem: target } = compileSystem();

        const actual = parsedCommandLine("tsconfig.json", {}, target);

        expect(actual.compileOnSave).toBe(false);
        expect(actual.fileNames).toEqual([]);
        expect(actual.options).toEqual({ configFilePath: "/tsconfig.json" });
        expect(actual.projectReferences).toBeUndefined();
        expect(actual.raw).toEqual({});
        expect(actual.typeAcquisition).toEqual({ enable: false, exclude: [], include: [] });
        expect(actual.watchOptions).toBeUndefined();
        expect(actual.wildcardDirectories).toEqual({ "": 1 });
    });

    it("yields default tsconfig.json with no includes", () => {
        const { fileSystem: target } = compileSystem({ files: { "/test.ts": "export const test = () => {};" } });

        const actual = parsedCommandLine("tsconfig.json", {}, target);

        expect(actual.errors).toEqual([]);
        expect(actual.options).toEqual({ configFilePath: "/tsconfig.json" });
    });
});

describe("parsedCommandLine w/ valid tsconfig.json", () => {
    it("yields default value with valid config file", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "tsconfig.json": JSON.stringify({
                    include: ["foobar.ts"],
                }),
                "foobar.ts": `class Foobar {}`,
            },
        });

        const actual = parsedCommandLine("tsconfig.json", {}, target);

        expect(actual.compileOnSave).toBe(false);
        expect(actual.fileNames).toEqual(["/foobar.ts"]);
        expect(actual.options).toEqual({ configFilePath: "/tsconfig.json" });
        expect(actual.projectReferences).toBeUndefined();
        expect(actual.raw).toEqual({ include: ["foobar.ts"] });
        expect(actual.typeAcquisition).toEqual({ enable: false, exclude: [], include: [] });
        expect(actual.watchOptions).toBeUndefined();
        expect(actual.wildcardDirectories).toEqual({});
    });

    it("yields no error with matching includes", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "tsconfig.json": JSON.stringify({
                    include: ["foobar.ts"],
                }),
                "foobar.ts": `class Foobar {}`,
            },
        });

        const actual = parsedCommandLine("tsconfig.json", {}, target);

        expect(actual.errors).toEqual([]);
    });
});

describe("parsedCommandLine w/ default tsconfig.json", () => {
    const { fileSystem: target } = compileSystem({
        files: {
            "tsconfig.json": JSON.stringify({
                include: ["**/*.tsx"],
                compilerOptions: {
                    strict: true,
                    lib: ["dom", "es2015"],
                    jsx: "react",
                },
            }),
            "/one.tsx": `class One {}`,
            "/two.tsx": `class Two {}`,
            "/three.tsx": `class Three {}`,
        },
    });

    it("yields default value with valid config file", () => {
        const actual = parsedCommandLine("tsconfig.json", {}, target);

        expect(actual.compileOnSave).toBe(false);
        expect(actual.fileNames).toEqual(["/one.tsx", "/two.tsx", "/three.tsx"]);
        expect(actual.options).toEqual({
            configFilePath: "/tsconfig.json",
            jsx: ts.JsxEmit.React,
            lib: ["lib.dom.d.ts", "lib.es2015.d.ts"],
            strict: true,
        });
        expect(actual.projectReferences).toBeUndefined();
        expect(actual.raw).toEqual({
            compilerOptions: {
                jsx: "react",
                lib: ["dom", "es2015"],
                strict: true,
            },
            include: ["**/*.tsx"],
        });
        expect(actual.typeAcquisition).toEqual({ enable: false, exclude: [], include: [] });
        expect(actual.watchOptions).toBeUndefined();
        expect(actual.wildcardDirectories).toEqual({ "": 1 });
    });

    it("yields no error with matching includes", () => {
        const actual = parsedCommandLine("tsconfig.json", {}, target);

        expect(actual.errors).toEqual([]);
    });
});

describe("parsedCommandLine w/ extra args", () => {
    const { fileSystem: target } = compileSystem({
        files: {
            "tsconfig.json": JSON.stringify({
                include: ["**/*.tsx"],
                compilerOptions: {
                    strict: true,
                    lib: ["dom", "es2015"],
                    jsx: "react",
                },
            }),
            "/one.tsx": `class One {}`,
            "/two.tsx": `class Two {}`,
            "/three.tsx": `class Three {}`,
        },
    });

    const DEFAULT_RAW = {
        compilerOptions: {
            jsx: "react",
            lib: ["dom", "es2015"],
            strict: true,
        },
        include: ["**/*.tsx"],
    };

    it("returns empty array with valid tsconfig.json and empty args", () => {
        const actual = parsedCommandLine("tsconfig.json", {}, target);

        expect(actual).toEqual({
            compileOnSave: false,
            errors: [],
            fileNames: ["/one.tsx", "/two.tsx", "/three.tsx"],
            options: {
                configFilePath: "/tsconfig.json",
                jsx: ts.JsxEmit.React,
                lib: ["lib.dom.d.ts", "lib.es2015.d.ts"],
                strict: true,
            },
            raw: {
                compilerOptions: {
                    jsx: "react",
                    lib: ["dom", "es2015"],
                    strict: true,
                },
                include: ["**/*.tsx"],
            },
            typeAcquisition: { enable: false, exclude: [], include: [] },
            wildcardDirectories: { "": 1 },
        });
    });

    it("returns empty array with valid tsconfig.json and jsx args", () => {
        const actual = parsedCommandLine("tsconfig.json", { jsx: "preserve" }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                jsx: ts.JsxEmit.Preserve,
            },
            raw: {
                ...DEFAULT_RAW,
                compilerOptions: {
                    jsx: "react",
                },
            },
        });
    });

    it("returns empty array with valid tsconfig.json and allowJs args", () => {
        const actual = parsedCommandLine("tsconfig.json", { allowJs: true }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                allowJs: true,
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and checkJs args", () => {
        const actual = parsedCommandLine("tsconfig.json", { checkJs: true }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                checkJs: true,
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and declaration args", () => {
        const actual = parsedCommandLine("tsconfig.json", { declaration: true }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                declaration: true,
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and declarationMap args", () => {
        const actual = parsedCommandLine("tsconfig.json", { declarationMap: true }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                declarationMap: true,
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and emitDeclarationOnly args", () => {
        const actual = parsedCommandLine("tsconfig.json", { emitDeclarationOnly: true }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                emitDeclarationOnly: true,
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and esModuleInterop args", () => {
        const actual = parsedCommandLine("tsconfig.json", { esModuleInterop: true }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                esModuleInterop: true,
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and lib args", () => {
        const actual = parsedCommandLine("tsconfig.json", { lib: ["es2017", "es2020.number"] }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                lib: ["lib.es2017.d.ts", "lib.es2020.number.d.ts"],
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and module args", () => {
        const actual = parsedCommandLine("tsconfig.json", { module: "commonjs" }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                module: ts.ModuleKind.CommonJS,
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and noEmit args", () => {
        const actual = parsedCommandLine("tsconfig.json", { noEmit: true }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                noEmit: true,
            },
            raw: {
                compilerOptions: {
                    jsx: "react",
                    lib: ["dom", "es2015"],
                    strict: true,
                },
            },
        });
    });

    it("returns empty array with valid tsconfig.json and outDir args", () => {
        const actual = parsedCommandLine("tsconfig.json", { outDir: "dist" }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                outDir: "dist",
            },
            raw: {
                compilerOptions: {
                    jsx: "react",
                    lib: ["dom", "es2015"],
                    strict: true,
                },
            },
        });
    });

    it("returns empty array with valid tsconfig.json and outFile args", () => {
        const actual = parsedCommandLine("tsconfig.json", { outFile: "bundle.js" }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                outFile: "bundle.js",
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and pretty args", () => {
        const actual = parsedCommandLine("tsconfig.json", { pretty: true }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                pretty: true,
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and removeComments args", () => {
        const actual = parsedCommandLine("tsconfig.json", { removeComments: true }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                removeComments: true,
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and sourceMap args", () => {
        const actual = parsedCommandLine("tsconfig.json", { sourceMap: true }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                sourceMap: true,
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and strict args", () => {
        const actual = parsedCommandLine("tsconfig.json", { strict: false }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                strict: false,
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and target args", () => {
        const actual = parsedCommandLine("tsconfig.json", { target: "es2020" }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                target: ts.ScriptTarget.ES2020,
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and types args", () => {
        const actual = parsedCommandLine("tsconfig.json", { types: ["node", "jest"] }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                types: ["node", "jest"],
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and debug args", () => {
        const actual = parsedCommandLine("tsconfig.json", { debug: true }, target);

        expect(actual).toEqual({
            compileOnSave: false,
            errors: [],
            fileNames: ["/one.tsx", "/two.tsx", "/three.tsx"],
            options: {
                configFilePath: "/tsconfig.json",
                jsx: ts.JsxEmit.React,
                lib: ["lib.dom.d.ts", "lib.es2015.d.ts"],
                strict: true,
            },
            raw: {
                compilerOptions: {
                    jsx: "react",
                    lib: ["dom", "es2015"],
                    strict: true,
                },
                include: ["**/*.tsx"],
            },
            projectReferences: undefined,
            typeAcquisition: { enable: false, exclude: [], include: [] },
            watchOptions: undefined,
            wildcardDirectories: { "": 1 },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and transpileOnly args", () => {
        const actual = parsedCommandLine("tsconfig.json", { transpileOnly: true }, target);

        expect(actual).toEqual({
            compileOnSave: false,
            errors: [],
            fileNames: ["/one.tsx", "/two.tsx", "/three.tsx"],
            options: {
                configFilePath: "/tsconfig.json",
                jsx: ts.JsxEmit.React,
                lib: ["lib.dom.d.ts", "lib.es2015.d.ts"],
                strict: true,
            },
            raw: {
                compilerOptions: {
                    jsx: "react",
                    lib: ["dom", "es2015"],
                    strict: true,
                },
                include: ["**/*.tsx"],
            },
            typeAcquisition: { enable: false, exclude: [], include: [] },
            wildcardDirectories: { "": 1 },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("returns empty array with valid tsconfig.json and watch args", () => {
        const actual = parsedCommandLine("tsconfig.json", { watch: true }, target);

        expect(actual).toMatchObject({
            errors: [],
            options: {
                watch: true,
            },
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("handles websmith-specific args (addons) gracefully", () => {
        const actual = parsedCommandLine("tsconfig.json", { addons: "addon1,addon2" }, target);

        expect(actual).toMatchObject({
            errors: [],
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("handles websmith-specific args (addonsDir) gracefully", () => {
        const actual = parsedCommandLine("tsconfig.json", { addonsDir: "./addons" }, target);

        expect(actual).toMatchObject({
            errors: [],
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("handles websmith-specific args (configFile) gracefully", () => {
        const actual = parsedCommandLine("tsconfig.json", { configFile: "custom.json" }, target);

        expect(actual).toMatchObject({
            errors: [],
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("handles websmith-specific args (profile) gracefully", () => {
        const actual = parsedCommandLine("tsconfig.json", { profile: "development" }, target);

        expect(actual).toMatchObject({
            errors: [],
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("handles websmith-specific args (project) gracefully", () => {
        const actual = parsedCommandLine("tsconfig.json", { project: "./src" }, target);

        expect(actual).toMatchObject({
            errors: [],
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });

    it("handles files array args correctly", () => {
        const actual = parsedCommandLine("tsconfig.json", { files: ["file1.ts", "file2.ts"] }, target);

        expect(actual).toMatchObject({
            errors: [],
        });
        expect(actual.raw).toEqual(DEFAULT_RAW);
    });
});

describe("createArgs", () => {
    it("returns empty array with empty object", () => {
        const actual = createArgs({});

        expect(actual).toEqual([]);
    });

    it("returns array with key and string value", () => {
        const actual = createArgs({ addons: "foo" });

        expect(actual).toEqual(["--addons", "foo"]);
    });

    it("returns array with key and boolean value", () => {
        const actual = createArgs({ allowJs: true });

        expect(actual).toEqual(["--allowJs"]);
    });

    it("returns array with key and array value", () => {
        const actual = createArgs({ lib: ["dom", "es2015"] });

        expect(actual).toEqual(["--lib", "dom,es2015"]);
    });

    it("returns array with key and undefined value", () => {
        const actual = createArgs({ addons: undefined });

        expect(actual).toEqual([]);
    });

    it("returns array with multiple string values", () => {
        const actual = createArgs({ addons: "foo", profile: "dev" });

        expect(actual).toEqual(["--addons", "foo", "--profile", "dev"]);
    });

    it("returns array with multiple boolean values", () => {
        const actual = createArgs({ allowJs: true, checkJs: true, debug: false });

        expect(actual).toEqual(["--allowJs", "--checkJs"]);
    });

    it("returns array with mixed value types", () => {
        const actual = createArgs({
            addons: "foo",
            allowJs: true,
            lib: ["dom", "es2015"],
            outDir: "dist",
            debug: false,
            transpileOnly: undefined,
        });

        expect(actual).toEqual(["--addons", "foo", "--allowJs", "--lib", "dom,es2015", "--outDir", "dist"]);
    });

    it("returns array with null value", () => {
        const actual = createArgs({ addons: null as any });

        expect(actual).toEqual(["--addons", ""]);
    });

    it("returns array with number value", () => {
        const actual = createArgs({ target: "es2020" as any });

        expect(actual).toEqual(["--target", "es2020"]);
    });

    it("returns array with empty array value", () => {
        const actual = createArgs({ lib: [] });

        expect(actual).toEqual(["--lib", ""]);
    });

    it("returns array with single item array value", () => {
        const actual = createArgs({ lib: ["dom"] });

        expect(actual).toEqual(["--lib", "dom"]);
    });

    it("returns array with files array", () => {
        const actual = createArgs({ files: ["file1.ts", "file2.ts", "file3.ts"] });

        expect(actual).toEqual(["--files", "file1.ts,file2.ts,file3.ts"]);
    });

    it("returns array with types array", () => {
        const actual = createArgs({ types: ["node", "jest"] });

        expect(actual).toEqual(["--types", "node,jest"]);
    });

    it("handles all CompilerArguments properties", () => {
        const testObj = createArgs({
            addons: "addon1,addon2",
            addonsDir: "./addons",
            allowJs: true,
            checkJs: false,
            configFile: "custom.json",
            debug: true,
            declaration: true,
            declarationMap: false,
            emitDeclarationOnly: true,
            esModuleInterop: false,
            files: ["file1.ts", "file2.ts"],
            jsx: "preserve",
            lib: ["dom", "es2015"],
            module: "commonjs",
            noEmit: true,
            outDir: "dist",
            outFile: "bundle.js",
            pretty: false,
            profile: "development",
            project: "./src",
            removeComments: true,
            sourceMap: false,
            strict: true,
            target: "es2020",
            transpileOnly: false,
            types: ["node", "jest"],
            watch: true,
        });

        const expected = [
            "--addons",
            "addon1,addon2",
            "--addonsDir",
            "./addons",
            "--allowJs",
            "--configFile",
            "custom.json",
            "--debug",
            "--declaration",
            "--emitDeclarationOnly",
            "--files",
            "file1.ts,file2.ts",
            "--jsx",
            "preserve",
            "--lib",
            "dom,es2015",
            "--module",
            "commonjs",
            "--noEmit",
            "--outDir",
            "dist",
            "--outFile",
            "bundle.js",
            "--profile",
            "development",
            "--project",
            "./src",
            "--removeComments",
            "--strict",
            "--target",
            "es2020",
            "--types",
            "node,jest",
            "--watch",
        ];

        expect(testObj).toEqual(expected);
    });
});

describe("parsedCommandLine comprehensive coverage", () => {
    it("ensures all CompilerArguments properties are processed without errors", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "tsconfig.json": JSON.stringify({
                    include: ["*.ts"],
                    compilerOptions: {
                        strict: true,
                    },
                }),
                "test.ts": `export const test = "hello";`,
            },
        });

        const testObj = parsedCommandLine(
            "tsconfig.json",
            {
                addons: "addon1,addon2",
                addonsDir: "./addons",
                allowJs: true,
                checkJs: true,
                configFile: "custom.json",
                debug: true,
                declaration: true,
                declarationMap: true,
                emitDeclarationOnly: true,
                esModuleInterop: true,
                files: ["file1.ts", "file2.ts"],
                jsx: "preserve",
                lib: ["dom", "es2015"],
                module: "commonjs",
                noEmit: true,
                outDir: "dist",
                outFile: "bundle.js",
                pretty: true,
                profile: "development",
                project: "./src",
                removeComments: true,
                sourceMap: true,
                strict: false,
                target: "es2020",
                transpileOnly: true,
                types: ["node", "jest"],
                watch: true,
            },
            target
        );

        expect(testObj.errors).toEqual([]);
        expect(testObj.options.allowJs).toBe(true);
        expect(testObj.options.checkJs).toBe(true);
        expect(testObj.options.declaration).toBe(true);
        expect(testObj.options.declarationMap).toBe(true);
        expect(testObj.options.emitDeclarationOnly).toBe(true);
        expect(testObj.options.esModuleInterop).toBe(true);
        expect(testObj.options.jsx).toBe(ts.JsxEmit.Preserve);
        expect(testObj.options.lib).toEqual(["lib.dom.d.ts", "lib.es2015.d.ts"]);
        expect(testObj.options.module).toBe(ts.ModuleKind.CommonJS);
        expect(testObj.options.noEmit).toBe(true);
        expect(testObj.options.outDir).toBe("dist");
        expect(testObj.options.outFile).toBe("bundle.js");
        expect(testObj.options.pretty).toBe(true);
        expect(testObj.options.removeComments).toBe(true);
        expect(testObj.options.sourceMap).toBe(true);
        expect(testObj.options.strict).toBe(false);
        expect(testObj.options.target).toBe(ts.ScriptTarget.ES2020);
        expect(testObj.options.transpileOnly).toBe(true);
        expect(testObj.options.types).toEqual(["node", "jest"]);
        expect(testObj.options.watch).toBe(true);
        expect(testObj.options.listFiles).toBe(true); // debug flag becomes listFiles
    });
});
