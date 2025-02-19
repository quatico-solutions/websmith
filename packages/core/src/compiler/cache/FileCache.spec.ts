/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import ts from "typescript";
import { FileCache } from "./FileCache";

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock("fs", () => ({
    ...jest.requireActual("fs"),
    writeFileSync: jest.fn(),
}));

describe("hasChanged", () => {
    it("w/o output should yield true", () => {
        fs.writeFileSync("expected", "expected");
        const testObj = new FileCache(ts.sys);
        testObj.updateSource("expected", "expected");

        const actual = testObj.hasChanged("expected");

        expect(actual).toBe(true);
        expect(testObj.getCachedFile("expected").content).toBe("expected");
    });

    it("w/ output should yield false", () => {
        fs.writeFileSync("expected", "expected");
        const testObj = new FileCache(ts.sys);
        testObj.updateSource("expected", "expected");
        testObj.updateOutput("expected", []);

        const actual = testObj.hasChanged("expected");

        expect(actual).toBe(false);
        expect(testObj.getCachedFile("expected").content).toBe("expected");
    });

    it("w/ modified file should yield true", async () => {
        fs.writeFileSync("expected", "expected");
        const testObj = new FileCache(ts.sys);
        testObj.updateSource("expected", "expected");
        await new Promise(resolve => setTimeout(resolve, 100));
        fs.writeFileSync("expected", "something else");

        const actual = testObj.hasChanged("expected");

        expect(actual).toBe(true);
    });
});
