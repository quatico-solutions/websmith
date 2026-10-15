/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createSystem } from "@quatico/websmith-core";
import { createDeduplicatingSystem } from "./write-record";

const createTarget = () => {
    const system = createSystem({}, { virtual: true });
    return { system, writeFile: jest.spyOn(system, "writeFile") };
};

describe("createDeduplicatingSystem", () => {
    it("should skip identical second write", () => {
        const { system: target, writeFile } = createTarget();
        const testObj = createDeduplicatingSystem(target);
        testObj.writeFile("/out/a.js", "A");

        testObj.writeFile("/out/a.js", "A");

        expect(writeFile).toHaveBeenCalledTimes(1);
    });

    it("should write changed text", () => {
        const { system: target } = createTarget();
        const testObj = createDeduplicatingSystem(target);
        testObj.writeFile("/out/a.js", "A");

        testObj.writeFile("/out/a.js", "B");

        expect(target.readFile("/out/a.js")).toBe("B");
    });

    it("should write again w/ deleted file", () => {
        const { system: target } = createTarget();
        const testObj = createDeduplicatingSystem(target);
        testObj.writeFile("/out/a.js", "A");
        target.deleteFile!("/out/a.js");

        testObj.writeFile("/out/a.js", "A");

        expect(target.readFile("/out/a.js")).toBe("A");
    });

    it("should leave target system unchanged", () => {
        const { system: target, writeFile } = createTarget();
        createDeduplicatingSystem(target).writeFile("/out/a.js", "A");

        target.writeFile("/out/a.js", "A");

        expect(writeFile).toHaveBeenCalledTimes(2);
    });

    it("should keep members of system in spread copy", () => {
        const { system: target } = createTarget();
        target.writeFile("/out/a.js", "A");

        const actual = { ...createDeduplicatingSystem(target) }.readFile("/out/a.js");

        expect(actual).toBe("A");
    });
});
