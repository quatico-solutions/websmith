/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { parseNumberValue } from "./compiler-options";

describe("parseNumberValue", () => {
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
