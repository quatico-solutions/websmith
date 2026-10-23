/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { createBrowserSystem } from "../../environment/browser-system";
import { FileCache } from "./FileCache";

describe("hasChanged", () => {
    it("should yield true w/o output", () => {
        const system = createBrowserSystem();
        system.writeFile("target-file.txt", "expected");
        const testObj = new FileCache(system).updateSource("target-file.txt", "expected");

        const actual = testObj.hasChanged("target-file.txt");

        expect(actual).toBe(true);
        expect(testObj.getCachedFile("target-file.txt").content).toBe("expected");
    });

    it("should yield false w/ output", () => {
        const system = createBrowserSystem();
        system.writeFile("target-file.txt", "expected");
        const testObj = new FileCache(system).updateSource("target-file.txt", "expected").updateOutput("target-file.txt", []);

        const actual = testObj.hasChanged("target-file.txt");

        expect(actual).toBe(false);
        expect(testObj.getCachedFile("target-file.txt").content).toBe("expected");
    });

    it("should yield true w/ modified file but no updated output", () => {
        const system = createBrowserSystem();
        system.writeFile("target-file.txt", "whatever");
        const testObj = new FileCache(ts.sys).updateSource("target-file.txt", "expected");

        system.writeFile("target-file.txt", "something else");

        expect(testObj.hasChanged("target-file.txt")).toBe(true);
        expect(testObj.getCachedFile("target-file.txt").content).toBe("expected");
    });
});

describe("updateSource", () => {
    it("should yield new version w/ new content and unchanged modification time", () => {
        const system = createBrowserSystem();
        system.writeFile("target-file.ts", "whatever");
        const testObj = new FileCache(system).updateSource("target-file.ts", "first").updateOutput("target-file.ts", []);

        const actual = testObj.updateSource("target-file.ts", "second").getVersion("target-file.ts");

        expect(actual).toBe(2);
    });

    it("should yield snapshot of new content w/ new content and unchanged modification time", () => {
        const system = createBrowserSystem();
        system.writeFile("target-file.ts", "whatever");
        const testObj = new FileCache(system).updateSource("target-file.ts", "first").updateOutput("target-file.ts", []);

        const actual = testObj.updateSource("target-file.ts", "second").getSnapshot("target-file.ts")!;

        expect(actual.getText(0, actual.getLength())).toBe("second");
    });

    it("should keep version w/ same content and unchanged modification time", () => {
        const system = createBrowserSystem();
        system.writeFile("target-file.ts", "whatever");
        const testObj = new FileCache(system).updateSource("target-file.ts", "first").updateOutput("target-file.ts", []);

        const actual = testObj.updateSource("target-file.ts", "first").getVersion("target-file.ts");

        expect(actual).toBe(1);
    });

    it("should yield new version per update w/ different content in each update", () => {
        const system = createBrowserSystem();
        system.writeFile("target-file.ts", "whatever");
        const testObj = new FileCache(system).updateSource("target-file.ts", "first").updateOutput("target-file.ts", []);
        testObj.updateSource("target-file.ts", "second").updateOutput("target-file.ts", []);

        const actual = testObj.updateSource("target-file.ts", "third").getVersion("target-file.ts");

        expect(actual).toBe(3);
    });

    it("should yield new version w/ newer modification time and same content", () => {
        const system = createBrowserSystem();
        system.writeFile("target-file.ts", "whatever");
        const testObj = new FileCache(system).updateSource("target-file.ts", "first").updateOutput("target-file.ts", []);
        jest.spyOn(system, "getModifiedTime").mockReturnValue(new Date(Date.now() + 60_000));

        const actual = testObj.updateSource("target-file.ts", "first").getVersion("target-file.ts");

        expect(actual).toBe(2);
    });
});

describe("refreshUnbuilt", () => {
    it("should yield new version w/ unbuilt file modified since it was read", () => {
        const system = createBrowserSystem();
        system.writeFile("target-file.ts", "whatever");
        const testObj = new FileCache(system).createCacheEntry("target-file.ts");
        jest.spyOn(system, "getModifiedTime").mockReturnValue(new Date(Date.now() + 60_000));

        const actual = testObj.refreshUnbuilt("target-file.ts").getVersion("target-file.ts");

        expect(actual).toBe(1);
    });

    it("should keep version w/ unbuilt file unmodified since it was read", () => {
        const system = createBrowserSystem();
        system.writeFile("target-file.ts", "whatever");
        const testObj = new FileCache(system).createCacheEntry("target-file.ts");

        const actual = testObj.refreshUnbuilt("target-file.ts").getVersion("target-file.ts");

        expect(actual).toBe(0);
    });

    it("should keep version w/ built file modified since it was built", () => {
        const system = createBrowserSystem();
        system.writeFile("target-file.ts", "whatever");
        const testObj = new FileCache(system).updateSource("target-file.ts", "whatever").updateOutput("target-file.ts", []);
        jest.spyOn(system, "getModifiedTime").mockReturnValue(new Date(Date.now() + 60_000));

        const actual = testObj.refreshUnbuilt("target-file.ts").getVersion("target-file.ts");

        expect(actual).toBe(1);
    });

    it("should keep version w/ file seen first", () => {
        const system = createBrowserSystem();
        system.writeFile("target.d.ts", "whatever");
        const testObj = new FileCache(system);

        const actual = testObj.refreshUnbuilt("target.d.ts").getVersion("target.d.ts");

        expect(actual).toBe(0);
    });

    it("should yield new version w/ file modified since it was seen first", () => {
        const system = createBrowserSystem();
        system.writeFile("target.d.ts", "whatever");
        const testObj = new FileCache(system).refreshUnbuilt("target.d.ts");
        jest.spyOn(system, "getModifiedTime").mockReturnValue(new Date(Date.now() + 60_000));

        const actual = testObj.refreshUnbuilt("target.d.ts").getVersion("target.d.ts");

        expect(actual).toBe(1);
    });

    it("should keep version w/ missing file", () => {
        const testObj = new FileCache(createBrowserSystem());

        const actual = testObj.refreshUnbuilt("missing.ts").getVersion("missing.ts");

        expect(actual).toBe(0);
    });
});

describe("createCacheEntry", () => {
    it("should keep version of refreshed unbuilt file", () => {
        const system = createBrowserSystem();
        system.writeFile("target-file.ts", "whatever");
        const testObj = new FileCache(system).createCacheEntry("target-file.ts");
        jest.spyOn(system, "getModifiedTime").mockReturnValue(new Date(Date.now() + 60_000));
        testObj.refreshUnbuilt("target-file.ts");

        const actual = testObj.createCacheEntry("target-file.ts").getVersion("target-file.ts");

        expect(actual).toBe(1);
    });
});
