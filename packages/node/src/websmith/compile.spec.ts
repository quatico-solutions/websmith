/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import { compile } from "./compile";
import { Logger } from "../Logger";

const TEST_TARGETS_DIR = path.join(__dirname, "..", "..", "test", "__test-targets__");

beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
});

describe("compile", () => {
    it("should yield success with default config and existing file path", async () => {
        const stdout = await compile([path.join(TEST_TARGETS_DIR, "foobar-arrow.ts")], {
            tsConfig: {
                noEmit: true,
            },
        });
        expect(stdout).toContain(""); // success
    }, 60000);

    it("should yield compile error with unknown file path", async () => {
        await expect(() => compile(["src/does-not-exist.ts"])).rejects.toThrow("error TS6053: File 'src/does-not-exist.ts' not found.");
    }, 60000);
});
