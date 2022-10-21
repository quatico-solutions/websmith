import { writeFileSync } from "fs";
import ts from "typescript";
import { FileCache } from "./FileCache";

describe("hasChanged", () => {
    it("w/o output should yield true", () => {
        writeFileSync("expected", "expected");
        const testObj = new FileCache(ts.sys);
        testObj.updateSource("expected", "expected");

        const actual = testObj.hasChanged("expected");

        expect(actual).toBe(true);
        expect(testObj.getCachedFile("expected").content).toBe("expected");
    });

    it("w/ output should yield false", () => {
        writeFileSync("expected", "expected");
        const testObj = new FileCache(ts.sys);
        testObj.updateSource("expected", "expected");
        testObj.updateOutput("expected",[]);

        const actual = testObj.hasChanged("expected");

        expect(actual).toBe(false);
        expect(testObj.getCachedFile("expected").content).toBe("expected");
    });

    it("w/ modified file should yield true", async () => {
        writeFileSync("expected", "expected");
        const testObj = new FileCache(ts.sys);
        testObj.updateSource("expected", "expected");
        await new Promise(resolve => setTimeout(resolve, 100));
        writeFileSync("expected", "something else");

        const actual = testObj.hasChanged("expected");

        expect(actual).toBe(true);
    });
});
