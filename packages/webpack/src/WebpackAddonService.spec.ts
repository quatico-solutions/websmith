/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { DefaultReporter } from "@quatico/websmith-core";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { WebpackAddonService } from "./WebpackAddonService";

describe("WebpackAddonService", () => {
    let tempDir: string;
    let mockSystem: ts.System;
    let mockReporter: DefaultReporter;

    beforeEach(() => {
        tempDir = path.join(__dirname, "..", "test-temp", `test-${Date.now()}`);

        mockSystem = {
            ...ts.sys,
            getCurrentDirectory: () => tempDir,
            directoryExists: (path: string) => fs.existsSync(path),
            fileExists: (path: string) => fs.existsSync(path),
            readFile: (path: string) => {
                try {
                    return fs.readFileSync(path, "utf8");
                } catch {
                    return undefined;
                }
            },
            writeFile: (path: string, data: string) => {
                fs.mkdirSync(path.substring(0, path.lastIndexOf("/")), { recursive: true });
                fs.writeFileSync(path, data);
            },
        };

        mockReporter = new DefaultReporter(mockSystem);
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe("cache directory creation", () => {
        it("should not create cache directory when no addons are configured", () => {
            new WebpackAddonService({
                system: mockSystem,
                reporter: mockReporter,
            });

            const cacheDir = path.join(tempDir, ".websmith-cache", "addons");

            expect(fs.existsSync(cacheDir)).toBe(false);
        });

        it("should not create cache directory when addons directory does not exist", () => {
            const testObj = new WebpackAddonService({
                addonsDir: path.join(tempDir, "non-existent-addons"),
                system: mockSystem,
                reporter: mockReporter,
            });

            const actual = testObj.getAvailableAddons();
            const cacheDir = path.join(tempDir, ".websmith-cache", "addons");

            expect(actual.length).toBe(0);
            expect(fs.existsSync(cacheDir)).toBe(false);
        });

        it("should not create cache directory when all addons are pre-built", () => {
            // Create addons directory with pre-built addon
            const addonsDir = path.join(tempDir, "addons");
            const addonDir = path.join(addonsDir, "test-addon");
            fs.mkdirSync(addonDir, { recursive: true });

            // Create pre-built addon.js file
            fs.writeFileSync(
                path.join(addonDir, "addon.js"),
                `
                module.exports = {
                    activate: function(context) {
                        // Pre-built addon
                    }
                };
            `
            );

            const testObj = new WebpackAddonService({
                addonsDir,
                system: mockSystem,
                reporter: mockReporter,
            });

            const actual = testObj.getAvailableAddons();
            const cacheDir = path.join(tempDir, ".websmith-cache", "addons");

            expect(actual.length).toBe(1);
            expect(fs.existsSync(cacheDir)).toBe(false);
        });

        it("should create cache directory only when addons need compilation", () => {
            // Create addons directory with TypeScript addon
            const addonsDir = path.join(tempDir, "addons");
            const addonDir = path.join(addonsDir, "test-addon");
            fs.mkdirSync(addonDir, { recursive: true });

            // Create TypeScript addon that needs compilation
            fs.writeFileSync(
                path.join(addonDir, "addon.ts"),
                `
                export function activate(context: any) {
                    // TypeScript addon that needs compilation
                }
            `
            );

            const testObj = new WebpackAddonService({
                addonsDir,
                system: mockSystem,
                reporter: mockReporter,
            });

            // Cache directory should not exist yet
            const cacheDir = path.join(tempDir, ".websmith-cache", "addons");
            expect(fs.existsSync(cacheDir)).toBe(false);

            // After getting available addons (which triggers compilation), cache should exist
            const actual = testObj.getAvailableAddons();

            expect(actual.length).toBe(1);
            expect(fs.existsSync(cacheDir)).toBe(true);
        });
    });

    describe("unknown addon validation", () => {
        it("should report warning for unknown addons in profile", () => {
            const reporterSpy = jest.spyOn(mockReporter, "reportDiagnostic");

            const testObj = new WebpackAddonService({
                addonsDir: path.join(tempDir, "addons"),
                profiles: {
                    "test-profile": {
                        addons: ["unknown-addon", "another-missing-addon"],
                    },
                },
                system: mockSystem,
                reporter: mockReporter,
            });

            // @ts-expect-error - getActiveAddons is private
            testObj.getActiveAddons("test-profile");

            expect(reporterSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining('Missing addons for profile "test-profile": "unknown-addon", "another-missing-addon"'),
                })
            );
        });

        it("should report warning for unknown addons in base configuration", () => {
            const reporterSpy = jest.spyOn(mockReporter, "reportDiagnostic");

            const testObj = new WebpackAddonService({
                addonsDir: path.join(tempDir, "addons"),
                addons: ["unknown-addon"],
                system: mockSystem,
                reporter: mockReporter,
            });

            // @ts-expect-error - getActiveAddons is private
            testObj.getActiveAddons();

            expect(reporterSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining('Missing addons: "unknown-addon"'),
                })
            );
        });

        it("should not report warnings for known addons", () => {
            // Create addons directory with valid addon
            const addonsDir = path.join(tempDir, "addons");
            const addonDir = path.join(addonsDir, "test-addon");
            fs.mkdirSync(addonDir, { recursive: true });

            fs.writeFileSync(
                path.join(addonDir, "addon.js"),
                `
                module.exports = {
                    activate: function(context) {
                        // Test addon
                    }
                };
            `
            );

            const reporterSpy = jest.spyOn(mockReporter, "reportDiagnostic");

            const testObj = new WebpackAddonService({
                addonsDir,
                profiles: {
                    "test-profile": {
                        addons: ["test-addon"],
                    },
                },
                system: mockSystem,
                reporter: mockReporter,
            });

            // Load available addons first to populate the loadedAddons map
            testObj.getAvailableAddons();

            // Then get active addons for the profile
            // @ts-expect-error - getActiveAddons is private
            testObj.getActiveAddons("test-profile");

            // Should not report any missing addon warnings
            expect(reporterSpy).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining("Missing addons"),
                })
            );
        });
    });

    describe("WebpackAddonContext integration", () => {
        let mockCompilationContext: any;
        let mockLoaderContext: any;
        let mockWebpackCompilation: any;

        beforeEach(() => {
            mockCompilationContext = {
                getCliArgs: () => ({ options: {}, fileNames: [], errors: [] }),
                addInputFile: jest.fn(),
                addAssetDependency: jest.fn(),
                addVirtualFile: jest.fn(),
                removeOutputFile: jest.fn(),
                registerGenerator: jest.fn(),
                registerProcessor: jest.fn(),
                registerTransformer: jest.fn(),
                registerResultProcessor: jest.fn(),
            };

            mockLoaderContext = {
                addDependency: jest.fn(),
                _compilation: undefined,
            };

            mockWebpackCompilation = {
                emitAsset: jest.fn(),
                assets: {},
                outputOptions: { path: "/output" },
            };
        });

        it("should pass loader context and compilation to WebpackAddonContext", () => {
            const addonsDir = path.join(tempDir, "addons");
            fs.mkdirSync(addonsDir, { recursive: true });

            // Create a simple addon that uses the context methods
            const addonDir = path.join(addonsDir, "test-addon");
            fs.mkdirSync(addonDir, { recursive: true });
            fs.writeFileSync(
                path.join(addonDir, "addon.ts"),
                `
                export const activate = (ctx) => {
                    ctx.addInputFile("test-input.ts");
                    ctx.addVirtualFile("test-virtual.ts", "export const test = 'virtual';");
                    ctx.addAssetDependency("asset.png", "parent.ts");
                    ctx.removeOutputFile("unwanted.js");
                };
                `
            );

            const testObj = new WebpackAddonService({
                addonsDir,
                addons: ["test-addon"],
                system: mockSystem,
                reporter: mockReporter,
            });

            // Load available addons first
            testObj.getAvailableAddons();

            const webpackContext = testObj.applyAddonsToContext(mockCompilationContext, undefined, mockLoaderContext, mockWebpackCompilation);

            // Verify that the context was created with webpack integration
            expect(webpackContext).toBeDefined();
            expect(webpackContext.getInputFilesToAdd().size).toBeGreaterThan(0);
            expect(webpackContext.getVirtualFiles().size).toBeGreaterThan(0);
            expect(webpackContext.getAssetDependencies().size).toBeGreaterThan(0);
            expect(webpackContext.getFilesToRemove().size).toBeGreaterThan(0);
        });

        it("should add dependencies to webpack loader context", () => {
            const addonsDir = path.join(tempDir, "addons");
            fs.mkdirSync(addonsDir, { recursive: true });

            const addonDir = path.join(addonsDir, "dependency-addon");
            fs.mkdirSync(addonDir, { recursive: true });
            fs.writeFileSync(
                path.join(addonDir, "addon.ts"),
                `
                export const activate = (ctx) => {
                    ctx.addInputFile("input.ts");
                    ctx.addAssetDependency("style.css", "component.ts");
                };
                `
            );

            const testObj = new WebpackAddonService({
                addonsDir,
                addons: ["dependency-addon"],
                system: mockSystem,
                reporter: mockReporter,
            });

            // Load available addons first
            testObj.getAvailableAddons();

            testObj.applyAddonsToContext(mockCompilationContext, undefined, mockLoaderContext, mockWebpackCompilation);

            // Verify that dependencies were added to the loader context
            expect(mockLoaderContext.addDependency).toHaveBeenCalledWith(expect.stringContaining("input.ts"));
            expect(mockLoaderContext.addDependency).toHaveBeenCalledWith(expect.stringContaining("style.css"));
        });

        it("should emit virtual files as webpack assets", () => {
            const addonsDir = path.join(tempDir, "addons");
            fs.mkdirSync(addonsDir, { recursive: true });

            const addonDir = path.join(addonsDir, "virtual-addon");
            fs.mkdirSync(addonDir, { recursive: true });
            fs.writeFileSync(
                path.join(addonDir, "addon.ts"),
                `
                export const activate = (ctx) => {
                    ctx.addVirtualFile("generated.js", "console.log('generated');");
                };
                `
            );

            const testObj = new WebpackAddonService({
                addonsDir,
                addons: ["virtual-addon"],
                system: mockSystem,
                reporter: mockReporter,
            });

            // Load available addons first
            testObj.getAvailableAddons();

            testObj.applyAddonsToContext(mockCompilationContext, undefined, mockLoaderContext, mockWebpackCompilation);

            // Verify that virtual file was emitted as webpack asset
            expect(mockWebpackCompilation.emitAsset).toHaveBeenCalledWith(expect.stringContaining("generated.js"), expect.any(Object));
        });

        it("should remove files from webpack assets", () => {
            const addonsDir = path.join(tempDir, "addons");
            fs.mkdirSync(addonsDir, { recursive: true });

            // Pre-populate webpack assets
            mockWebpackCompilation.assets["unwanted.js"] = { source: () => "content", size: () => 7 };

            const addonDir = path.join(addonsDir, "removal-addon");
            fs.mkdirSync(addonDir, { recursive: true });
            fs.writeFileSync(
                path.join(addonDir, "addon.ts"),
                `
                export const activate = (ctx) => {
                    ctx.removeOutputFile("/output/unwanted.js");
                };
                `
            );

            const testObj = new WebpackAddonService({
                addonsDir,
                addons: ["removal-addon"],
                system: mockSystem,
                reporter: mockReporter,
            });

            // Load available addons first
            testObj.getAvailableAddons();

            const webpackContext = testObj.applyAddonsToContext(mockCompilationContext, undefined, mockLoaderContext, mockWebpackCompilation);

            // Apply deferred operations to simulate webpack compilation hook
            webpackContext.applyDeferredOperations(mockWebpackCompilation);

            // Verify that file was removed from webpack assets
            expect(mockWebpackCompilation.assets["unwanted.js"]).toBeUndefined();
        });

        it("should fall back to compilation context when webpack context is not available", () => {
            const addonsDir = path.join(tempDir, "addons");
            fs.mkdirSync(addonsDir, { recursive: true });

            const addonDir = path.join(addonsDir, "fallback-addon");
            fs.mkdirSync(addonDir, { recursive: true });
            fs.writeFileSync(
                path.join(addonDir, "addon.ts"),
                `
                export const activate = (ctx) => {
                    ctx.addInputFile("fallback-input.ts");
                    ctx.addVirtualFile("fallback-virtual.ts", "export const fallback = true;");
                };
                `
            );

            const testObj = new WebpackAddonService({
                addonsDir,
                addons: ["fallback-addon"],
                system: mockSystem,
                reporter: mockReporter,
            });

            // Load available addons first
            testObj.getAvailableAddons();

            // Apply without webpack contexts (fallback scenario)
            testObj.applyAddonsToContext(mockCompilationContext);

            // Verify that compilation context methods were called as fallback
            expect(mockCompilationContext.addInputFile).toHaveBeenCalledWith("fallback-input.ts");
            expect(mockCompilationContext.addVirtualFile).toHaveBeenCalledWith("fallback-virtual.ts", "export const fallback = true;");
        });
    });
});
