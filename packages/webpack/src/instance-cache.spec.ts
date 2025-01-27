/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { NoReporter } from "@quatico/websmith-core";
import { randomUUID } from "crypto";
import { rmSync } from "fs";
import { join } from "path";
import webpack, { type Compilation, type Compiler, type LoaderContext } from "webpack";
import { TsCompiler } from "./TsCompiler";
import { getCacheName, getInstanceFromCache, initializeInstance, setInstanceInCache } from "./instance-cache";

let compiler: Compiler;
let context: LoaderContext<any>;
let tsCompiler: TsCompiler;
const projectDir = join(__dirname, "..", "test", "__data__");

beforeEach(() => {
    compiler = webpack({});
    context = { _compilation: { hash: randomUUID() } as Compilation } as LoaderContext<any>;

    const reporter = new NoReporter();
    tsCompiler = new TsCompiler(
        {
            buildDir: "./src",
            tsConfig: {},
            reporter,
            cliArgs: { options: { outDir: ".build" }, fileNames: [], errors: [] },
            debug: false,
            watch: false,
        },
        () => undefined,
        { addonsDir: "./addons", configFile: "./websmith.config.json" }
    );
});

afterEach(() => {
    compiler.close(() => undefined);
    rmSync("./.build", { recursive: true, force: true });
});

describe("initializeInstance", () => {
    it("should create a TsCompiler instance w/o instance in cache", () => {
        const target = { _compiler: {} as Compiler } as LoaderContext<any>;

        const actual = initializeInstance(
            target,
            { configFile: join(projectDir, "websmith.config.json"), project: join(projectDir, "tsconfig.json") },
            path => console.info(`dependency ${path} added`)
        );

        expect(actual).toEqual(getInstanceFromCache(target._compiler, target));
    });
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
    it("should cache the instance w/ cache key", () => {
        const expected = tsCompiler;

        setInstanceInCache(compiler, context, expected);

        expect(getInstanceFromCache(compiler, context)).toBe(expected);
    });

    it("should cache the instance with a global identifier w/o cache key", () => {
        const expected = tsCompiler;

        setInstanceInCache(undefined, context, expected);

        expect(getInstanceFromCache(undefined, context)).toBe(expected);
    });

    it("should cache only the last instance w/o cache key", () => {
        const expected = tsCompiler;

        setInstanceInCache(undefined, context, expected);

        const firstInstance = getInstanceFromCache(undefined, context);
        expect(firstInstance).toBe(expected);

        const target = {} as TsCompiler;

        setInstanceInCache(undefined, context, target);

        const secondInstance = getInstanceFromCache(undefined, context);
        expect(secondInstance).not.toBe(firstInstance);
        expect(secondInstance).toBe(target);
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

        expect(actual).toContain(expected);
    });
});
