/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createBrowserSystem } from "../environment";
import ts from "typescript";
import { resolveCompilerOptions } from "./resolve-options";

describe("compileOptions", () => {
    it("should return correct defaults", () => {
        const actual = resolveCompilerOptions(createBrowserSystem());

        expect(actual).toEqual({
            buildDir: "/src",
            reporter: expect.any(Object),
            debug: false,
            watch: false,
            tsConfig: {
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.Latest,
                configFilePath: "./tsconfig.json",
            },
            cliArgs: {
                options: {
                    outDir: "./dist",
                },
                fileNames: [],
                errors: [],
            },
        });
    });
});
