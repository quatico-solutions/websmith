/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import path from "node:path";
import { ErrorMessage } from "@quatico/websmith-api";
import { createSystem, NoReporter } from "@quatico/websmith-core";
import { type Compilation, type Compiler } from "webpack";
import { CompilationQueue } from "./CompilationQueue";
import { type WebpackLoaderContext } from "./loader";
import { TsCompiler } from "./TsCompiler";
import { addCompilationHooks } from "./webpack-hooks";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

describe("webpack-hooks", () => {
    let mockCompiler: jest.Mocked<Compiler>;
    let mockContext: WebpackLoaderContext;
    let mockOptions: WebsmithLoaderConfig;

    afterEach(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        mockCompiler = {
            hooks: {
                beforeRun: { tap: jest.fn() },
                watchRun: { tap: jest.fn() },
                done: { tap: jest.fn(), tapAsync: jest.fn() },
                compilation: { tap: jest.fn() },
                thisCompilation: { tap: jest.fn() },
                afterCompile: { tap: jest.fn() },
            },
            options: { watch: false },
        } as any;

        mockContext = {
            websmithCompiler: null,
            dependencyCallback: jest.fn(),
            queue: new CompilationQueue(),
            loadOptions: () => mockOptions,
        };

        mockOptions = {
            instanceName: "test-instance",
            configFile: undefined,
            transpileOnly: true,
        } as WebsmithLoaderConfig;
    });

    describe("addCompilationHooks", () => {
        it("should register hooks when compiler has hooks", () => {
            addCompilationHooks(mockCompiler, mockOptions, mockContext);

            expect(mockCompiler.hooks.beforeRun.tap).toHaveBeenCalledWith("websmith-loader", expect.any(Function));
            expect(mockCompiler.hooks.watchRun.tap).toHaveBeenCalledWith("websmith-loader", expect.any(Function));
            expect(mockCompiler.hooks.done.tap).toHaveBeenCalledWith("websmith-loader", expect.any(Function));
            expect(mockCompiler.hooks.done.tapAsync).toHaveBeenCalledWith("websmith-loader", expect.any(Function));
        });

        it("should reset compilation caches of websmith compiler w/ new compilation", () => {
            const target = {
                resetCompilationCaches: jest.fn(),
                refreshAddons: jest.fn(),
                reportEsmCheckTime: jest.fn(),
                keepCachesPerCompilation: jest.fn(),
                useCompilationHooks: jest.fn(),
            };
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: target as unknown as TsCompiler });
            const [[, onThisCompilation]] = jest.mocked(mockCompiler.hooks.thisCompilation.tap).mock.calls as unknown as [[string, () => void]];

            onThisCompilation();

            expect(target.resetCompilationCaches).toHaveBeenCalledTimes(1);
        });

        it("should keep caches of websmith compiler per compilation w/ compilation hooks", () => {
            const target = {
                resetCompilationCaches: jest.fn(),
                refreshAddons: jest.fn(),
                reportEsmCheckTime: jest.fn(),
                keepCachesPerCompilation: jest.fn(),
                useCompilationHooks: jest.fn(),
            };

            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: target as unknown as TsCompiler });

            expect(target.keepCachesPerCompilation).toHaveBeenCalledTimes(1);
        });

        it("should report ESM check time of websmith compiler w/ done compilation", () => {
            const target = {
                resetCompilationCaches: jest.fn(),
                refreshAddons: jest.fn(),
                reportEsmCheckTime: jest.fn(),
                keepCachesPerCompilation: jest.fn(),
                useCompilationHooks: jest.fn(),
            };
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: target as unknown as TsCompiler });
            const onDone = jest.mocked(mockCompiler.hooks.done.tap).mock.calls.map(([, cur]) => cur as unknown as () => void);

            onDone.forEach(cur => cur());

            expect(target.reportEsmCheckTime).toHaveBeenCalledTimes(1);
        });

        it("should mark websmith compiler as using compilation hooks w/ compilation hooks", () => {
            const target = createConfigErrorCompiler();

            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: target });

            expect(target.useCompilationHooks).toHaveBeenCalledTimes(1);
        });

        it("should push config errors of websmith compiler to compilation errors after compile", () => {
            const target = createCompilation(mockCompiler);
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: createConfigErrorCompiler() });
            const [onAfterCompile] = getAfterCompileTaps(mockCompiler);

            onAfterCompile(target);
            const actual = target.errors.map(cur => cur.message);

            expect(actual).toEqual(["Unknown profile 'whatever' in 'depends'."]);
        });

        it("should push each config error once w/ several websmith compilers in one compilation", () => {
            const target = createCompilation(mockCompiler);
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: createConfigErrorCompiler() });
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: createConfigErrorCompiler() });
            const taps = getAfterCompileTaps(mockCompiler);

            taps.forEach(cur => cur(target));
            const actual = target.errors.map(cur => cur.message);

            expect(actual).toEqual(["Unknown profile 'whatever' in 'depends'."]);
        });

        it("should call error option w/ config errors after compile", () => {
            const target = jest.fn();
            addCompilationHooks(mockCompiler, { ...mockOptions, error: target }, { ...mockContext, websmithCompiler: createConfigErrorCompiler() });
            const [onAfterCompile] = getAfterCompileTaps(mockCompiler);

            onAfterCompile(createCompilation(mockCompiler));
            const actual = target.mock.calls.map(([cur]: [Error]) => cur.message);

            expect(actual).toEqual(["Unknown profile 'whatever' in 'depends'."]);
        });

        it("should push no config errors to child compilation after compile", () => {
            const target = createCompilation({} as Compiler);
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: createConfigErrorCompiler() });
            const [onAfterCompile] = getAfterCompileTaps(mockCompiler);

            onAfterCompile(target);
            const actual = target.errors;

            expect(actual).toEqual([]);
        });

        it("should add options files of websmith compiler to file and missing dependencies after compile", () => {
            const target = createCompilation(mockCompiler);
            const websmithCompiler = {
                ...createConfigErrorCompiler(),
                getOptionsFiles: () => ({ files: [path.resolve("/websmith.config.json")], missing: [path.resolve("/tsconfig.base.json")] }),
            } as unknown as TsCompiler;
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler });
            const [onAfterCompile] = getAfterCompileTaps(mockCompiler);

            onAfterCompile(target);
            const actual = { file: [...target.fileDependencies], missing: [...target.missingDependencies] };

            expect(actual).toEqual({ file: [path.resolve("/websmith.config.json")], missing: [path.resolve("/tsconfig.base.json")] });
        });

        it.each([
            ["config file", "/websmith.config.json"],
            ["tsconfig.json", "/tsconfig.json"],
            ["extends target", "/tsconfig.base.json"],
        ])("should resolve options of websmith compiler again w/ modified %s in watch run", (_name, fileName) => {
            const websmithCompiler = createOptionsCompiler();
            const target = jest.spyOn(websmithCompiler, "setOptions");
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler, loadOptions: () => OPTIONS_LOADER_CONFIG });
            const [[, onWatchRun]] = jest.mocked(mockCompiler.hooks.watchRun.tap).mock.calls as unknown as [[string, () => void]];
            Object.assign(mockCompiler, { modifiedFiles: new Set([path.resolve(fileName)]) });

            onWatchRun();
            const actual = target.mock.calls.length;

            expect(actual).toBe(1);
        });

        it("should keep options of websmith compiler w/ modified unrelated file in watch run", () => {
            const websmithCompiler = createOptionsCompiler();
            const target = jest.spyOn(websmithCompiler, "setOptions");
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler, loadOptions: () => OPTIONS_LOADER_CONFIG });
            const [[, onWatchRun]] = jest.mocked(mockCompiler.hooks.watchRun.tap).mock.calls as unknown as [[string, () => void]];
            Object.assign(mockCompiler, { modifiedFiles: new Set([path.resolve("/src/a.ts")]) });

            onWatchRun();
            const actual = target.mock.calls.length;

            expect(actual).toBe(0);
        });

        it("should refresh addons of websmith compiler w/ new compilation", () => {
            const target = createConfigErrorCompiler();
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: target });
            const [[, onThisCompilation]] = jest.mocked(mockCompiler.hooks.thisCompilation.tap).mock.calls as unknown as [[string, () => void]];

            onThisCompilation();

            expect(target.refreshAddons).toHaveBeenCalledTimes(1);
        });

        it("should register no compilation tap", () => {
            addCompilationHooks(mockCompiler, mockOptions, mockContext);

            expect(mockCompiler.hooks.compilation.tap).not.toHaveBeenCalled();
        });

        it("should not register hooks when compiler has no hooks", () => {
            const compilerWithoutHooks = {} as Compiler;

            addCompilationHooks(compilerWithoutHooks, mockOptions, mockContext);

            // Should not throw and should not call any hook registration
            expect(true).toBe(true); // Test passes if no error is thrown
        });
    });

});

const createConfigErrorCompiler = () =>
    ({
        resetCompilationCaches: jest.fn(),
        refreshAddons: jest.fn(),
        reportEsmCheckTime: jest.fn(),
        keepCachesPerCompilation: jest.fn(),
        useCompilationHooks: jest.fn(),
        getOptions: () => ({ configFile: "/websmith.config.json" }),
        getOptionsFiles: () => ({ files: [path.resolve("/websmith.config.json")], missing: [] }),
        getConfigErrors: () => [new ErrorMessage("Unknown profile 'whatever' in 'depends'.")],
    }) as unknown as jest.Mocked<TsCompiler>;

const createCompilation = (compiler: Compiler) =>
    ({ compiler, errors: [], fileDependencies: new Set<string>(), missingDependencies: new Set<string>() }) as unknown as Compilation;

const getAfterCompileTaps = (compiler: jest.Mocked<Compiler>) =>
    jest.mocked(compiler.hooks.afterCompile.tap).mock.calls.map(([, cur]) => cur as unknown as (compilation: Compilation) => void);

const OPTIONS_LOADER_CONFIG: WebsmithLoaderConfig = {
    tsConfigFile: "/tsconfig.json",
    configFile: "/websmith.config.json",
    transpileOnly: true,
    instanceName: "options-instance",
};

const createOptionsCompiler = () =>
    new TsCompiler(
        { reporter: new NoReporter(), cliArgs: { options: {}, fileNames: ["/src/a.ts"], errors: [] } },
        OPTIONS_LOADER_CONFIG,
        undefined,
        undefined,
        createSystem(
            {
                "/tsconfig.json": JSON.stringify({ extends: "./tsconfig.base.json" }),
                "/tsconfig.base.json": JSON.stringify({ compilerOptions: { target: "es2020", module: "esnext" } }),
                "/websmith.config.json": JSON.stringify({}),
                "/src/a.ts": "export const a = 1;",
            },
            { virtual: true }
        )
    );
