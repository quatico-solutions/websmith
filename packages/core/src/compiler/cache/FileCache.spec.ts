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
