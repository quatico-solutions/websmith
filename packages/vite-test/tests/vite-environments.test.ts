/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import path from "node:path";
import { createProject, getProjectDir, removeProject, runVite, runViteApp, writeFile, writeProfiles, writeTsConfig } from "./vite-project";

const VITES = ["vite", "vite6"];
const MAGELLAN = { profile: { client: "client", ssr: "server" } };
const NODENEXT = { module: "NodeNext", moduleResolution: "NodeNext" };

const ENVIRONMENTS = {
    client: { build: { outDir: "dist/client", rollupOptions: { input: "src/main.ts", preserveEntrySignatures: "strict" } } },
    ssr: { build: { outDir: "dist/server", ssr: "src/server.ts" } },
};

const projectPath = (fileName: string): string => path.join(getProjectDir(), fileName);

// The lines the addons logged, e.g. "activate clientx" or "clientx main.ts"
const readLog = (): string[] => {
    const filePath = projectPath("addons.log");
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8").trim().split("\n") : [];
};

// A CommonJS addon that logs its activation to addons.log and runs `body` with `ctx`, `log` and `path`
const writeLoggingAddon = (name: string, body: string): void =>
    writeFile(
        `addons/${name}/addon.js`,
        [
            `const fs = require("node:fs");`,
            `const path = require("node:path");`,
            `const log = line => fs.appendFileSync(${JSON.stringify(projectPath("addons.log"))}, line + "\\n");`,
            `exports.activate = ctx => {`,
            `    log("activate ${name}");`,
            `    ${body}`,
            `};`,
            ``,
        ].join("\n")
    );

beforeEach(() => {
    createProject("vite-environments");

    writeTsConfig({});
    writeLoggingAddon(
        "clientx",
        `ctx.registerProcessor((file, content) => (log("clientx " + path.basename(file)), content.replaceAll("MARK_IN", "CLIENT_OUT")));`
    );
    writeLoggingAddon(
        "servergen",
        `ctx.registerGenerator(file => (log("servergen " + path.basename(file)), ctx.getSystem().writeFile(ctx.resolvePath("gen/" + path.basename(file) + ".txt"), "GEN")));`
    );
    writeLoggingAddon("serverrp", `ctx.registerResultProcessor(files => log("serverrp " + files.map(cur => path.basename(cur)).join(",")));`);
    writeFile("addons/replacer/addon.js", `exports.activate = ctx => ctx.registerProcessor((_f, c) => c.replaceAll("MARK_IN", "MARK_OUT"));\n`);
    writeProfiles({
        client: { addons: ["clientx"], tsConfig: { outDir: "./tsc-client" } },
        server: { addons: ["servergen", "serverrp"], tsConfig: { outDir: "./tsc-server" } },
        app: { addons: ["replacer"] },
    });
    writeFile("src/shared.ts", `export const shared: string = "MARK_IN";\n`);
    writeFile("src/main.ts", `import { shared } from "./shared";\nexport const greeting: string = "MAIN " + shared;\n`);
    writeFile("src/server.ts", `import { shared } from "./shared";\nexport const render = (): string => "SERVER " + shared;\n`);
});

afterEach(() => {
    removeProject();
});

describe("vite build w/ websmith in Vite environments", () => {
    it.each(VITES)(
        "should run each addon only in its environment w/ profile map and %s",
        vite => {
            const actual = runViteApp({ vite, pluginOptions: MAGELLAN, environments: ENVIRONMENTS });
            const log = readLog();

            expect(actual.client.error).toBeUndefined();
            expect(actual.ssr.error).toBeUndefined();
            expect(actual.client.code).toContain("CLIENT_OUT");
            expect(actual.ssr.code).toContain("MARK_IN");
            expect(actual.ssr.code).not.toContain("CLIENT_OUT");
            expect(fs.existsSync(projectPath("gen/server.ts.txt"))).toBe(true);
            expect(fs.existsSync(projectPath("gen/shared.ts.txt"))).toBe(true);
            expect(fs.existsSync(projectPath("gen/main.ts.txt"))).toBe(false);
            expect(log.filter(cur => cur.startsWith("clientx ")).sort()).toEqual(["clientx main.ts", "clientx shared.ts"]);
            expect(log.filter(cur => cur.startsWith("servergen ")).sort()).toEqual(["servergen server.ts", "servergen shared.ts"]);
            expect(log.filter(cur => cur.startsWith("serverrp "))).toEqual([expect.stringMatching(/^serverrp (.*,)?server\.js(,|$)/)]);
        },
        60000
    );

    it.each(VITES)(
        "should activate addons once per environment w/ string profile and %s",
        vite => {
            const actual = runViteApp({ vite, pluginOptions: { profile: "client" }, environments: ENVIRONMENTS });

            expect(actual.client.code).toContain("CLIENT_OUT");
            expect(actual.ssr.code).toContain("CLIENT_OUT");
            expect(readLog().filter(cur => cur === "activate clientx")).toHaveLength(2);
        },
        60000
    );

    it.each(VITES)(
        "should fail only the environment the profile map does not name w/ %s",
        vite => {
            const actual = runViteApp({ vite, pluginOptions: { profile: { client: "client" } }, environments: ENVIRONMENTS });
            const message = actual.ssr.error?.message ?? "";

            expect(actual.client.error).toBeUndefined();
            expect(actual.client.code).toContain("CLIENT_OUT");
            expect(message).toContain("'ssr'");
            expect(message).toContain("It names: client");
            expect(message).not.toContain("[object Object]");
            expect(message.split("names no profile for the Vite environment")).toHaveLength(2);
        },
        60000
    );

    it.each(VITES)(
        "should place virtual file in build.outDir of its environment w/ inline config and %s",
        vite => {
            writeLoggingAddon(
                "clientx",
                `ctx.registerGenerator(() => ctx.addVirtualFile(ctx.resolvePath("dist/client/abs.json"), "{}"));\n    ctx.registerProcessor((_f, c) => c);`
            );

            const actual = runViteApp({ vite, pluginOptions: MAGELLAN, environments: ENVIRONMENTS });

            expect(actual.client.error).toBeUndefined();
            expect(actual.client.assets.map(cur => cur.fileName)).toContain("abs.json");
        },
        60000
    );

    it.each(VITES)(
        "should place virtual file in build.outDir of its environment w/ shared builder and %s",
        vite => {
            writeLoggingAddon(
                "clientx",
                `ctx.registerGenerator(() => ctx.addVirtualFile(ctx.resolvePath("dist/client/abs.json"), "{}"));\n    ctx.registerProcessor((_f, c) => c);`
            );

            const actual = runViteApp({
                vite,
                pluginOptions: MAGELLAN,
                environments: ENVIRONMENTS,
                builder: { sharedConfigBuild: true, sharedPlugins: true },
            });

            expect(actual.client.error).toBeUndefined();
            expect(actual.client.assets.filter(cur => cur.source === "{}").map(cur => cur.fileName)).toEqual(["abs.json"]);
        },
        60000
    );

    it.each(VITES)(
        "should run result processors and emit virtual files of every client module w/ same plugin object in worker.plugins and %s",
        vite => {
            writeLoggingAddon(
                "clientx",
                [
                    `ctx.registerGenerator(file => ctx.addVirtualFile(path.basename(file) + ".json", "{}"));`,
                    `ctx.registerResultProcessor(files => log("clientrp " + files.map(cur => path.basename(cur)).filter(cur => cur.endsWith(".js")).sort().join(",")));`,
                ].join("\n    ")
            );
            writeFile("src/w.ts", `import { shared } from "./shared";\nself.postMessage(shared);\n`);
            writeFile(
                "src/mainw.ts",
                `import { shared } from "./shared";\nexport const worker = new Worker(new URL("./w.ts", import.meta.url), { type: "module" });\nexport const greeting: string = shared;\n`
            );

            const actual = runViteApp({
                vite,
                pluginOptions: { profile: "client" },
                environments: { client: { build: { outDir: "dist/client", rollupOptions: { input: "src/mainw.ts" } } } },
                workerPlugin: true,
            }).client;

            expect(actual.error).toBeUndefined();
            expect(actual.assets.map(cur => cur.fileName)).toEqual(expect.arrayContaining(["mainw.ts.json", "shared.ts.json"]));
            expect(readLog().filter(cur => cur.startsWith("clientrp ")).sort()).toEqual(["clientrp mainw.js,shared.js", "clientrp shared.js,w.js"]);
        },
        60000
    );

    it.each(VITES)(
        "should select profile of client environment w/ profile map in lib build and %s",
        vite => {
            const actual = runVite({ vite, pluginOptions: { profile: { client: "app" } } });

            expect(actual.error).toBeUndefined();
            expect(actual.code).toContain("MARK_OUT");
        },
        60000
    );

    it.each(VITES)(
        "should fail w/ nodenext profile and package.json without type module and %s",
        vite => {
            writeProfiles({ app: { addons: ["replacer"], tsConfig: NODENEXT } });

            const actual = runVite({ vite, pluginOptions: { profile: "app" } }).error?.message ?? "";

            expect(actual).toContain("src/main.ts");
            expect(actual).toContain("CommonJS");
            expect(actual).toContain(`"type": "module"`);
        },
        60000
    );

    it.each(VITES)(
        "should build w/ nodenext profile and mts entry and %s",
        vite => {
            writeProfiles({ app: { addons: ["replacer"], tsConfig: NODENEXT } });
            writeFile("src/main.mts", `export const greeting: string = "MARK_IN";\n`);

            const actual = runViteApp({
                vite,
                pluginOptions: { profile: "app" },
                environments: { client: { build: { lib: { entry: "src/main.mts", formats: ["es"] } } } },
            }).client;

            expect(actual.error).toBeUndefined();
            expect(actual.code).toContain("MARK_OUT");
        },
        60000
    );

    it.each(VITES)(
        "should report only core's ESM error w/ nodenext profile and esm and %s",
        vite => {
            writeProfiles({ app: { addons: ["replacer"], tsConfig: NODENEXT, esm: { runtime: "bundler", check: "error" } } });

            const actual = runVite({ vite, pluginOptions: { profile: "app" } }).error?.message ?? "";

            expect(actual).toContain("ESM91032");
            expect(actual).not.toContain("which Vite cannot bundle as an ES module");
        },
        60000
    );
});
