/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFs, resetFs } from "./fusion-fs";

describe("fusion-fs", () => {
    afterEach(() => resetFs());

    describe("readFileSync", () => {
        it("should fall back to the actual fs and return a buffer without options", () => {
            const testObj = createFs(fs);

            const actual = testObj.readFileSync(__filename);

            expect(Buffer.isBuffer(actual)).toBe(true);
        });

        it("should fall back to the actual fs and honor an encoding string", () => {
            const testObj = createFs(fs);

            const actual = testObj.readFileSync(__filename, "utf-8");

            expect(typeof actual).toBe("string");
        });

        it("should read a file written to the in-memory volume", () => {
            const testObj = createFs(fs);
            const file = path.join(os.tmpdir(), "websmith-fusion-fs", "a.txt");
            testObj.writeFileSync(file, "content");

            const actual = testObj.readFileSync(file, { encoding: "utf-8" });

            expect(actual).toBe("content");
        });
    });

    describe("statSync", () => {
        it("should stat in-memory files and fall back to the actual fs", () => {
            const testObj = createFs(fs);
            const file = path.join(os.tmpdir(), "websmith-fusion-fs", "b.txt");
            testObj.writeFileSync(file, "content");

            const actual = [testObj.statSync(file).isFile(), testObj.statSync(__filename).isFile()];

            expect(actual).toEqual([true, true]);
        });
    });
});
