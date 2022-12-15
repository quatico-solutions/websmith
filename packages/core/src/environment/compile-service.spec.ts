/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable jest/no-mocks-import */
import ts from "typescript";
import { ReporterMock } from "../../test";
import { resolveProjectConfig } from "../compiler";
import { createBrowserSystem } from "./browser-system";
import { createWatchHost } from "./compile-service";

const testSystem = createBrowserSystem({
    "tsconfig.json": JSON.stringify({
        exclude: ["node_modules"],
    }),
    "folder/one.js": `class One {}`,
    "folder/two.js": `class Two {}`,
    "folder/foo/three.js": `class Three {}`,
}, ts.sys.useCaseSensitiveFileNames);

describe("createWatchHost", () => {
    let target: ts.WatchCompilerHostOfFilesAndCompilerOptions<ts.SemanticDiagnosticsBuilderProgram>;
    const config = resolveProjectConfig("tsconfig.json", testSystem);
    beforeEach(() => {
        target = createWatchHost(config.fileNames, config.options, testSystem, new ReporterMock(testSystem));
    });

    describe("createHash", () => {
        it("returns same hash code", () => {
            expect(target.createHash!("Foobar")).toHaveLength(64);
        });
    });

    describe("directoryExists", () => {
        it("returns false for non-existing path", () => {
            const actual = target.directoryExists!("does-not-exist");

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

            expect(actual).toBe(false);
        });

        it("returns true for existing path", () => {
            const actual = target.fileExists("folder/one.js");

            expect(actual).toBe(true);
        });
    });

    describe("getCurrentDirectory", () => {
        it("returns root directory", () => {
            expect(target.getCurrentDirectory()).toBe("/");
        });
    });

    describe("getDefaultLibFileName", () => {
        it("returns lib.es2015.d.ts", () => {
            const actual = target.getDefaultLibFileName(config.options);

            expect(actual).toBe("/lib.d.ts");
        });
    });

    describe("getDirectories", () => {
        it("returns empty array for non-existing path", () => {
            const actual = target.getDirectories!("does-not-exist");

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
            expect(target.getNewLine()).toBe("\n");
        });
    });

    describe("useCaseSensitiveFileNames", () => {
        it("return same value", () => {
            expect(target.useCaseSensitiveFileNames()).toBe(ts.sys.useCaseSensitiveFileNames);
        });
    });

    describe("readDirectory", () => {
        it("returns empty array for non-existing directory path", () => {
            const actual = target.readDirectory!("does-not-exist", [".scss"], [], []);

            expect(actual).toEqual([]);
        });

        it("returns empty array for existing directory with non-matching file names", () => {
            const actual = target.readDirectory!("folder/foo", [".scss"], [], []);

            expect(actual).toEqual([]);
        });

        it("returns file paths for existing directory and matching file names", () => {
            const actual = target.readDirectory!("folder/foo", [".js"], [], []);

            expect(actual).toEqual(["/folder/foo/three.js"]);
        });
    });

    describe("readFile", () => {
        it("returns undefined for non-existing file", () => {
            const actual = target.readFile("non-existing.js");

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

            expect(actual).toBe("./whatever.js");
        });

        it("returns input path with absolute path", () => {
            const actual = target.realpath!("/foobar/whatever.js");

            expect(actual).toBe("/foobar/whatever.js");
        });

        it("returns absolute path with directory path", () => {
            const actual = target.realpath!("foobar");

            expect(actual).toBe("/foobar");
        });

        it("returns input path with file path", () => {
            const actual = target.realpath!("foobar.tsx");

            expect(actual).toBe("foobar.tsx");
        });

        it("returns current directory with empty path", () => {
            const actual = target.realpath!("");

            expect(actual).toBe("/");
        });
    });
});
