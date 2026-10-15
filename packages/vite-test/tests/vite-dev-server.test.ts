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
} from "./vite-project";

const VITES = ["vite", "vite6"];
const APP = { profile: "app" };
const PLUGIN_PREFIX = "[plugin websmith]";
// TS5053 prefix: jsxFactory excludes reactNamespace, an option error TypeScript 5 and 6 report without a file
const OPTION_ERROR = "Option 'reactNamespace' cannot be specified with option 'jsxFactory'";

const projectPath = (fileName: string): string => path.join(getProjectDir(), fileName);

// The lines the addons logged, e.g. "activate rp" or "replacer main.ts"
const readLog = (): string[] => {
    const filePath = projectPath("addons.log");
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8").trim().split("\n") : [];
};

// A CommonJS addon that logs its activation to addons.log and runs `body` with `ctx`, `log` and `path`
const writeLoggingAddon = (name: string, body: string, exportsSource = ""): void =>
    writeFile(
        `addons/${name}/addon.js`,
        [
            `const fs = require("node:fs");`,
            `const path = require("node:path");`,
            `const log = line => fs.appendFileSync(${JSON.stringify(projectPath("addons.log"))}, line + "\\n");`,
            exportsSource,
            `exports.activate = ctx => {`,
            `    log("activate ${name} " + ctx.constructor.name);`,
            `    ${body}`,
            `};`,
            ``,
        ].join("\n")
    );

// The lines the plugin itself logged at `level`, which Vite's own lines about a failed request do not count in
const pluginLogs = ({ logs }: ViteDevResult, level: "warn" | "error"): string[] =>
    logs.filter(cur => cur.level === level && cur.msg.startsWith(PLUGIN_PREFIX)).map(cur => cur.msg);

const errorMessages = ({ messages }: ViteDevResult): string[] => messages.filter(cur => cur.type === "error").map(cur => cur.err?.message ?? "");

// Matches a string that contains `text`
const containing = (text: string): string => expect.stringContaining(text) as string;

// Requests `url` and waits for the error payload of its failure, since the payload and the response race
const GET_FAILING = (url: string): string => `await get(${JSON.stringify(url)}); await waitForMessage(cur => cur.type === "error");`;

beforeEach(() => {
    createProject("vite-dev-server");

    writeTsConfig({});
    writeLoggingAddon(
        "replacer",
        `ctx.registerProcessor((file, content) => (log("replacer " + path.basename(file)), content.replaceAll("MARK_IN", "MARK_OUT")));`
    );
    writeLoggingAddon(
        "gen",
        [
            `ctx.registerGenerator(file => {`,
            `        log("gen " + path.basename(file));`,
            `        ctx.getSystem().writeFile(ctx.resolvePath("gen/" + path.basename(file) + ".txt"), "GEN");`,
            `        ctx.addVirtualFile("virt/" + path.basename(file) + ".json", '{"v":1}');`,
            `    });`,
        ].join("\n")
    );
    writeLoggingAddon("rp", `ctx.registerResultProcessor(files => log("rp " + files.map(cur => path.basename(cur)).join(",")));`);
    writeProfiles({ app: { addons: ["replacer", "gen", "rp"] } });
    writeFile("src/shared.ts", `export const shared: string = "MARK_IN";\n`);
    writeFile("src/main.ts", `import { shared } from "./shared";\nexport const greeting: string = "MAIN " + shared + " MARK_IN";\n`);
    writeFile("src/server.ts", `import { shared } from "./shared";\nexport const render = (): string => "SERVER " + shared;\n`);
});

afterEach(() => {
    removeProject();
});

describe("vite dev server w/ websmith plugin", () => {
    it.each(VITES)(
        "should serve a transformed module w/ %s",
        vite => {
            const actual = runViteDev({ vite, pluginOptions: APP, steps: [`await get("/src/main.ts");`] });

            expect(actual.listening).toBe(true);
            expect(actual.responses).toEqual([expect.objectContaining({ url: "/src/main.ts", status: 200, body: containing("MARK_OUT") })]);
        },
        60000
    );

    it.each(VITES)(
        "should reload the importer w/ edit of an imported file w/ %s",
        vite => {
            const actual = runViteDev({
                vite,
                pluginOptions: APP,
                steps: [
                    `await get("/src/main.ts");`,
                    `await get("/src/shared.ts");`,
                    `await edit("src/shared.ts", 'export const shared: string = "MARK_IN2";\\n', cur => cur.type === "full-reload");`,
                    `await get("/src/shared.ts");`,
                ],
            });

            expect(actual.timeouts).toEqual([]);
            expect(actual.messages.filter(cur => cur.type === "full-reload")).not.toEqual([]);
            expect(actual.responses[2]).toEqual(expect.objectContaining({ status: 200, body: containing("MARK_OUT2") }));
        },
        60000
    );

    it.each(
        VITES.flatMap(vite => [
            { vite, broken: "unknown profile", pluginOptions: { profile: "nope" }, config: undefined, expected: ["nope"] },
            {
                vite,
                broken: "missing config file",
                pluginOptions: { profile: "app", configFile: "missing.json" },
                config: undefined,
                expected: ["missing.json", "no websmith.config.json was found"],
            },
            { vite, broken: "invalid config", pluginOptions: APP, config: "{ bad json", expected: ["websmith.config.json"] },
        ])
    )(
        "should show the overlay on every module without stopping the server w/ $broken w/ $vite",
        ({ vite, pluginOptions, config, expected }) => {
            if (config !== undefined) {
                writeFile("websmith.config.json", config);
            }

            const actual = runViteDev({
                vite,
                pluginOptions,
                steps: [GET_FAILING("/src/main.ts"), GET_FAILING("/src/shared.ts"), GET_FAILING("/src/main.ts")],
            });

            expect(actual.listening).toBe(true);
            expect(actual.timeouts).toEqual([]);
            expect(pluginLogs(actual, "error")).toEqual(expected.map(cur => containing(cur)));
            expect(actual.responses.map(cur => [cur.url, cur.status])).toEqual([
                ["/src/main.ts", 500],
                ["/src/shared.ts", 500],
                ["/src/main.ts", 500],
            ]);
            expect(errorMessages(actual)).toEqual([0, 1, 2].map(() => containing(expected[0])));
            expect(readLog().filter(cur => cur.startsWith("replacer "))).toEqual([]);
        },
        60000
    );

    it.each(VITES)(
        "should show the overlay and serve no CommonJS w/ profile emitting commonjs w/ %s",
        vite => {
            writeProfiles({ app: { addons: ["replacer", "gen", "rp"], tsConfig: { module: "commonjs" } } });

            const actual = runViteDev({ vite, pluginOptions: APP, steps: [GET_FAILING("/src/main.ts")] });

            expect(actual.responses).toEqual([expect.objectContaining({ status: 500 })]);
            expect(actual.responses[0].body).not.toContain("__esModule");
            expect(errorMessages(actual)).toEqual([containing("emits CommonJS")]);
            expect(pluginLogs(actual, "error")).toEqual([containing("emits CommonJS")]);
        },
        60000
    );

    it.each(VITES)(
        "should show the overlay on every module and log once w/ throwing activate w/ %s",
        vite => {
            writeLoggingAddon("rp", `throw new Error("ACTIVATE_BOOM");`);

            const actual = runViteDev({
                vite,
                pluginOptions: APP,
                steps: [GET_FAILING("/src/main.ts"), GET_FAILING("/src/main.ts"), GET_FAILING("/src/shared.ts")],
            });

            expect(actual.timeouts).toEqual([]);
            expect(actual.responses.map(cur => cur.status)).toEqual([500, 500, 500]);
            expect(errorMessages(actual)).toEqual([
                containing("ACTIVATE_BOOM"),
                containing("ACTIVATE_BOOM"),
                containing("ACTIVATE_BOOM"),
            ]);
            expect(pluginLogs(actual, "error")).toEqual([containing("ACTIVATE_BOOM")]);
        },
        60000
    );

    it.each(VITES)(
        "should show the overlay and log once w/ option error without a file w/ %s",
        vite => {
            writeTsConfig({ jsx: "react", jsxFactory: "h", reactNamespace: "R" });

            const actual = runViteDev({
                vite,
                pluginOptions: { profile: "app", transpileOnly: true },
                steps: [GET_FAILING("/src/main.ts"), GET_FAILING("/src/shared.ts")],
            });

            expect(actual.timeouts).toEqual([]);
            expect(actual.responses.map(cur => [cur.url, cur.status])).toEqual([
                ["/src/main.ts", 500],
                ["/src/shared.ts", 500],
            ]);
            expect(errorMessages(actual)[0]).toContain(OPTION_ERROR);
            expect(pluginLogs(actual, "error")).toEqual([containing(OPTION_ERROR)]);
        },
        60000
    );

    it.each(VITES)(
        "should fail and log the environment the profile map does not name w/ %s",
        vite => {
            const actual = runViteDev({ vite, pluginOptions: { profile: { client: "app" } }, steps: [`await ssr("/src/server.ts");`, `await get("/src/main.ts");`] });

            expect(actual.responses[0].error).toContain("'ssr'");
            expect(pluginLogs(actual, "error")).toEqual([containing("'ssr'")]);
            expect(actual.responses[1]).toEqual(expect.objectContaining({ status: 200, body: containing("MARK_OUT") }));
        },
        60000
    );

    it.each(VITES)(
        "should serve a virtual file from memory w/ %s",
        vite => {
            const actual = runViteDev({ vite, pluginOptions: APP, steps: [`await get("/src/main.ts");`, `await get("/virt/main.ts.json");`] });

            expect(actual.responses[1]).toEqual({ url: "/virt/main.ts.json", status: 200, body: '{"v":1}' });
        },
        60000
    );

    it.each(VITES)(
        "should refuse a virtual file as Vite refuses a module w/ host not allowed w/ %s",
        vite => {
            const actual = runViteDev({
                vite,
                pluginOptions: APP,
                steps: [
                    `await get("/src/main.ts");`,
                    `await get("/virt/main.ts.json", { host: "evil.example" });`,
                    `await get("/src/main.ts", { host: "evil.example" });`,
                ],
            });

            expect(actual.responses.slice(1).map(cur => [cur.url, cur.status])).toEqual([
                ["/virt/main.ts.json", 403],
                ["/src/main.ts", 403],
            ]);
        },
        60000
    );

    it.each(VITES)(
        "should serve a virtual file w/ host in allowedHosts w/ %s",
        vite => {
            const actual = runViteDev({
                vite,
                pluginOptions: APP,
                viteOptions: { server: { port: 5273, strictPort: false, allowedHosts: ["app.example"] } },
                steps: [`await get("/src/main.ts");`, `await get("/virt/main.ts.json", { host: "app.example" });`],
            });

            expect(actual.responses[1]).toEqual({ url: "/virt/main.ts.json", status: 200, body: '{"v":1}' });
        },
        60000
    );

    it.each(VITES)(
        "should run result processors after each transform w/ %s",
        vite => {
            runViteDev({
                vite,
                pluginOptions: APP,
                steps: [
                    `await get("/src/main.ts");`,
                    `fs.appendFileSync(path.join(root, "addons.log"), "after first\\n");`,
                    `await edit("src/main.ts", 'export const greeting: string = "MARK_IN 2";\\n', cur => cur.type === "full-reload" || cur.type === "update");`,
                    `await get("/src/main.ts");`,
                ],
            });

            const actual = readLog().filter(cur => cur === "after first" || (cur.startsWith("rp ") && cur.includes("main.js")));

            expect(actual).toEqual(["rp main.js.map,main.js", "after first", "rp main.js.map,main.js"]);
        },
        60000
    );

    it.each(VITES)(
        "should warn once naming the addons that need type information w/ transpileOnly w/ %s",
        vite => {
            writeLoggingAddon("fast", `ctx.registerProcessor((_file, content) => content);`, "exports.needsTypeInfo = false;");
            writeProfiles({ app: { addons: ["replacer", "fast"] } });

            const actual = runViteDev({ vite, pluginOptions: { profile: "app", transpileOnly: true }, steps: [`await get("/src/main.ts");`] });

            expect(pluginLogs(actual, "warn")).toEqual([
                `${PLUGIN_PREFIX} 'transpileOnly' drops type information in the Vite dev server for the addons of profile 'app' that need it: replacer. ` +
                    "Remove 'transpileOnly', or set needsTypeInfo to false in an addon that needs none.",
            ]);
        },
        60000
    );

    it.each(VITES)(
        "should not warn w/o transpileOnly w/ %s",
        vite => {
            writeLoggingAddon("fast", `ctx.registerProcessor((_file, content) => content);`, "exports.needsTypeInfo = false;");
            writeProfiles({ app: { addons: ["replacer", "fast"] } });

            const actual = runViteDev({ vite, pluginOptions: APP, steps: [`await get("/src/main.ts");`] });

            expect(pluginLogs(actual, "warn")).toEqual([]);
        },
        60000
    );
});
