// tslint:disable: object-literal-sort-keys
import { createBrowserSystem } from "./browser-system";

describe("createDirectory", () => {
    it("throws error", () => {
        const testObj = createBrowserSystem({});

        expect(() => testObj.createDirectory("whatever")).toThrowError("createDirectory() not implemented");
    });
});

describe("write", () => {
    it("throws error", () => {
        const testObj = createBrowserSystem({});

        expect(() => testObj.write("whatever")).toThrowError("write() not implemented");
    });
});

describe("exit", () => {
    it("throws error", () => {
        const testObj = createBrowserSystem({});

        expect(() => testObj.exit()).toThrowError("exit() not implemented");
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
    it("returns false with non-existing path", () => {
        const testObj = createBrowserSystem({});

        expect(testObj.fileExists("doesnotexist")).toBe(false);
    });

    it("returns true with existing file path", () => {
        const testObj = createBrowserSystem({
            "one.js": `{
                export class One {}
            }`,
        });

        expect(testObj.fileExists("one.js")).toBe(true);
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
    it('returns "/" path', () => {
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

        expect(testObj.getDirectories("/expected/")).toEqual(["/expected/two"]);
    });

    it("returns dir path w/ single nested file in root folder", () => {
        const testObj = createBrowserSystem({ "/expected/one.js": "" });

        expect(testObj.getDirectories("/")).toEqual(["/expected"]);
    });

    it("returns all dir paths w/ nested files in root folder", () => {
        const testObj = createBrowserSystem({
            "/three/one.js": "",
            "/one.js": "",
            "/two/one.js": "",
            "/three/two/one.js": "",
        });

        expect(testObj.getDirectories("/")).toEqual(["/three", "/two", "/three/two"]);
    });

    it("returns all dir paths w/ nested files in root folder", () => {
        const testObj = createBrowserSystem({
            "/three/one.js": "",
            "/one.js": "",
            "/two/one.js": "",
            "/three/two/one.js": "",
        });

        expect(testObj.getDirectories("/")).toEqual(["/three", "/two", "/three/two"]);
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

        expect(testObj.readDirectory("/expected")).toEqual([
            "/expected/one.js",
            "/expected/two.js",
            "/expected/three.js",
        ]);
    });

    it("returns file path w/ nested dir names", () => {
        const testObj = createBrowserSystem({
            "/expected/one.js": "",
            "/expected/two/one.js": "",
            "/expected/three/one.js": "",
        });

        expect(testObj.readDirectory("/expected")).toEqual([
            "/expected/one.js",
            "/expected/two/one.js",
            "/expected/three/one.js",
        ]);
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

        expect(testObj.readFile("../expected/one.js")).toBe(`{
                export class One {}
            }`);
    });

    it("yields file in system w/ empty string", () => {
        const testObj = createBrowserSystem({});

        testObj.writeFile("whatever", "");

        expect(testObj.readFile("whatever")).toBe("");
    });

    it("does not yield file in system w/ empty path", () => {
        const testObj = createBrowserSystem({});

        testObj.writeFile("", "whatever");

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
