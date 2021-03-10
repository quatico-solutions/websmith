// tslint:disable: object-literal-sort-keys
import * as path from "path";
import * as ts from "typescript";
import { createConfig } from "../compiler/Config";
import { createBrowserSystem } from "./browser-system";
import { createCompileHost } from "./compile-service";

const testSystem = createBrowserSystem({
    "tsconfig.json": `{
        exclude: ["node_modules"]
    }`,
    "folder/one.js": `class One {}`,
    "folder/two.js": `class Two {}`,
    "folder/foo/three.js": `class Three {}`,
});

describe("createCompileHost", () => {
    let expected: ts.CompilerHost;
    let target: ts.CompilerHost;
    const options = createConfig("tsconfig.json", testSystem).options;
    beforeEach(() => {
        expected = ts.createCompilerHost(options);
        target = createCompileHost({}, testSystem);
    });

    describe("createHash", () => {
        it("returns same hash code", () => {
            expect(target.createHash!("Foobar")).toBe(expected.createHash!("Foobar"));
        });
    });

    describe("directoryExists", () => {
        it("returns false for non-existing path", () => {
            const actual = target.directoryExists!("does-not-exist");

            expect(actual).toBe(expected.directoryExists!("does-not-exist"));
            expect(actual).toBe(false);
        });

        it("returns true for existing path", () => {
            const actual = target.directoryExists!("folder");

            expect(actual).toBe(true);
        });
    });

    describe("fileExists", () => {
        it("returns false for non-existing path", () => {
            const actual = target.fileExists("does-not-exist.js");

            expect(actual).toBe(expected.fileExists("does-not-exist.js"));
            expect(actual).toBe(false);
        });

        it("returns true for existing path", () => {
            target.writeFile("foobar.js", "whatever", false);

            const actual = target.fileExists("foobar.js");

            expect(actual).toBe(true);
        });
    });

    describe("getCanonicalFileName", () => {
        it("returns normalized filename with file path", () => {
            const actual = target.getCanonicalFileName("/zip/zap/zup/something.js");

            expect(actual).toBe(expected.getCanonicalFileName("/zip/zap/zup/something.js"));
            expect(actual).toBe(path.normalize("/zip/zap/zup/something.js"));
        });

        it("returns normalized filename with camelcase file path", () => {
            const actual = target.getCanonicalFileName("./FooBar/Something.js");

            expect(actual).toBe(expected.getCanonicalFileName("./FooBar/Something.js"));
            expect(actual).toBe("./foobar/something.js");
        });

        it("returns normalized filename with file name", () => {
            const actual = target.getCanonicalFileName("something.js");

            expect(actual).toBe(expected.getCanonicalFileName("something.js"));
            expect(actual).toBe(path.normalize("something.js"));
        });
    });

    describe("getCurrentDirectory", () => {
        it("returns root directory", () => {
            expect(target.getCurrentDirectory()).toBe("/");
        });
    });

    describe("getDefaultLibFileName", () => {
        it("returns lib.es2015.d.ts", () => {
            const actual = target.getDefaultLibFileName(options);

            expect(actual).toBe("/lib.es2015.d.ts");
        });
    });

    describe("getDirectories", () => {
        it("returns empty array for non-existing path", () => {
            const actual = target.getDirectories!("does-not-exist");

            expect(actual).toEqual(expected.getDirectories!("does-not-exist"));
            expect(actual).toEqual([]);
        });

        it("returns file path array for existing path with content", () => {
            const actual = target.getDirectories!("folder");

            expect(actual).toEqual(["foo"]);
        });

        it("returns empty array for existing path with no directories", () => {
            const actual = target.getDirectories!("folder/foo");

            expect(actual).toEqual([]);
        });
    });

    describe("getNewLine", () => {
        it("return same new line character", () => {
            expect(target.getNewLine()).toBe(expected.getNewLine());
        });
    });

    describe("useCaseSensitiveFileNames", () => {
        it("return same value", () => {
            expect(target.useCaseSensitiveFileNames()).toEqual(expected.useCaseSensitiveFileNames());
        });
    });

    describe("readDirectory", () => {
        it("returns empty array for non-existing directory path", () => {
            const actual = target.readDirectory!("does-not-exist", [".scss"], [], []);

            expect(actual).toEqual(expected.readDirectory!("does-not-exist", [".scss"], [], []));
            expect(actual).toEqual([]);
        });

        it("returns empty array for existing directory with non-matching file names", () => {
            const actual = target.readDirectory!("folder/foo", [".scss"], [], []);

            expect(actual).toEqual([]);
        });

        it("returns file paths for existing directory and matching file names", () => {
            const actual = target.readDirectory!("folder/foo", [".js"], [], []);

            expect(actual).toEqual(["folder/foo/three.js"]);
        });
    });

    describe("readFile", () => {
        it("returns undefined for non-existing file", () => {
            const actual = target.readFile("non-existing.js");

            expect(actual).toEqual(expected.readFile("non-existing.js"));
            expect(actual).toBeUndefined();
        });

        it("returns file content for existing file", () => {
            const actual = target.readFile("folder/one.js");

            expect(actual).toBe("class One {}");
        });
    });

    describe("realpath", () => {
        it("returns input path with relative path", () => {
            const actual = target.realpath!("./whatever.js");

            expect(actual).toBe(expected.realpath!("./whatever.js"));
            expect(actual).toBe("./whatever.js");
        });

        it("returns input path with absolute path", () => {
            const actual = target.realpath!("/foobar/whatever.js");

            expect(actual).toBe(expected.realpath!("/foobar/whatever.js"));
            expect(actual).toBe("/foobar/whatever.js");
        });

        it("returns absolute path with directory path", () => {
            const actual = target.realpath!("foobar");

            expect(actual).toBe("/foobar");
        });

        it("returns input path with file path", () => {
            const actual = target.realpath!("foobar.tsx");

            expect(actual).toBe(expected.realpath!("foobar.tsx"));
            expect(actual).toBe("foobar.tsx");
        });

        it("returns current directory with empty path", () => {
            const actual = target.realpath!("");

            expect(actual).toBe("/");
        });
    });

    describe("writeFile", () => {
        it("yields file content with valid name and content", () => {
            target.writeFile("one.scss", "whatever", false);

            const actual = target.readFile("one.scss");

            expect(actual).toBe("whatever");
        });

        it("yields file content with valid name and empty content", () => {
            target.writeFile("two.scss", "", false);

            const actual = target.readFile("two.scss");

            expect(actual).toBe("");
        });
    });
});
