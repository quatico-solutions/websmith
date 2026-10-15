/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** The failure of a `vite build`, as Rollup augments the error the plugin raised. */
export type ViteBuildError = { message: string; loc?: { file?: string; line: number; column: number }; hook?: string; plugin?: string };

/** An asset of the bundle, with its source as text. */
export type ViteAsset = { fileName: string; source: string };

/**
 * The result of a `vite build`: the code of its chunks, its failure, the warnings of `onwarn`, the assets of the
 * bundle and, with `probe`, the watch files at `generateBundle`, relative to the project.
 */
export type ViteBuildResult = { code: string; error?: ViteBuildError; warnings: string[]; assets: ViteAsset[]; watchFiles?: string[] };

/** One event of a `vite build --watch`, with the message and hook of an `ERROR` event. */
export type ViteWatchEvent = { code: string; message?: string; hook?: string };

/**
 * The options of the runners: the Vite package to import, the plugin options, Vite options and the working directory.
 * `probe` adds a plugin that records the watch files; `betweenBuilds`, code run in the build process, runs a first
 * build with the same plugin object before it, and the result is that of the second build.
 */
export type RunViteOptions = {
    vite?: string;
    pluginOptions: Record<string, unknown>;
    viteOptions?: Record<string, unknown>;
    cwd?: string;
    probe?: boolean;
    betweenBuilds?: string;
};

let projectDir = "";

/** Creates a project directory for the current test under the package, where bare imports of `vite` resolve. */
export const createProject = (prefix: string): string => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    projectDir = path.resolve(__dirname, "..", `test-output-${prefix}-${testId}_${Date.now()}`);
    return projectDir;
};

export const removeProject = (): void => fs.rmSync(projectDir, { recursive: true, force: true });

export const getProjectDir = (): string => projectDir;

export const writeFile = (fileName: string, content: string): void => {
    const filePath = path.join(projectDir, fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, { encoding: "utf-8" });
};

export const writeTsConfig = (compilerOptions: Record<string, unknown>): void =>
    writeFile(
        "tsconfig.json",
        JSON.stringify({
            compilerOptions: {
                target: "ES2022",
                module: "ESNext",
                moduleResolution: "bundler",
                rootDir: "./src",
                outDir: "./tsc-out",
                ...compilerOptions,
            },
        })
    );

/** Writes a config with the profile `app` using the `replacer` addon and `tsConfig`. */
export const writeConfig = (tsConfig: Record<string, unknown>): void => writeProfiles({ app: { addons: ["replacer"], tsConfig } });

/** Writes a config with `profiles` and the addons of `./addons`. */
export const writeProfiles = (profiles: Record<string, unknown>): void =>
    writeFile("websmith.config.json", JSON.stringify({ addonsDir: "./addons", profiles }));

// The plugin options as JavaScript source, with RegExp values that JSON drops
export const toSource = (value: unknown): string => {
    if (value instanceof RegExp) {
        return String(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(toSource).join(", ")}]`;
    }
    if (value !== null && typeof value === "object") {
        return `{ ${Object.entries(value)
            .map(([key, cur]) => `${JSON.stringify(key)}: ${toSource(cur)}`)
            .join(", ")} }`;
    }
    return JSON.stringify(value) ?? "undefined";
};

const runScript = (fileName: string, cwd: string, timeout?: number): string => {
    const { status, stdout, stderr, error } = spawnSync(process.execPath, [path.join(projectDir, fileName)], { cwd, encoding: "utf-8", timeout });
    if (error || status !== 0) {
        throw new Error(`${fileName} failed with exit code ${status}${error ? ` (${error.message})` : ""}:\n${stderr}`);
    }
    return stdout.trim().split("\n").pop() ?? "null";
};

/**
 * Runs `vite build` with the plugin in a separate Node process, since Vite is ESM only, and returns the code of the
 * bundle, the error that failed the build, and the warnings Rollup's `onwarn` received.
 */
export const runVite = ({
    vite = "vite",
    pluginOptions,
    viteOptions = {},
    cwd = projectDir,
    probe = false,
    betweenBuilds,
}: RunViteOptions): ViteBuildResult => {
    writeFile(
        "build.mjs",
        `
        import { build } from ${JSON.stringify(vite)};
        import websmith from "@quatico/websmith-vite";
        import fs from "node:fs";
        import path from "node:path";

        const root = ${JSON.stringify(projectDir)};
        const plugin = websmith(${toSource(pluginOptions)});
        let warnings = [];
        let watchFiles;
        const probe = {
            name: "probe",
            generateBundle() {
                watchFiles = this.getWatchFiles().map(cur => path.relative(root, cur).split(path.sep).join("/"));
            },
        };
        const runBuild = () => {
            warnings = [];
            return build({
                root,
                configFile: false,
                logLevel: "warn",
                plugins: [plugin, ...(${probe} ? [probe] : [])],
                ...${JSON.stringify(viteOptions)},
                build: {
                    write: false,
                    minify: false,
                    lib: { entry: "src/main.ts", formats: ["es"] },
                    rollupOptions: { onwarn: warning => warnings.push(warning.message) },
                },
            });
        };
        let code = "";
        let assets = [];
        let error;
        try {
            ${betweenBuilds === undefined ? "" : `await runBuild();\n${betweenBuilds}`}
            const result = await runBuild();
            const outputs = (Array.isArray(result) ? result : [result]).flatMap(cur => cur.output);
            code = outputs.filter(cur => cur.type === "chunk").map(cur => cur.code).join("\\n");
            assets = outputs
                .filter(cur => cur.type === "asset")
                .map(cur => ({
                    fileName: cur.fileName,
                    source: typeof cur.source === "string" ? cur.source : Buffer.from(cur.source).toString("utf-8"),
                }));
        } catch (cause) {
            error = { message: cause.message, loc: cause.loc, hook: cause.hook, plugin: cause.plugin };
        }
        console.log(JSON.stringify({ code, error, warnings, assets, watchFiles }));
        `
    );
    return JSON.parse(runScript("build.mjs", cwd)) as ViteBuildResult;
};

/**
 * The options of `runViteApp`: the Vite package, the plugin options, Vite's `environments` and `builder` options, and
 * whether `worker.plugins` returns the same plugin object, which then also bundles the workers.
 */
export type RunViteAppOptions = {
    vite?: string;
    pluginOptions: Record<string, unknown>;
    environments: Record<string, unknown>;
    builder?: Record<string, unknown>;
    workerPlugin?: boolean;
};

/** The result of one environment's build in `runViteApp`: the code of its chunks, its assets and its failure. */
export type ViteEnvironmentResult = Pick<ViteBuildResult, "code" | "assets" | "error">;

/**
 * Runs Vite's `createBuilder` with one plugin object in a separate Node process and builds each environment of
 * `environments`, in order, as `vite build --app` does with an inline config. Returns the result per environment name.
 */
export const runViteApp = ({
    vite = "vite",
    pluginOptions,
    environments,
    builder,
    workerPlugin = false,
}: RunViteAppOptions): Record<string, ViteEnvironmentResult> => {
    writeFile(
        "build-app.mjs",
        `
        import { createBuilder } from ${JSON.stringify(vite)};
        import websmith from "@quatico/websmith-vite";

        const environments = ${JSON.stringify(environments)};
        const plugin = websmith(${toSource(pluginOptions)});
        const builder = await createBuilder({
            root: ${JSON.stringify(projectDir)},
            configFile: false,
            logLevel: "warn",
            plugins: [plugin],
            ...(${workerPlugin} ? { worker: { format: "es", plugins: () => [plugin] } } : {}),
            builder: ${JSON.stringify(builder)},
            environments,
            build: { write: false, minify: false },
        });
        const results = {};
        for (const name of Object.keys(environments)) {
            let code = "";
            let assets = [];
            let error;
            try {
                const result = await builder.build(builder.environments[name]);
                const outputs = (Array.isArray(result) ? result : [result]).flatMap(cur => cur.output);
                code = outputs.filter(cur => cur.type === "chunk").map(cur => cur.code).join("\\n");
                assets = outputs
                    .filter(cur => cur.type === "asset")
                    .map(cur => ({
                        fileName: cur.fileName,
                        source: typeof cur.source === "string" ? cur.source : Buffer.from(cur.source).toString("utf-8"),
                    }));
            } catch (cause) {
                error = { message: cause.message, loc: cause.loc, hook: cause.hook, plugin: cause.plugin };
            }
            results[name] = { code, assets, error };
        }
        console.log(JSON.stringify(results));
        `
    );
    return JSON.parse(runScript("build-app.mjs", projectDir)) as Record<string, ViteEnvironmentResult>;
};

/** Runs `vite build` and returns the code of the bundle; throws with the error's message when the build fails. */
export const runViteBuild = (options: RunViteOptions): string => {
    const { code, error } = runVite(options);
    if (error) {
        throw new Error(`vite build failed:\n${error.message}`);
    }
    return code;
};

/**
 * Runs `vite build --watch` with the plugin: after the `END` of the n-th build it runs `afterBuilds[n - 1]` in the
 * build process, e.g. a file write, and returns the watcher events up to the outcome of the build after the last
 * step, its `BUNDLE_END` or `ERROR`. Rollup registers the watch files of a build asynchronously after its `END`, so a
 * write right after it can go unseen: the runner repeats a step every 250 ms until the watcher reports the `START` of
 * the next build.
 */
export const runViteWatch = ({
    vite = "vite",
    pluginOptions,
    afterBuilds,
}: Pick<RunViteOptions, "vite" | "pluginOptions"> & { afterBuilds: string[] }): ViteWatchEvent[] => {
    writeFile(
        "watch.mjs",
        `
        import { build } from ${JSON.stringify(vite)};
        import websmith from "@quatico/websmith-vite";
        import fs from "node:fs";

        const watcher = await build({
            root: ${JSON.stringify(projectDir)},
            configFile: false,
            logLevel: "silent",
            plugins: [websmith(${toSource(pluginOptions)})],
            build: { minify: false, lib: { entry: "src/main.ts", formats: ["es"] }, watch: {} },
        });
        const events = [];
        const afterBuilds = [${afterBuilds.map(cur => `() => { ${cur} }`).join(", ")}];
        let builds = 0;
        let retry;
        const finish = async () => {
            console.log(JSON.stringify(events));
            await watcher.close();
            process.exit(0);
        };
        watcher.on("event", event => {
            if (event.code === "ERROR") {
                events.push({ code: event.code, message: event.error.message, hook: event.error.hook });
            } else {
                events.push({ code: event.code });
            }
            if (event.code === "START") {
                builds++;
                clearInterval(retry);
                retry = undefined;
            }
            if (builds > afterBuilds.length && (event.code === "BUNDLE_END" || event.code === "ERROR")) {
                void finish();
            } else if (event.code === "END") {
                const step = afterBuilds[builds - 1];
                step();
                retry = setInterval(step, 250);
            }
        });
        `
    );
    return JSON.parse(runScript("watch.mjs", projectDir, 45000)) as ViteWatchEvent[];
};

/** A line Vite's logger received during `runViteDev`, by level, without ANSI codes. */
export type ViteDevLog = { level: "info" | "warn" | "error"; msg: string };

/** A response of `runViteDev`: of `get(url)` with its status and body, or of `ssr(url)` with its code or error. */
export type ViteDevResponse = { url: string; status?: number; body?: string; ssr?: boolean; code?: string; error?: string };

/** An HMR payload the dev server sent, e.g. `{ type: "full-reload" }` or `{ type: "error", err: { message } }`. */
export type ViteDevMessage = { type: string; err?: { message: string }; path?: string };

/**
 * The result of `runViteDev`: whether `server.listen()` resolved or its error, the logger's lines, the HMR payloads
 * except `ping`, the responses of the steps, and the waits that timed out.
 */
export type ViteDevResult = {
    listening: boolean;
    listenError?: string;
    logs: ViteDevLog[];
    messages: ViteDevMessage[];
    responses: ViteDevResponse[];
    timeouts: string[];
};

/**
 * Starts Vite's dev server with the plugin in a separate Node process, connects to its HMR socket and runs `steps`, code
 * in an async function of the server process, in order. The steps have these helpers in scope:
 * - `get(url, headers)` requests `url` from the server, with `headers` if given, e.g. `{ host }`, and records
 *   `{ url, status, body }`;
 * - `ssr(url)` records the code or the error of `server.environments.ssr.transformRequest(url)`;
 * - `waitForMessage(predicate, ms)` waits for the next HMR payload after the last one a wait matched, polling every
 *   25 ms, and records a timeout instead of throwing;
 * - `edit(file, text, predicate)` writes the project file `file`, rewriting it every 250 ms until a payload matches
 *   `predicate`, since the watcher may miss a write made right after a request.
 */
export const runViteDev = ({
    vite = "vite",
    pluginOptions,
    viteOptions = {},
    steps,
}: Pick<RunViteOptions, "vite" | "pluginOptions" | "viteOptions"> & { steps: string[] }): ViteDevResult => {
    writeFile(
        "dev.mjs",
        `
        import { createLogger, createServer } from ${JSON.stringify(vite)};
        import websmith from "@quatico/websmith-vite";
        import fs from "node:fs";
        import http from "node:http";
        import path from "node:path";

        const root = ${JSON.stringify(projectDir)};
        const logs = [];
        const messages = [];
        const responses = [];
        const timeouts = [];
        const strip = text => String(text).replace(/\\u001b\\[[0-9;]*m/g, "");
        const customLogger = createLogger("info", { allowClearScreen: false });
        customLogger.info = msg => logs.push({ level: "info", msg: strip(msg) });
        customLogger.warn = msg => logs.push({ level: "warn", msg: strip(msg) });
        customLogger.warnOnce = msg => logs.push({ level: "warn", msg: strip(msg) });
        customLogger.error = msg => logs.push({ level: "error", msg: strip(msg) });
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

        let cursor = 0;
        const findMessage = predicate => {
            const index = messages.findIndex((cur, i) => i >= cursor && predicate(cur));
            if (index >= 0) {
                cursor = index + 1;
                return messages[index];
            }
            return undefined;
        };
        const waitForMessage = async (predicate, ms = 10000) => {
            const end = Date.now() + ms;
            for (;;) {
                const found = findMessage(predicate);
                if (found || Date.now() >= end) {
                    if (!found) {
                        timeouts.push(String(predicate));
                    }
                    return found;
                }
                await sleep(25);
            }
        };

        const server = await createServer({
            root,
            configFile: false,
            logLevel: "info",
            clearScreen: false,
            customLogger,
            plugins: [websmith(${toSource(pluginOptions)})],
            server: { port: 5273, strictPort: false },
            ...${JSON.stringify(viteOptions)},
        });
        let listening = false;
        let listenError;
        try {
            await server.listen();
            listening = true;
        } catch (cause) {
            listenError = cause.message;
        }

        const port = listening ? server.httpServer.address().port : 0;
        // node:http, since fetch does not send a Host header of the caller
        const request = (url, headers) =>
            new Promise((resolve, reject) => {
                http.get({ host: "localhost", port, path: url, headers }, response => {
                    let body = "";
                    response.setEncoding("utf-8");
                    response.on("data", chunk => (body += chunk));
                    response.on("end", () => resolve({ status: response.statusCode, body }));
                }).on("error", reject);
            });
        const get = async (url, headers) => {
            const response = headers ? await request(url, headers) : await fetch("http://localhost:" + port + url);
            const result = { url, status: response.status, body: typeof response.body === "string" ? response.body : await response.text() };
            responses.push(result);
            return result;
        };
        const ssr = async url => {
            try {
                const result = await server.environments.ssr.transformRequest(url);
                responses.push({ url, ssr: true, code: result?.code ?? "" });
            } catch (cause) {
                responses.push({ url, ssr: true, error: cause.message });
            }
        };
        const edit = async (file, text, predicate) => {
            const write = () => fs.writeFileSync(path.join(root, file), text);
            write();
            const end = Date.now() + 10000;
            for (;;) {
                const found = findMessage(predicate);
                if (found || Date.now() >= end) {
                    if (!found) {
                        timeouts.push("edit " + file);
                    }
                    return found;
                }
                await sleep(250);
                write();
            }
        };

        let socket;
        if (listening) {
            socket = new WebSocket("ws://localhost:" + port + "/", "vite-hmr");
            socket.addEventListener("message", event => {
                const message = JSON.parse(String(event.data));
                if (message.type !== "ping") {
                    messages.push(message);
                }
            });
            await waitForMessage(cur => cur.type === "connected");
            const steps = [${steps.map(cur => `async () => { ${cur} }`).join(", ")}];
            for (const step of steps) {
                await step();
            }
        }
        socket?.close();
        await server.close();
        console.log(JSON.stringify({ listening, listenError, logs, messages, responses, timeouts }));
        process.exit(0);
        `
    );
    return JSON.parse(runScript("dev.mjs", projectDir, 60000)) as ViteDevResult;
};
