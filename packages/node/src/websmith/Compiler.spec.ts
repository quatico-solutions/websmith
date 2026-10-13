/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import crossSpawn from "cross-spawn";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { tsDefaults } from "../compiler-options";
import { Logger } from "../Logger";
import { Compiler } from "./Compiler";
import * as findTscModule from "./find-tsc";

const TEST_TARGETS_DIR = path.join(__dirname, "..", "..", "test", "__test-targets__");

describe("Compiler#getTsOptions", () => {
    it("should return tsDefaults without tsOptions", () => {
        const testObj = new Compiler();

        expect(testObj.getTsConfig()).toEqual(tsDefaults);
    });

    it("should return tsOptions with tsOptions parameter", () => {
        const testObj = new Compiler({ target: ts.ScriptTarget.ESNext });

        expect(testObj.getTsConfig()).toEqual({ target: ts.ScriptTarget.ESNext });
    });
});

describe("Compiler#compile", () => {
    beforeEach(() => {
        jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
        jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    });

    it("should yield success with default config and existing file path", async () => {
        const testObj = new Compiler({
            noEmit: true,
        });

        const stdout = await testObj.compile([path.join(TEST_TARGETS_DIR, "foobar-arrow.ts")]);

        expect(stdout).toContain(""); // success
    }, 60000);

    it("should yield help with help flag", async () => {
        const testObj = new Compiler({
            help: true,
        });

        const stdout = await testObj.compile();

        expect(stdout).toContain(`tsc: The TypeScript Compiler - Version ${ts.version}`);
    }, 60000);

    it("should yield compile error with unknown file path", async () => {
        const testObj = new Compiler({});

        await expect(() => testObj.compile(["src/does-not-exist.ts"])).rejects.toThrow("error TS6053: File 'src/does-not-exist.ts' not found.");
    }, 60000);
});

describe("Compiler#compile w/ fake tsc binary", () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "websmith-fake-tsc-"));
        jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const writeFakeTsc = (version: string): string => {
        const binDir = path.join(tempDir, "typescript", "bin");
        fs.mkdirSync(binDir, { recursive: true });
        fs.writeFileSync(path.join(tempDir, "typescript", "package.json"), JSON.stringify({ name: "typescript", version }));
        const tscPath = path.join(binDir, "tsc");
        fs.writeFileSync(tscPath, "");
        return tscPath;
    };

    const createFakeProcess = () => {
        const process = Object.assign(new EventEmitter(), { stdin: new EventEmitter(), stdout: new EventEmitter(), stderr: new EventEmitter() });
        setImmediate(() => process.emit("exit", 0, null));
        return process;
    };

    it("should spawn tsc version 6 w/ ignoreConfig whatever the installed typescript", async () => {
        const tscPath = writeFakeTsc("6.0.3");
        jest.spyOn(findTscModule, "findTsc").mockResolvedValue(tscPath);
        const target = jest.spyOn(crossSpawn, "spawn").mockImplementation(() => createFakeProcess() as unknown as ReturnType<typeof crossSpawn.spawn>);
        const testObj = new Compiler({ noEmit: true });

        await testObj.compile(["src/index.ts"]);

        expect(target).toHaveBeenCalledWith(tscPath, ["--noEmit", "--ignoreConfig", "src/index.ts"], expect.anything());
    });

    it("should spawn tsc version 5 w/o ignoreConfig whatever the installed typescript", async () => {
        const tscPath = writeFakeTsc("5.7.3");
        jest.spyOn(findTscModule, "findTsc").mockResolvedValue(tscPath);
        const target = jest.spyOn(crossSpawn, "spawn").mockImplementation(() => createFakeProcess() as unknown as ReturnType<typeof crossSpawn.spawn>);
        const testObj = new Compiler({ noEmit: true });

        await testObj.compile(["src/index.ts"]);

        expect(target).toHaveBeenCalledWith(tscPath, ["--noEmit", "src/index.ts"], expect.anything());
    });
});
