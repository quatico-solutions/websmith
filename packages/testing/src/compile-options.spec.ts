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
            addons: expect.any(Object),
            buildDir: "/src",
            reporter: expect.any(Object),
            debug: false,
            sourceMap: false,
            transpileOnly: false,
            watch: false,
            project: {
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.Latest,
                configFilePath: "./tsconfig.json",
            },
            targets: [],
            tsconfig: {
                options: {
                    outDir: "./dist",
                },
                fileNames: [],
                errors: [],
            },
        });
    });
});
