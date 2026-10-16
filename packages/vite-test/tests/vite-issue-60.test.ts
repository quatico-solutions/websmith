/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createProject, getProjectDir, removeProject, writeFile, writeTsConfig } from "./vite-project";

const VITES = ["vite", "vite6"];

const projectPath = (fileName: string): string => path.join(getProjectDir(), fileName);

const readDir = (dirName: string): string =>
    fs
        .readdirSync(projectPath(dirName), { recursive: true, encoding: "utf-8" })
        .map(cur => path.join(projectPath(dirName), cur))
        .filter(cur => fs.statSync(cur).isFile())
        .map(cur => fs.readFileSync(cur, "utf-8"))
        .join("\n");

const viteBin = (vite: string): string => path.join(path.dirname(require.resolve(`${vite}/package.json`)), "bin/vite.js");

beforeEach(() => {
    createProject("vite-issue-60");

    // The example of issue #60, translated to the plugin's options: addons and profiles in websmith.config.json
    writeTsConfig({});
    writeFile(
        "websmith.config.json",
        JSON.stringify({
            addonsDir: "./addons",
            profiles: { client: { addons: ["client-function-transform"] }, server: { addons: ["service-function-generate"] } },
        })
    );
    writeFile(
        "addons/client-function-transform/addon.js",
        `exports.activate = ctx => ctx.registerProcessor((_file, content) => content.replaceAll("MARK_IN", "CLIENT_OUT"));\n`
    );
    writeFile(
        "addons/service-function-generate/addon.js",
        [
            `const path = require("node:path");`,
            `exports.activate = ctx => ctx.registerGenerator(file => ctx.getSystem().writeFile(ctx.resolvePath("gen/" + path.basename(file) + ".txt"), "GEN"));`,
            ``,
        ].join("\n")
    );
    writeFile("src/shared.ts", `export const shared: string = "MARK_IN";\n`);
    writeFile("src/main.ts", `import { shared } from "./shared";\nconsole.log("MAIN " + shared);\n`);
    writeFile("src/server.ts", `import { shared } from "./shared";\nexport const render = (): string => "SERVER " + shared;\n`);
    writeFile(
        "vite.config.mjs",
        `import websmith from "@quatico/websmith-vite";

export default {
    plugins: [websmith({ profile: { client: "client", ssr: "server" }, include: /\\.tsx?$/, exclude: /node_modules/ })],
    builder: {},
    environments: {
        client: { build: { outDir: "dist/client", rollupOptions: { input: "src/main.ts" } } },
        ssr: { build: { outDir: "dist/server", ssr: "src/server.ts" } },
    },
};
`
    );
});

afterEach(() => {
    removeProject();
});

describe("vite CLI w/ the vite.config.mjs of issue #60", () => {
    it.each(VITES)(
        "should transform client modules and generate from server modules in vite build w/ %s",
        vite => {
            const actual = spawnSync(process.execPath, [viteBin(vite), "build"], { cwd: getProjectDir(), encoding: "utf-8" });

            expect(actual.status).toBe(0);
            expect(readDir("dist/client")).toContain("CLIENT_OUT");
            expect(readDir("dist/server")).toContain("MARK_IN");
            expect(readDir("dist/server")).not.toContain("CLIENT_OUT");
            expect(fs.existsSync(projectPath("gen/server.ts.txt"))).toBe(true);
            expect(fs.existsSync(projectPath("gen/shared.ts.txt"))).toBe(true);
            expect(fs.existsSync(projectPath("gen/main.ts.txt"))).toBe(false);
            expect(actual.stderr).not.toContain("[plugin websmith]");
        },
        60000
    );

    it.each(VITES)(
        "should transform client modules only in the dev server w/ %s",
        vite => {
            writeFile(
                "dev.mjs",
                `
                import { createServer } from ${JSON.stringify(vite)};

                const server = await createServer({
                    root: ${JSON.stringify(getProjectDir())},
                    configFile: ${JSON.stringify(projectPath("vite.config.mjs"))},
                    logLevel: "silent",
                    server: { port: 0 },
                });
                await server.listen();
                const client = await server.environments.client.transformRequest("/src/main.ts");
                const shared = await server.environments.client.transformRequest("/src/shared.ts");
                const ssr = await server.environments.ssr.transformRequest("/src/server.ts");
                const ssrShared = await server.environments.ssr.transformRequest("/src/shared.ts");
                await server.close();
                console.log(JSON.stringify({ client: client.code + shared.code, ssr: ssr.code + ssrShared.code }));
                `
            );

            const { status, stdout, stderr } = spawnSync(process.execPath, [projectPath("dev.mjs")], { cwd: getProjectDir(), encoding: "utf-8" });
            const actual = JSON.parse(stdout.trim().split("\n").pop() || "{}") as { client?: string; ssr?: string };

            expect(stderr).not.toContain("[plugin websmith]");
            expect(status).toBe(0);
            expect(actual.client).toContain("CLIENT_OUT");
            expect(actual.ssr).toContain("MARK_IN");
            expect(actual.ssr).not.toContain("CLIENT_OUT");
        },
        60000
    );
});
