/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { NoReporter } from "@quatico/websmith-core";
import fs from "node:fs";
import webpack, { type Compiler } from "webpack";
import { TsCompiler } from "./TsCompiler";
import { getInstanceFromCache, setInstanceInCache } from "./instance-cache";

let compiler: Compiler;
let tsCompiler: TsCompiler;

beforeEach(() => {
    compiler = webpack({});

    const reporter = new NoReporter();
    tsCompiler = new TsCompiler(
        {
            buildDir: "./src",
            tsConfig: {},
            reporter,
            cliArgs: { options: { outDir: ".build" }, fileNames: [], errors: [] },
        },
        { configFile: "./websmith.config.json", instanceName: "target-instance" },
        () => undefined
    );
});

afterEach(() => {
    compiler.close(() => undefined);
    fs.rmSync("./.build", { recursive: true, force: true });
});

describe("getInstanceFromCache", () => {
    it("should return the previously cached instance", () => {
        const expected = tsCompiler;
        setInstanceInCache(compiler, "target", expected);

        const actual = getInstanceFromCache(compiler, "target");

        expect(actual).toBe(expected);
    });

    it("should return undefined if no previously cached instance exists", () => {
        const actual = getInstanceFromCache(compiler, "target");

        expect(actual).toBeUndefined();
    });
});

describe("setInstanceInCache", () => {
    it("should cache the instance w/ cache key", () => {
        const expected = tsCompiler;

        setInstanceInCache(compiler, "target", expected);

        expect(getInstanceFromCache(compiler, "target")).toBe(expected);
    });

    it("should cache the instance with a global identifier w/o cache key", () => {
        const expected = tsCompiler;

        setInstanceInCache(undefined, "target", expected);

        expect(getInstanceFromCache(undefined, "target")).toBe(expected);
    });

    it("should cache only the last instance w/o cache key", () => {
        const expected = tsCompiler;

        setInstanceInCache(undefined, "target", expected);

        const firstInstance = getInstanceFromCache(undefined, "target");
        expect(firstInstance).toBe(expected);

        const target = {} as TsCompiler;

        setInstanceInCache(undefined, "target", target);

        const secondInstance = getInstanceFromCache(undefined, "target");
        expect(secondInstance).not.toBe(firstInstance);
        expect(secondInstance).toBe(target);
    });
});
