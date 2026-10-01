/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { ErrorMessage } from "@quatico/websmith-api";
import { type Compilation, type Compiler } from "webpack";
import { CompilationQueue } from "./CompilationQueue";
import { type WebpackLoaderContext } from "./loader";
import { type TsCompiler } from "./TsCompiler";
import { addCompilationHooks, isValidCompilation } from "./webpack-hooks";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

describe("webpack-hooks", () => {
    let mockCompiler: jest.Mocked<Compiler>;
    let mockContext: WebpackLoaderContext;
    let mockOptions: WebsmithLoaderConfig;

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
            expect(mockCompiler.hooks.compilation.tap).toHaveBeenCalledWith("websmith-loader", expect.any(Function));
            expect(mockCompiler.hooks.done.tapAsync).toHaveBeenCalledWith("websmith-loader", expect.any(Function));
        });

        it("should reset compilation caches of websmith compiler w/ new compilation", () => {
            const target = { resetCompilationCaches: jest.fn(), reportEsmCheckTime: jest.fn(), keepCachesPerCompilation: jest.fn() };
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: target as unknown as TsCompiler });
            const [[, onThisCompilation]] = jest.mocked(mockCompiler.hooks.thisCompilation.tap).mock.calls as unknown as [[string, () => void]];

            onThisCompilation();

            expect(target.resetCompilationCaches).toHaveBeenCalledTimes(1);
        });

        it("should keep caches of websmith compiler per compilation w/ compilation hooks", () => {
            const target = { resetCompilationCaches: jest.fn(), reportEsmCheckTime: jest.fn(), keepCachesPerCompilation: jest.fn() };

            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: target as unknown as TsCompiler });

            expect(target.keepCachesPerCompilation).toHaveBeenCalledTimes(1);
        });

        it("should report ESM check time of websmith compiler w/ done compilation", () => {
            const target = { resetCompilationCaches: jest.fn(), reportEsmCheckTime: jest.fn(), keepCachesPerCompilation: jest.fn() };
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: target as unknown as TsCompiler });
            const onDone = jest.mocked(mockCompiler.hooks.done.tap).mock.calls.map(([, cur]) => cur as unknown as () => void);

            onDone.forEach(cur => cur());

            expect(target.reportEsmCheckTime).toHaveBeenCalledTimes(1);
        });

        it("should push config errors of websmith compiler to compilation errors after compile", () => {
            const target = { compiler: mockCompiler, errors: [] } as unknown as Compilation;
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: createConfigErrorCompiler() });
            const [[, onAfterCompile]] = jest.mocked(mockCompiler.hooks.afterCompile.tap).mock.calls as unknown as [[string, (cur: Compilation) => void]];

            onAfterCompile(target);
            const actual = target.errors.map(cur => cur.message);

            expect(actual).toEqual(["Unknown profile 'whatever' in 'depends'."]);
        });

        it("should call error option w/ config errors after compile", () => {
            const target = jest.fn();
            const compilation = { compiler: mockCompiler, errors: [] } as unknown as Compilation;
            addCompilationHooks(mockCompiler, { ...mockOptions, error: target }, { ...mockContext, websmithCompiler: createConfigErrorCompiler() });
            const [[, onAfterCompile]] = jest.mocked(mockCompiler.hooks.afterCompile.tap).mock.calls as unknown as [[string, (cur: Compilation) => void]];

            onAfterCompile(compilation);
            const actual = target.mock.calls.map(([cur]) => cur);

            expect(actual).toEqual(compilation.errors);
        });

        it("should push no config errors to child compilation after compile", () => {
            const target = { compiler: {}, errors: [] } as unknown as Compilation;
            addCompilationHooks(mockCompiler, mockOptions, { ...mockContext, websmithCompiler: createConfigErrorCompiler() });
            const [[, onAfterCompile]] = jest.mocked(mockCompiler.hooks.afterCompile.tap).mock.calls as unknown as [[string, (cur: Compilation) => void]];

            onAfterCompile(target);
            const actual = target.errors;

            expect(actual).toEqual([]);
        });

        it("should not register hooks when compiler has no hooks", () => {
            const compilerWithoutHooks = {} as Compiler;

            addCompilationHooks(compilerWithoutHooks, mockOptions, mockContext);

            // Should not throw and should not call any hook registration
            expect(true).toBe(true); // Test passes if no error is thrown
        });
    });

    describe("compilation validation (duck typing)", () => {
        it("should validate proper Compilation object", () => {
            const validCompilation = {
                hooks: {
                    processAssets: { tap: jest.fn() },
                },
                compiler: {},
                emitAsset: jest.fn(),
            };

            expect(isValidCompilation(validCompilation)).toBe(true);
        });

        it("should reject null or undefined compilation", () => {
            expect(isValidCompilation(null)).toBe(false);
            expect(isValidCompilation(undefined)).toBe(false);
        });

        it("should reject non-object compilation", () => {
            expect(isValidCompilation("string")).toBe(false);
            expect(isValidCompilation(123)).toBe(false);
            expect(isValidCompilation(true)).toBe(false);
        });

        it("should reject compilation without hooks", () => {
            const compilationWithoutHooks = {
                compiler: {},
                emitAsset: jest.fn(),
            };

            expect(isValidCompilation(compilationWithoutHooks)).toBe(false);
        });

        it("should reject compilation with non-object hooks", () => {
            const compilationWithInvalidHooks = {
                hooks: "not an object",
                compiler: {},
                emitAsset: jest.fn(),
            };

            expect(isValidCompilation(compilationWithInvalidHooks)).toBe(false);
        });

        it("should reject compilation without processAssets hook", () => {
            const compilationWithoutProcessAssets = {
                hooks: {
                    // missing processAssets
                },
                compiler: {},
                emitAsset: jest.fn(),
            };

            expect(isValidCompilation(compilationWithoutProcessAssets)).toBe(false);
        });

        it("should reject compilation without compiler", () => {
            const compilationWithoutCompiler = {
                hooks: {
                    processAssets: { tap: jest.fn() },
                },
                emitAsset: jest.fn(),
            };

            expect(isValidCompilation(compilationWithoutCompiler)).toBe(false);
        });

        it("should reject compilation without emitAsset function", () => {
            const compilationWithoutEmitAsset = {
                hooks: {
                    processAssets: { tap: jest.fn() },
                },
                compiler: {},
            };

            expect(isValidCompilation(compilationWithoutEmitAsset)).toBe(false);
        });

        it("should reject compilation with non-function emitAsset", () => {
            const compilationWithInvalidEmitAsset = {
                hooks: {
                    processAssets: { tap: jest.fn() },
                },
                compiler: {},
                emitAsset: "not a function",
            };

            expect(isValidCompilation(compilationWithInvalidEmitAsset)).toBe(false);
        });

        it("should work with objects from different module contexts (avoiding instanceof issues)", () => {
            // Simulate an object that looks like a Compilation but isn't from the same module context
            const foreignCompilation = Object.create(null);
            foreignCompilation.hooks = {
                processAssets: { tap: jest.fn() },
            };
            foreignCompilation.compiler = {};
            foreignCompilation.emitAsset = jest.fn();

            // This should pass duck typing validation even if it fails instanceof checks
            expect(isValidCompilation(foreignCompilation)).toBe(true);
        });
    });
});

const createConfigErrorCompiler = (): TsCompiler =>
    ({
        resetCompilationCaches: jest.fn(),
        reportEsmCheckTime: jest.fn(),
        keepCachesPerCompilation: jest.fn(),
        getConfigErrors: () => [new ErrorMessage("Unknown profile 'whatever' in 'depends'.")],
    }) as unknown as TsCompiler;
