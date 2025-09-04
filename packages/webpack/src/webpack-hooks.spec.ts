/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { Compilation, type Compiler } from "webpack";
import { addCompilationHooks, isValidCompilation } from "./webpack-hooks";
import { type WebpackLoaderContext } from "./loader";
import { CompilationQueue } from "./CompilationQueue";
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
