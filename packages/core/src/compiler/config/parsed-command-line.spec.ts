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
        const { fileSystem: target } = compileSystem();

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
});
