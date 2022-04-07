/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
/* eslint-disable no-console */
import ts from "typescript";
import { createBrowserSystem, isDirectoryName, resolveDirectories, resolveFiles, resolvePath } from "./browser-system";

describe("resolvePath", () => {
    it("returns path with root path", () => {
        expect(resolvePath("/")).toBe("/");
    });

    it("returns path with empty path", () => {
        expect(resolvePath("")).toBe("/");
    });

    it("returns path with point path", () => {
        expect(resolvePath(".")).toBe("/");
    });

    it("returns path with absolute path", () => {
        expect(resolvePath("/foo/bar")).toBe("/foo/bar");
    });

    it("returns path with implicitly relative path", () => {
        expect(resolvePath("foo/bar")).toBe("/foo/bar");
    });

    it("returns path with explicitly relative path", () => {
        expect(resolvePath("./foo/bar")).toBe("/foo/bar");
    });

    it("returns path with parent relative path", () => {
        expect(resolvePath("../foo/bar")).toBe("/foo/bar");
    });

    it("returns path with network path", () => {
        expect(resolvePath("//foo/bar")).toBe("/foo/bar");
    });

    it("returns path with directory path ending slash", () => {
        expect(resolvePath("foo/bar/")).toBe("/foo/bar");
    });

    it("returns path with absolute file path", () => {
        expect(resolvePath("/foo/bar.js")).toBe("/foo/bar.js");
    });

    it("returns path with relative file path", () => {
        expect(resolvePath("foo/bar.js")).toBe("/foo/bar.js");
    });

    it("returns path w/ dir path", () => {
        const testObj = createBrowserSystem();

        expect(testObj.resolvePath("/expected")).toBe("/expected");
    });

    it("returns path w/ file path", () => {
        const testObj = createBrowserSystem();

        expect(testObj.resolvePath("/expected/one.js")).toBe("/expected/one.js");
    });

    it("returns absolute path w/ relative path", () => {
        const testObj = createBrowserSystem();

        expect(testObj.resolvePath("./expected/one.js")).toBe("/expected/one.js");
    });

    it("returns absolute path w/ relative parent path", () => {
        const testObj = createBrowserSystem();

        expect(testObj.resolvePath("../one.js")).toBe("/one.js");
    });

    it("returns root path w/ empty string", () => {
        const testObj = createBrowserSystem();

        expect(testObj.resolvePath("")).toBe("/");
    });
});

describe("resolveFiles", () => {
    it("should return files w/ direct children", () => {
        const actual = resolveFiles("/foo/bar", ["/foo/bar/baz.js", "/foo/bar/baz.ts"]);

        expect(actual).toEqual(["/foo/bar/baz.js", "/foo/bar/baz.ts"]);
    });

    it("should return files w/ file path", () => {
        const actual = resolveFiles("/foo/bar.ts", ["/foo/bar.ts"]);

        expect(actual).toEqual(["/foo/bar.ts"]);
    });

    it("should return empty array w/ empty directory", () => {
        const actual = resolveFiles("/foo", ["/foo/"]);

        expect(actual).toEqual([]);
    });
});

describe("resolveDirectories", () => {
    it("should return direct child folder with file paths", () => {
        const actual = resolveDirectories("/foo", ["/foo/bar/baz.js", "/foo/bar/baz.ts"]);

        expect(actual).toEqual(["bar"]);
    });

    it("should 2", () => {
        const actual = resolveDirectories("/foo", ["/foo/", "/foo/bar/"]);

        expect(actual).toEqual(["bar"]);
    });

    it("should 33", () => {
        const actual = resolveDirectories("/foo", ["/foo/", "/foo/bar/baz/zip.js"]);

        expect(actual).toEqual(["bar"]);
    });

    it("should 4", () => {
        const actual = resolveDirectories("/zip", ["/zip/zap/zup/"]);

        expect(actual).toEqual(["zap"]);
    });
});

describe("isDirectoryName", () => {
    it("should return false w/ absolute file path", () => {
        expect(isDirectoryName("/foo/bar/baz.js")).toBe(false);
    });

    it("should return false w/ relative file path", () => {
        expect(isDirectoryName("bar/baz.js")).toBe(false);
    });

    it("should return false w/ file name", () => {
        expect(isDirectoryName("baz.js")).toBe(false);
    });

    it("should return false w/ relative directory name and extension", () => {
        expect(isDirectoryName("foo.bar")).toBe(false);
    });

    it("should return true w/ absolute directory path", () => {
        expect(isDirectoryName("/foo/bar")).toBe(true);
    });

    it("should return true w/ absolute directory name", () => {
        expect(isDirectoryName("/foo")).toBe(true);
    });

    it("should return true w/ relative directory name", () => {
        expect(isDirectoryName("foo")).toBe(true);
    });

    it("should return true w/ relative directory name, extension and trailing slash", () => {
        expect(isDirectoryName("foo.js/")).toBe(true);
    });
});

describe("directoryExists", () => {
    let testObj: ts.System;
    beforeEach(() => {
        testObj = createBrowserSystem({});
    });

    it("should return true w/ existing relative directory path", () => {
        testObj.createDirectory("./addons");

        expect(testObj.directoryExists("./addons")).toBe(true);
    });

    it("should return true w/ existing absolute directory path", () => {
        testObj.createDirectory("/addons");

        expect(testObj.directoryExists("/addons")).toBe(true);
    });

    it("should return true w/ existing directory name", () => {
        testObj.createDirectory("addons");

        expect(testObj.directoryExists("addons")).toBe(true);
    });

    it("should return true w/ existing directory name containing extension", () => {
        testObj.createDirectory("addons.js");

        expect(testObj.directoryExists("addons.js")).toBe(true);
    });

    it("should return true w/ existing directory name, extension, trailing slash", () => {
        testObj.createDirectory("addons.js");

        expect(testObj.directoryExists("addons.js/")).toBe(true);
    });

    it("should return false w/ existing relative file path", () => {
        testObj.writeFile("addons/file.js", "export const foo = () => {};");

        expect(testObj.directoryExists("addons/file.js")).toBe(false);
    });

    it("should return true w/ existing partial file path", () => {
        testObj.writeFile("addons.js/file.js", "export const foo = () => {};");

        expect(testObj.directoryExists("/addons.js")).toBe(true);
    });

    it("returns false with empty path", () => {
        const testObj = createBrowserSystem();

        expect(testObj.directoryExists("")).toBe(false);
    });

    it("returns false with non-existing path", () => {
        const testObj = createBrowserSystem();

        expect(testObj.directoryExists("doesnotexist")).toBe(false);
    });

    it("returns false with non-existing absolute path", () => {
        const testObj = createBrowserSystem();

        expect(testObj.directoryExists("/doesnotexist/")).toBe(false);
    });

    it("returns false with non-existing relative path", () => {
        const testObj = createBrowserSystem();

        expect(testObj.directoryExists("./doesnotexist")).toBe(false);
    });

    it("returns true with root path and no files", () => {
        const testObj = createBrowserSystem();

        expect(testObj.directoryExists("/")).toBe(true);
    });

    it("returns false with existing file path", () => {
        const testObj = createBrowserSystem({
            "one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.directoryExists("one.js")).toBe(false);
    });

    it("returns false with absolute file path", () => {
        const testObj = createBrowserSystem({
            "/one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.directoryExists("/one.js")).toBe(false);
    });

    it("returns true with existing directory path", () => {
        const testObj = createBrowserSystem({
            "/expected/one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.directoryExists("/expected")).toBe(true);
    });

    it("returns true with nested existing directory path", () => {
        const testObj = createBrowserSystem({
            "/expected/two/one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.directoryExists("/expected/two/")).toBe(true);
    });

    it("returns true with relative directory path", () => {
        const testObj = createBrowserSystem({
            "../expected/one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.directoryExists("../expected/")).toBe(true);
    });
});

describe("createDirectory", () => {
    let testObj: ts.System;
    beforeEach(() => {
        testObj = createBrowserSystem({});
    });

    it("does nothing, but directed can be read", () => {
        testObj.createDirectory("expected");

        expect(testObj.readDirectory("expected")).toEqual([]);
    });

    it("does nothing, but new directory exists", () => {
        testObj.createDirectory("/expected/");

        expect(testObj.directoryExists("/expected")).toBe(true);
    });

    it("does nothing, but new file exists", () => {
        testObj.createDirectory("/expected/");
        testObj.writeFile("/expected/foobar.ts", "whatever");

        expect(testObj.fileExists("/expected/foobar.ts")).toBe(true);
    });
});

describe("write", () => {
    const orgWarnLog = console.warn;
    let targetLog: any;

    beforeEach(() => {
        targetLog = jest.fn();
        console.warn = targetLog;
    });

    afterAll(() => {
        console.warn = orgWarnLog;
    });

    it("yields error on console log", () => {
        const testObj = createBrowserSystem();

        testObj.write("whatever");

        expect(targetLog).toHaveBeenCalledWith('write() not supported. Did not write: "whatever".');
    });
});

describe("exit", () => {
    it("returns w/o any exitCode", () => {
        const testObj = createBrowserSystem();

        expect(() => testObj.exit()).not.toThrow();
    });

    it("returns with exitCode '0'", () => {
        const testObj = createBrowserSystem();

        expect(() => testObj.exit(0)).not.toThrow();
    });

    it("throws error with exitCode greater '0'", () => {
        const testObj = createBrowserSystem();

        expect(() => testObj.exit(1)).toThrow('websmith exited with code "1".');
    });
});

describe("fileExists", () => {
    it("returns false with non-existing directory path", () => {
        const testObj = createBrowserSystem();

        expect(testObj.fileExists("/doesnotexist")).toBe(false);
    });

    it("returns false with non-existing path", () => {
        const testObj = createBrowserSystem();

        expect(testObj.fileExists("doesnotexist.js")).toBe(false);
    });

    it("returns false with non-existing relative path", () => {
        const testObj = createBrowserSystem();

        expect(testObj.fileExists("./foobar/doesnotexist.js")).toBe(false);
    });

    it("returns false with non-existing absolute path", () => {
        const testObj = createBrowserSystem();

        expect(testObj.fileExists("/foobar/doesnotexist.js")).toBe(false);
    });

    it("returns true with existing file path", () => {
        const testObj = createBrowserSystem({
            "one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.fileExists("one.js")).toBe(true);
    });

    it("returns true with existing absolute path", () => {
        const testObj = createBrowserSystem({
            "/one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.fileExists("/one.js")).toBe(true);
    });

    it("returns false with existing directory path", () => {
        const testObj = createBrowserSystem({
            "/expected/one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.fileExists("/expected")).toBe(false);
    });

    it("returns true with existing relative file path", () => {
        const testObj = createBrowserSystem({
            "./expected/one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.fileExists("/expected/one.js")).toBe(true);
    });
});

describe("getCurrentDirectory", () => {
    it("returns root directory", () => {
        const testObj = createBrowserSystem();

        expect(testObj.getCurrentDirectory()).toBe("/");
    });
});

describe("getDirectories", () => {
    it("returns empty array w/o files", () => {
        const testObj = createBrowserSystem();

        expect(testObj.getDirectories("whatever")).toEqual([]);
    });

    it("returns empty array w/ single file in root folder", () => {
        const testObj = createBrowserSystem({ "/one.js": "" });

        expect(testObj.getDirectories("/")).toEqual([]);
    });

    it("returns empty array w/ single nested file in folder", () => {
        const testObj = createBrowserSystem({ "/expected/one.js": "" });

        expect(testObj.getDirectories("/expected")).toEqual([]);
    });

    it("returns empty array w/ single nested file in folder w/ ending /", () => {
        const testObj = createBrowserSystem({ "/expected/one.js": "" });

        expect(testObj.getDirectories("/expected/")).toEqual([]);
    });

    it("returns nested folder w/ transitively nested file in folder w/ ending /", () => {
        const testObj = createBrowserSystem({ "/expected/two/one.js": "" });

        expect(testObj.getDirectories("/expected/")).toEqual(["two"]);
    });

    it("returns dir path w/ single nested file in root folder", () => {
        const testObj = createBrowserSystem({ "/expected/one.js": "" });

        expect(testObj.getDirectories("/")).toEqual(["expected"]);
    });

    it("returns dir path w/ single nested file in root relative folder", () => {
        const testObj = createBrowserSystem({ "./expected/one.js": "" });

        expect(testObj.getDirectories("/")).toEqual(["expected"]);
    });

    it("returns all dir paths w/ nested files in root folder", () => {
        const testObj = createBrowserSystem({
            "/three/one.js": "",
            "/one.js": "",
            "/two/one.js": "",
            "/three/two/one.js": "",
        });

        expect(testObj.getDirectories("/")).toEqual(["three", "two"]);
    });

    it("returns all dir paths w/ nested files in sub-folder", () => {
        const testObj = createBrowserSystem({
            "/three/one.js": "",
            "/one.js": "",
            "/two/one.js": "",
            "/three/two/one.js": "",
        });

        expect(testObj.getDirectories("/three")).toEqual(["two"]);
    });

    it("returns all dir paths w/ nested directories in sub-folder", () => {
        const testObj = createBrowserSystem({
            "/three/one.js": "",
            "/one.js": "",
            "/three/one/one.js": "",
            "/three/two/one.js": "",
        });

        expect(testObj.getDirectories("/three")).toEqual(["one", "two"]);
    });
});

describe("getExecutingFilePath", () => {
    it('returns "/" path', () => {
        const testObj = createBrowserSystem();

        expect(testObj.getExecutingFilePath()).toBe("/");
    });
});

describe("readDirectory", () => {
    it("returns empty array w/o any content", () => {
        const testObj = createBrowserSystem();

        expect(testObj.readDirectory("whatever")).toEqual([]);
    });

    it("returns empty array w/ relative paths", () => {
        const testObj = createBrowserSystem({
            "one.js": "",
        });

        expect(testObj.readDirectory("/")).toEqual(["/one.js"]);
        expect(testObj.readDirectory(".")).toEqual(["/one.js"]);
        expect(testObj.readDirectory("..")).toEqual([]);
        expect(testObj.readDirectory("../")).toEqual([]);
        expect(testObj.readDirectory("./")).toEqual([]);
    });

    it("returns file path w/ root path and existing file", () => {
        const testObj = createBrowserSystem({
            "one.js": "",
        });

        expect(testObj.readDirectory("/")).toEqual(["/one.js"]);
    });

    it("returns file path w/ root path and multiple existing files", () => {
        const testObj = createBrowserSystem({
            "one.js": "",
            "two.js": "",
            "three.js": "",
        });

        expect(testObj.readDirectory("/")).toEqual(["/one.js", "/two.js", "/three.js"]);
    });

    it("returns empty array w/ file name", () => {
        const testObj = createBrowserSystem({
            "one.js": "",
        });

        expect(testObj.readDirectory("one.js")).toEqual([]);
    });

    it("returns file path w/ nested relative file name", () => {
        const testObj = createBrowserSystem({
            "./expected/one.js": "",
            "./expected/two.js": "",
            "./expected/three.js": "",
        });

        expect(testObj.readDirectory("/expected")).toEqual(["/expected/one.js", "/expected/two.js", "/expected/three.js"]);
    });

    it("returns file path w/ nested file name", () => {
        const testObj = createBrowserSystem({
            "/expected/one.js": "",
            "/expected/two.js": "",
            "/expected/three.js": "",
        });

        expect(testObj.readDirectory("/expected")).toEqual(["/expected/one.js", "/expected/two.js", "/expected/three.js"]);
    });

    it("returns file path w/ nested dir names", () => {
        const testObj = createBrowserSystem({
            "/expected/one.js": "",
            "/expected/two/one.js": "",
            "/expected/three/one.js": "",
        });

        expect(testObj.readDirectory("/expected")).toEqual(["/expected/one.js", "/expected/two/one.js", "/expected/three/one.js"]);
    });
});

describe("readFile", () => {
    it("returns undefined w/ non-existing file", () => {
        const testObj = createBrowserSystem();

        expect(testObj.readFile("doesnotexist")).toBeUndefined();
    });

    it("returns file content w/ existing file path", () => {
        const testObj = createBrowserSystem({
            "one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.readFile("one.js")).toBe(`{
                export class One {}
            }`);
    });

    it("returns file content w/ existing absolute file path", () => {
        const testObj = createBrowserSystem({
            "/one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.readFile("/one.js")).toBe(`{
                export class One {}
            }`);
    });

    it("returns file content w/ existing dir path", () => {
        const testObj = createBrowserSystem({
            "/expected/one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.readFile("/expected/one.js")).toBe(`{
                export class One {}
            }`);
    });

    it("returns file content w/ existing relative dir path", () => {
        const testObj = createBrowserSystem({
            "./expected/one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.readFile("/expected/one.js")).toBe(`{
                export class One {}
            }`);
    });
});

describe("writeFile", () => {
    it("yields file in system w/ file name", () => {
        const testObj = createBrowserSystem();

        testObj.writeFile(
            "one.js",
            `{
                export class One {}
            }`
        );

        expect(testObj.fileExists("one.js")).toBe(true);
        expect(testObj.readFile("one.js")).toBe(`{
                export class One {}
            }`);
    });

    it("yields file in system w/ dir path name", () => {
        const testObj = createBrowserSystem();

        testObj.writeFile(
            "/expected/one.js",
            `{
                export class One {}
            }`
        );

        expect(testObj.fileExists("/expected/one.js")).toBe(true);
        expect(testObj.readFile("/expected/one.js")).toBe(`{
                export class One {}
            }`);
    });

    it("yields file in system w/ relative path name", () => {
        const testObj = createBrowserSystem();

        testObj.writeFile(
            "../expected/one.js",
            `{
                export class One {}
            }`
        );

        expect(testObj.fileExists("../expected/one.js")).toBe(true);
        expect(testObj.readFile("../expected/one.js")).toBe(`{
                export class One {}
            }`);
    });

    it("yields file in system w/ relative subdirectory path name", () => {
        const testObj = createBrowserSystem();

        testObj.writeFile(
            "./expected/one.js",
            `{
                export class One {}
            }`
        );

        expect(testObj.fileExists("/expected/one.js")).toBe(true);
        expect(testObj.readFile("/expected/one.js")).toBe(`{
                export class One {}
            }`);
    });

    it("yields file in system w/ empty string", () => {
        const testObj = createBrowserSystem();

        testObj.writeFile("whatever", "");

        expect(testObj.fileExists("whatever")).toBe(true);
        expect(testObj.readFile("whatever")).toBe("");
    });

    it("does not yield file in system w/ empty path", () => {
        const testObj = createBrowserSystem();

        testObj.writeFile("", "whatever");

        expect(testObj.fileExists("")).toBe(false);
        expect(testObj.readFile("")).toBeUndefined();
    });
});

describe("createHash", () => {
    it("returns same hash for multiple calls", () => {
        const testObj = createBrowserSystem();

        const actual = testObj.createHash!("hello");

        expect(actual).toEqual(testObj.createHash!("hello"));
    });
});
