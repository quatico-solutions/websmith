import { parseCliArguments } from "./compiler-arguments";

describe("parseCliArguments", () => {
    it("should return empty array without arguments and files", () => {
        const result = parseCliArguments({}, []);

        expect(result).toEqual([]);
    });

    it("should return array with boolean value argument", () => {
        const result = parseCliArguments({ noEmit: true }, []);

        expect(result).toEqual(["--noEmit"]);
    });

    it("should return array with string value argument", () => {
        const result = parseCliArguments({ outDir: "out" }, []);

        expect(result).toEqual(["--outDir", "out"]);
    });

    it("should return array with number value argument", () => {
        const result = parseCliArguments({ target: 99 }, []);

        expect(result).toEqual(["--target", "ESNext"]);
    });

    it("should return array with array value argument", () => {
        const result = parseCliArguments({ rootDirs: ["src", "test"] }, []);

        expect(result).toEqual(["--rootDirs", "src,test"]);
    });

    it("should throw error with MapLike value argument", () => {
        expect(() => parseCliArguments({ paths: { "@/*": ["src/*"] } }, [])).toThrow("Unknown value type: object");
    });

    it("should return array with single files value", () => {
        const result = parseCliArguments({}, ["src/index.ts"]);

        expect(result).toEqual(["src/index.ts"]);
    });

    it("should return array with multiple files value", () => {
        const result = parseCliArguments({}, ["src/index.ts", "src/main.ts"]);

        expect(result).toEqual(["src/index.ts", "src/main.ts"]);
    });

    it("should return array with files value with options", () => {
        const result = parseCliArguments({ outDir: "out" }, ["src/index.ts", "src/main.ts"]);

        expect(result).toEqual(["--outDir", "out", "src/index.ts", "src/main.ts"]);
    });
});
