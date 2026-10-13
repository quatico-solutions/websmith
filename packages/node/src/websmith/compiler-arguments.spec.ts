/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { parseCliArguments } from "./compiler-arguments";

describe("parseCliArguments", () => {
    it("should return pretty false without arguments and files", () => {
        const result = parseCliArguments({}, []);

        expect(result).toEqual(["--pretty", "false"]);
    });

    it("should return array with boolean value argument", () => {
        const result = parseCliArguments({ noEmit: true }, []);

        expect(result).toEqual(["--noEmit", "--pretty", "false"]);
    });

    it("should return array with project argument", () => {
        const result = parseCliArguments({ project: "expected/tsconfig.json" }, []);

        expect(result).toEqual(["--project", "expected/tsconfig.json", "--pretty", "false"]);
    });

    it("should return array with string value argument", () => {
        const result = parseCliArguments({ outDir: "out" }, []);

        expect(result).toEqual(["--outDir", "out", "--pretty", "false"]);
    });

    it("should return array with number value argument", () => {
        const result = parseCliArguments({ target: 99 }, []);

        expect(result).toEqual(["--target", "ESNext", "--pretty", "false"]);
    });

    it("should return array with array value argument", () => {
        const result = parseCliArguments({ rootDirs: ["src", "test"] }, []);

        expect(result).toEqual(["--rootDirs", "src,test", "--pretty", "false"]);
    });

    it("should throw error with MapLike value argument", () => {
        expect(() => parseCliArguments({ paths: { "@/*": ["src/*"] } }, [])).toThrow("Unknown value type: object");
    });

    it("should return array with single files value", () => {
        const result = parseCliArguments({}, ["src/index.ts"]);

        expect(result).toEqual(["--pretty", "false", "src/index.ts"]);
    });

    it("should return array with multiple files value", () => {
        const result = parseCliArguments({}, ["src/index.ts", "src/main.ts"]);

        expect(result).toEqual(["--pretty", "false", "src/index.ts", "src/main.ts"]);
    });

    it("should return array with files value with options", () => {
        const result = parseCliArguments({ outDir: "out" }, ["src/index.ts", "src/main.ts"]);

        expect(result).toEqual(["--outDir", "out", "--pretty", "false", "src/index.ts", "src/main.ts"]);
    });

    it("should return array with target name for value 12", () => {
        const actual = parseCliArguments({ target: 12 }, []);

        expect(actual).toEqual(["--target", "ES2025", "--pretty", "false"]);
    });

    it("should add ignoreConfig before files with tsc version 6", () => {
        const actual = parseCliArguments({ outDir: "out" }, ["src/index.ts"], "6.0.3");

        expect(actual).toEqual(["--outDir", "out", "--pretty", "false", "--ignoreConfig", "src/index.ts"]);
    });

    it("should add ignoreConfig with tsc version 7", () => {
        const actual = parseCliArguments({}, ["src/index.ts"], "7.0.0");

        expect(actual).toEqual(["--pretty", "false", "--ignoreConfig", "src/index.ts"]);
    });

    it("should not add ignoreConfig with tsc version 5", () => {
        const actual = parseCliArguments({}, ["src/index.ts"], "5.7.3");

        expect(actual).toEqual(["--pretty", "false", "src/index.ts"]);
    });

    it("should not add ignoreConfig without tsc version", () => {
        const actual = parseCliArguments({}, ["src/index.ts"], undefined);

        expect(actual).toEqual(["--pretty", "false", "src/index.ts"]);
    });

    it("should not add ignoreConfig with unparsable tsc version", () => {
        const actual = parseCliArguments({}, ["src/index.ts"], "garbage");

        expect(actual).toEqual(["--pretty", "false", "src/index.ts"]);
    });

    it("should not add ignoreConfig without files and tsc version 6", () => {
        const actual = parseCliArguments({ help: true }, [], "6.0.3");

        expect(actual).toEqual(["--help", "--pretty", "false"]);
    });

    it("should add ignoreConfig once with ignoreConfig option and tsc version 6", () => {
        const actual = parseCliArguments({ ignoreConfig: true }, ["src/index.ts"], "6.0.3");

        expect(actual).toEqual(["--ignoreConfig", "--pretty", "false", "src/index.ts"]);
    });

    it("should add pretty false without pretty option", () => {
        const actual = parseCliArguments({ noEmit: true }, ["src/index.ts"]);

        expect(actual).toEqual(["--noEmit", "--pretty", "false", "src/index.ts"]);
    });

    it("should pass pretty w/o false with pretty option true", () => {
        const actual = parseCliArguments({ pretty: true }, ["src/index.ts"]);

        expect(actual).toEqual(["--pretty", "src/index.ts"]);
    });

    it("should pass pretty false once with pretty option false", () => {
        const actual = parseCliArguments({ pretty: false }, ["src/index.ts"]);

        expect(actual).toEqual(["--pretty", "false", "src/index.ts"]);
    });
});
