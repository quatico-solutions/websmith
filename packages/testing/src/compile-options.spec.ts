/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createBrowserSystem } from "@quatico/websmith-core";
import ts from "typescript";
import { compileOptions } from "./compile-options";

describe("compileOptions", () => {
    it("should return correct defaults", () => {
        const actual = compileOptions(createBrowserSystem());

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
            targets: [],
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
