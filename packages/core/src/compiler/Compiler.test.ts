/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ReporterMock } from "../../test";
import { compileSystem } from "../testing";
import { Compiler } from "./Compiler";

describe("end-2-end compile w/ websmith", () => {
    it("should yield compiled js files", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "tsconfig.json": "{}",
                "src/one.ts": `whatever`,
                "src/two.ts": `whatever`,
            },
        });

        const actual = new Compiler(
            {
                reporter: new ReporterMock(target),
                tsConfig: { outDir: "./bin" },
            },
            undefined,
            target
        ).compile();

        expect(actual.diagnostics).toEqual([]);
        expect(actual.emitSkipped).toBe(false);
        expect(target.fileExists("/bin/one.js")).toBe(true);
        expect(target.fileExists("/bin/two.js")).toBe(true);
    });

    it("should yield compiled d.ts files", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "tsconfig.json": "{}",
                "src/one.ts": `whatever`,
                "src/two.ts": `whatever`,
            },
        });

        const actual = new Compiler(
            {
                reporter: new ReporterMock(target),
                tsConfig: { outDir: "./bin", declaration: true, declarationMap: true },
            },
            undefined,
            target
        ).compile();

        expect(actual.diagnostics).toEqual([]);
        expect(actual.emitSkipped).toBe(false);
        expect(target.fileExists("/bin/one.d.ts")).toBe(true);
        expect(target.fileExists("/bin/two.d.ts")).toBe(true);
    });
});
