/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage, type Reporter, WarnMessage } from "@quatico/websmith-api";
import { type CompileFragment } from "@quatico/websmith-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { type AddonOutputs } from "./addon-outputs";
import { createWebsmithHooks, type EnvironmentInfo, type HookCompiler, type HookContext } from "./hooks";

const ROOT = "/project";
const MAIN = `${ROOT}/src/main.ts`;
const B = `${ROOT}/src/b.ts`;

const fragment = (files: Record<string, string> = {}): CompileFragment => ({
    version: 0,
    files: Object.entries(files).map(([name, text]) => ({ name, text, writeByteOrderMark: false })),
    writtenFiles: [],
});

const FILE = ts.createSourceFile(MAIN, "const a = 1;\nexport const x = ;\n", ts.ScriptTarget.ES2022);
const START = "const a = 1;\nexport const x = ".length;

const diagnostic = (messageText: string, category = ts.DiagnosticCategory.Error, position?: { file: ts.SourceFile; start: number }): ts.Diagnostic => ({
    category,
    code: 1,
    file: position?.file,
    start: position?.start,
    length: undefined,
    messageText,
});

const build = (diagnostics: ts.Diagnostic[], files: Record<string, string> = {}): HookCompiler["build"] =>
    jest.fn(() => ({ fragment: fragment(files), diagnostics, dependencies: { files: [], missing: [] } }));

const createOptions = (profiles: Record<string, { tsConfig?: ts.CompilerOptions; esm?: object }>, profile?: string): ReturnType<HookCompiler["getOptions"]> =>
    ({
        config: { profiles },
        getOptions: (name?: string) => ({ tsConfig: name ? profiles[name]?.tsConfig : undefined }),
        profile,
    }) as unknown as ReturnType<HookCompiler["getOptions"]>;

const createCompiler = (overrides: Partial<HookCompiler> = {}): HookCompiler => ({
    getOptions: jest.fn(() => createOptions({ app: { tsConfig: { module: ts.ModuleKind.ESNext } } }, "app")),
    getProfile: jest.fn(() => "app"),
    build: jest.fn(() => ({ fragment: fragment({ "main.js": "export const x = 1;" }), diagnostics: [], dependencies: { files: [], missing: [] } })),
    getConfigErrors: jest.fn(() => []),
    runResultProcessors: jest.fn(() => []),
    getOptionsFiles: jest.fn(() => ({ files: [], missing: [] })),
    refreshOptions: jest.fn(() => false),
    refreshAddons: jest.fn(),
    resetCompilationCaches: jest.fn(),
    keepCachesPerCompilation: jest.fn(),
    ...overrides,
});

const createEnvironment = (name = "client", outDir = "dist", command: "build" | "serve" = "build"): EnvironmentInfo => ({
    name,
    config: { root: ROOT, command, build: { outDir } },
});

const createContext = (moduleIds: string[] = [], environment: EnvironmentInfo = createEnvironment()): HookContext => ({
    error: jest.fn((error: unknown) => {
        throw new Error(typeof error === "string" ? error : (error as { message: string }).message);
    }),
    warn: jest.fn(),
    addWatchFile: jest.fn(),
    emitFile: jest.fn(() => "whatever"),
    getModuleIds: jest.fn(() => moduleIds.values()),
    environment,
});

const CLIENT = createEnvironment("client", "dist/client");
const SSR = createEnvironment("ssr", "dist/server");
const SSR_SERVE = createEnvironment("ssr", "dist/server", "serve");

const PROFILES = { profile: { client: "client", ssr: "server" } };

// Runs a hook expected to raise, so the test observes what it did before it raised
const attempt = (fn: () => unknown): void => {
    try {
        fn();
    } catch {
        // the raised error is not what the test observes
    }
};

// A project directory on disk with a package.json without "type", for the node16 and nodenext module format check
const nodeProjects: string[] = [];

const createNodeProject = (): string => {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "websmith-vite-hooks-")));
    fs.writeFileSync(path.join(dir, "package.json"), "{}");
    nodeProjects.push(dir);
    return dir;
};

afterEach(() => {
    nodeProjects.splice(0).forEach(cur => fs.rmSync(cur, { recursive: true, force: true }));
});

const createHooks = (compiler: HookCompiler, command: "build" | "serve" = "build") => {
    const testObj = createWebsmithHooks({ profile: "app" }, { createFilter: () => () => true, createCompiler: () => compiler });
    testObj.configResolved({ root: ROOT, command });
    return testObj;
};

describe("createWebsmithHooks", () => {
    describe("transformHandler", () => {
        it("should return null w/ id rejected by filter", () => {
            const testObj = createWebsmithHooks({}, { createFilter: () => () => false, createCompiler: () => createCompiler() });
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext());

            const actual = testObj.transformHandler.call(createContext(), "whatever", MAIN);

            expect(actual).toBeNull();
        });

        it("should return null w/o buildStart", () => {
            const testObj = createWebsmithHooks({}, { createFilter: () => () => true, createCompiler: () => createCompiler() });

            const actual = testObj.transformHandler.call(createContext(), "whatever", MAIN);

            expect(actual).toBeNull();
        });

        it("should return code and map w/ javascript output", () => {
            const compiler = createCompiler({
                build: jest.fn(() => ({
                    fragment: fragment({ "main.js": "export const x = 1;\n//# sourceMappingURL=main.js.map", "main.js.map": `{"version":3}` }),
                    diagnostics: [],
                    dependencies: { files: [], missing: [] },
                })),
            });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());

            const actual = testObj.transformHandler.call(createContext(), "whatever", MAIN);

            expect(actual).toEqual({ code: "export const x = 1;\n", map: { version: 3 } });
        });

        it("should build module as esm w/ compiled id", () => {
            const compiler = createCompiler();
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());

            testObj.transformHandler.call(createContext(), "whatever", MAIN);
            const actual = compiler.build;

            expect(actual).toHaveBeenCalledWith(MAIN, { moduleKind: "esm" });
        });

        it("should return null w/ fragment without javascript", () => {
            const compiler = createCompiler({ build: jest.fn(() => ({ fragment: fragment(), diagnostics: [], dependencies: { files: [], missing: [] } })) });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());

            const actual = testObj.transformHandler.call(createContext(), "whatever", MAIN);

            expect(actual).toBeNull();
        });

        it("should raise error w/ error diagnostic", () => {
            const compiler = createCompiler({ build: build([diagnostic("BOOM")]) });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());

            const actual = () => testObj.transformHandler.call(createContext(), "whatever", MAIN);

            expect(actual).toThrow("BOOM");
        });

        it("should raise one error with every message and loc w/ two error diagnostics", () => {
            const compiler = createCompiler({ build: build([diagnostic("First"), diagnostic("Second", ts.DiagnosticCategory.Error, { file: FILE, start: START })]) });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());
            const target = createContext();

            attempt(() => testObj.transformHandler.call(target, "whatever", MAIN));
            const actual = target.error;

            expect(actual).toHaveBeenCalledWith({ message: "First\nSecond", loc: { file: MAIN, line: 2, column: 17 } });
        });

        it("should warn once per warning w/ two warning diagnostics", () => {
            const compiler = createCompiler({ build: build([diagnostic("One", ts.DiagnosticCategory.Warning), diagnostic("Two", ts.DiagnosticCategory.Warning)]) });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());
            const target = createContext();

            testObj.transformHandler.call(target, "whatever", MAIN);
            const actual = target.warn;

            expect(actual).toHaveBeenCalledTimes(2);
        });

        it("should warn with loc w/ positioned warning", () => {
            const compiler = createCompiler({ build: build([diagnostic("ESM91001", ts.DiagnosticCategory.Warning, { file: FILE, start: START })]) });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());
            const target = createContext();

            testObj.transformHandler.call(target, "whatever", MAIN);
            const actual = target.warn;

            expect(actual).toHaveBeenCalledWith({ message: "ESM91001", loc: { file: MAIN, line: 2, column: 17 } });
        });

        it("should return output w/ warning only", () => {
            const compiler = createCompiler({ build: build([diagnostic("One", ts.DiagnosticCategory.Warning)], { "main.js": "whatever" }) });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());

            const actual = testObj.transformHandler.call(createContext(), "whatever", MAIN);

            expect(actual).toEqual({ code: "whatever", map: null });
        });

        it("should raise error w/ processor throw reported through reporter", () => {
            let reporter: Reporter | undefined;
            const compiler = createCompiler({
                build: jest.fn(() => {
                    reporter?.reportDiagnostic(new ErrorMessage('Error in processor "thrower": Error: BOOM_PROCESSOR'));
                    return { fragment: fragment({ "main.js": "whatever" }), diagnostics: [], dependencies: { files: [], missing: [] } };
                }),
            });
            const testObj = createWebsmithHooks({}, { createFilter: () => () => true, createCompiler: (_options, cur) => ((reporter = cur), compiler) });
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext());

            const actual = () => testObj.transformHandler.call(createContext(), "whatever", MAIN);

            expect(actual).toThrow("BOOM_PROCESSOR");
        });

        it("should warn w/ addon warning reported through reporter", () => {
            let reporter: Reporter | undefined;
            const compiler = createCompiler({
                build: jest.fn(() => {
                    reporter?.reportDiagnostic(new WarnMessage("ADDON_WARNING"));
                    return { fragment: fragment({ "main.js": "whatever" }), diagnostics: [], dependencies: { files: [], missing: [] } };
                }),
            });
            const testObj = createWebsmithHooks({}, { createFilter: () => () => true, createCompiler: (_options, cur) => ((reporter = cur), compiler) });
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext());
            const target = createContext();

            testObj.transformHandler.call(target, "whatever", MAIN);
            const actual = target.warn;

            expect(actual).toHaveBeenCalledWith("ADDON_WARNING");
        });

        it("should add dependencies as watch files", () => {
            const compiler = createCompiler({
                build: jest.fn(() => ({
                    fragment: fragment({ "main.js": "whatever" }),
                    diagnostics: [],
                    dependencies: { files: [`${ROOT}/package.json`], missing: [`${ROOT}/src/package.json`] },
                })),
            });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());
            const target = createContext();

            testObj.transformHandler.call(target, "whatever", MAIN);
            const actual = (target.addWatchFile as jest.Mock).mock.calls.map(([cur]: [string]) => cur);

            expect(actual).toEqual([`${ROOT}/package.json`, `${ROOT}/src/package.json`]);
        });
    });

    describe("buildStart", () => {
        it("should raise configuration errors w/ build mode", () => {
            const compiler = createCompiler({ getConfigErrors: jest.fn(() => [diagnostic("Unknown profile 'missing'")]) });
            const testObj = createHooks(compiler);

            const actual = () => testObj.buildStart.call(createContext());

            expect(actual).toThrow("Unknown profile 'missing'");
        });

        it("should raise one error with every configuration error w/ two errors", () => {
            const compiler = createCompiler({ getConfigErrors: jest.fn(() => [diagnostic("First"), diagnostic("Second")]) });
            const testObj = createHooks(compiler);
            const target = createContext();

            attempt(() => testObj.buildStart.call(target));
            const actual = target.error;

            expect(actual).toHaveBeenCalledWith({ message: "First\nSecond" });
        });

        it("should not raise configuration errors w/ serve mode", () => {
            const compiler = createCompiler({ getConfigErrors: jest.fn(() => [diagnostic("Unknown profile 'missing'")]) });
            const testObj = createHooks(compiler, "serve");

            const actual = () => testObj.buildStart.call(createContext());

            expect(actual).not.toThrow();
        });

        it("should raise activation error reported through reporter w/ build mode", () => {
            const testObj = createWebsmithHooks(
                {},
                {
                    createFilter: () => () => true,
                    createCompiler: (_options, reporter) => {
                        reporter.reportDiagnostic(new ErrorMessage('Error activating addon "thrower": Error: BOOM_ACTIVATE'));
                        return createCompiler();
                    },
                }
            );
            testObj.configResolved({ root: ROOT, command: "build" });

            const actual = () => testObj.buildStart.call(createContext());

            expect(actual).toThrow("BOOM_ACTIVATE");
        });

        it("should leave activation error to the handler w/ serve mode", () => {
            const testObj = createWebsmithHooks(
                {},
                {
                    createFilter: () => () => true,
                    createCompiler: (_options, reporter) => {
                        reporter.reportDiagnostic(new ErrorMessage('Error activating addon "thrower": Error: BOOM_ACTIVATE'));
                        return createCompiler();
                    },
                }
            );
            testObj.configResolved({ root: ROOT, command: "serve" });
            testObj.buildStart.call(createContext());

            const actual = () => testObj.transformHandler.call(createContext(), "whatever", MAIN);

            expect(actual).toThrow("BOOM_ACTIVATE");
        });

        it("should warn once w/ missing addons warning reported twice", () => {
            const testObj = createWebsmithHooks(
                {},
                {
                    createFilter: () => () => true,
                    createCompiler: (_options, reporter) => {
                        reporter.reportDiagnostic(new WarnMessage('Missing addons for profile "app": "nope"'));
                        reporter.reportDiagnostic(new WarnMessage('Missing addons for profile "app": "nope"'));
                        return createCompiler();
                    },
                }
            );
            testObj.configResolved({ root: ROOT, command: "build" });
            const target = createContext();

            testObj.buildStart.call(target);
            const actual = target.warn;

            expect(actual).toHaveBeenCalledTimes(1);
        });

        it("should warn once w/ missing addons warning reported by two modules", () => {
            let reporter: Reporter | undefined;
            const compiler = createCompiler({
                build: jest.fn(() => {
                    reporter?.reportDiagnostic(new WarnMessage('Missing addons for profile "app": "nope"'));
                    return { fragment: fragment({ "main.js": "whatever" }), diagnostics: [], dependencies: { files: [], missing: [] } };
                }),
            });
            const testObj = createWebsmithHooks({}, { createFilter: () => () => true, createCompiler: (_options, cur) => ((reporter = cur), compiler) });
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext());
            const target = createContext();

            testObj.transformHandler.call(target, "whatever", MAIN);
            testObj.transformHandler.call(target, "whatever", `${ROOT}/src/b.ts`);
            const actual = target.warn;

            expect(actual).toHaveBeenCalledTimes(1);
        });

        it("should warn again w/ missing addons warning in rebuild", () => {
            let reporter: Reporter | undefined;
            const compiler = createCompiler({
                build: jest.fn(() => {
                    reporter?.reportDiagnostic(new WarnMessage('Missing addons for profile "app": "nope"'));
                    return { fragment: fragment({ "main.js": "whatever" }), diagnostics: [], dependencies: { files: [], missing: [] } };
                }),
            });
            const testObj = createWebsmithHooks({}, { createFilter: () => () => true, createCompiler: (_options, cur) => ((reporter = cur), compiler) });
            testObj.configResolved({ root: ROOT, command: "build" });
            const target = createContext();
            testObj.buildStart.call(target);
            testObj.transformHandler.call(target, "whatever", MAIN);

            testObj.buildStart.call(target);
            testObj.transformHandler.call(target, "whatever", MAIN);
            const actual = target.warn;

            expect(actual).toHaveBeenCalledTimes(2);
        });

        it("should raise configuration error w/ profile emitting commonjs", () => {
            const compiler = createCompiler({ getOptions: jest.fn(() => createOptions({ app: { tsConfig: { module: ts.ModuleKind.CommonJS } } }, "app")) });
            const testObj = createHooks(compiler);

            const actual = () => testObj.buildStart.call(createContext());

            expect(actual).toThrow("Profile 'app' emits CommonJS");
        });

        it("should not raise w/ profile emitting commonjs and esm set", () => {
            const compiler = createCompiler({
                getOptions: jest.fn(() => createOptions({ app: { tsConfig: { module: ts.ModuleKind.CommonJS }, esm: { runtime: "bundler" } } }, "app")),
            });
            const testObj = createHooks(compiler);

            const actual = () => testObj.buildStart.call(createContext());

            expect(actual).not.toThrow();
        });

        it("should add watch files for options files w/ build mode", () => {
            const compiler = createCompiler({ getOptionsFiles: jest.fn(() => ({ files: [`${ROOT}/websmith.config.json`], missing: [`${ROOT}/tsconfig.json`] })) });
            const testObj = createHooks(compiler);
            const target = createContext();

            testObj.buildStart.call(target);
            const actual = (target.addWatchFile as jest.Mock).mock.calls.flat();

            expect(actual).toEqual([`${ROOT}/websmith.config.json`, `${ROOT}/tsconfig.json`]);
        });

        it("should not add watch files w/ serve mode", () => {
            const compiler = createCompiler({ getOptionsFiles: jest.fn(() => ({ files: [`${ROOT}/websmith.config.json`], missing: [] })) });
            const testObj = createHooks(compiler, "serve");
            const target = createContext();

            testObj.buildStart.call(target);
            const actual = target.addWatchFile;

            expect(actual).not.toHaveBeenCalled();
        });

        it("should create compiler once w/ two builds", () => {
            const target = jest.fn(() => createCompiler());
            const testObj = createWebsmithHooks({}, { createFilter: () => () => true, createCompiler: target });
            testObj.configResolved({ root: ROOT, command: "build" });

            testObj.buildStart.call(createContext());
            testObj.buildStart.call(createContext());
            const actual = target.mock.calls.length;

            expect(actual).toBe(1);
        });

        it("should create compiler w/ loader options resolved against root", () => {
            const target = jest.fn(() => createCompiler());
            const testObj = createWebsmithHooks({ profile: "app" }, { createFilter: () => () => true, createCompiler: target });
            testObj.configResolved({ root: ROOT, command: "build" });

            testObj.buildStart.call(createContext());
            const actual = target.mock.calls[0][0];

            expect(actual).toEqual({ configFile: `${ROOT}/websmith.config.json`, profile: "app" });
        });

        it("should keep caches per compilation w/ first build", () => {
            const compiler = createCompiler();
            const testObj = createHooks(compiler);

            testObj.buildStart.call(createContext());
            const actual = compiler.keepCachesPerCompilation;

            expect(actual).toHaveBeenCalledTimes(1);
        });

        it("should not refresh options w/ first build", () => {
            const compiler = createCompiler();
            const testObj = createHooks(compiler);

            testObj.buildStart.call(createContext());
            const actual = compiler.refreshOptions;

            expect(actual).not.toHaveBeenCalled();
        });

        it("should refresh options with the loader options w/ rebuild", () => {
            const compiler = createCompiler();
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());

            testObj.buildStart.call(createContext());
            const actual = jest.mocked(compiler.refreshOptions).mock.calls[0][0]();

            expect(actual).toEqual({ configFile: `${ROOT}/websmith.config.json`, profile: "app" });
        });

        it("should refresh addons w/ rebuild", () => {
            const compiler = createCompiler();
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());

            testObj.buildStart.call(createContext());
            const actual = compiler.refreshAddons;

            expect(actual).toHaveBeenCalledTimes(1);
        });

        it("should refresh options before resetting caches w/ rebuild", () => {
            const order: string[] = [];
            const compiler = createCompiler({
                refreshOptions: jest.fn(() => (order.push("refreshOptions"), false)),
                refreshAddons: jest.fn(() => order.push("refreshAddons")),
                resetCompilationCaches: jest.fn(() => order.push("resetCompilationCaches")),
            });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());

            testObj.buildStart.call(createContext());
            const actual = order;

            expect(actual).toEqual(["refreshOptions", "refreshAddons", "resetCompilationCaches"]);
        });

        it("should add watch file added on activation again w/ rebuild", () => {
            const testObj = createWebsmithHooks(
                {},
                {
                    createFilter: () => () => true,
                    createCompiler: (_options, _reporter, outputs) => (outputs.addWatchFile(`${ROOT}/t.html`, "addAssetDependency", "probe"), createCompiler()),
                }
            );
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext());
            const target = createContext();

            testObj.buildStart.call(target);
            const actual = target.addWatchFile;

            expect(actual).toHaveBeenCalledWith(`${ROOT}/t.html`);
        });

        it("should reset compilation caches w/ rebuild", () => {
            const compiler = createCompiler();
            const testObj = createHooks(compiler);

            testObj.buildStart.call(createContext());
            testObj.buildStart.call(createContext());
            const actual = compiler.resetCompilationCaches;

            expect(actual).toHaveBeenCalledTimes(1);
        });
    });

    describe("buildEnd", () => {
        it("should not raise errors buildStart raised w/ build mode", () => {
            const compiler = createCompiler({ getConfigErrors: jest.fn(() => [diagnostic("Unknown profile 'missing'")]) });
            const testObj = createHooks(compiler);
            attempt(() => testObj.buildStart.call(createContext()));

            const actual = () => testObj.buildEnd.call(createContext(), undefined);

            expect(actual).not.toThrow();
        });

        it("should raise errors collected after buildStart w/ build mode", () => {
            const errors = [diagnostic("Unknown profile 'missing'")];
            const compiler = createCompiler({ getConfigErrors: jest.fn(() => errors) });
            const testObj = createHooks(compiler);
            attempt(() => testObj.buildStart.call(createContext()));
            errors.push(diagnostic("TS5053"));

            const actual = () => testObj.buildEnd.call(createContext(), undefined);

            expect(actual).toThrow(/^TS5053$/);
        });

        it("should warn w/ warning reported after the last transform", () => {
            let reporter: Reporter | undefined;
            const testObj = createWebsmithHooks({}, { createFilter: () => () => true, createCompiler: (_options, cur) => ((reporter = cur), createCompiler()) });
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext());
            reporter?.reportDiagnostic(new WarnMessage("LATE_WARNING"));
            const target = createContext();

            testObj.buildEnd.call(target, undefined);
            const actual = target.warn;

            expect(actual).toHaveBeenCalledWith("LATE_WARNING");
        });

        it("should raise config errors w/ build mode", () => {
            const errors: ts.Diagnostic[] = [];
            const compiler = createCompiler({ getConfigErrors: jest.fn(() => errors) });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());
            errors.push(diagnostic("TS5053"));

            const actual = () => testObj.buildEnd.call(createContext(), undefined);

            expect(actual).toThrow("TS5053");
        });

        it("should not raise config errors w/ serve mode", () => {
            const compiler = createCompiler({ getConfigErrors: jest.fn(() => [diagnostic("TS5053")]) });
            const testObj = createHooks(compiler, "serve");
            testObj.buildStart.call(createContext());

            const actual = () => testObj.buildEnd.call(createContext(), undefined);

            expect(actual).not.toThrow();
        });

        it("should not raise config errors w/ earlier build error", () => {
            const errors: ts.Diagnostic[] = [];
            const compiler = createCompiler({ getConfigErrors: jest.fn(() => errors) });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());
            errors.push(diagnostic("TS5053"));

            const actual = () => testObj.buildEnd.call(createContext(), new Error("whatever"));

            expect(actual).not.toThrow();
        });

        it("should not raise w/o buildStart", () => {
            const testObj = createWebsmithHooks({}, { createFilter: () => () => true, createCompiler: () => createCompiler({ getConfigErrors: jest.fn(() => [diagnostic("TS5053")]) }) });
            testObj.configResolved({ root: ROOT, command: "build" });

            const actual = () => testObj.buildEnd.call(createContext(), undefined);

            expect(actual).not.toThrow();
        });

        it("should run result processors once w/ outputs of module ids", () => {
            const compiler = createCompiler({
                build: jest.fn((id: string) => ({
                    fragment: fragment(id === MAIN ? { "/dist/main.js": "whatever", "/dist/main.js.map": "{}" } : { "/dist/b.js": "whatever" }),
                    diagnostics: [],
                    dependencies: { files: [], missing: [] },
                })),
            });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());
            testObj.transformHandler.call(createContext(), "whatever", MAIN);
            testObj.transformHandler.call(createContext(), "whatever", B);
            testObj.transformHandler.call(createContext(), "whatever", `${ROOT}/src/gone.ts`);

            testObj.buildEnd.call(createContext([MAIN, B]), undefined);
            const actual = (compiler.runResultProcessors as jest.Mock).mock.calls;

            expect(actual).toEqual([[["/dist/main.js", "/dist/main.js.map", "/dist/b.js"]]]);
        });

        it("should not run result processors w/ serve mode", () => {
            const compiler = createCompiler();
            const testObj = createHooks(compiler, "serve");
            testObj.buildStart.call(createContext());

            testObj.buildEnd.call(createContext([MAIN]), undefined);
            const actual = compiler.runResultProcessors;

            expect(actual).not.toHaveBeenCalled();
        });

        it("should not run result processors w/ earlier build error", () => {
            const compiler = createCompiler();
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());

            testObj.buildEnd.call(createContext([MAIN]), new Error("whatever"));
            const actual = compiler.runResultProcessors;

            expect(actual).not.toHaveBeenCalled();
        });

        it("should raise result processor error", () => {
            const compiler = createCompiler({ runResultProcessors: jest.fn(() => [diagnostic(`Error in result processor "probe": Error: BOOM_RESULT`)]) });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());

            const actual = () => testObj.buildEnd.call(createContext([MAIN]), undefined);

            expect(actual).toThrow("BOOM_RESULT");
        });

        it("should raise error reported by result processor through reporter", () => {
            let reporter: Reporter | undefined;
            const compiler = createCompiler({
                runResultProcessors: jest.fn(() => {
                    reporter?.reportDiagnostic(new ErrorMessage("ADDON_CONTEXT_ERROR"));
                    return [];
                }),
            });
            const testObj = createWebsmithHooks({}, { createFilter: () => () => true, createCompiler: (_options, cur) => ((reporter = cur), compiler) });
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext());

            const actual = () => testObj.buildEnd.call(createContext([MAIN]), undefined);

            expect(actual).toThrow("ADDON_CONTEXT_ERROR");
        });
    });

    describe("generateBundle", () => {
        it("should emit virtual file added in transform", () => {
            let outputs: AddonOutputs | undefined;
            const compiler = createCompiler({
                build: jest.fn(() => {
                    outputs?.addVirtualFile("virtual.json", "{}", "probe");
                    return { fragment: fragment({ "main.js": "whatever" }), diagnostics: [], dependencies: { files: [], missing: [] } };
                }),
            });
            const testObj = createWebsmithHooks({}, { createFilter: () => () => true, createCompiler: (_options, _reporter, cur) => ((outputs = cur), compiler) });
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext());
            testObj.transformHandler.call(createContext(), "whatever", MAIN);
            const target = createContext([MAIN]);

            testObj.generateBundle.call(target, {}, {});
            const actual = target.emitFile;

            expect(actual).toHaveBeenCalledWith({ type: "asset", fileName: "virtual.json", source: "{}" });
        });

        it("should emit virtual file added on activation w/ rebuild", () => {
            const testObj = createWebsmithHooks(
                {},
                {
                    createFilter: () => () => true,
                    createCompiler: (_options, _reporter, outputs) => (outputs.addVirtualFile("activation.json", "{}", "probe"), createCompiler()),
                }
            );
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext());
            testObj.buildStart.call(createContext());
            const target = createContext([MAIN]);

            testObj.generateBundle.call(target, {}, {});
            const actual = target.emitFile;

            expect(actual).toHaveBeenCalledWith({ type: "asset", fileName: "activation.json", source: "{}" });
        });

        it("should raise error an addon context reported", () => {
            let reporter: Reporter | undefined;
            const testObj = createWebsmithHooks({}, { createFilter: () => () => true, createCompiler: (_options, cur) => ((reporter = cur), createCompiler()) });
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext());
            reporter?.reportDiagnostic(new ErrorMessage("ADDON_CONTEXT_ERROR"));

            const actual = () => testObj.generateBundle.call(createContext([MAIN]), {}, {});

            expect(actual).toThrow("ADDON_CONTEXT_ERROR");
        });

        it("should warn w/ removal of file absent from bundle", () => {
            let outputs: AddonOutputs | undefined;
            const testObj = createWebsmithHooks({}, { createFilter: () => () => true, createCompiler: (_options, _reporter, cur) => ((outputs = cur), createCompiler()) });
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext());
            outputs?.removeOutputFile("absent.js", "probe");
            const target = createContext([MAIN]);

            testObj.generateBundle.call(target, {}, {});
            const actual = target.warn;

            expect(actual).toHaveBeenCalledWith(`removeOutputFile of addon "probe" found no 'absent.js' in the bundle`);
        });
    });

    describe("environments", () => {
        it("should create compiler per environment with its profile w/ profile map", () => {
            const target = jest.fn(() => createCompiler());
            const testObj = createWebsmithHooks(PROFILES, { createFilter: () => () => true, createCompiler: target });
            testObj.configResolved({ root: ROOT, command: "build" });

            testObj.buildStart.call(createContext([], CLIENT));
            testObj.buildStart.call(createContext([], SSR));
            const actual = target.mock.calls.map(([cur]: [{ profile?: string }]) => cur.profile);

            expect(actual).toEqual(["client", "server"]);
        });

        it("should create compiler per environment with the same profile w/ string profile", () => {
            const target = jest.fn(() => createCompiler());
            const testObj = createWebsmithHooks({ profile: "app" }, { createFilter: () => () => true, createCompiler: target });
            testObj.configResolved({ root: ROOT, command: "build" });

            testObj.buildStart.call(createContext([], CLIENT));
            testObj.buildStart.call(createContext([], SSR));
            const actual = target.mock.calls.map(([cur]: [{ profile?: string }]) => cur.profile);

            expect(actual).toEqual(["app", "app"]);
        });

        it("should refresh compiler and not create one w/ second buildStart of same environment", () => {
            const compiler = createCompiler();
            const target = jest.fn(() => compiler);
            const testObj = createWebsmithHooks(PROFILES, { createFilter: () => () => true, createCompiler: target });
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext([], CLIENT));
            testObj.buildStart.call(createContext([], SSR));

            testObj.buildStart.call(createContext([], CLIENT));
            const actual = [target.mock.calls.length, jest.mocked(compiler.refreshAddons).mock.calls.length];

            expect(actual).toEqual([2, 1]);
        });

        it("should create compiler of environment w/ transform without buildStart", () => {
            const target = jest.fn(() => createCompiler());
            const testObj = createWebsmithHooks(PROFILES, { createFilter: () => () => true, createCompiler: target });
            testObj.configResolved({ root: ROOT, command: "serve" });
            testObj.buildStart.call(createContext([], createEnvironment("client", "dist/client", "serve")));

            testObj.transformHandler.call(createContext([], SSR_SERVE), "whatever", MAIN);
            const actual = target.mock.calls.map(([cur]: [{ profile?: string }]) => cur.profile);

            expect(actual).toEqual(["client", "server"]);
        });

        it("should raise profile error once in buildStart w/ environment not in profile map", () => {
            const testObj = createWebsmithHooks(
                { profile: { client: "client" } },
                { createFilter: () => () => true, createCompiler: () => createCompiler() }
            );
            testObj.configResolved({ root: ROOT, command: "build" });
            const target = createContext([], SSR);

            attempt(() => testObj.buildStart.call(target));
            testObj.buildEnd.call(target, new Error("whatever"));
            const actual = target.error;

            expect(actual).toHaveBeenCalledTimes(1);
            expect(actual).toHaveBeenCalledWith({
                message: "The websmith plugin's 'profile' map names no profile for the Vite environment 'ssr'. It names: client.",
            });
        });

        it("should build other environment w/ environment not in profile map", () => {
            const compiler = createCompiler();
            const testObj = createWebsmithHooks(
                { profile: { client: "client" } },
                { createFilter: () => () => true, createCompiler: () => compiler }
            );
            testObj.configResolved({ root: ROOT, command: "build" });
            attempt(() => testObj.buildStart.call(createContext([], SSR)));
            testObj.buildStart.call(createContext([], CLIENT));

            const actual = testObj.transformHandler.call(createContext([], CLIENT), "whatever", MAIN);

            expect(actual).toEqual({ code: "export const x = 1;", map: null });
        });

        it("should raise profile error in transform and not create compiler w/ environment not in profile map in serve mode", () => {
            const target = jest.fn(() => createCompiler());
            const testObj = createWebsmithHooks({ profile: { client: "client" } }, { createFilter: () => () => true, createCompiler: target });
            testObj.configResolved({ root: ROOT, command: "serve" });

            const actual = () => testObj.transformHandler.call(createContext([], SSR_SERVE), "whatever", MAIN);

            expect(actual).toThrow("The websmith plugin's 'profile' map names no profile for the Vite environment 'ssr'. It names: client.");
            expect(target).not.toHaveBeenCalled();
        });

        it("should place virtual file relative to outDir of environment config", () => {
            const outputs: AddonOutputs[] = [];
            const testObj = createWebsmithHooks(PROFILES, {
                createFilter: () => () => true,
                createCompiler: (_options, _reporter, cur) => (outputs.push(cur), createCompiler()),
            });
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext([], CLIENT));
            testObj.buildStart.call(createContext([], SSR));

            const actual = outputs.map(cur => cur.toBundleFileName(`${ROOT}/dist/client/abs.json`, "addVirtualFile", "probe"));

            expect(actual).toEqual(["abs.json", undefined]);
        });

        it("should place virtual file relative to outDir of later build w/ second build of same environment", () => {
            const outputs: AddonOutputs[] = [];
            const testObj = createWebsmithHooks(PROFILES, {
                createFilter: () => () => true,
                createCompiler: (_options, _reporter, cur) => (outputs.push(cur), createCompiler()),
            });
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext([], createEnvironment("client", "dist/a")));

            testObj.buildStart.call(createContext([], createEnvironment("client", "dist/b")));
            const actual = outputs[0].toBundleFileName(`${ROOT}/dist/b/x.json`, "addVirtualFile", "probe");

            expect(actual).toBe("x.json");
        });

        it("should run result processors of environment compiler only in buildEnd", () => {
            const compilers = [createCompiler(), createCompiler()];
            const testObj = createWebsmithHooks(PROFILES, {
                createFilter: () => () => true,
                createCompiler: () => compilers.shift() ?? createCompiler(),
            });
            const [client, ssr] = compilers;
            testObj.configResolved({ root: ROOT, command: "build" });
            testObj.buildStart.call(createContext([], CLIENT));
            testObj.buildStart.call(createContext([], SSR));

            testObj.buildEnd.call(createContext([MAIN], SSR), undefined);
            const actual = [client, ssr].map(cur => jest.mocked(cur.runResultProcessors).mock.calls.length);

            expect(actual).toEqual([0, 1]);
        });

        it("should drop output files of modules no longer in graph w/ successful build", () => {
            const compiler = createCompiler({
                build: jest.fn((id: string) => ({
                    fragment: fragment({ [id.replace(/\.ts$/, ".js")]: "whatever" }),
                    diagnostics: [],
                    dependencies: { files: [], missing: [] },
                })),
            });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());
            testObj.transformHandler.call(createContext(), "whatever", MAIN);
            testObj.transformHandler.call(createContext(), "whatever", B);
            testObj.buildEnd.call(createContext([MAIN]), undefined);
            testObj.buildStart.call(createContext());

            testObj.buildEnd.call(createContext([MAIN, B]), undefined);
            const actual = jest.mocked(compiler.runResultProcessors).mock.calls[1][0];

            expect(actual).toEqual([`${ROOT}/src/main.js`]);
        });

        it("should keep output files of modules no longer in graph w/ failed build", () => {
            const compiler = createCompiler({
                build: jest.fn((id: string) => ({
                    fragment: fragment({ [id.replace(/\.ts$/, ".js")]: "whatever" }),
                    diagnostics: [],
                    dependencies: { files: [], missing: [] },
                })),
            });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());
            testObj.transformHandler.call(createContext(), "whatever", MAIN);
            testObj.transformHandler.call(createContext(), "whatever", B);
            testObj.buildEnd.call(createContext([MAIN]), new Error("whatever"));
            testObj.buildStart.call(createContext());

            testObj.buildEnd.call(createContext([MAIN, B]), undefined);
            const actual = jest.mocked(compiler.runResultProcessors).mock.calls[0][0];

            expect(actual).toEqual([`${ROOT}/src/main.js`, `${ROOT}/src/b.js`]);
        });

        it("should raise commonjs error before build w/ nodenext profile and package.json without type", () => {
            const dir = createNodeProject();
            const compiler = createCompiler({
                getOptions: jest.fn(() =>
                    createOptions(
                        { app: { tsConfig: { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext } } },
                        "app"
                    )
                ),
            });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());

            const actual = () => testObj.transformHandler.call(createContext(), "whatever", path.join(dir, "main.ts"));

            expect(actual).toThrow(`Profile 'app' emits CommonJS for '${path.join(dir, "main.ts")}'`);
            expect(compiler.build).not.toHaveBeenCalled();
        });

        it("should watch package.json w/ nodenext profile and package.json without type", () => {
            const dir = createNodeProject();
            const compiler = createCompiler({
                getOptions: jest.fn(() =>
                    createOptions(
                        { app: { tsConfig: { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext } } },
                        "app"
                    )
                ),
            });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());
            const target = createContext();

            attempt(() => testObj.transformHandler.call(target, "whatever", path.join(dir, "main.ts")));
            const actual = target.addWatchFile;

            expect(actual).toHaveBeenCalledWith(path.join(dir, "package.json"));
        });

        it("should watch package.json and build w/ nodenext profile and package.json with type module", () => {
            const dir = createNodeProject();
            fs.writeFileSync(path.join(dir, "package.json"), `{"type":"module"}`);
            const compiler = createCompiler({
                getOptions: jest.fn(() =>
                    createOptions({ app: { tsConfig: { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext } } }, "app")
                ),
            });
            const testObj = createHooks(compiler);
            testObj.buildStart.call(createContext());
            const target = createContext();

            testObj.transformHandler.call(target, "whatever", path.join(dir, "main.ts"));
            const actual = target.addWatchFile;

            expect(actual).toHaveBeenCalledWith(path.join(dir, "package.json"));
            expect(compiler.build).toHaveBeenCalledWith(path.join(dir, "main.ts"), { moduleKind: "esm" });
        });
    });
});
