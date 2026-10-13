/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationProfile, type Reporter } from "@quatico/websmith-api";
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
        const testObj = createModuleCompiler({ ...MODULE_PACKAGE, "/src/a.ts": `export const x = "before";` }, { target: { addons: ["replacer"] } }, {
            replacer: ctx => ctx.registerProcessor((_fileName, content) => content.replace("before", "after")),
        });

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
        const testObj = createModuleCompiler({ "/src/a.ts": "export const a = 1;" }, { target: { addons: ["results"] } }, {
            results: ctx => ctx.registerResultProcessor(target),
        });

        testObj.runResultProcessors(["/dist/a.js", "/dist/b.js"]);

        expect(target.mock.calls.map(([files]) => files)).toEqual([["/dist/a.js", "/dist/b.js"]]);
    });

    it("yields error diagnostic and runs next result processor w/ throwing result processor", () => {
        const target = jest.fn();
        const testObj = createModuleCompiler({ "/src/a.ts": "export const a = 1;" }, { target: { addons: ["throwing", "results"] } }, {
            throwing: ctx =>
                ctx.registerResultProcessor(() => {
                    throw new Error("Result exploded");
                }),
            results: ctx => ctx.registerResultProcessor(target),
        });

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

        expect(actual).toEqual(["Unknown profile 'unknown-profile' in 'depends' of '/websmith.config.json'."]);
        expect(spy.mock.calls.filter(([cur]) => cur.category === ts.DiagnosticCategory.Error)).toEqual([]);
    });

    it("resolves options again w/ modified options file", () => {
        const { testObj } = createOptionsCompiler("valid");
        const loadOptions = jest.fn().mockReturnValue({ tsConfigFile: "/tsconfig.json", configFile: "/websmith.config.json", profile: "broken" });

        const actual = testObj.refreshOptions(loadOptions, new Set([path.resolve("/websmith.config.json")]));

        expect(actual).toBe(true);
        expect(testObj.getConfigErrors().map(cur => cur.messageText)).toEqual(["Unknown profile 'unknown-profile' in 'depends' of '/websmith.config.json'."]);
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
