/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { DefaultReporter } from "@quatico/websmith-core";
import ts from "typescript";
import { sources } from "webpack";
import { WebpackAddonContext } from "./WebpackAddonContext";

describe("WebpackAddonContext", () => {
    let mockSystem: ts.System;
    let mockReporter: DefaultReporter;
    let mockLoaderContext: any;
    let mockWebpackCompilation: any;
    let testObj: WebpackAddonContext;

    beforeEach(() => {
        mockSystem = {
            ...ts.sys,
            resolvePath: (path: string) => (path.startsWith("/") ? path : `/resolved/${path}`),
        };

        mockReporter = new DefaultReporter(mockSystem);
        jest.spyOn(mockReporter, "reportDiagnostic");

        mockLoaderContext = {
            addDependency: jest.fn(),
            _compilation: undefined,
        };

        mockWebpackCompilation = {
            emitAsset: jest.fn(),
            assets: {},
            outputOptions: { path: "/output" },
        };

        testObj = new WebpackAddonContext(
            mockSystem,
            mockReporter,
            "test-profile",
            undefined,
            undefined,
            mockLoaderContext,
            mockWebpackCompilation,
            true
        );
    });

    describe("addInputFile", () => {
        it("should add file to tracking and call loader dependency", () => {
            testObj.addInputFile("input.ts");

            expect(testObj.getInputFilesToAdd()).toContain("/resolved/input.ts");
            expect(mockLoaderContext.addDependency).toHaveBeenCalledWith("/resolved/input.ts");
            expect(mockReporter.reportDiagnostic).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining("Added input file dependency"),
                })
            );
        });

        it("should handle absolute paths correctly", () => {
            testObj.addInputFile("/absolute/input.ts");

            expect(testObj.getInputFilesToAdd()).toContain("/absolute/input.ts");
            expect(mockLoaderContext.addDependency).toHaveBeenCalledWith("/absolute/input.ts");
        });

        it("should queue file when no loader context available", () => {
            const testObjNoLoader = new WebpackAddonContext(
                mockSystem,
                mockReporter,
                "test-profile",
                undefined,
                undefined,
                undefined,
                undefined,
                true
            );

            testObjNoLoader.addInputFile("queued.ts");

            expect(testObjNoLoader.getInputFilesToAdd()).toContain("/resolved/queued.ts");
            expect(mockReporter.reportDiagnostic).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining("Queued input file"),
                })
            );
        });
    });

    describe("addAssetDependency", () => {
        it("should track asset dependency and add to loader", () => {
            testObj.addAssetDependency("style.css", "component.ts");

            const dependencies = testObj.getAssetDependencies();
            expect(dependencies.get("/resolved/component.ts")).toContain("/resolved/style.css");
            expect(mockLoaderContext.addDependency).toHaveBeenCalledWith("/resolved/style.css");
            expect(mockReporter.reportDiagnostic).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining("Added asset dependency"),
                })
            );
        });

        it("should handle multiple dependencies for same parent", () => {
            testObj.addAssetDependency("style1.css", "component.ts");
            testObj.addAssetDependency("style2.css", "component.ts");

            const dependencies = testObj.getAssetDependencies();
            const parentDeps = dependencies.get("/resolved/component.ts");
            expect(parentDeps).toContain("/resolved/style1.css");
            expect(parentDeps).toContain("/resolved/style2.css");
            expect(parentDeps?.size).toBe(2);
        });
    });

    describe("addVirtualFile", () => {
        it("should store virtual file and emit as webpack asset", () => {
            const content = "export const virtual = true;";

            testObj.addVirtualFile("virtual.ts", content);

            expect(testObj.getVirtualFiles().get("/resolved/virtual.ts")).toBe(content);
            expect(mockWebpackCompilation.emitAsset).toHaveBeenCalledWith("virtual.ts", expect.any(sources.RawSource));
            expect(mockReporter.reportDiagnostic).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining("Added virtual file"),
                })
            );
        });

        it("should handle files with absolute paths", () => {
            const content = "console.log('absolute virtual');";

            testObj.addVirtualFile("/absolute/virtual.js", content);

            expect(testObj.getVirtualFiles().get("/absolute/virtual.js")).toBe(content);
            expect(mockWebpackCompilation.emitAsset).toHaveBeenCalledWith("absolute/virtual.js", expect.any(sources.RawSource));
        });

        it("should queue virtual file when no webpack compilation available", () => {
            const testObjNoCompilation = new WebpackAddonContext(
                mockSystem,
                mockReporter,
                "test-profile",
                undefined,
                undefined,
                mockLoaderContext,
                undefined,
                true
            );

            testObjNoCompilation.addVirtualFile("queued.ts", "content");

            expect(testObjNoCompilation.getVirtualFiles().get("/resolved/queued.ts")).toBe("content");
            expect(mockReporter.reportDiagnostic).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining("Queued virtual file"),
                })
            );
        });
    });

    describe("removeOutputFile", () => {
        it("should track file for removal and delete from webpack assets", () => {
            // Pre-populate webpack assets with the expected key (without the mock prefix)
            mockWebpackCompilation.assets["unwanted.js"] = {
                source: () => "content",
                size: () => 7,
            };

            testObj.removeOutputFile("unwanted.js");

            expect(testObj.getFilesToRemove()).toContain("/resolved/unwanted.js");
            expect(mockWebpackCompilation.assets["unwanted.js"]).toBeUndefined();
            expect(mockReporter.reportDiagnostic).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining("Removed output file"),
                })
            );
        });

        it("should queue file for removal when asset doesn't exist", () => {
            testObj.removeOutputFile("nonexistent.js");

            expect(testObj.getFilesToRemove()).toContain("/resolved/nonexistent.js");
            expect(mockReporter.reportDiagnostic).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining("Queued output file"),
                })
            );
        });
    });

    describe("applyDeferredOperations", () => {
        it("should apply all virtual files and removals to compilation", () => {
            const mockCompilation = {
                emitAsset: jest.fn(),
                assets: {
                    "to-remove.js": { source: () => "content", size: () => 7 },
                },
                outputOptions: { path: "/output" },
            };

            // Add some operations to apply
            testObj.addVirtualFile("/output/generated.js", "console.log('generated');");
            testObj.removeOutputFile("/output/to-remove.js");

            testObj.applyDeferredOperations(mockCompilation);

            // Verify virtual file was emitted
            expect(mockCompilation.emitAsset).toHaveBeenCalledWith("generated.js", expect.any(sources.RawSource));

            // Verify file was removed
            expect(mockCompilation.assets["to-remove.js"]).toBeUndefined();

            // Verify summary message
            expect(mockReporter.reportDiagnostic).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining("Applied 1 virtual files and removed 1 files"),
                })
            );
        });

        it("should handle empty operations gracefully", () => {
            const mockCompilation = {
                emitAsset: jest.fn(),
                assets: {},
                outputOptions: { path: "/output" },
            };

            testObj.applyDeferredOperations(mockCompilation);

            expect(mockCompilation.emitAsset).not.toHaveBeenCalled();
            expect(mockReporter.reportDiagnostic).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining("Applied 0 virtual files and removed 0 files"),
                })
            );
        });
    });

    describe("debug mode", () => {
        it("should not report debug messages when debug is false", () => {
            const testObjNoDebug = new WebpackAddonContext(
                mockSystem,
                mockReporter,
                "test-profile",
                undefined,
                undefined,
                mockLoaderContext,
                mockWebpackCompilation,
                false
            );

            jest.clearAllMocks();

            testObjNoDebug.addInputFile("input.ts");

            expect(testObjNoDebug.getInputFilesToAdd()).toContain("/resolved/input.ts");
            expect(mockLoaderContext.addDependency).toHaveBeenCalledWith("/resolved/input.ts");
            expect(mockReporter.reportDiagnostic).not.toHaveBeenCalled();
        });

        it("should report debug messages when debug is true", () => {
            jest.clearAllMocks();

            testObj.addInputFile("input.ts");

            expect(testObj.getInputFilesToAdd()).toContain("/resolved/input.ts");
            expect(mockLoaderContext.addDependency).toHaveBeenCalledWith("/resolved/input.ts");
            expect(mockReporter.reportDiagnostic).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining("Added input file dependency"),
                })
            );
        });
    });

    describe("utility methods", () => {
        it("should return immutable copies of internal state", () => {
            testObj.addInputFile("input.ts");
            testObj.addVirtualFile("virtual.ts", "content");
            testObj.addAssetDependency("asset.png", "parent.ts");
            testObj.removeOutputFile("remove.js");

            const inputFiles = testObj.getInputFilesToAdd();
            const virtualFiles = testObj.getVirtualFiles();
            const assetDeps = testObj.getAssetDependencies();
            const filesToRemove = testObj.getFilesToRemove();

            // Modify the returned collections
            inputFiles.add("should-not-affect-original");
            virtualFiles.set("should-not-affect-original", "content");
            assetDeps.set("should-not-affect-original", new Set());
            filesToRemove.add("should-not-affect-original");

            // Verify original state is unchanged
            expect(testObj.getInputFilesToAdd()).not.toContain("should-not-affect-original");
            expect(testObj.getVirtualFiles().has("should-not-affect-original")).toBeFalsy();
            expect(testObj.getAssetDependencies().has("should-not-affect-original")).toBeFalsy();
            expect(testObj.getFilesToRemove()).not.toContain("should-not-affect-original");
        });
    });

    describe("markFileAsAddonProcessed", () => {
        it("should mark file as processed", () => {
            testObj.markFileAsAddonProcessed("/path/to/file.ts");

            expect(testObj.isFileProcessedByAddon("/path/to/file.ts")).toBe(true);
        });

        it("should normalize paths before marking", () => {
            testObj.markFileAsAddonProcessed("src/index.ts");

            // Check with resolved path
            expect(testObj.isFileProcessedByAddon("/resolved/src/index.ts")).toBe(true);
        });

        it("should be idempotent", () => {
            testObj.markFileAsAddonProcessed("/path/file.ts");
            testObj.markFileAsAddonProcessed("/path/file.ts");

            expect(testObj.isFileProcessedByAddon("/path/file.ts")).toBe(true);
        });

        it("should return false for unmarked files", () => {
            expect(testObj.isFileProcessedByAddon("/other/file.ts")).toBe(false);
        });

        it("should delegate to compilation context when available", () => {
            const mockCompilationContext = {
                markFileAsAddonProcessed: jest.fn(),
                isFileProcessedByAddon: jest.fn().mockReturnValue(true),
            };

            const testObjWithContext = new WebpackAddonContext(
                mockSystem,
                mockReporter,
                "test-profile",
                undefined,
                mockCompilationContext as any,
                mockLoaderContext,
                mockWebpackCompilation,
                true
            );

            testObjWithContext.markFileAsAddonProcessed("/path/file.ts");

            expect(mockCompilationContext.markFileAsAddonProcessed).toHaveBeenCalledWith("/path/file.ts");
        });

        it("should check compilation context when file not in local tracking", () => {
            const mockCompilationContext = {
                markFileAsAddonProcessed: jest.fn(),
                isFileProcessedByAddon: jest.fn().mockReturnValue(true),
            };

            const testObjWithContext = new WebpackAddonContext(
                mockSystem,
                mockReporter,
                "test-profile",
                undefined,
                mockCompilationContext as any,
                mockLoaderContext,
                mockWebpackCompilation,
                true
            );

            // Don't mark locally, but compilation context says it's processed
            const result = testObjWithContext.isFileProcessedByAddon("/path/file.ts");

            expect(result).toBe(true);
            expect(mockCompilationContext.isFileProcessedByAddon).toHaveBeenCalledWith("/path/file.ts");
        });

        it("should return immutable copy of addon processed files", () => {
            testObj.markFileAsAddonProcessed("path/file.ts");

            const processedFiles = testObj.getAddonProcessedFiles();
            processedFiles.add("should-not-affect-original");

            expect(testObj.getAddonProcessedFiles()).not.toContain("should-not-affect-original");
            expect(testObj.getAddonProcessedFiles()).toContain("/resolved/path/file.ts");
        });

        it("should merge local and compilation context files in getAddonProcessedFiles", () => {
            const mockCompilationContext = {
                markFileAsAddonProcessed: jest.fn(),
                isFileProcessedByAddon: jest.fn(),
                getAddonProcessedFiles: jest.fn().mockReturnValue(new Set(["/context/file.ts"])),
            };

            const testObjWithContext = new WebpackAddonContext(
                mockSystem,
                mockReporter,
                "test-profile",
                undefined,
                mockCompilationContext as any,
                mockLoaderContext,
                mockWebpackCompilation,
                true
            );

            testObjWithContext.markFileAsAddonProcessed("/local/file.ts");

            const allFiles = testObjWithContext.getAddonProcessedFiles();
            expect(allFiles).toContain("/local/file.ts");
            expect(allFiles).toContain("/context/file.ts");
            expect(allFiles.size).toBe(2);
        });

        it("should report debug message when marking file", () => {
            jest.clearAllMocks();

            testObj.markFileAsAddonProcessed("path/file.ts");

            expect(mockReporter.reportDiagnostic).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: expect.stringContaining("Marked file /resolved/path/file.ts as addon-processed"),
                })
            );
        });
    });
});
