/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { NoReporter } from "@quatico/websmith-core";
import fs from "node:fs";
import path from "node:path";
import webpack, { type Compiler, type LoaderContext } from "webpack";
import { TsCompiler } from "./TsCompiler";
import { getCompilerInstance } from "./compiler-instances";
import { getInstanceFromCache, setInstanceInCache } from "./instance-cache";

let compiler: Compiler;
let tsCompiler: TsCompiler;
const projectDir = path.join(__dirname, "..");

beforeEach(() => {
    compiler = webpack({});

    const reporter = new NoReporter();
    tsCompiler = new TsCompiler(
        {
            tsConfig: {},
            reporter,
            cliArgs: { options: { outDir: "test-output" }, fileNames: [], errors: [] },
            debug: false,
            watch: false,
        },
        { configFile: "./websmith.config.json", instanceName: "target-instance" },
        () => undefined
    );
});

afterEach(() => {
    compiler.close(() => undefined);
    fs.rmSync("./test-output", { recursive: true, force: true });
});

describe("getCompilerInstance", () => {
    it("should create a TsCompiler instance w/o instance in cache", () => {
        jest.spyOn(process.stderr, "write").mockImplementation(() => true); // Don't log missing configuration files

        const target = { _compiler: {} as Compiler } as LoaderContext<any>;
        const actual = getCompilerInstance(
            {
                tsConfigFile: path.join(projectDir, "tsconfig.json"),
                configFile: path.join(projectDir, "websmith.config.json"),
                instanceName: "target-instance",
            },
            target,
            path => console.info(`dependency ${path} added`)
        );

        expect(actual).toEqual(getInstanceFromCache(target._compiler, "target-instance"));
    });
});

describe("getCompilerInstance w/o webpack compiler", () => {
    const fixtureDir = path.join(projectDir, "test-output", "no-compiler");

    beforeEach(() => {
        const files: Record<string, string> = {
            "package.json": JSON.stringify({ type: "module" }),
            "tsconfig.json": JSON.stringify({ compilerOptions: { target: "es2020", module: "esnext", rootDir: "src", outDir: "dist" } }),
            "websmith.config.json": JSON.stringify({
                profiles: { target: { depends: ["node"] }, node: { tsConfig: { outDir: path.join(fixtureDir, "lib") }, esm: { runtime: "node" } } },
            }),
            "src/a.ts": "export const a = 1;\n",
        };
        Object.entries(files).forEach(([fileName, content]) => {
            fs.mkdirSync(path.dirname(path.join(fixtureDir, fileName)), { recursive: true });
            fs.writeFileSync(path.join(fixtureDir, fileName), content);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("reads package.json again in each build, because no compilation resets its caches", () => {
        const options = {
            tsConfigFile: path.join(fixtureDir, "tsconfig.json"),
            configFile: path.join(fixtureDir, "websmith.config.json"),
            profile: "target",
            transpileOnly: true,
            instanceName: "no-compiler-instance",
        };
        const testObj = getCompilerInstance(options, {} as LoaderContext<any>);
        const target = jest.spyOn(testObj.getSystem(), "readFile");
        testObj.build(path.join(fixtureDir, "src", "a.ts"));

        getCompilerInstance(options, {} as LoaderContext<any>).build(path.join(fixtureDir, "src", "a.ts"));
        const actual = target.mock.calls.filter(([fileName]) => fileName === path.join(fixtureDir, "package.json")).length;

        expect(actual).toBe(2);
    });
});

describe("getInstanceFromCache", () => {
    it("should return the previously cached instance", () => {
        const expected = tsCompiler;
        setInstanceInCache(compiler, "target-instance", expected);

        const actual = getInstanceFromCache(compiler, "target-instance");

        expect(actual).toBe(expected);
    });

    it("should return undefined if no previously cached instance exists", () => {
        const actual = getInstanceFromCache(compiler, "target-instance");

        expect(actual).toBeUndefined();
    });
});

describe("setInstanceInCache", () => {
    it("should cache the instance w/ cache key", () => {
        const expected = tsCompiler;

        setInstanceInCache(compiler, "target-instance", expected);

        expect(getInstanceFromCache(compiler, "target-instance")).toBe(expected);
    });

    it("should cache the instance with a global identifier w/o cache key", () => {
        const expected = tsCompiler;

        setInstanceInCache(undefined, "target-instance", expected);

        expect(getInstanceFromCache(undefined, "target-instance")).toBe(expected);
    });

    it("should cache only the last instance w/o cache key", () => {
        const expected = tsCompiler;

        setInstanceInCache(undefined, "target-instance", expected);

        const firstInstance = getInstanceFromCache(undefined, "target-instance");
        expect(firstInstance).toBe(expected);

        const target = {} as TsCompiler;

        setInstanceInCache(undefined, "target-instance", target);

        const secondInstance = getInstanceFromCache(undefined, "target-instance");
        expect(secondInstance).not.toBe(firstInstance);
        expect(secondInstance).toBe(target);
    });
});
