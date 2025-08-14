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
        tempDir = path.join(__dirname, "test-temp", `test-${Date.now()}`);

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
});
