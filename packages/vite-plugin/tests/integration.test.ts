/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build, createServer } from "vite";
import { websmithPlugin } from "../src/plugin";

// Create a temporary test directory
const TEST_DIR = path.resolve(__dirname, "../temp-test-project");
const SRC_DIR = path.join(TEST_DIR, "src");
const DIST_DIR = path.join(TEST_DIR, "dist");

describe("Vite with websmith plugin integration", () => {
    beforeAll(() => {
        // Create test project structure
        if (!fs.existsSync(TEST_DIR)) {
            fs.mkdirSync(TEST_DIR, { recursive: true });
        }
        if (!fs.existsSync(SRC_DIR)) {
            fs.mkdirSync(SRC_DIR, { recursive: true });
        }

        // Create a simple TypeScript file
        fs.writeFileSync(
            path.join(SRC_DIR, "main.ts"),
            `
export function greet(name: string): string {
    return \`Hello, \${name}!\`;
}

export default {
    greet
};
            `,
            "utf-8"
        );

        // Create an index.html
        fs.writeFileSync(
            path.join(TEST_DIR, "index.html"),
            `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>Websmith Vite Plugin Test</title>
</head>
<body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
</body>
</html>
            `,
            "utf-8"
        );
    });

    afterAll(() => {
        // Clean up the test directory
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
    });

    it("should successfully build a project with the plugin", async () => {
        // Build the project
        await build({
            root: TEST_DIR,
            plugins: [
                websmithPlugin({
                    profile: "test",
                    transpileOnly: true,
                }),
            ],
            build: {
                outDir: "dist",
                emptyOutDir: true,
            },
            logLevel: "silent", // Avoid cluttering test output
        });

        // Verify that build output exists
        expect(fs.existsSync(DIST_DIR)).toBe(true);

        // Check that assets were created
        const assets = fs.readdirSync(DIST_DIR);
        expect(assets.some(file => file.endsWith(".js"))).toBe(true);

        // Read the generated JS file (should contain our code)
        const jsFiles = assets.filter(file => file.endsWith(".js"));
        const jsContent = fs.readFileSync(path.join(DIST_DIR, jsFiles[0]), "utf-8");

        // Check that our function was included
        expect(jsContent).toContain("greet");
    }, 30000); // Longer timeout for build process

    it("should handle the dev server with the plugin", async () => {
        // Create a dev server
        const server = await createServer({
            root: TEST_DIR,
            plugins: [
                websmithPlugin({
                    profile: "development",
                    transpileOnly: true,
                }),
            ],
            logLevel: "silent", // Avoid cluttering test output
            server: {
                port: 3999, // Use a port unlikely to be in use
            },
        });

        try {
            // Start the server
            await server.listen();

            // Check that the server started
            expect(server.httpServer).not.toBeNull();

            // Get the transformed module
            const mod = server.moduleGraph.getModuleById("/src/main.ts");
            expect(mod).not.toBeUndefined();

            // You would typically make HTTP requests to test the server here,
            // but for simplicity we're just checking that the server runs
        } finally {
            // Always close the server
            await server.close();
        }
    }, 30000); // Longer timeout for server startup
});
