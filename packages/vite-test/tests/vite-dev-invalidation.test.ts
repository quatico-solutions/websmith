/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import path from "node:path";
import {
    createProject,
    getProjectDir,
    removeProject,
    runViteDev,
    writeFile,
    writeProfiles,
    writeTsConfig,
    type ViteDevResult,
    type ViteWatcherEvent,
} from "./vite-project";

const VITES = ["vite", "vite6"];
const APP = { profile: "app" };
const PLUGIN_PREFIX = "[plugin websmith]";
const ADDONS = ["replacer", "gen"];

const projectPath = (fileName: string): string => path.join(getProjectDir(), fileName);

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

const writeReplacer = (replacement: string): void =>
    writeLoggingAddon("replacer", `ctx.registerProcessor((file, content) => content.replaceAll("MARK_IN", ${JSON.stringify(replacement)}));`);

// The lines the plugin itself logged at `level`, which Vite's own lines about a failed request do not count in
const pluginLogs = ({ logs }: ViteDevResult, level: "info" | "error"): string[] =>
    logs.filter(cur => cur.level === level && cur.msg.includes(PLUGIN_PREFIX)).map(cur => cur.msg);

const errorMessages = ({ messages }: ViteDevResult): string[] => messages.filter(cur => cur.type === "error").map(cur => cur.err?.message ?? "");

// Matches a string that contains `text`
const containing = (text: string): string => expect.stringContaining(text) as string;

// The source of a step predicate that matches the plugin's info line about a changed options input
const CHANGED = `{ log: cur => cur.msg.includes("${PLUGIN_PREFIX}") && cur.msg.includes(" changed: ") }`;

// The source of a step predicate that matches the reload of a module, triggered by `file`
const reloadOf = (file: string): string =>
    `cur => (cur.type === "full-reload" || cur.type === "update") && String(cur.triggeredBy ?? cur.updates?.[0]?.path).endsWith(${JSON.stringify(file)})`;

// Requests `url` and waits for the error payload of its failure, since the payload and the response race
const GET_FAILING = (url: string): string => `await get(${JSON.stringify(url)}); await waitForMessage(cur => cur.type === "error");`;

// The watcher events after the first event of `from` that follows one of `after`, up to the next event of `after`
const eventsBetween = (events: ViteWatcherEvent[], after: string, from: string): ViteWatcherEvent[] => {
    const start = events.findIndex((cur, i) => cur.file === from && events.slice(0, i).some(prev => prev.file === after));
    const end = events.findIndex((cur, i) => i > start && cur.file === after);
    return start < 0 ? [] : events.slice(start, end < 0 ? events.length : end);
};

beforeEach(() => {
    createProject("vite-dev-invalidation");

    writeTsConfig({});
    writeReplacer("MARK_OUT");
    writeLoggingAddon(
        "gen",
        [
            `ctx.registerGenerator(file => {`,
            `        ctx.getSystem().writeFile(ctx.resolvePath("gen/" + path.basename(file) + ".txt"), "GEN");`,
            `        ctx.addVirtualFile("virt/" + path.basename(file) + ".json", '{"v":1}');`,
            `    });`,
        ].join("\n")
    );
    writeProfiles({ app: { addons: ADDONS } });
    writeFile("src/shared.ts", `export const shared: string = "MARK_IN";\n`);
    writeFile("src/main.ts", `import { shared } from "./shared";\nexport const greeting: string = "MAIN " + shared + " MARK_IN";\n`);
    writeFile("src/server.ts", `import { shared } from "./shared";\nexport const render = (): string => "SERVER " + shared;\n`);
});

afterEach(() => {
    removeProject();
});

describe("vite dev server invalidation w/ websmith plugin", () => {
    it.each(VITES)(
        "should reload with the new configuration w/ config edit w/ %s",
        vite => {
            const config = JSON.stringify({ addonsDir: "./addons", profiles: { app: { addons: ["gen"] } } });

            const actual = runViteDev({
                vite,
                pluginOptions: APP,
                steps: [
                    `await get("/src/main.ts");`,
                    `await get("/src/shared.ts");`,
                    `await edit("websmith.config.json", ${JSON.stringify(config)}, ${CHANGED});`,
                    `await get("/src/shared.ts");`,
                ],
            });

            expect(actual.timeouts).toEqual([]);
            expect(actual.messages).toContainEqual(expect.objectContaining({ type: "full-reload" }));
            expect(actual.responses[2]).toEqual(expect.objectContaining({ status: 200, body: containing("MARK_IN") }));
            expect(actual.responses[2].body).not.toContain("MARK_OUT");
        },
        60000
    );

    it.each(VITES)(
        "should show the overlay on every module w/ broken config edit w/ %s",
        vite => {
            const actual = runViteDev({
                vite,
                pluginOptions: APP,
                steps: [
                    `await get("/src/main.ts");`,
                    `await edit("websmith.config.json", "{ broken", ${CHANGED});`,
                    GET_FAILING("/src/main.ts"),
                    GET_FAILING("/src/shared.ts"),
                ],
            });

            expect(actual.timeouts).toEqual([]);
            expect(pluginLogs(actual, "error").filter(cur => cur.includes("Invalid JSON"))).toHaveLength(1);
            expect(actual.responses.slice(1).map(cur => cur.status)).toEqual([500, 500]);
            expect(errorMessages(actual)).toEqual([containing("Invalid JSON"), containing("Invalid JSON")]);
        },
        60000
    );

    it.each(VITES)(
        "should clear the overlay w/ fixed config w/ %s",
        vite => {
            const config = JSON.stringify({ addonsDir: "./addons", profiles: { app: { addons: ADDONS }, app2: { addons: ["replacer"] } } });

            const actual = runViteDev({
                vite,
                pluginOptions: { profile: "app2" },
                steps: [GET_FAILING("/src/main.ts"), `await edit("websmith.config.json", ${JSON.stringify(config)}, ${CHANGED});`, `await get("/src/main.ts");`],
            });

            expect(actual.timeouts).toEqual([]);
            expect(actual.responses.map(cur => cur.status)).toEqual([500, 200]);
            expect(actual.responses[1].body).toContain("MARK_OUT");
            expect(pluginLogs(actual, "error").filter(cur => cur.includes("app2"))).toHaveLength(1);
        },
        60000
    );

    it.each(VITES)(
        "should recompile with the new tsconfig w/ tsconfig edit w/ %s",
        vite => {
            const tsConfig = JSON.stringify({
                compilerOptions: { target: "ES2022", module: "commonjs", moduleResolution: "node10", rootDir: "./src", outDir: "./tsc-out" },
            });

            const actual = runViteDev({
                vite,
                pluginOptions: APP,
                steps: [`await get("/src/main.ts");`, `await edit("tsconfig.json", ${JSON.stringify(tsConfig)}, ${CHANGED});`, `await get("/src/main.ts");`],
            });

            expect(actual.timeouts).toEqual([]);
            expect(actual.responses[1]).toEqual(expect.objectContaining({ status: 500, body: containing("emits CommonJS") }));
        },
        60000
    );

    it.each(VITES)(
        "should load the addon again w/ addon edit w/ %s",
        vite => {
            const addon = fs.readFileSync(projectPath("addons/replacer/addon.js"), "utf-8").replace('"MARK_OUT"', '"MARK_NEW"');

            const actual = runViteDev({
                vite,
                pluginOptions: APP,
                steps: [
                    `await get("/src/main.ts");`,
                    `await get("/src/shared.ts");`,
                    `await edit("addons/replacer/addon.js", ${JSON.stringify(addon)}, ${CHANGED});`,
                    `await get("/src/shared.ts");`,
                ],
            });

            expect(actual.timeouts).toEqual([]);
            expect(pluginLogs(actual, "info")).toContainEqual(containing("addons/replacer/addon.js changed: websmith compiles with the new configuration"));
            expect(actual.responses[2]).toEqual(expect.objectContaining({ status: 200, body: containing("MARK_NEW") }));
        },
        60000
    );

    it.each(VITES)(
        "should use the edited addon in every environment w/ restart with the same plugin object w/ %s",
        vite => {
            const addon = fs.readFileSync(projectPath("addons/replacer/addon.js"), "utf-8").replace('"MARK_OUT"', '"MARK_NEW"');

            const actual = runViteDev({
                vite,
                pluginOptions: APP,
                steps: [
                    `await get("/src/shared.ts");`,
                    `await ssr("/src/shared.ts");`,
                    `fs.writeFileSync(path.join(root, "addons/replacer/addon.js"), ${JSON.stringify(addon)});`,
                    `await server.restart();`,
                    `await transform("client", "/src/shared.ts");`,
                    `await transform("ssr", "/src/shared.ts");`,
                ],
            });

            expect(actual.responses.slice(0, 2).map(cur => cur.body ?? cur.code)).toEqual([containing("MARK_OUT"), containing("MARK_OUT")]);
            expect(actual.responses.slice(2)).toEqual([
                expect.objectContaining({ env: "client", code: containing("MARK_NEW") }),
                expect.objectContaining({ env: "ssr", code: containing("MARK_NEW") }),
            ]);
        },
        60000
    );

    it.each(VITES)(
        "should check the module format again w/ package.json edit w/ %s",
        vite => {
            writeProfiles({ app: { addons: ["replacer"], tsConfig: { module: "nodenext", moduleResolution: "nodenext" } } });
            writeFile("src/package.json", `{"type":"module"}`);
            writeFile("src/main.ts", `import { shared } from "./shared.js";\nexport const greeting: string = "MAIN " + shared + " MARK_IN";\n`);

            const actual = runViteDev({
                vite,
                pluginOptions: APP,
                steps: [`await get("/src/main.ts");`, `await edit("src/package.json", "{}", cur => cur.type === "full-reload");`, `await get("/src/main.ts");`],
            });

            expect(actual.timeouts).toEqual([]);
            expect(actual.responses[0].status).toBe(200);
            expect(actual.responses[1]).toEqual(expect.objectContaining({ status: 500, body: containing("emits CommonJS for") }));
            expect(actual.responses.map(cur => cur.body)).not.toContainEqual(containing("__esModule"));
        },
        60000
    );

    it.each(VITES)(
        "should produce exactly one rewrite and one HMR update w/ HMR edit with a generator w/ %s",
        vite => {
            writeLoggingAddon(
                "genw",
                [
                    `const target = file => ctx.resolvePath("gen/" + path.basename(file) + ".txt");`,
                    `    ctx.registerGenerator((file, content) => ctx.getSystem().writeFile(target(file), content));`,
                    `    ctx.registerProcessor((file, content) => (ctx.addAssetDependency(target(file), file), content));`,
                ].join("\n")
            );
            writeProfiles({ app: { addons: ["genw"] } });
            writeFile("src/sentinel.ts", `export const sentinel: number = 0;\n`);
            writeFile(
                "src/main.ts",
                `import { shared } from "./shared";\nimport { sentinel } from "./sentinel";\nexport const greeting: string = "MAIN " + shared + sentinel;\n`
            );

            const actual = runViteDev({
                vite,
                pluginOptions: APP,
                steps: [
                    `await get("/src/main.ts");`,
                    `await get("/src/shared.ts");`,
                    `await edit("src/sentinel.ts", "export const sentinel: number = 1;\\n", ${reloadOf("src/sentinel.ts")});`,
                    `await edit("src/shared.ts", 'export const shared: string = "MARK_IN2";\\n', ${reloadOf("src/shared.ts")});`,
                    `await get("/src/shared.ts");`,
                    `await edit("src/sentinel.ts", "export const sentinel: number = 2;\\n", ${reloadOf("src/sentinel.ts")});`,
                ],
            });

            expect(actual.timeouts).toEqual([]);
            expect(fs.readFileSync(projectPath("gen/shared.ts.txt"), "utf-8")).toContain("MARK_IN2");
            expect(eventsBetween(actual.watcherEvents, "src/sentinel.ts", "src/shared.ts").filter(cur => cur.file === "gen/shared.ts.txt")).toEqual([
                { event: "change", file: "gen/shared.ts.txt" },
            ]);
            expect(actual.messages.filter(cur => String(cur.triggeredBy).includes("/gen/"))).toEqual([]);
        },
        60000
    );

    it.each(VITES)(
        "should not rewrite a file w/ identical content on disk w/ %s",
        vite => {
            writeFile("gen/main.ts.txt", "GEN");
            const past = new Date("2020-01-01T00:00:00Z");
            fs.utimesSync(projectPath("gen/main.ts.txt"), past, past);

            const actual = runViteDev({ vite, pluginOptions: APP, steps: [`await get("/src/main.ts");`] });

            expect(actual.responses[0].status).toBe(200);
            expect(fs.statSync(projectPath("gen/main.ts.txt")).mtime).toEqual(past);
        },
        60000
    );

    it.each(VITES)(
        "should overwrite another writer's change w/ %s",
        vite => {
            const actual = runViteDev({
                vite,
                pluginOptions: APP,
                steps: [
                    `await get("/src/main.ts");`,
                    `fs.writeFileSync(path.join(root, "gen/main.ts.txt"), "OTHER");`,
                    `await edit("src/main.ts", 'export const greeting: string = "MARK_IN 2";\\n', cur => cur.type === "full-reload" || cur.type === "update");`,
                    `await get("/src/main.ts");`,
                ],
            });

            expect(actual.timeouts).toEqual([]);
            expect(actual.responses[1].status).toBe(200);
            expect(fs.readFileSync(projectPath("gen/main.ts.txt"), "utf-8")).toBe("GEN");
        },
        60000
    );

    it.each(VITES)(
        "should drop the virtual file w/ deleted module w/ %s",
        vite => {
            const actual = runViteDev({
                vite,
                pluginOptions: APP,
                steps: [
                    `await get("/src/server.ts");`,
                    `await get("/virt/server.ts.json");`,
                    `fs.unlinkSync(path.join(root, "src/server.ts"));`,
                    `await waitForMessage(${reloadOf("src/server.ts")});`,
                    `await get("/virt/server.ts.json");`,
                ],
            });

            expect(actual.timeouts).toEqual([]);
            expect(actual.watcherEvents).toContainEqual({ event: "unlink", file: "src/server.ts" });
            expect(actual.responses.slice(1).map(cur => cur.status)).toEqual([200, 404]);
        },
        60000
    );
});
