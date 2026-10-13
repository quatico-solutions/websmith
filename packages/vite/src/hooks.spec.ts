/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage, type Reporter, WarnMessage } from "@quatico/websmith-api";
import { type CompileFragment } from "@quatico/websmith-core";
import ts from "typescript";
import { createWebsmithHooks, type HookCompiler, type HookContext } from "./hooks";

const ROOT = "/project";
const MAIN = `${ROOT}/src/main.ts`;

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
    getOptionsFiles: jest.fn(() => ({ files: [], missing: [] })),
    refreshOptions: jest.fn(() => false),
    refreshAddons: jest.fn(),
    resetCompilationCaches: jest.fn(),
    keepCachesPerCompilation: jest.fn(),
    ...overrides,
});

const createContext = (): HookContext => ({
    error: jest.fn((error: unknown) => {
        throw new Error(typeof error === "string" ? error : (error as { message: string }).message);
    }),
    warn: jest.fn(),
    addWatchFile: jest.fn(),
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

            expect(() => testObj.transformHandler.call(target, "whatever", MAIN)).toThrow();
            const actual = target.error;

            expect(actual).toHaveBeenCalledWith({ message: `First\n${MAIN} (2,18): Second`, loc: { file: MAIN, line: 2, column: 17 } });
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

            expect(actual).toHaveBeenCalledWith({ message: `${MAIN} (2,18): ESM91001`, loc: { file: MAIN, line: 2, column: 17 } });
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

            expect(() => testObj.buildStart.call(target)).toThrow();
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
            expect(() => testObj.buildStart.call(createContext())).toThrow();

            const actual = () => testObj.buildEnd.call(createContext(), undefined);

            expect(actual).not.toThrow();
        });

        it("should raise errors collected after buildStart w/ build mode", () => {
            const errors = [diagnostic("Unknown profile 'missing'")];
            const compiler = createCompiler({ getConfigErrors: jest.fn(() => errors) });
            const testObj = createHooks(compiler);
            expect(() => testObj.buildStart.call(createContext())).toThrow();
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
    });
});
