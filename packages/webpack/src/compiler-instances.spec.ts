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
import { WebpackAddonService } from "./WebpackAddonService";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

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
    // Own directory: instance-cache.spec.ts removes ./test-output while other spec files run in parallel workers
    const fixtureDir = path.join(projectDir, `test-output-no-compiler-${process.pid}`);

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

    afterAll(() => {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
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

describe("getCompilerInstance option resolution", () => {
    // Own directory per test: tests change the files and their modification times
    const getFixtureDir = () =>
        path.join(projectDir, `test-output-resolution-${process.pid}-${expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_")}`);
    let fixtureDir: string;

    beforeEach(() => {
        fixtureDir = getFixtureDir();
        const files: Record<string, string> = {
            "tsconfig.json": JSON.stringify({ extends: "./tsconfig.base.json", compilerOptions: { rootDir: "src", outDir: "dist" } }),
            "tsconfig.base.json": JSON.stringify({ compilerOptions: { target: "es2020", module: "esnext", removeComments: false } }),
            "websmith.config.json": JSON.stringify({ addonsDir: "./addons", profiles: { target: { addons: ["counter"] } } }),
            "addons/counter/addon.js": "exports.activate = () => undefined;\n",
            "src/a.ts": "/* note */\nexport const a = 1;\n",
            "src/b.ts": "export const b = 1;\n",
        };
        Object.entries(files).forEach(([fileName, content]) => writeFixture(fileName, content));
        jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fs.rmSync(fixtureDir, { recursive: true, force: true });
    });

    const writeFixture = (fileName: string, content: string) => {
        fs.mkdirSync(path.dirname(path.join(fixtureDir, fileName)), { recursive: true });
        fs.writeFileSync(path.join(fixtureDir, fileName), content);
    };

    const touchFixture = (fileName: string) => {
        const time = new Date(Date.now() + 10000);
        fs.utimesSync(path.join(fixtureDir, fileName), time, time);
    };

    const createOptions = (instanceName: string): WebsmithLoaderConfig => ({
        tsConfigFile: path.join(fixtureDir, "tsconfig.json"),
        configFile: path.join(fixtureDir, "websmith.config.json"),
        profile: "target",
        transpileOnly: true,
        instanceName: `${instanceName}-${process.pid}-${expect.getState().currentTestName}`,
    });

    const createContext = (options: WebsmithLoaderConfig, compiler?: Compiler) =>
        ({ ...(compiler && { _compiler: compiler }), getOptions: () => options }) as unknown as LoaderContext<WebsmithLoaderConfig>;

    // thread-loader passes a compiler stub without hooks, which carries the start time of webpack's watch compilation
    const createWorkerContext = (options: WebsmithLoaderConfig, fsStartTime: number) =>
        createContext(options, { fsStartTime, options: { plugins: [] } } as unknown as Compiler);

    it("resolves options once w/ three modules of one compilation", () => {
        const target = jest.spyOn(TsCompiler.prototype, "setOptions");
        const options = createOptions("once");
        const context = createContext(options, webpack({}));

        [1, 2, 3].forEach(() => getCompilerInstance(options, context));
        const actual = target.mock.calls.length;

        expect(actual).toBe(1);
    });

    it("resolves options once w/ three modules w/o webpack compiler and unchanged files", () => {
        const target = jest.spyOn(TsCompiler.prototype, "setOptions");
        const options = createOptions("once-without-compiler");
        const context = createContext(options);

        [1, 2, 3].forEach(() => getCompilerInstance(options, context));
        const actual = target.mock.calls.length;

        expect(actual).toBe(1);
    });

    it("resolves options again w/o webpack compiler w/ changed modification time of tsconfig.json", () => {
        const target = jest.spyOn(TsCompiler.prototype, "setOptions");
        const options = createOptions("tsconfig-changed");
        const context = createContext(options);
        getCompilerInstance(options, context);
        touchFixture("tsconfig.json");

        getCompilerInstance(options, context);
        getCompilerInstance(options, context);
        const actual = target.mock.calls.length;

        expect(actual).toBe(2);
    });

    it("resolves options again w/o webpack compiler w/ changed modification time of extends target", () => {
        const target = jest.spyOn(TsCompiler.prototype, "setOptions");
        const options = createOptions("extends-changed");
        const context = createContext(options);
        getCompilerInstance(options, context);
        touchFixture("tsconfig.base.json");

        getCompilerInstance(options, context);
        const actual = target.mock.calls.length;

        expect(actual).toBe(2);
    });

    it("yields output of changed extends target w/o webpack compiler", () => {
        const options = createOptions("extends-output");
        const context = createContext(options);
        getCompilerInstance(options, context).build(path.join(fixtureDir, "src", "a.ts"));
        writeFixture("tsconfig.base.json", JSON.stringify({ compilerOptions: { target: "es2020", module: "esnext", removeComments: true } }));
        touchFixture("tsconfig.base.json");

        const actual = getCompilerInstance(options, context).build(path.join(fixtureDir, "src", "a.ts")).fragment.files[0].text;

        expect(actual).not.toContain("note");
    });

    it("loads addons once w/ three modules of one compilation", () => {
        const target = jest.spyOn(WebpackAddonService.prototype, "getAvailableAddons");
        const options = createOptions("addons-once");
        const context = createContext(options, webpack({}));

        ["a.ts", "b.ts", "a.ts"].forEach(cur => getCompilerInstance(options, context).build(path.join(fixtureDir, "src", cur)));
        const actual = target.mock.calls.length;

        expect(actual).toBe(1);
    });

    it("keeps loaded addons w/ next compilation and unchanged addons", () => {
        const target = jest.spyOn(WebpackAddonService.prototype, "getAvailableAddons");
        const options = createOptions("addons-kept");
        const context = createContext(options, webpack({}));
        const testObj = getCompilerInstance(options, context);
        testObj.build(path.join(fixtureDir, "src", "a.ts"));

        testObj.refreshAddons();
        testObj.build(path.join(fixtureDir, "src", "a.ts"));
        const actual = target.mock.calls.length;

        expect(actual).toBe(1);
    });

    it("loads addons again w/o compilation hooks w/ next watch compilation and changed addon file", () => {
        const target = jest.spyOn(WebpackAddonService.prototype, "getAvailableAddons");
        const options = createOptions("addons-worker-changed");
        getCompilerInstance(options, createWorkerContext(options, 1)).build(path.join(fixtureDir, "src", "a.ts"));
        touchFixture("addons/counter/addon.js");

        getCompilerInstance(options, createWorkerContext(options, 2)).build(path.join(fixtureDir, "src", "a.ts"));
        const actual = target.mock.calls.length;

        expect(actual).toBe(2);
    });

    it("checks addons once per watch compilation w/o compilation hooks", () => {
        const target = jest.spyOn(TsCompiler.prototype, "refreshAddons");
        const options = createOptions("addons-worker-once");

        [1, 1, 2, 2, 2].forEach(cur => getCompilerInstance(options, createWorkerContext(options, cur)));
        const actual = target.mock.calls.length;

        expect(actual).toBe(1);
    });

    it("checks addons at most once per second w/o compilation hooks and compilation start time", () => {
        const target = jest.spyOn(TsCompiler.prototype, "refreshAddons");
        const options = createOptions("addons-throttled");
        const now = jest.spyOn(Date, "now");

        [1000, 1500, 2100, 2200].forEach(cur => {
            now.mockReturnValue(cur);
            getCompilerInstance(options, createContext(options));
        });
        const actual = target.mock.calls.length;

        expect(actual).toBe(1);
    });

    it("loads addons again w/ next compilation and changed addon file", () => {
        const target = jest.spyOn(WebpackAddonService.prototype, "getAvailableAddons");
        const options = createOptions("addons-changed");
        const context = createContext(options, webpack({}));
        const testObj = getCompilerInstance(options, context);
        testObj.build(path.join(fixtureDir, "src", "a.ts"));
        touchFixture("addons/counter/addon.js");

        testObj.refreshAddons();
        testObj.build(path.join(fixtureDir, "src", "a.ts"));
        const actual = target.mock.calls.length;

        expect(actual).toBe(2);
    });
});
