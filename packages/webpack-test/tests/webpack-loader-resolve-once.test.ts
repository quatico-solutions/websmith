/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { writeSourceFile } from "./test-files";

// Webpack runs in a separate Node process, like in webpack-esm-check.test.ts, and reports each build as a JSON line.
const getProjectDir = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    return path.resolve(__dirname, "..", `test-output-${testId}_${Date.now()}`);
};

let projectDir: string;

type BuildReport = { errors: string[]; outputs: Record<string, string> };
type RunOptions = {
    /** A JavaScript expression of the webpack configuration, an array for a MultiCompiler; `projectDir` and `loader` are in scope. */
    config: string;
    /** Output files to report, relative to the project. */
    outputs: string[];
    /** Files to write after each watch build, relative to the project; runs webpack once when absent. */
    steps?: Record<string, string>[];
    /** Files to write before each further run() of the same compiler, without watch, relative to the project. */
    reruns?: Record<string, string>[];
};

beforeEach(() => {
    projectDir = getProjectDir();
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    writeSourceFile("package.json", JSON.stringify({ type: "module" }), projectDir);
    // The pre-built addons are CommonJS
    writeSourceFile("addons/package.json", JSON.stringify({ type: "commonjs" }), projectDir);
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader under watch", () => {
    it("emits output of edited tsconfig.json", () => {
        writeTsConfig({ removeComments: false });
        writeSourceFile("websmith.config.json", JSON.stringify({}), projectDir);
        writeSourceFile("src/a.ts", COMMENTED_SOURCE, projectDir);

        const actual = runWebpack({
            config: singleRule(),
            outputs: ["dist/main.js"],
            steps: [{ "tsconfig.json": tsConfig({ removeComments: true }) }],
        }).map(cur => cur.outputs["dist/main.js"].includes("comment-marker"));

        expect(actual).toEqual([true, false]);
    }, 90000);

    it("emits output of edited extends target of tsconfig.json", () => {
        writeSourceFile("tsconfig.json", JSON.stringify({ extends: "./tsconfig.base.json" }), projectDir);
        writeSourceFile("tsconfig.base.json", tsConfig({ removeComments: false }), projectDir);
        writeSourceFile("websmith.config.json", JSON.stringify({}), projectDir);
        writeSourceFile("src/a.ts", COMMENTED_SOURCE, projectDir);

        const actual = runWebpack({
            config: singleRule(),
            outputs: ["dist/main.js"],
            steps: [{ "tsconfig.base.json": tsConfig({ removeComments: true }) }],
        }).map(cur => cur.outputs["dist/main.js"].includes("comment-marker"));

        expect(actual).toEqual([true, false]);
    }, 90000);

    it("reports broken websmith.config.json and builds cleanly after it is fixed", () => {
        writeTsConfig({});
        writeSourceFile("websmith.config.json", JSON.stringify({ profiles: { target: {} } }), projectDir);
        writeSourceFile("src/a.ts", "export const a = 1;\n", projectDir);

        const actual = runWebpack({
            config: singleRule({ profile: "target" }),
            outputs: [],
            steps: [
                { "websmith.config.json": `{ "profiles": { "target": ` },
                { "websmith.config.json": JSON.stringify({ profiles: { target: {} } }) },
            ],
        }).map(cur => cur.errors.length > 0);

        expect(actual).toEqual([false, true, false]);
    }, 120000);

    it("emits output of edited dependency of transformed module", () => {
        writeTsConfig({});
        writeSourceFile(
            "websmith.config.json",
            JSON.stringify({ addonsDir: "./addons", addonEmitOnly: true, profiles: { target: { addons: ["marker"] } } }),
            projectDir
        );
        writeMarkerAddon();
        writeSourceFile("src/a.ts", `import { E } from "./b";\nexport const a = E.X;\n`, projectDir);
        writeSourceFile("src/b.ts", `export const enum E { X = 1111 }\n`, projectDir);

        const actual = runWebpack({
            config: singleRule({ profile: "target", transpileOnly: false }),
            outputs: ["dist/main.js"],
            steps: [{ "src/b.ts": `export const enum E { X = 2222 }\n` }],
        }).map(cur => cur.outputs["dist/main.js"].includes("2222"));

        expect(actual).toEqual([false, true]);
    }, 90000);

    it("emits transformed output of edited module w/ starter-shaped build", () => {
        writeTsConfig({});
        writeSourceFile("websmith.config.json", JSON.stringify({ addonsDir: "./addons", profiles: { client: { addons: ["marker"] } } }), projectDir);
        writeMarkerAddon();
        writeSourceFile("src/index.ts", `import { f } from "./functions/f";\nexport const main = f;\n`, projectDir);
        writeSourceFile("src/functions/f.ts", `export const f = "first";\n`, projectDir);

        const actual = runWebpack({
            config: `({
                mode: "development",
                devtool: false,
                target: "node",
                context: projectDir,
                entry: { main: "./src/index.ts" },
                output: { path: path.join(projectDir, "dist") },
                resolve: { extensions: [".ts", ".js"] },
                module: {
                    rules: [
                        {
                            test: /\\.ts$/,
                            include: [path.join(projectDir, "src", "functions")],
                            use: [{ loader, options: { tsConfigFile: path.join(projectDir, "tsconfig.json"), configFile: path.join(projectDir, "websmith.config.json"), profile: "client", transpileOnly: true } }],
                        },
                        {
                            test: /\\.ts$/,
                            exclude: [path.join(projectDir, "src", "functions")],
                            use: [{ loader: ${JSON.stringify(require.resolve("ts-loader"))}, options: { transpileOnly: true, configFile: path.join(projectDir, "tsconfig.json") } }],
                        },
                    ],
                },
            })`,
            outputs: ["dist/main.js"],
            steps: [{ "src/functions/f.ts": `export const f = "second";\n` }],
        }).map(cur => ["first", "second", "marker-transformed"].filter(text => cur.outputs["dist/main.js"].includes(text)));

        expect(actual).toEqual([
            ["first", "marker-transformed"],
            ["second", "marker-transformed"],
        ]);
    }, 90000);
});

describe("webpack w/ websmith-loader and repeated runs", () => {
    it("emits output of edited tsconfig.json w/ second run of the same compiler", () => {
        writeTsConfig({ removeComments: false });
        writeSourceFile("websmith.config.json", JSON.stringify({}), projectDir);
        writeSourceFile("src/a.ts", COMMENTED_SOURCE, projectDir);

        const actual = runWebpack({
            config: singleRule(),
            outputs: ["dist/main.js"],
            reruns: [{ "tsconfig.json": tsConfig({ removeComments: true }) }],
        }).map(cur => cur.outputs["dist/main.js"].includes("comment-marker"));

        expect(actual).toEqual([true, false]);
    }, 60000);
});

describe("webpack w/ websmith-loader and several instances", () => {
    it("loads and activates addons once per loader rule w/ two loader rules and an edit under watch", () => {
        writeTsConfig({});
        writeCountedConfig();
        writeCounterAddon();
        writeSourceFile("src/index.ts", `import { a } from "./one/a";\nimport { b } from "./two/b";\nexport const main = [a, b];\n`, projectDir);
        ["one/a", "one/c", "two/b", "two/d"].forEach(cur =>
            writeSourceFile(`src/${cur}.ts`, `export const ${path.basename(cur)} = 1;\n`, projectDir)
        );
        writeSourceFile("src/one/a.ts", `import { c } from "./c";\nexport const a = c;\n`, projectDir);
        writeSourceFile("src/two/b.ts", `import { d } from "./d";\nexport const b = d;\n`, projectDir);

        runWebpack({
            config: `({
                mode: "development",
                devtool: false,
                target: "node",
                context: projectDir,
                entry: { main: "./src/index.ts" },
                output: { path: path.join(projectDir, "dist") },
                resolve: { extensions: [".ts", ".js"] },
                module: {
                    rules: [
                        { test: /\\.ts$/, include: [path.join(projectDir, "src", "two")], use: [{ loader, options: loaderOptions("two") }] },
                        { test: /\\.ts$/, exclude: [path.join(projectDir, "src", "two")], use: [{ loader, options: loaderOptions("one") }] },
                    ],
                },
            })`,
            outputs: [],
            steps: [{ "src/one/c.ts": `export const c = 2;\n` }],
        });
        const actual = readCounterLog();

        expect(actual).toEqual({ load: 2, activate: 2 });
    }, 90000);

    it("loads and activates addons once per child compiler w/ MultiCompiler", () => {
        writeTsConfig({});
        writeCountedConfig();
        writeCounterAddon();
        writeSourceFile("src/a.ts", `import { c } from "./c";\nexport const a = c;\n`, projectDir);
        writeSourceFile("src/c.ts", `export const c = 1;\n`, projectDir);

        runWebpack({
            config: `["client", "server"].map(name => ({
                name,
                mode: "development",
                devtool: false,
                target: "node",
                context: projectDir,
                entry: { main: "./src/a.ts" },
                output: { path: path.join(projectDir, "dist", name) },
                resolve: { extensions: [".ts", ".js"] },
                module: { rules: [{ test: /\\.ts$/, use: [{ loader, options: loaderOptions("one") }] }] },
            }))`,
            outputs: [],
        });
        const actual = readCounterLog();

        expect(actual).toEqual({ load: 2, activate: 2 });
    }, 60000);
});

const COMMENTED_SOURCE = `/* comment-marker */\nexport const a = 1;\n`;

const tsConfig = (compilerOptions: Record<string, unknown>) =>
    JSON.stringify({
        compilerOptions: { target: "es2020", module: "esnext", moduleResolution: "bundler", rootDir: "src", outDir: "tsout", ...compilerOptions },
    });

const writeTsConfig = (compilerOptions: Record<string, unknown>) => writeSourceFile("tsconfig.json", tsConfig(compilerOptions), projectDir);

const singleRule = (options: Record<string, unknown> = {}) => `({
    mode: "development",
    devtool: false,
    target: "node",
    context: projectDir,
    entry: { main: "./src/a.ts" },
    output: { path: path.join(projectDir, "dist") },
    resolve: { extensions: [".ts", ".js"] },
    module: {
        rules: [
            {
                test: /\\.ts$/,
                use: [{ loader, options: { transpileOnly: true, tsConfigFile: path.join(projectDir, "tsconfig.json"), configFile: path.join(projectDir, "websmith.config.json"), ...${JSON.stringify(options)} } }],
            },
        ],
    },
})`;

// Adds a "marker-transformed" statement after each top-level variable statement
const writeMarkerAddon = () =>
    writeSourceFile(
        "addons/marker/addon.js",
        `
            const ts = require(${JSON.stringify(require.resolve("typescript"))});
            exports.activate = ctx => {
                ctx.registerTransformer({
                    before: [
                        () => file =>
                            ts.factory.updateSourceFile(
                                file,
                                file.statements.flatMap(cur =>
                                    ts.isVariableStatement(cur) ? [cur, ts.factory.createExpressionStatement(ts.factory.createStringLiteral("marker-transformed"))] : [cur]
                                )
                            ),
                    ],
                });
            };
        `,
        projectDir
    );

const writeCountedConfig = () =>
    writeSourceFile(
        "websmith.config.json",
        JSON.stringify({ addonsDir: "./addons", profiles: { one: { addons: ["counter"] }, two: { addons: ["counter"] } } }),
        projectDir
    );

// Appends a line per module evaluation and per activation, so the test counts both across all loader instances
const writeCounterAddon = () =>
    writeSourceFile(
        "addons/counter/addon.js",
        `
            const fs = require("node:fs");
            const log = ${JSON.stringify(path.join(projectDir, "counter.log"))};
            fs.appendFileSync(log, "load\\n");
            exports.activate = () => fs.appendFileSync(log, "activate\\n");
        `,
        projectDir
    );

const readCounterLog = () => {
    const lines = fs.readFileSync(path.join(projectDir, "counter.log"), "utf-8").split("\n");
    return { load: lines.filter(cur => cur === "load").length, activate: lines.filter(cur => cur === "activate").length };
};

const runWebpack = ({ config, outputs, steps, reruns }: RunOptions): BuildReport[] => {
    const script = `
        const fs = require("node:fs");
        const path = require("node:path");
        const webpack = require(${JSON.stringify(require.resolve("webpack"))});
        const projectDir = ${JSON.stringify(projectDir)};
        const loader = ${JSON.stringify(require.resolve("websmith-loader"))};
        const loaderOptions = profile => ({
            transpileOnly: true,
            tsConfigFile: path.join(projectDir, "tsconfig.json"),
            configFile: path.join(projectDir, "websmith.config.json"),
            profile,
        });
        const steps = ${JSON.stringify(steps ?? null)};
        const reruns = ${JSON.stringify(reruns ?? [])};
        const outputs = ${JSON.stringify(outputs)};
        const compiler = webpack(${config});
        const report = stats => {
            const errors = (stats.stats ?? [stats]).flatMap(cur => cur.compilation.errors.map(error => error.message));
            const read = fileName => {
                const filePath = path.join(projectDir, fileName);
                return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
            };
            console.log("RESULT " + JSON.stringify({ errors, outputs: Object.fromEntries(outputs.map(cur => [cur, read(cur)])) }));
        };
        if (!steps) {
            let run = 0;
            const onRun = (err, stats) => {
                if (err) {
                    console.error(err);
                    process.exitCode = 2;
                    return compiler.close(() => undefined);
                }
                report(stats);
                const files = reruns[run++];
                if (!files) {
                    return compiler.close(() => undefined);
                }
                // A later modification time than the previous run's
                setTimeout(() => {
                    Object.entries(files).forEach(([fileName, content]) => fs.writeFileSync(path.join(projectDir, fileName), content));
                    compiler.run(onRun);
                }, 1000);
            };
            compiler.run(onRun);
        } else {
            let step = 0;
            let watchdog;
            let awaited = null;
            const watching = compiler.watch({ aggregateTimeout: 100 }, (err, stats) => {
                if (err) {
                    console.error(err);
                    process.exitCode = 2;
                    return watching.close(() => undefined);
                }
                // Only a rebuild that saw the edited files is the awaited one
                const modified = compiler.modifiedFiles || new Set();
                if (awaited && !awaited.every(cur => modified.has(cur))) {
                    return;
                }
                report(stats);
                clearTimeout(watchdog);
                const files = steps[step++];
                if (!files) {
                    return watching.close(() => undefined);
                }
                awaited = Object.keys(files).map(fileName => path.join(projectDir, fileName));
                watchdog = setTimeout(() => {
                    console.error("no rebuild containing " + awaited.join(", ") + " within 25000ms");
                    process.exitCode = 2;
                    watching.close(() => undefined);
                }, 25000);
                // Let the watcher settle, so the write is seen as a change after this build
                setTimeout(() => Object.entries(files).forEach(([fileName, content]) => fs.writeFileSync(path.join(projectDir, fileName), content)), 1000);
            });
        }
    `;
    const scriptPath = path.join(projectDir, "run-webpack.cjs");
    fs.writeFileSync(scriptPath, script, { encoding: "utf-8" });

    const builds = (steps ?? reruns ?? []).length + 1;
    const result = spawnSync(process.execPath, [scriptPath], { cwd: projectDir, encoding: "utf-8", timeout: builds * 26000 + 15000 });
    const reports = result.stdout
        .split("\n")
        .filter(cur => cur.startsWith("RESULT "))
        .map(cur => JSON.parse(cur.slice("RESULT ".length)) as BuildReport);
    if (reports.length !== builds) {
        throw new Error(`webpack reported ${reports.length} builds, expected ${builds}: ${result.stdout}${result.stderr}`);
    }
    return reports;
};
