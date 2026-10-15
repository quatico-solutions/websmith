/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Logger } from "../Logger";
import { findTsc, readTscVersion } from "./find-tsc";

let tempDir: string;

beforeEach(() => {
    // module resolution yields real paths, the macOS tmpdir is a symlink
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "websmith-find-tsc-")));
});

afterEach(() => {
    jest.restoreAllMocks();
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

const writeProject = (name: string): string => {
    const projectDir = path.join(tempDir, name);
    const tsDir = path.join(projectDir, "node_modules", "typescript");
    fs.mkdirSync(path.join(tsDir, "bin"), { recursive: true });
    fs.writeFileSync(path.join(tsDir, "package.json"), JSON.stringify({ name: "typescript", version: "6.0.3", main: "./lib/typescript.js" }));
    fs.writeFileSync(path.join(tsDir, "bin", "tsc"), "");
    return projectDir;
};

describe("findTsc", () => {
    it("should return the tsc of the typescript resolved from websmith-node", async () => {
        const projectDir = writeProject("project");
        const fromDir = path.join(projectDir, "node_modules", "@quatico", "websmith-node", "lib", "websmith");
        fs.mkdirSync(fromDir, { recursive: true });

        const actual = await findTsc(new Logger(), fromDir);

        expect(actual).toBe(path.join(projectDir, "node_modules", "typescript", "bin", "tsc"));
    });

    it("should return the resolved tsc w/ another typescript in the working directory", async () => {
        const projectDir = writeProject("project");
        const fromDir = path.join(projectDir, "node_modules", "@quatico", "websmith-node", "lib", "websmith");
        fs.mkdirSync(fromDir, { recursive: true });
        jest.spyOn(process, "cwd").mockReturnValue(writeProject("sub"));

        const actual = await findTsc(new Logger(), fromDir);

        expect(actual).toBe(path.join(projectDir, "node_modules", "typescript", "bin", "tsc"));
    });

    it("should return the tsc of the working directory w/o typescript resolvable from websmith-node", async () => {
        const fromDir = path.join(tempDir, "unresolvable");
        fs.mkdirSync(fromDir, { recursive: true });
        const cwd = writeProject("cwd");
        jest.spyOn(process, "cwd").mockReturnValue(cwd);

        const actual = await findTsc(new Logger(), fromDir);

        expect(actual).toBe(path.join(cwd, "node_modules", "typescript", "bin", "tsc"));
    });
});

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
