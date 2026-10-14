/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompileFragment } from "@quatico/websmith-core";
import { pickOutput } from "./output";

const fragment = (files: Record<string, string>): CompileFragment => ({
    version: 0,
    files: Object.entries(files).map(([name, text]) => ({ name, text, writeByteOrderMark: false })),
    writtenFiles: [],
});

describe("pickOutput", () => {
    it.each(["js", "jsx", "mjs", "cjs"])("should return code of %s file w/ output file", extension => {
        const actual = pickOutput(fragment({ [`main.${extension}`]: "export const x = 1;" }))?.code;

        expect(actual).toBe("export const x = 1;");
    });

    it("should return parsed map w/ map file", () => {
        const actual = pickOutput(fragment({ "main.js": "whatever", "main.js.map": `{"version":3,"sources":["main.ts"]}` }))?.map;

        expect(actual).toEqual({ version: 3, sources: ["main.ts"] });
    });

    it("should return null map w/o map file", () => {
        const actual = pickOutput(fragment({ "main.js": "whatever" }))?.map;

        expect(actual).toBeNull();
    });

    it("should strip sourceMappingURL comment w/ comment in code", () => {
        const actual = pickOutput(fragment({ "main.js": "export const x = 1;\n//# sourceMappingURL=main.js.map\n" }))?.code;

        expect(actual).toBe("export const x = 1;\n\n");
    });

    it("should return null w/ declaration file only", () => {
        const actual = pickOutput(fragment({ "main.d.ts": "export declare const x: number;" }));

        expect(actual).toBeNull();
    });

    it("should return null w/ empty fragment of unconfigured profile", () => {
        const actual = pickOutput(fragment({}));

        expect(actual).toBeNull();
    });
});
