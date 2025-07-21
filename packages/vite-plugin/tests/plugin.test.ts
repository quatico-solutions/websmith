/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { describe, expect, it, vi } from "vitest";
import { websmithPlugin } from "../src/plugin";

describe("websmithPlugin", () => {
    it("should create a plugin with the correct name", () => {
        const plugin = websmithPlugin();
        expect(plugin.name).toBe("vite-plugin-websmith");
    });

    it("should only process typescript files", async () => {
        const plugin = websmithPlugin();
        const configResolved = vi.fn();
        plugin.configResolved?.({} as any);

        // Should not process CSS files
        const cssResult = await plugin.transform?.("body { color: red; }", "style.css");
        expect(cssResult).toBeNull();

        // Should process TS files
        const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

        const tsResult = await plugin.transform?.("const x: number = 42;", "file.ts");
        expect(tsResult).not.toBeNull();
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Processing file.ts"));
        mockConsoleLog.mockRestore();
    });

    it("should skip node_modules", async () => {
        const plugin = websmithPlugin();
        plugin.configResolved?.({} as any);

        const result = await plugin.transform?.("export const x = 42;", "node_modules/some-pkg/index.ts");
        expect(result).toBeNull();
    });
});
