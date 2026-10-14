/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationProfile, ErrorMessage, type Reporter } from "@quatico/websmith-api";
import path from "node:path";
import ts from "typescript";
import { createSystem } from "../environment";
import { AddonRegistry, type CompilationContext, ModuleCompiler, NoReporter } from "../index";

const MODULE_PACKAGE = { "/package.json": JSON.stringify({ type: "module" }) };
const TS_CONFIG = { "/tsconfig.json": JSON.stringify({ compilerOptions: { target: "es2020", module: "esnext", outDir: "/dist", rootDir: "/src" } }) };
const REQUIRE_SOURCE = `declare const require: (id: string) => unknown;\nexport const x = require("x");`;

const createAddons = (system: ts.System, reporter: Reporter, activators: Record<string, (ctx: CompilationContext) => void>): AddonRegistry => {
    system.createDirectory("/addons");
    const addons = new AddonRegistry({ addonsDir: "/addons", reporter, system });
    const available = Object.entries(activators).map(([name, activate]) => ({ getName: () => name, activate, needsTypeInfo: false }));
    addons.getAvailableAddons = jest.fn().mockReturnValue(available);
    addons.getAddonByName = jest.fn().mockImplementation((name: string) => available.find(cur => cur.getName() === name));
    return addons;
};

const createModuleCompiler = (
    files: Record<string, string>,
    profiles: Record<string, CompilationProfile>,
    activators: Record<string, (ctx: CompilationContext) => void> = {}
): ModuleCompiler => {
    const system = createSystem({ ...TS_CONFIG, ...files }, { virtual: true });
    const reporter = new NoReporter();
    return new ModuleCompiler(
        { config: { profiles }, reporter, cliArgs: { options: {}, fileNames: Object.keys(files).filter(cur => cur.endsWith(".ts")), errors: [] } },
        { tsConfigFile: "/tsconfig.json", transpileOnly: true, profile: "target" },
        system,
        { addons: createAddons(system, reporter, activators) }
    );
};

class ThrowingAddonsCompiler extends ModuleCompiler {
    protected applyAddons(): void {
        throw new Error("Addon exploded");
    }
}

class ThrowingSetupCompiler extends ModuleCompiler {
    protected prepareAddons(): void {
        throw new Error("Setup exploded");
    }
}

class RecordingCompiler extends ModuleCompiler {
    public readonly calls: string[] = [];

    protected prepareAddons(): void {
        this.calls.push("prepareAddons");
    }

    protected applyAddons(): void {
        this.calls.push("applyAddons");
    }

    protected onTargetEmitted(): void {
        this.calls.push("onTargetEmitted");
    }
}

describe("ModuleCompiler build", () => {
    it("yields fragment changed by processor addon from registry", () => {
        const testObj = createModuleCompiler(
            { ...MODULE_PACKAGE, "/src/a.ts": `export const x = "before";` },
            { target: { addons: ["replacer"] } },
            {
                replacer: ctx => ctx.registerProcessor((_fileName, content) => content.replace("before", "after")),
            }
        );

        const actual = testObj.build("/src/a.ts").fragment.files.find(cur => cur.name.endsWith(".js"))?.text;

        expect(actual).toContain(`"after"`);
    });

    it("yields nothing w/ auto module kind and require in bundler target under module package", () => {
        const testObj = createModuleCompiler({ ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE }, { target: { esm: { runtime: "bundler" } } });

        const actual = testObj.build("/src/a.ts", { moduleKind: "auto" }).diagnostics;

        expect(actual).toEqual([]);
    });

    it("yields 91001 w/o module kind and require in bundler target under module package", () => {
        const testObj = createModuleCompiler({ ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE }, { target: { esm: { runtime: "bundler" } } });

        const actual = testObj.build("/src/a.ts").diagnostics.map(cur => cur.code);

        expect(actual).toEqual([91001]);
    });

    it("yields 91001 w/ auto module kind and require in node target under module package", () => {
        const testObj = createModuleCompiler({ ...MODULE_PACKAGE, "/src/a.ts": REQUIRE_SOURCE }, { target: { esm: { runtime: "node" } } });

        const actual = testObj.build("/src/a.ts", { moduleKind: "auto" }).diagnostics.map(cur => cur.code);

        expect(actual).toEqual([91001]);
    });

    it("yields 91010 w/ esm module kind and extensionless import in node target", () => {
        const testObj = createModuleCompiler(
            { ...MODULE_PACKAGE, "/src/a.ts": `import "./b";\nexport {};`, "/dist/b.js": "" },
            { target: { esm: { runtime: "node" } } }
        );

        const actual = testObj.build("/src/a.ts", { moduleKind: "esm" }).diagnostics.map(cur => cur.code);

        expect(actual).toEqual([91010]);
    });

    it("yields nothing w/ esm module kind and extensionless import in bundler target", () => {
        const testObj = createModuleCompiler(
            { ...MODULE_PACKAGE, "/src/a.ts": `import "./b";\nexport {};`, "/dist/b.js": "" },
            { target: { esm: { runtime: "bundler" } } }
        );

        const actual = testObj.build("/src/a.ts", { moduleKind: "esm" }).diagnostics;

        expect(actual).toEqual([]);
    });

    it("yields error diagnostic w/ throwing host addon step", () => {
        const system = createSystem({ ...TS_CONFIG, "/src/a.ts": "export const a = 1;" }, { virtual: true });
        const target = new NoReporter();
        const spy = jest.spyOn(target, "reportDiagnostic");
        const testObj = new ThrowingAddonsCompiler(
            { reporter: target, cliArgs: { options: {}, fileNames: ["/src/a.ts"], errors: [] } },
            { tsConfigFile: "/tsconfig.json", transpileOnly: true },
            system
        );

        const actual = testObj.build("/src/a.ts").diagnostics.map(cur => [cur.category, cur.messageText]);

        expect(actual).toEqual([[ts.DiagnosticCategory.Error, "Addon processing failed: Addon exploded"]]);
        expect(spy).not.toHaveBeenCalled();
    });

    it("throws setup error w/ throwing host addon setup", () => {
        const system = createSystem({ ...TS_CONFIG, "/src/a.ts": "export const a = 1;" }, { virtual: true });
        const testObj = new ThrowingSetupCompiler(
            { reporter: new NoReporter(), cliArgs: { options: {}, fileNames: ["/src/a.ts"], errors: [] } },
            { tsConfigFile: "/tsconfig.json", transpileOnly: true },
            system
        );

        const actual = () => testObj.build("/src/a.ts");

        expect(actual).toThrow(new Error("Setup exploded"));
    });

    it("prepares addons after dependent profile writes and before addon step and target emit", () => {
        const system = createSystem({ ...TS_CONFIG, "/src/a.ts": "export const a = 1;" }, { virtual: true });
        const writeFile = system.writeFile.bind(system);
        const testObj = new RecordingCompiler(
            {
                config: { profiles: { target: { depends: ["node"], tsConfig: { outDir: "/dist" } }, node: { tsConfig: { outDir: "/lib" } } } },
                reporter: new NoReporter(),
                cliArgs: { options: {}, fileNames: ["/src/a.ts"], errors: [] },
            },
            { tsConfigFile: "/tsconfig.json", transpileOnly: true, profile: "target" },
            system
        );
        system.writeFile = (fileName, ...rest) => {
            testObj.calls.push(`write ${fileName}`);
            writeFile(fileName, ...rest);
        };

        testObj.build("/src/a.ts");

        expect(testObj.calls).toEqual(["write /lib/a.js", "prepareAddons", "applyAddons", "write /dist/a.js", "onTargetEmitted"]);
    });

    it("throws w/o system", () => {
        const testObj = createModuleCompiler({ "/src/a.ts": "export const a = 1;" }, { target: {} });
        jest.spyOn(testObj, "getSystem").mockReturnValue(undefined as never);

        expect(() => testObj.build("/src/a.ts")).toThrow(new Error("TsCompiler.build() called without a valid ts.System"));
    });
});

describe("ModuleCompiler runResultProcessors", () => {
    it("runs each result processor of target profile once w/ files", () => {
        const target = jest.fn();
        const testObj = createModuleCompiler(
            { "/src/a.ts": "export const a = 1;" },
            { target: { addons: ["results"] } },
            {
                results: ctx => ctx.registerResultProcessor(target),
            }
        );

        testObj.runResultProcessors(["/dist/a.js", "/dist/b.js"]);

        expect(target.mock.calls.map(([files]) => files)).toEqual([["/dist/a.js", "/dist/b.js"]]);
    });

    it("yields error diagnostic and runs next result processor w/ throwing result processor", () => {
        const target = jest.fn();
        const testObj = createModuleCompiler(
            { "/src/a.ts": "export const a = 1;" },
            { target: { addons: ["throwing", "results"] } },
            {
                throwing: ctx =>
                    ctx.registerResultProcessor(() => {
                        throw new Error("Result exploded");
                    }),
                results: ctx => ctx.registerResultProcessor(target),
            }
        );

        const actual = testObj.runResultProcessors(["/dist/a.js"]).map(cur => [cur.category, cur.messageText]);

        expect(actual).toEqual([[ts.DiagnosticCategory.Error, `Error in result processor "throwing": Error: Result exploded`]]);
        expect(target).toHaveBeenCalledTimes(1);
    });
});

describe("ModuleCompiler options", () => {
    const CONFIG_FILE = { "/websmith.config.json": JSON.stringify({ profiles: { broken: { depends: ["unknown-profile"] }, valid: {} } }) };

    const createOptionsCompiler = (profile: string, target: Reporter = new NoReporter()): { testObj: ModuleCompiler; system: ts.System } => {
        const system = createSystem({ ...TS_CONFIG, ...CONFIG_FILE, "/src/a.ts": "export const a = 1;" }, { virtual: true });
        const testObj = new ModuleCompiler(
            { reporter: target, cliArgs: { options: {}, fileNames: ["/src/a.ts"], errors: [] } },
            { tsConfigFile: "/tsconfig.json", configFile: "/websmith.config.json", transpileOnly: true, profile },
            system
        );
        return { testObj, system };
    };

    it("yields unknown profile error as config error w/o reporting it", () => {
        const target = new NoReporter();
        const spy = jest.spyOn(target, "reportDiagnostic");
        const { testObj } = createOptionsCompiler("broken", target);

        const actual = testObj.getConfigErrors().map(cur => cur.messageText);

        expect(actual).toEqual(["Unknown profile 'unknown-profile' in 'depends' of '/websmith.config.json'. Available profiles: broken, valid."]);
        expect(spy.mock.calls.filter(([cur]) => cur.category === ts.DiagnosticCategory.Error)).toEqual([]);
    });

    it("resolves options again w/ modified options file", () => {
        const { testObj } = createOptionsCompiler("valid");
        const loadOptions = jest.fn().mockReturnValue({ tsConfigFile: "/tsconfig.json", configFile: "/websmith.config.json", profile: "broken" });

        const actual = testObj.refreshOptions(loadOptions, new Set([path.resolve("/websmith.config.json")]));

        expect(actual).toBe(true);
        expect(testObj.getConfigErrors().map(cur => cur.messageText)).toEqual([
            "Unknown profile 'unknown-profile' in 'depends' of '/websmith.config.json'. Available profiles: broken, valid.",
        ]);
    });

    it("resolves options not again w/ other modified file", () => {
        const { testObj } = createOptionsCompiler("valid");
        const target = jest.fn();

        const actual = testObj.refreshOptions(target, new Set([path.resolve("/src/a.ts")]));

        expect(actual).toBe(false);
        expect(target).not.toHaveBeenCalled();
    });

    it("resolves options again w/ changed modification time of options file", () => {
        const { testObj, system } = createOptionsCompiler("valid");
        const loadOptions = jest.fn().mockReturnValue({ tsConfigFile: "/tsconfig.json", configFile: "/websmith.config.json", profile: "valid" });
        jest.spyOn(system, "getModifiedTime").mockReturnValue(new Date(1));

        const actual = testObj.refreshOptions(loadOptions);

        expect(actual).toBe(true);
    });

    it("resolves options not again w/ unchanged modification times", () => {
        const { testObj } = createOptionsCompiler("valid");
        const target = jest.fn();

        const actual = testObj.refreshOptions(target);

        expect(actual).toBe(false);
        expect(target).not.toHaveBeenCalled();
    });
});

describe("ModuleCompiler unconfigured profile", () => {
    const CONFIG_FILE = { "/websmith.config.json": JSON.stringify({ profiles: { a: {}, b: {} } }) };
    const PROFILE_ERROR = "Profile 'missing' is not configured in '/websmith.config.json'. Available profiles: a, b.";

    const createProfileCompiler = (profile: string): ModuleCompiler => {
        const system = createSystem({ ...TS_CONFIG, ...CONFIG_FILE, "/src/a.ts": "export const a = 1;" }, { virtual: true });
        return new ModuleCompiler(
            { reporter: new NoReporter(), cliArgs: { options: {}, fileNames: ["/src/a.ts"], errors: [] } },
            { tsConfigFile: "/tsconfig.json", configFile: "/websmith.config.json", transpileOnly: true, profile },
            system
        );
    };

    it("build yields no files and no diagnostics w/ unconfigured profile", () => {
        const testObj = createProfileCompiler("missing");

        const actual = testObj.build("/src/a.ts");

        expect(actual).toEqual({
            fragment: { version: 0, files: [], writtenFiles: [] },
            diagnostics: [],
            dependencies: { files: [], missing: [] },
        });
    });

    it("getConfigErrors yields profile error w/ unconfigured profile", () => {
        const testObj = createProfileCompiler("missing");

        const actual = testObj.getConfigErrors().map(cur => cur.messageText);

        expect(actual).toEqual([PROFILE_ERROR]);
    });

    it("isProfileConfigured yields false w/ unconfigured profile", () => {
        const testObj = createProfileCompiler("missing");

        const actual = testObj.isProfileConfigured();

        expect(actual).toBe(false);
    });

    it("isProfileConfigured yields true w/ configured profile", () => {
        const testObj = createProfileCompiler("a");

        const actual = testObj.isProfileConfigured();

        expect(actual).toBe(true);
    });

    it("isProfileConfigured yields true after updateLoaderConfig w/ config defining profile", () => {
        const testObj = createProfileCompiler("missing");

        testObj.updateLoaderConfig({
            tsConfigFile: "/tsconfig.json",
            transpileOnly: true,
            profile: "missing",
            config: { profiles: { missing: {} } },
        });
        const actual = testObj.isProfileConfigured();

        expect(actual).toBe(true);
        expect(testObj.getConfigErrors()).toEqual([]);
    });

    it("takeUnreportedConfigErrors yields profile error to first module only", () => {
        const testObj = createProfileCompiler("missing");
        testObj.takeUnreportedConfigErrors("/src/a.ts");

        const actual = testObj.takeUnreportedConfigErrors("/src/b.ts");

        expect(actual).toEqual([]);
        expect(testObj.takeUnreportedConfigErrors("/src/a.ts").map(cur => cur.messageText)).toEqual([PROFILE_ERROR]);
    });
});

describe("ModuleCompiler target compiler options", () => {
    const VIEW_SOURCE = `declare const h: unknown;\nexport const view = <div id="v" />;`;

    const createJsxCompiler = (): { testObj: ModuleCompiler; system: ts.System } => {
        const system = createSystem({ ...TS_CONFIG, "/src/v.tsx": VIEW_SOURCE }, { virtual: true });
        const testObj = new ModuleCompiler(
            {
                config: {
                    profiles: {
                        target: { depends: ["dep"], tsConfig: { jsx: ts.JsxEmit.ReactJSX, outDir: "/dist" } },
                        dep: { tsConfig: { jsx: ts.JsxEmit.ReactJSX, outDir: "/lib" } },
                    },
                },
                reporter: new NoReporter(),
                cliArgs: { options: {}, fileNames: ["/src/v.tsx"], errors: [] },
            },
            { tsConfigFile: "/tsconfig.json", transpileOnly: true, profile: "target" },
            system,
            { targetCompilerOptions: { jsx: ts.JsxEmit.Preserve } }
        );
        return { testObj, system };
    };

    it("yields fragment w/ preserved jsx w/ jsx preserve target option and react-jsx profile", () => {
        const { testObj } = createJsxCompiler();

        const actual = testObj.build("/src/v.tsx").fragment.files.find(cur => cur.name.endsWith(".jsx"))?.text;

        expect(actual).toContain(`<div id="v"/>`);
    });

    it("writes compiled jsx of dependent profile w/ jsx preserve target option", () => {
        const { testObj, system } = createJsxCompiler();

        testObj.build("/src/v.tsx");

        expect(system.readFile("/lib/v.js")).toContain("_jsx(");
    });

    it("yields fragment w/ preserved jsx after updateLoaderConfig w/ jsx preserve target option", () => {
        const { testObj } = createJsxCompiler();
        testObj.updateLoaderConfig({ tsConfigFile: "/tsconfig.json", transpileOnly: true, profile: "target" });

        const actual = testObj.build("/src/v.tsx").fragment.files.map(cur => path.extname(cur.name));

        expect(actual).toContain(".jsx");
    });
});

describe("ModuleCompiler option errors", () => {
    const INVALID_TS_CONFIG = {
        "/tsconfig.json": JSON.stringify({
            compilerOptions: { jsx: "react", jsxFactory: "h", reactNamespace: "R", outDir: "/dist", rootDir: "/src" },
        }),
    };
    const BOGUS_TS_CONFIG = {
        "/tsconfig.json": JSON.stringify({ compilerOptions: { bogusOption: true, outDir: "/dist", rootDir: "/src" } }),
    };
    const SOURCES = { "/src/a.ts": "export const a = 1;", "/src/b.ts": "export const b = 2;" };
    const LOADER_OPTIONS = { tsConfigFile: "/tsconfig.json", transpileOnly: true, profile: "target" };

    class InjectingCompiler extends ModuleCompiler {
        public injected: ts.Diagnostic[] = [];

        protected emitSourceFile(...args: Parameters<ModuleCompiler["emitSourceFile"]>): ReturnType<ModuleCompiler["emitSourceFile"]> {
            const fragment = super.emitSourceFile(...args);
            return { ...fragment, diagnostics: [...(fragment.diagnostics ?? []), ...this.injected] };
        }
    }

    it("yields no file-less TypeScript error in build w/ invalid option and two files", () => {
        const testObj = createModuleCompiler({ ...INVALID_TS_CONFIG, ...SOURCES }, { target: {} });

        const actual = [testObj.build("/src/a.ts"), testObj.build("/src/b.ts")].flatMap(cur => cur.diagnostics.map(diagnostic => diagnostic.code));

        expect(actual).toEqual([]);
    });

    it("yields file-less TypeScript error once as config error w/ invalid option and two files built", () => {
        const testObj = createModuleCompiler({ ...INVALID_TS_CONFIG, ...SOURCES }, { target: {} });
        testObj.build("/src/a.ts");
        testObj.build("/src/b.ts");

        const actual = testObj.getConfigErrors().map(cur => cur.code);

        expect(actual).toEqual([5053]);
    });

    it("yields file-less warning and websmith error w/o code in build", () => {
        const system = createSystem({ ...TS_CONFIG, "/src/a.ts": "export const a = 1;" }, { virtual: true });
        const testObj = new InjectingCompiler(
            { reporter: new NoReporter(), cliArgs: { options: {}, fileNames: ["/src/a.ts"], errors: [] } },
            { tsConfigFile: "/tsconfig.json", transpileOnly: true },
            system
        );
        testObj.injected = [
            {
                file: undefined,
                start: undefined,
                length: undefined,
                code: 6000,
                category: ts.DiagnosticCategory.Warning,
                messageText: "File-less warning",
            },
            new ErrorMessage("Websmith error"),
        ];

        const actual = testObj.build("/src/a.ts").diagnostics.map(cur => cur.messageText);

        expect(actual).toEqual(["File-less warning", "Websmith error"]);
    });

    it("yields no config errors w/ file-less warning and websmith error w/o code in build", () => {
        const system = createSystem({ ...TS_CONFIG, "/src/a.ts": "export const a = 1;" }, { virtual: true });
        const testObj = new InjectingCompiler(
            { reporter: new NoReporter(), cliArgs: { options: {}, fileNames: ["/src/a.ts"], errors: [] } },
            { tsConfigFile: "/tsconfig.json", transpileOnly: true },
            system
        );
        testObj.injected = [
            {
                file: undefined,
                start: undefined,
                length: undefined,
                code: 6000,
                category: ts.DiagnosticCategory.Warning,
                messageText: "File-less warning",
            },
            new ErrorMessage("Websmith error"),
        ];

        testObj.build("/src/a.ts");

        const actual = testObj.getConfigErrors();

        expect(actual).toEqual([]);
    });

    it("yields no file-less TypeScript error as config error after options update w/ valid options", () => {
        const testObj = createModuleCompiler({ ...INVALID_TS_CONFIG, ...SOURCES }, { target: {} });
        testObj.build("/src/a.ts");
        testObj.getSystem().writeFile("/tsconfig.json", TS_CONFIG["/tsconfig.json"]);
        testObj.updateLoaderConfig(LOADER_OPTIONS);

        const actual = testObj.getConfigErrors();

        expect(actual).toEqual([]);
    });

    it("yields file-less TypeScript error as config error after compilation caches reset", () => {
        const testObj = createModuleCompiler({ ...INVALID_TS_CONFIG, ...SOURCES }, { target: {} });
        testObj.build("/src/a.ts");
        testObj.resetCompilationCaches();

        const actual = testObj.getConfigErrors().map(cur => cur.code);

        expect(actual).toEqual([5053]);
    });

    it("yields config errors once to first built module w/o compilation hooks", () => {
        const testObj = createModuleCompiler({ ...INVALID_TS_CONFIG, ...SOURCES }, { target: {} });
        testObj.build("/src/a.ts");

        const actual = testObj.takeUnreportedConfigErrors("/src/a.ts").map(cur => cur.code);

        expect(actual).toEqual([5053]);
    });

    it("yields no config errors to second module w/ errors taken by first module", () => {
        const testObj = createModuleCompiler({ ...INVALID_TS_CONFIG, ...SOURCES }, { target: {} });
        testObj.build("/src/a.ts");
        testObj.takeUnreportedConfigErrors("/src/a.ts");
        testObj.build("/src/b.ts");

        const actual = testObj.takeUnreportedConfigErrors("/src/b.ts");

        expect(actual).toEqual([]);
    });

    it("yields config errors again to carrier module w/ carrier built again", () => {
        const testObj = createModuleCompiler({ ...INVALID_TS_CONFIG, ...SOURCES }, { target: {} });
        testObj.build("/src/a.ts");
        testObj.takeUnreportedConfigErrors("/src/a.ts");
        testObj.build("/src/b.ts");
        testObj.takeUnreportedConfigErrors("/src/b.ts");
        testObj.build("/src/a.ts");

        const actual = testObj.takeUnreportedConfigErrors("/src/a.ts").map(cur => cur.code);

        expect(actual).toEqual([5053]);
    });

    it("yields config errors to next module after options update", () => {
        const testObj = createModuleCompiler({ ...INVALID_TS_CONFIG, ...SOURCES }, { target: {} });
        testObj.build("/src/a.ts");
        testObj.takeUnreportedConfigErrors("/src/a.ts");
        testObj.updateLoaderConfig(LOADER_OPTIONS);
        testObj.build("/src/b.ts");

        const actual = testObj.takeUnreportedConfigErrors("/src/b.ts").map(cur => cur.code);

        expect(actual).toEqual([5053]);
    });
    it("yields tsconfig.json error once as config error w/ unknown option", () => {
        const testObj = createModuleCompiler({ ...BOGUS_TS_CONFIG, ...SOURCES }, { target: {} });
        testObj.build("/src/a.ts");
        testObj.build("/src/b.ts");

        const actual = testObj.getConfigErrors().map(cur => cur.code);

        expect(actual).toEqual([5023]);
    });

    it("yields tsconfig.json error to first module only w/ unknown option", () => {
        const testObj = createModuleCompiler({ ...BOGUS_TS_CONFIG, ...SOURCES }, { target: {} });
        testObj.build("/src/a.ts");
        testObj.build("/src/b.ts");

        const actual = [testObj.takeUnreportedConfigErrors("/src/a.ts"), testObj.takeUnreportedConfigErrors("/src/b.ts")].map(cur =>
            cur.map(diagnostic => diagnostic.code)
        );

        expect(actual).toEqual([[5023], []]);
    });

    it("yields no tsconfig.json error after options update w/ fixed tsconfig.json", () => {
        const testObj = createModuleCompiler({ ...BOGUS_TS_CONFIG, ...SOURCES }, { target: {} });
        testObj.build("/src/a.ts");
        testObj.getSystem().writeFile("/tsconfig.json", TS_CONFIG["/tsconfig.json"]);
        testObj.updateLoaderConfig(LOADER_OPTIONS);

        const actual = testObj.getConfigErrors();

        expect(actual).toEqual([]);
    });

    const createCompilerWith = (compilerOptions: object, files: Record<string, string>, transpileOnly: boolean): ModuleCompiler => {
        const tsConfig = {
            "/tsconfig.json": JSON.stringify({ compilerOptions: { outDir: "/dist", target: "es2020", module: "esnext", ...compilerOptions } }),
        };
        const system = createSystem({ ...tsConfig, ...files }, { virtual: true });
        return new ModuleCompiler(
            { reporter: new NoReporter(), cliArgs: { options: {}, fileNames: Object.keys(files), errors: [] } },
            { tsConfigFile: "/tsconfig.json", transpileOnly },
            system
        );
    };
    const ROOT_DIR_SOURCES = { "/src/lib/index.ts": `import { b } from "../b";\nexport const i = b;`, "/src/b.ts": "export const b = 1;" };

    it.each([
        { name: "fast path", transpileOnly: true, declaration: false },
        { name: "declaration", transpileOnly: false, declaration: true },
    ])("yields rootDir violation in build of the offending file w/ $name", ({ transpileOnly, declaration }) => {
        const testObj = createCompilerWith({ rootDir: "/src/lib", declaration }, ROOT_DIR_SOURCES, transpileOnly);

        const actual = testObj.build("/src/b.ts").diagnostics.map(cur => cur.code);

        expect(actual).toEqual([6059]);
    });

    it.each([
        { name: "fast path", transpileOnly: true, declaration: false },
        { name: "declaration", transpileOnly: false, declaration: true },
    ])("yields no rootDir violation as config error after build of the offending file w/ $name", ({ transpileOnly, declaration }) => {
        const testObj = createCompilerWith({ rootDir: "/src/lib", declaration }, ROOT_DIR_SOURCES, transpileOnly);
        testObj.build("/src/b.ts");

        const actual = testObj.getConfigErrors().map(cur => cur.code);

        expect(actual).toEqual([]);
    });

    it("yields no missing type definition file in build w/ declaration and two files", () => {
        const testObj = createCompilerWith({ rootDir: "/src", declaration: true, types: ["does-not-exist"] }, SOURCES, false);

        const actual = [testObj.build("/src/a.ts"), testObj.build("/src/b.ts")].flatMap(cur => cur.diagnostics.map(diagnostic => diagnostic.code));

        expect(actual).toEqual([]);
    });

    it("yields missing type definition file once as config error w/ declaration and two files built", () => {
        const testObj = createCompilerWith({ rootDir: "/src", declaration: true, types: ["does-not-exist"] }, SOURCES, false);
        testObj.build("/src/a.ts");
        testObj.build("/src/b.ts");

        const actual = testObj.getConfigErrors().map(cur => cur.code);

        expect(actual).toEqual([2688]);
    });

    it("yields no rootDir violation as config error after build of a file no longer importing the offending one", () => {
        const testObj = createCompilerWith({ rootDir: "/src/lib" }, ROOT_DIR_SOURCES, true);
        testObj.build("/src/lib/index.ts");
        testObj.build("/src/b.ts");
        testObj.getSystem().writeFile("/src/lib/index.ts", `export const i = 1;`);
        testObj.build("/src/lib/index.ts");

        const actual = testObj.getConfigErrors().map(cur => cur.code);

        expect(actual).toEqual([]);
    });
});

describe("ModuleCompiler dependent profile diagnostics", () => {
    const PROFILES = { target: { depends: ["dep"], tsConfig: { outDir: "/dist" } }, dep: { tsConfig: { outDir: "/lib" } } };
    const SOURCES = { "/src/a.ts": "export const a = 1;", "/src/b.ts": "export const b = 2;" };
    const FILE_LESS_ERROR: ts.Diagnostic = {
        file: undefined,
        start: undefined,
        length: undefined,
        code: 5095,
        category: ts.DiagnosticCategory.Error,
        messageText: "Option error",
    };

    class ProfileInjectingCompiler extends ModuleCompiler {
        public injected: Record<string, ts.Diagnostic[]> = {};

        protected emitSourceFile(...args: Parameters<ModuleCompiler["emitSourceFile"]>): ReturnType<ModuleCompiler["emitSourceFile"]> {
            const fragment = super.emitSourceFile(...args);
            return { ...fragment, diagnostics: [...(fragment.diagnostics ?? []), ...(this.injected[args[1] ?? ""] ?? [])] };
        }
    }

    const createInjectingCompiler = (
        injected: Record<string, ts.Diagnostic[]>,
        profiles: Record<string, CompilationProfile> = PROFILES,
        files: Record<string, string> = SOURCES
    ): ProfileInjectingCompiler => {
        const system = createSystem({ ...TS_CONFIG, ...files }, { virtual: true });
        const testObj = new ProfileInjectingCompiler(
            { config: { profiles }, reporter: new NoReporter(), cliArgs: { options: {}, fileNames: Object.keys(files), errors: [] } },
            { tsConfigFile: "/tsconfig.json", transpileOnly: true, profile: "target" },
            system
        );
        testObj.injected = injected;
        return testObj;
    };

    const createFileDiagnostic = (
        messageText: string | ts.DiagnosticMessageChain,
        category = ts.DiagnosticCategory.Error,
        fileName = "/src/a.ts"
    ): ts.Diagnostic => ({
        file: ts.createSourceFile(fileName, "", ts.ScriptTarget.ES2020),
        start: 0,
        length: 1,
        code: 4094,
        category,
        messageText,
    });

    const flatten = (diagnostics: ts.Diagnostic[]): string[] => diagnostics.map(cur => ts.flattenDiagnosticMessageText(cur.messageText, "\n"));

    it("yields error labelled w/ profile w/ error only in dependent profile", () => {
        const testObj = createInjectingCompiler({ dep: [createFileDiagnostic("Decl error")] });

        const actual = flatten(testObj.build("/src/a.ts").diagnostics);

        expect(actual).toEqual(['Decl error (profile "dep")']);
    });

    it("yields error once w/o label w/ same error in dependent and target profile", () => {
        const testObj = createInjectingCompiler({ dep: [createFileDiagnostic("Decl error")], target: [createFileDiagnostic("Decl error")] });

        const actual = flatten(testObj.build("/src/a.ts").diagnostics);

        expect(actual).toEqual(["Decl error"]);
    });

    it("yields error once labelled w/ first dependent profile w/ same error in two dependent profiles", () => {
        const testObj = createInjectingCompiler(
            { dep1: [createFileDiagnostic("Decl error")], dep2: [createFileDiagnostic("Decl error")] },
            { target: { depends: ["dep1", "dep2"], tsConfig: { outDir: "/dist" } }, dep1: { tsConfig: { outDir: "/lib1" } }, dep2: { tsConfig: { outDir: "/lib2" } } }
        );

        const actual = flatten(testObj.build("/src/a.ts").diagnostics);

        expect(actual).toEqual(['Decl error (profile "dep1")']);
    });

    it("yields warning labelled w/ profile w/ warning only in dependent profile", () => {
        const testObj = createInjectingCompiler({ dep: [createFileDiagnostic("Decl warning", ts.DiagnosticCategory.Warning)] });

        const actual = testObj.build("/src/a.ts").diagnostics.map(cur => [cur.category, cur.messageText]);

        expect(actual).toEqual([[ts.DiagnosticCategory.Warning, 'Decl warning (profile "dep")']]);
    });

    it("yields chain labelled on its head w/ chained message only in dependent profile", () => {
        const chain: ts.DiagnosticMessageChain = {
            messageText: "Head",
            category: ts.DiagnosticCategory.Error,
            code: 4094,
            next: [{ messageText: "Tail", category: ts.DiagnosticCategory.Error, code: 4094 }],
        };
        const testObj = createInjectingCompiler({ dep: [createFileDiagnostic(chain)] });

        const actual = testObj.build("/src/a.ts").diagnostics.map(cur => cur.messageText);

        expect(actual).toEqual([{ ...chain, messageText: 'Head (profile "dep")' }]);
    });

    it("leaves injected diagnostic unchanged w/ chained message only in dependent profile", () => {
        const target = createFileDiagnostic({ messageText: "Head", category: ts.DiagnosticCategory.Error, code: 4094 });
        const testObj = createInjectingCompiler({ dep: [target] });

        testObj.build("/src/a.ts");
        const actual = target.messageText;

        expect(actual).toEqual({ messageText: "Head", category: ts.DiagnosticCategory.Error, code: 4094 });
    });

    it("yields no file-less TypeScript error in build w/ file-less error only in dependent profile and two files", () => {
        const testObj = createInjectingCompiler({ dep: [FILE_LESS_ERROR] });

        const actual = [testObj.build("/src/a.ts"), testObj.build("/src/b.ts")].flatMap(cur => cur.diagnostics);

        expect(actual).toEqual([]);
    });

    it("yields file-less TypeScript error once labelled as config error w/ file-less error only in dependent profile and two files", () => {
        const testObj = createInjectingCompiler({ dep: [FILE_LESS_ERROR] });
        testObj.build("/src/a.ts");
        testObj.build("/src/b.ts");

        const actual = testObj.getConfigErrors().map(cur => cur.messageText);

        expect(actual).toEqual(['Option error (profile "dep")']);
    });

    it("yields file-less TypeScript error once w/o label as config error w/ same file-less error in dependent and target profile and two files", () => {
        const testObj = createInjectingCompiler({ dep: [FILE_LESS_ERROR], target: [FILE_LESS_ERROR] });
        testObj.build("/src/a.ts");
        testObj.build("/src/b.ts");

        const actual = testObj.getConfigErrors().map(cur => cur.messageText);

        expect(actual).toEqual(["Option error"]);
    });

    const OWN_FILE_ERROR: ts.Diagnostic = {
        ...FILE_LESS_ERROR,
        code: 6059,
        messageText: "File '/src/a.ts' is not under 'rootDir' '/src/lib'. 'rootDir' is expected to contain all source files.",
    };

    it("yields file-less TypeScript error naming the module's file labelled in build w/ error only in dependent profile", () => {
        const testObj = createInjectingCompiler({ dep: [OWN_FILE_ERROR] });

        const actual = flatten(testObj.build("/src/a.ts").diagnostics);

        expect(actual).toEqual(["File '/src/a.ts' is not under 'rootDir' '/src/lib'. 'rootDir' is expected to contain all source files. (profile \"dep\")"]);
    });

    it("yields no file-less TypeScript error naming the module's file as config error after rebuild w/o error in dependent profile", () => {
        const testObj = createInjectingCompiler({ dep: [OWN_FILE_ERROR] });
        testObj.build("/src/a.ts");
        testObj.injected = {};
        testObj.build("/src/a.ts");

        const actual = testObj.getConfigErrors();

        expect(actual).toEqual([]);
    });

    it("yields file-less TypeScript error naming '/src/a.tsx' as config error w/ build of '/src/a.ts'", () => {
        const target: ts.Diagnostic = { ...OWN_FILE_ERROR, messageText: "File '/src/a.tsx' is not under 'rootDir' '/src/lib'." };
        const testObj = createInjectingCompiler({ target: [target] }, { target: { tsConfig: { outDir: "/dist" } } });
        testObj.build("/src/a.ts");

        const actual = testObj.getConfigErrors().map(cur => cur.messageText);

        expect(actual).toEqual(["File '/src/a.tsx' is not under 'rootDir' '/src/lib'."]);
    });

    it("yields websmith error labelled in build w/ file-less error w/o code only in dependent profile", () => {
        const testObj = createInjectingCompiler({ dep: [new ErrorMessage("Websmith error")] });

        const actual = testObj.build("/src/a.ts").diagnostics.map(cur => cur.messageText);

        expect(actual).toEqual(['Websmith error (profile "dep")']);
    });

    it("yields syntax error once w/o label w/ syntax error in both profiles on the fast path", () => {
        const testObj = createInjectingCompiler({}, PROFILES, { "/src/a.ts": "export const x = ;" });

        const actual = flatten(testObj.build("/src/a.ts").diagnostics);

        expect(actual).toEqual(["Expression expected."]);
    });
});
