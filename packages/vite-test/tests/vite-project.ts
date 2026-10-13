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

/** The result of a `vite build`: the code of its chunks, its failure, and the warnings of `onwarn`. */
export type ViteBuildResult = { code: string; error?: ViteBuildError; warnings: string[] };

/** One event of a `vite build --watch`, with the message and hook of an `ERROR` event. */
export type ViteWatchEvent = { code: string; message?: string; hook?: string };

/** The options of the runners: the Vite package to import, the plugin options, Vite options and the working directory. */
export type RunViteOptions = {
    vite?: string;
    pluginOptions: Record<string, unknown>;
    viteOptions?: Record<string, unknown>;
    cwd?: string;
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
export const runVite = ({ vite = "vite", pluginOptions, viteOptions = {}, cwd = projectDir }: RunViteOptions): ViteBuildResult => {
    writeFile(
        "build.mjs",
        `
        import { build } from ${JSON.stringify(vite)};
        import websmith from "@quatico/websmith-vite";

        const warnings = [];
        let code = "";
        let error;
        try {
            const result = await build({
                root: ${JSON.stringify(projectDir)},
                configFile: false,
                logLevel: "warn",
                plugins: [websmith(${toSource(pluginOptions)})],
                ...${JSON.stringify(viteOptions)},
                build: {
                    write: false,
                    minify: false,
                    lib: { entry: "src/main.ts", formats: ["es"] },
                    rollupOptions: { onwarn: warning => warnings.push(warning.message) },
                },
            });
            const outputs = (Array.isArray(result) ? result : [result]).flatMap(cur => cur.output);
            code = outputs.filter(cur => cur.type === "chunk").map(cur => cur.code).join("\\n");
        } catch (cause) {
            error = { message: cause.message, loc: cause.loc, hook: cause.hook, plugin: cause.plugin };
        }
        console.log(JSON.stringify({ code, error, warnings }));
        `
    );
    return JSON.parse(runScript("build.mjs", cwd)) as ViteBuildResult;
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
 * Runs `vite build --watch` with the plugin: after the first `END` event it runs `afterFirstBuild` in the build
 * process, e.g. a file write, and returns the watcher events up to the end of the second build.
 */
export const runViteWatch = ({
    vite = "vite",
    pluginOptions,
    afterFirstBuild,
}: Pick<RunViteOptions, "vite" | "pluginOptions"> & { afterFirstBuild: string }): ViteWatchEvent[] => {
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
        let builds = 0;
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
            if (event.code === "END" || event.code === "ERROR") {
                builds++;
                if (builds === 1) {
                    ${afterFirstBuild}
                } else {
                    void finish();
                }
            }
        });
        `
    );
    return JSON.parse(runScript("watch.mjs", projectDir, 45000)) as ViteWatchEvent[];
};
