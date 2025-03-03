/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compileSystem } from "../../testing";
import { parsedCommandLine } from "./parsed-command-line";

describe("parsedCommandLine w/ empty tsconfig.json", () => {
    it("yields empty config with empty config file", () => {
        const { fileSystem: target } = compileSystem();

        const actual = parsedCommandLine("tsconfig.json", target);

        expect(actual.compileOnSave).toBe(false);
        expect(actual.fileNames).toEqual([]);
        expect(actual.options).toEqual({ configFilePath: "/tsconfig.json" });
        expect(actual.projectReferences).toBeUndefined();
        expect(actual.raw).toEqual({});
        expect(actual.typeAcquisition).toEqual({ enable: false, exclude: [], include: [] });
        expect(actual.watchOptions).toBeUndefined();
        expect(actual.wildcardDirectories).toEqual({ "": 1 });
    });

    it("yields error with no matching includes", () => {
        const { fileSystem: target } = compileSystem();

        const actual = parsedCommandLine("tsconfig.json", target);

        expect(actual.errors[0]).toEqual(
            expect.objectContaining({
                messageText: `No inputs were found in config file '/tsconfig.json'. Specified 'include' paths were '["**/*"]' and 'exclude' paths were '[]'.`,
            })
        );
        expect(actual.errors).toHaveLength(1);
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

        const actual = parsedCommandLine("tsconfig.json", target);

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

        const actual = parsedCommandLine("tsconfig.json", target);

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
        const actual = parsedCommandLine("tsconfig.json", target);

        expect(actual.compileOnSave).toBe(false);
        expect(actual.fileNames).toEqual(["/one.tsx", "/two.tsx", "/three.tsx"]);
        expect(actual.options).toEqual({
            configFilePath: "/tsconfig.json",
            jsx: 2,
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
        const actual = parsedCommandLine("tsconfig.json", target);

        expect(actual.errors).toEqual([]);
    });
});
