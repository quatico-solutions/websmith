/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readTscVersion } from "./find-tsc";

let tempDir: string;

beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "websmith-find-tsc-"));
});

afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
});

const writeTypeScript = (packageJson?: Record<string, unknown>): string => {
    const binDir = path.join(tempDir, "typescript", "bin");
    fs.mkdirSync(binDir, { recursive: true });
    if (packageJson) {
        fs.writeFileSync(path.join(tempDir, "typescript", "package.json"), JSON.stringify(packageJson));
    }
    const tscPath = path.join(binDir, "tsc");
    fs.writeFileSync(tscPath, "");
    return tscPath;
};

describe("readTscVersion", () => {
    it.each(["5.7.3", "6.0.3"])("should return version %s of the typescript package", async version => {
        const tscPath = writeTypeScript({ name: "typescript", version });

        const actual = await readTscVersion(tscPath);

        expect(actual).toBe(version);
    });

    it("should return version of the symlink target", async () => {
        const target = writeTypeScript({ name: "typescript", version: "6.0.3" });
        const binDir = path.join(tempDir, "nvm", "bin");
        fs.mkdirSync(binDir, { recursive: true });
        const tscPath = path.join(binDir, "tsc");
        fs.symlinkSync(target, tscPath);

        const actual = await readTscVersion(tscPath);

        expect(actual).toBe("6.0.3");
    });

    it("should return undefined with package of another name", async () => {
        const tscPath = writeTypeScript({ name: "whatever", version: "6.0.3" });

        const actual = await readTscVersion(tscPath);

        expect(actual).toBeUndefined();
    });

    it("should return undefined without package.json", async () => {
        const tscPath = writeTypeScript();

        const actual = await readTscVersion(tscPath);

        expect(actual).toBeUndefined();
    });

    it("should return undefined with missing tsc file", async () => {
        const actual = await readTscVersion(path.join(tempDir, "does-not-exist", "bin", "tsc"));

        expect(actual).toBeUndefined();
    });
});
