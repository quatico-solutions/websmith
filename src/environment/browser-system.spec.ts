/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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
import { createBrowserSystem } from "./browser-system";

describe("createDirectory", () => {
    it("does nothing, but directed can be read", () => {
        const testObj = createBrowserSystem({});

        testObj.createDirectory("expected");

        expect(testObj.readDirectory("expected")).toEqual([]);
    });

    it("does nothing, but new directory exists", () => {
        const testObj = createBrowserSystem({});
        testObj.createDirectory("/expected/");

        expect(testObj.directoryExists("/expected")).toBe(true);
    });

    it("does nothing, but new file exists", () => {
        const testObj = createBrowserSystem({});
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
        const testObj = createBrowserSystem({});

        testObj.write("whatever");

        expect(targetLog).toHaveBeenCalledWith('write() not supported. Did not write: "whatever".');
    });
});

describe("exit", () => {
    it("returns w/o any exitCode", () => {
        const testObj = createBrowserSystem({});

        expect(() => testObj.exit()).not.toThrow();
    });

    it("returns with exitCode '0'", () => {
        const testObj = createBrowserSystem({});

        expect(() => testObj.exit(0)).not.toThrow();
    });

    it("throws error with exitCode greater '0'", () => {
        const testObj = createBrowserSystem({});

        expect(() => testObj.exit(1)).toThrow('websmith exited with code "1".');
    });
});

describe("directoryExists", () => {
    it("returns false with empty path", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.directoryExists("")).toBe(false);
    });

    it("returns false with non-existing path", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.directoryExists("doesnotexist")).toBe(false);
    });

    it("returns false with non-existing absolute path", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.directoryExists("/doesnotexist/")).toBe(false);
    });

    it("returns false with non-existing relative path", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.directoryExists("./doesnotexist")).toBe(false);
    });

    it("returns true with root path and no files", () => {
        const testObj = createBrowserSystem({});

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

describe("fileExists", () => {
    it("returns false with non-existing directory path", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.fileExists("/doesnotexist")).toBe(false);
    });

    it("returns false with non-existing path", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.fileExists("doesnotexist.js")).toBe(false);
    });

    it("returns false with non-existing relative path", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.fileExists("./foobar/doesnotexist.js")).toBe(false);
    });

    it("returns false with non-existing absolute path", () => {
        const testObj = createBrowserSystem({});

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
});

describe("getCurrentDirectory", () => {
    it("returns root directory", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.getCurrentDirectory()).toBe("/");
    });
});

describe("getDirectories", () => {
    it("returns empty array w/o files", () => {
        const testObj = createBrowserSystem({});

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

    it("returns all dir paths w/ nested files in root folder", () => {
        const testObj = createBrowserSystem({
            "/three/one.js": "",
            "/one.js": "",
            "/two/one.js": "",
            "/three/two/one.js": "",
        });

        expect(testObj.getDirectories("/")).toEqual(["three", "two", "two"]);
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
});

describe("getExecutingFilePath", () => {
    it('returns "/" path', () => {
        const testObj = createBrowserSystem({});

        expect(testObj.getExecutingFilePath()).toBe("/");
    });
});

describe("readDirectory", () => {
    it("returns empty array w/o any content", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.readDirectory("whatever")).toEqual([]);
    });

    it("returns empty array w/ relative paths", () => {
        const testObj = createBrowserSystem({
            "one.js": "",
        });

        expect(testObj.readDirectory(".")).toEqual([]);
        expect(testObj.readDirectory("..")).toEqual([]);
        expect(testObj.readDirectory("../")).toEqual([]);
        expect(testObj.readDirectory("./")).toEqual([]);
    });

    it("returns file path w/ root path and existing file", () => {
        const testObj = createBrowserSystem({
            "one.js": "",
        });

        expect(testObj.readDirectory("/")).toEqual(["one.js"]);
    });

    it("returns file path w/ root path and multiple existing files", () => {
        const testObj = createBrowserSystem({
            "one.js": "",
            "two.js": "",
            "three.js": "",
        });

        expect(testObj.readDirectory("/")).toEqual(["one.js", "two.js", "three.js"]);
    });

    it("returns empty array w/ file name", () => {
        const testObj = createBrowserSystem({
            "one.js": "",
        });

        expect(testObj.readDirectory("one.js")).toEqual([]);
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
        const testObj = createBrowserSystem({});

        expect(testObj.readFile("doesnotexist")).toBeUndefined();
    });

    it("returns undefined w/ existing file path", () => {
        const testObj = createBrowserSystem({
            "one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.readFile("one.js")).toBe(`{
                export class One {}
            }`);
    });

    it("returns undefined w/ existing absolute file path", () => {
        const testObj = createBrowserSystem({
            "/one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.readFile("/one.js")).toBe(`{
                export class One {}
            }`);
    });

    it("returns undefined w/ existing dir path", () => {
        const testObj = createBrowserSystem({
            "/expected/one.js": `{
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
        const testObj = createBrowserSystem({});

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
        const testObj = createBrowserSystem({});

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
        const testObj = createBrowserSystem({});

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

    it("yields file in system w/ empty string", () => {
        const testObj = createBrowserSystem({});

        testObj.writeFile("whatever", "");

        expect(testObj.fileExists("whatever")).toBe(true);
        expect(testObj.readFile("whatever")).toBe("");
    });

    it("does not yield file in system w/ empty path", () => {
        const testObj = createBrowserSystem({});

        testObj.writeFile("", "whatever");

        expect(testObj.fileExists("")).toBe(false);
        expect(testObj.readFile("")).toBeUndefined();
    });
});

describe("resolvePath", () => {
    it("returns path w/ dir path", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.resolvePath("/expected")).toBe("/expected");
    });

    it("returns path w/ file path", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.resolvePath("/expected/one.js")).toBe("/expected/one.js");
    });

    it("returns absolute path w/ relative path", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.resolvePath("./expected/one.js")).toBe("/expected/one.js");
    });

    it("returns absolute path w/ relative parent path", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.resolvePath("../one.js")).toBe("/one.js");
    });

    it("returns root path w/ empty string", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.resolvePath("")).toBe("/");
    });
});

describe("createHash", () => {
    it("returns same hash for multiple calls", () => {
        const testObj = createBrowserSystem({});

        const actual = testObj.createHash!("hello");

        expect(actual).toEqual(testObj.createHash!("hello"));
    });
});
