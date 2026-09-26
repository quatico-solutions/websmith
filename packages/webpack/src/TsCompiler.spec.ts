/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type CompilationProfile, type CompilerOptions, type Reporter } from "@quatico/websmith-api";
import { type CompileFragment, createSystem, NoReporter } from "@quatico/websmith-core";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { TsCompiler } from "./TsCompiler";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

// Create unique test directories for each test to prevent cross-test contamination
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const timestamp = Date.now();
    const uniqueId = `${testId}_${timestamp}`;
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-${uniqueId}`);
    const OUTPUT_DIR = path.resolve(PROJECT_DIR, "dist");
    const SOURCE_DIR = path.join(PROJECT_DIR, "src");
    return { PROJECT_DIR, OUTPUT_DIR, SOURCE_DIR };
};

class TestCompiler extends TsCompiler {
    private sys: ts.System | undefined;

    constructor(options: CompilerOptions, loaderConfig?: WebsmithLoaderConfig) {
        super(options, loaderConfig, path => console.info(`dependency ${path} added`, undefined, undefined));
        this.sys = super.getSystem();
    }

    public setSystem(system: ts.System | undefined): this {
        this.sys = system;
        return this;
    }

    public getSystem(): ts.System {
        return this.sys as any;
    }

    public stubEmitSourceFile(func: (fileName: string, target: string, writeFile: boolean) => CompileFragment) {
        super.emitSourceFile = func;
    }
}
let testObj: TestCompiler;
let expected: string;
let reporter: Reporter;

beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});

    const { SOURCE_DIR } = getTestDirs();
    expected = path.resolve(SOURCE_DIR, "one.ts");
    reporter = new NoReporter();
});

describe("TsCompiler", () => {
    beforeEach(() => {
        testObj = new TestCompiler(
            {
                tsConfig: { declaration: true, target: ts.ScriptTarget.ESNext, noEmitOnError: true },
                reporter,
                cliArgs: { options: {}, fileNames: [expected], errors: [] },
                debug: true,
                watch: false,
            },
            { configFile: "./websmith.config.json" }
        );
    });

    it("should throw error in build w/o system", () => {
        testObj.setSystem(undefined);

        expect(() => testObj.build("./src/one.ts")).toThrow(new Error("TsCompiler.build() called without a valid ts.System"));
    });

    it("should provide transpiled compilation fragment w/ build, default config, no profile and source code", () => {
        const { PROJECT_DIR } = getTestDirs();
        const expected = { version: 42, files: [{ name: "expected.ts", text: "expected" }] };
        const target = jest.fn().mockReturnValue(expected);
        testObj.stubEmitSourceFile(target);

        const actual = testObj.build("expected.ts").fragment;

        expect(actual).toEqual(expected);
        expect(target).toHaveBeenCalledWith(path.resolve("./expected.ts"), undefined, true);

        fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
    });
});

describe("Transpilation", () => {
    it("should provide transpiled compilation fragment w/ build, default target and source code", () => {
        const { PROJECT_DIR, SOURCE_DIR } = getTestDirs();
        const expected = path.join(SOURCE_DIR, "one.ts");
        createSource(expected, "export const one = () => 1;");

        const actual = new TestCompiler(
            {
                tsConfig: { declaration: true, target: ts.ScriptTarget.ESNext, noEmitOnError: true },
                reporter: new NoReporter(),
                cliArgs: { options: { declaration: true, target: ts.ScriptTarget.ESNext }, fileNames: [expected], errors: [] },
                debug: true,
                watch: false,
            },
            { configFile: path.join(PROJECT_DIR, "websmith.config.json") }
        ).build(expected).fragment;

        expect(actual.files.map(f => f.name)).toEqual([path.resolve(SOURCE_DIR, "one.js"), path.resolve(SOURCE_DIR, "one.d.ts")]);
        expect(actual.files.find(f => f.name.endsWith(".js"))?.text).toBe("export const one = () => 1;\n");
        expect(actual.files.find(f => f.name.endsWith(".d.ts"))?.text).toBe("export declare const one: () => number;\n");

        fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
    });

    it('should provide transpiled compilation fragment w/ build, "fragment" and "write" target and source code', () => {
        const { PROJECT_DIR, OUTPUT_DIR, SOURCE_DIR } = getTestDirs();
        const expected = path.join(SOURCE_DIR, "one.ts");
        createSource(expected, "export const one = () => 1;");
        const reporter = new NoReporter();
        testObj = new TestCompiler(
            {
                config: {
                    profiles: {
                        fragment: {
                            depends: ["write"],
                            tsConfig: { declaration: true },
                        },
                        write: { tsConfig: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, declarationMap: true, sourceMap: true } },
                    },
                    addonsDir: "./addons",
                },
                tsConfig: { target: ts.ScriptTarget.ESNext, outDir: OUTPUT_DIR, noEmitOnError: true, noEmit: false },
                reporter,
                cliArgs: { options: { target: ts.ScriptTarget.ESNext }, fileNames: [expected], errors: [] },
            },
            {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                profile: "fragment",
            }
        );

        const actual = testObj.build(expected).fragment;

        expect(actual.files.map(f => f.name)).toEqual([
            path.resolve(OUTPUT_DIR, "one.js.map"),
            path.resolve(OUTPUT_DIR, "one.js"),
            path.resolve(OUTPUT_DIR, "one.d.ts.map"),
            path.resolve(OUTPUT_DIR, "one.d.ts"),
        ]);
        expect(actual.files.find(f => f.name.endsWith("one.js.map"))?.text).toContain('"version":3');
        expect(actual.files.find(f => f.name.endsWith("one.js"))?.text).toContain('"use strict"');
        expect(actual.files.find(f => f.name.endsWith("one.d.ts.map"))?.text).toContain('"version":3');
        expect(actual.files.find(f => f.name.endsWith("one.d.ts"))?.text).toContain("export declare const one: () => number;");
        expect(fs.existsSync(path.resolve(OUTPUT_DIR, "one.js"))).toBe(true);
        expect(fs.existsSync(path.resolve(OUTPUT_DIR, "one.d.ts"))).toBe(true);

        fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
    });
});

const createSource = (fileName: string, text: string) => {
    const dir = path.dirname(fileName);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fileName, text);
};

const MODULE_PACKAGE = { "/package.json": JSON.stringify({ type: "module" }) };
const TS_CONFIG = { "/tsconfig.json": JSON.stringify({ compilerOptions: { target: "es2020", module: "esnext", outDir: "/dist", rootDir: "/src" } }) };
const REQUIRE_SOURCE = `declare const require: (id: string) => unknown;\nexport const x = require("x");`;

const createEsmCompiler = (files: Record<string, string>, profiles: Record<string, CompilationProfile>): TsCompiler =>
    new TsCompiler(
        {
            config: { profiles },
            reporter: new NoReporter(),
            cliArgs: { options: {}, fileNames: Object.keys(files).filter(cur => cur.endsWith(".ts")), errors: [] },
        },
        { tsConfigFile: "/tsconfig.json", transpileOnly: true, profile: "target" },
        undefined,
        undefined,
        createSystem({ ...TS_CONFIG, ...files }, { virtual: true })
    );

const NODE_DEPENDENT: CompilationProfile = { tsConfig: { outDir: "/lib" }, esm: { runtime: "node" } };

describe("TsCompiler ESM check", () => {
    it("yields 91001 w/ javascript/esm module type and require in bundler target", () => {
        const testObj = createEsmCompiler({ ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE }, { target: { esm: { runtime: "bundler" } } });

        const actual = testObj.build("/src/a.ts", "javascript/esm").diagnostics.map(cur => cur.code);

        expect(actual).toEqual([91001]);
    });

    it("yields nothing w/ javascript/auto module type and require in bundler target under module package", () => {
        const testObj = createEsmCompiler({ ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE }, { target: { esm: { runtime: "bundler" } } });

        const actual = testObj.build("/src/a.ts", "javascript/auto").diagnostics;

        expect(actual).toEqual([]);
    });

    it("yields 91001 w/o module type and require in bundler target under module package", () => {
        const testObj = createEsmCompiler({ ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE }, { target: { esm: { runtime: "bundler" } } });

        const actual = testObj.build("/src/a.ts").diagnostics.map(cur => cur.code);

        expect(actual).toEqual([91001]);
    });

    it("yields 91001 located in written file of node dependent profile", () => {
        const testObj = createEsmCompiler(
            { ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE },
            { target: { depends: ["node"] }, node: NODE_DEPENDENT }
        );

        const actual = testObj.build("/src/a.ts", "javascript/auto").diagnostics.map(cur => [cur.code, cur.file?.fileName]);

        expect(actual).toEqual([[91001, "/lib/a.js"]]);
    });

    it("yields diagnostics of target only w/ esm in target but not in its dependent profile", () => {
        const testObj = createEsmCompiler(
            { ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE },
            { target: { depends: ["node"], tsConfig: { outDir: "/dist" }, esm: { runtime: "bundler" } }, node: { tsConfig: { outDir: "/lib" } } }
        );

        const actual = testObj.build("/src/a.ts", "javascript/esm").diagnostics.map(cur => cur.file?.fileName);

        expect(actual).toEqual(["/dist/a.js"]);
    });

    it("yields warning category w/ check warn", () => {
        const testObj = createEsmCompiler(
            { ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE },
            { target: { esm: { runtime: "bundler", check: "warn" } } }
        );

        const actual = testObj.build("/src/a.ts", "javascript/esm").diagnostics.map(cur => cur.category);

        expect(actual).toEqual([ts.DiagnosticCategory.Warning]);
    });

    it("yields 91010 but no 91012 w/ extensionless and unresolved imports in node dependent profile", () => {
        const testObj = createEsmCompiler(
            { ...MODULE_PACKAGE, "/src/a.ts": `import "./b";\nimport "./gone.js";\nexport {};`, "/lib/b.js": "" },
            { target: { depends: ["node"] }, node: NODE_DEPENDENT }
        );

        const actual = testObj.build("/src/a.ts", "javascript/auto").diagnostics.map(cur => cur.code);

        expect(actual).toEqual([91010]);
    });

    it("yields nothing w/ extensionless import in bundler target with javascript/esm module type", () => {
        const testObj = createEsmCompiler(
            { ...MODULE_PACKAGE, "/src/a.ts": `import "./b";\nexport {};`, "/dist/b.js": "" },
            { target: { esm: { runtime: "bundler" } } }
        );

        const actual = testObj.build("/src/a.ts", "javascript/esm").diagnostics;

        expect(actual).toEqual([]);
    });

    it("reports found and missing package.json of node dependent profile as dependencies", () => {
        const testObj = createEsmCompiler(
            { ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE },
            { target: { depends: ["node"] }, node: NODE_DEPENDENT }
        );

        const actual = testObj.build("/src/a.ts", "javascript/auto").dependencies;

        expect(actual).toEqual({ files: ["/package.json"], missing: ["/lib/package.json"] });
    });

    it("reports same dependencies for second module in same directory", () => {
        const testObj = createEsmCompiler(
            { ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE, "/src/b.ts": REQUIRE_SOURCE },
            { target: { depends: ["node"] }, node: NODE_DEPENDENT }
        );
        testObj.build("/src/a.ts", "javascript/auto");

        const actual = testObj.build("/src/b.ts", "javascript/auto").dependencies;

        expect(actual).toEqual({ files: ["/package.json"], missing: ["/lib/package.json"] });
    });

    it("reads package.json once for two modules in same directory", () => {
        const testObj = createEsmCompiler(
            { ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE, "/src/b.ts": REQUIRE_SOURCE },
            { target: { depends: ["node"] }, node: NODE_DEPENDENT }
        );
        const target = jest.spyOn(testObj.getSystem(), "readFile");
        testObj.build("/src/a.ts", "javascript/auto");

        testObj.build("/src/b.ts", "javascript/auto");
        const actual = target.mock.calls.filter(([fileName]) => fileName === "/package.json").length;

        expect(actual).toBe(1);
    });

    it("reads package.json again after compilation caches are reset", () => {
        const testObj = createEsmCompiler(
            { ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE, "/src/b.ts": REQUIRE_SOURCE },
            { target: { depends: ["node"] }, node: NODE_DEPENDENT }
        );
        const target = jest.spyOn(testObj.getSystem(), "readFile");
        testObj.build("/src/a.ts", "javascript/auto");

        testObj.resetCompilationCaches();
        testObj.build("/src/b.ts", "javascript/auto");
        const actual = target.mock.calls.filter(([fileName]) => fileName === "/package.json").length;

        expect(actual).toBe(2);
    });

    it("reuses parsed output w/ second build of unchanged output", () => {
        const testObj = createEsmCompiler({ ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE }, { target: { esm: { runtime: "bundler" } } });
        const [expected] = testObj.build("/src/a.ts", "javascript/esm").diagnostics;

        const [actual] = testObj.build("/src/a.ts", "javascript/esm").diagnostics;

        expect(actual.file).toBe(expected.file);
    });
});
