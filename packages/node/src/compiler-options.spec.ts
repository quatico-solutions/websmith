/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { parseNumberValue } from "./compiler-options";

describe("parseNumberValue", () => {
    it.each([
        [0, "ES3"],
        [1, "ES5"],
        [2, "ES2015"],
        [3, "ES2016"],
        [4, "ES2017"],
        [5, "ES2018"],
        [6, "ES2019"],
        [7, "ES2020"],
        [8, "ES2021"],
        [9, "ES2022"],
        [10, "ES2023"],
        [11, "ES2024"],
        [12, "ES2025"],
        [99, "ESNext"],
    ])("should return target name for value %d", (value, expected) => {
        const actual = parseNumberValue("target", value);

        expect(actual).toBe(expected);
    });

    it("should return target value", () => {
        expect(parseNumberValue("target", 99)).toEqual("ESNext");
    });

    it("should return importsNotUsedAsValues value", () => {
        expect(parseNumberValue("importsNotUsedAsValues", 1)).toEqual("Preserve");
    });

    it("should return jsx value", () => {
        expect(parseNumberValue("jsx", 2)).toEqual("React");
    });

    it("should return module value", () => {
        expect(parseNumberValue("module", 100)).toEqual("Node16");
    });

    it("should return module value with workaround for value 99", () => {
        expect(parseNumberValue("module", 99)).toEqual("ESNext");
    });

    it("should return moduleResolution value", () => {
        expect(parseNumberValue("moduleResolution", 1)).toEqual("Classic");
    });

    it("should return moduleDetection value", () => {
        expect(parseNumberValue("moduleDetection", 1)).toEqual("Legacy");
    });

    it("should return newLine value", () => {
        expect(parseNumberValue("newLine", 1)).toEqual("LineFeed");
    });

    it("should throw error with unknown key", () => {
        expect(() => parseNumberValue("unknown", 1)).toThrow('Unknown key: "unknown" with number value: "1"');
    });
});
