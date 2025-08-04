/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { createSystem } from "../environment";
import { parsedCommandLine } from "../compiler";
import { NoReporter } from "../compiler/NoReporter";
import { createWatchHost } from "./compile-service";

describe("createWatchHost", () => {
    describe("createHash", () => {
        it("returns same hash code", () => {
            const target = createSystem({}, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            expect(testObj.createHash!("Foobar")).toHaveLength(64);
        });
    });

    describe("directoryExists", () => {
        it("returns false for non-existing path", () => {
            const target = createSystem({}, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.directoryExists!("does-not-exist");

            expect(actual).toBe(false);
        });

        it("returns true for existing path", () => {
            const target = createSystem({ "folder/one.js": `class One {}` }, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.directoryExists!("folder");

            expect(actual).toBe(true);
        });
    });

    describe("fileExists", () => {
        it("returns false for non-existing path", () => {
            const target = createSystem({}, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.fileExists("does-not-exist.js");

            expect(actual).toBe(false);
        });

        it("returns true for existing path", () => {
            const target = createSystem({ "folder/one.js": `class One {}` }, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.fileExists("folder/one.js");

            expect(actual).toBe(true);
        });
    });

    describe("getCurrentDirectory", () => {
        it("returns root directory", () => {
            const target = createSystem({}, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            expect(testObj.getCurrentDirectory()).toBe("/");
        });
    });

    describe("getDefaultLibFileName", () => {
        it("returns lib.es2015.d.ts", () => {
            const target = createSystem({}, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.getDefaultLibFileName(config.options);

            expect(actual).toBe("/lib.d.ts");
        });
    });

    describe("getDirectories", () => {
        it("returns empty array for non-existing path", () => {
            const target = createSystem({}, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.getDirectories!("does-not-exist");

            expect(actual).toEqual([]);
        });

        it("returns file path array for existing path with content", () => {
            const target = createSystem(
                {
                    "folder/one.js": `class One {}`,
                    "folder/two.js": `class Two {}`,
                    "folder/foo/three.js": `class Three {}`,
                },
                { virtual: true }
            );
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.getDirectories!("folder");

            expect(actual).toEqual(["foo"]);
        });

        it("returns empty array for existing path with no directories", () => {
            const target = createSystem(
                {
                    "folder/one.js": `class One {}`,
                    "folder/two.js": `class Two {}`,
                    "folder/foo/three.js": `class Three {}`,
                },
                { virtual: true }
            );
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.getDirectories!("folder/foo");

            expect(actual).toEqual([]);
        });
    });

    describe("getNewLine", () => {
        it("return same new line character", () => {
            const target = createSystem({ "tsconfig.json": "{}" }, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            expect(testObj.getNewLine()).toBe("\n");
        });
    });

    describe("useCaseSensitiveFileNames", () => {
        it("return same value", () => {
            const target = createSystem({}, { virtual: true, useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            expect(testObj.useCaseSensitiveFileNames()).toBe(ts.sys.useCaseSensitiveFileNames);
        });
    });

    describe("readDirectory", () => {
        it("returns empty array for non-existing directory path", () => {
            const target = createSystem({}, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.readDirectory!("does-not-exist", [".scss"], [], []);

            expect(actual).toEqual([]);
        });

        it("returns empty array for existing directory with non-matching file names", () => {
            const target = createSystem(
                {
                    "folder/one.js": `class One {}`,
                    "folder/two.js": `class Two {}`,
                    "folder/foo/three.js": `class Three {}`,
                },
                { virtual: true }
            );
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.readDirectory!("folder/foo", [".scss"], [], []);

            expect(actual).toEqual([]);
        });

        it("returns file paths for existing directory and matching file names", () => {
            const target = createSystem(
                {
                    "folder/one.js": `class One {}`,
                    "folder/two.js": `class Two {}`,
                    "folder/foo/three.js": `class Three {}`,
                },
                { virtual: true }
            );
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.readDirectory!("folder/foo", [".js"], [], []);

            expect(actual).toEqual(["/folder/foo/three.js"]);
        });
    });

    describe("readFile", () => {
        it("returns undefined for non-existing file", () => {
            const target = createSystem({}, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.readFile("non-existing.js");

            expect(actual).toBeUndefined();
        });

        it("returns file content for existing file", () => {
            const target = createSystem({ "folder/one.js": `class One {}` }, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.readFile("folder/one.js");

            expect(actual).toBe("class One {}");
        });
    });

    describe("realpath", () => {
        it("returns input path with relative path", () => {
            const target = createSystem({}, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.realpath!("./whatever.js");

            expect(actual).toBe("./whatever.js");
        });

        it("returns input path with absolute path", () => {
            const target = createSystem({}, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.realpath!("/foobar/whatever.js");

            expect(actual).toBe("/foobar/whatever.js");
        });

        it("returns absolute path with directory path", () => {
            const target = createSystem({}, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.realpath!("foobar");

            expect(actual).toBe("/foobar");
        });

        it("returns input path with file path", () => {
            const target = createSystem({}, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.realpath!("foobar.tsx");

            expect(actual).toBe("foobar.tsx");
        });

        it("returns current directory with empty path", () => {
            const target = createSystem({}, { virtual: true });
            const config = parsedCommandLine("tsconfig.json", {}, target);
            const testObj = createWatchHost(config.fileNames, config.options, target, new NoReporter());

            const actual = testObj.realpath!("");

            expect(actual).toBe("/");
        });
    });
});
