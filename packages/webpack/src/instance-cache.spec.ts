/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonRegistry, NoReporter } from "@quatico/websmith-compiler";
import { randomUUID } from "crypto";
import { rmSync } from "fs";
import ts from "typescript";
import webpack, { Compilation, Compiler, LoaderContext } from "webpack";
import { getCacheName, getInstanceFromCache, setInstanceInCache } from "./instance-cache";
import { TsCompiler } from "./TsCompiler";

let compiler: Compiler;
let context: LoaderContext<any>;
let tsCompiler: TsCompiler;

beforeEach(() => {
    compiler = webpack({});
    context = { _compilation: { hash: randomUUID() } as Compilation } as LoaderContext<any>;

    const reporter = new NoReporter();
    tsCompiler = new TsCompiler({
        addons: new AddonRegistry({ addonsDir: "./addons", reporter: reporter, system: ts.sys }),
        buildDir: "./src",
        project: {},
        reporter,
        targets: [],
        tsconfig: { options: { outDir: ".build" }, fileNames: [], errors: [] },
        debug: false,
        sourceMap: false,
        watch: false,
    });
});

afterEach(() => {
    compiler.close(() => undefined);
    rmSync("./.build", { recursive: true, force: true });
});

describe("getInstanceFromCache", () => {
    it("should return the previously cached instance", () => {
        const expected = tsCompiler;
        setInstanceInCache(compiler, context, expected);

        const actual = getInstanceFromCache(compiler, context);

        expect(actual).toBe(expected);
    });

    it("should return undefined if no previously cached instance exists", () => {
        const actual = getInstanceFromCache(compiler, context);

        expect(actual).toBeUndefined();
    });
});

describe("setInstanceInCache", () => {
    it("should cache the instance", () => {
        const expected = tsCompiler;

        setInstanceInCache(compiler, context, expected);

        expect(getInstanceFromCache(compiler, context)).toBe(expected);
    });
});

describe("getCacheName", () => {
    it("should return the cache name w/ context w/ compilation hash", () => {
        const expected = `websmith-${context._compilation!.hash}`;

        const actual = getCacheName(context);

        expect(actual).toBe(expected);
    });

    it("should return empty string with context w/o compilation hash", () => {
        const expected = `websmith-`;
        context._compilation = undefined;

        const actual = getCacheName(context);

        expect(actual).toBe(expected);
    });
});
