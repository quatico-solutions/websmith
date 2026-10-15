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

// Webpack runs in a separate Node process, like in webpack-esm-check.test.ts, and reports each compilation as a JSON line.
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-${testId}_${Date.now()}`);
    return { PROJECT_DIR, OUTPUT_DIR: path.join(PROJECT_DIR, "dist"), SOURCE_DIR: path.join(PROJECT_DIR, "src") };
};

let testDirs: ReturnType<typeof getTestDirs>;

type BuildReport = {
    built: string[];
    /** Module format of dist/main.js. */
    format: "commonjs" | "esm";
    /** package.json files among the build info dependencies of the a.ts module, relative to the project. */
    dependencies: { files: string[]; missing: string[] };
    /** package.json types recorded in the build info of the a.ts module. */
    recorded: Record<string, string | null> | null;
};
type RunOptions = {
    threadLoader?: boolean;
    cache?: boolean;
    /** Files to write after the first watch build, relative to the project; runs webpack once when absent. */
    edit?: Record<string, string>;
};

const PACKAGE = { name: "package-type-test", version: "1.0.0", type: "module" };
const MODULE_RESOLUTIONS: Record<string, string> = { nodenext: "nodenext", node16: "node16", esnext: "bundler" };

beforeEach(() => {
    testDirs = getTestDirs();
    writeSourceFile("a.ts", "export const a = 1;\n", testDirs.SOURCE_DIR);
    writeSourceFile("package.json", JSON.stringify(PACKAGE), testDirs.PROJECT_DIR);
});

afterEach(() => {
    fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader and package.json type", () => {
    it("should rebuild module w/ type flip under watch w/ nodenext profile w/o esm", () => {
        writeProject("nodenext", {});

        const [, actual] = runWebpack({ edit: { "package.json": JSON.stringify({ ...PACKAGE, type: "commonjs" }) } });

        expect({ built: actual.built, format: actual.format }).toEqual({ built: [sourcePath("a.ts")], format: "commonjs" });
    }, 90000);

    it("should not rebuild module w/ version edit under watch w/ nodenext ESM check", () => {
        writeProject("nodenext", { esm: { runtime: "node" } });

        const [, actual] = runWebpack({ edit: { "package.json": JSON.stringify({ ...PACKAGE, version: "1.0.1" }) } });

        expect({ built: actual.built, files: actual.dependencies.files }).toEqual({ built: [], files: [] });
    }, 90000);

    it("should not rebuild module w/ version edit under watch w/ nodenext profile w/o esm", () => {
        writeProject("nodenext", {});

        const [, actual] = runWebpack({ edit: { "package.json": JSON.stringify({ ...PACKAGE, version: "1.0.1" }) } });

        expect(actual.built).toEqual([]);
    }, 90000);

    it("should rebuild module w/ type flip under thread-loader w/ node16 profile", () => {
        writeProject("node16", {});

        const [, actual] = runWebpack({ threadLoader: true, edit: { "package.json": JSON.stringify({ ...PACKAGE, type: "commonjs" }) } });

        expect({ built: actual.built, format: actual.format }).toEqual({ built: [sourcePath("a.ts")], format: "commonjs" });
    }, 90000);

    it("should rebuild module w/ type flip between two runs w/ persistent cache w/ nodenext profile", async () => {
        writeProject("nodenext", {});
        runWebpack({ cache: true });
        await waitForNewModificationTime();
        writeSourceFile("package.json", JSON.stringify({ ...PACKAGE, type: "commonjs" }), testDirs.PROJECT_DIR);

        const [actual] = runWebpack({ cache: true });

        expect({ built: actual.built, format: actual.format }).toEqual({ built: [sourcePath("a.ts")], format: "commonjs" });
    }, 90000);

    it("should rebuild module w/ type flip between two runs w/ persistent cache w/ nodenext ESM check", async () => {
        writeProject("nodenext", { esm: { runtime: "node" } });
        runWebpack({ cache: true });
        await waitForNewModificationTime();
        writeSourceFile("package.json", JSON.stringify({ ...PACKAGE, type: "commonjs" }), testDirs.PROJECT_DIR);

        const [actual] = runWebpack({ cache: true });

        expect({ built: actual.built, format: actual.format }).toEqual({ built: [sourcePath("a.ts")], format: "commonjs" });
    }, 90000);

    it("should register no package.json dependency w/o node16/nodenext profile", () => {
        writeProject("esnext", {});

        const [actual] = runWebpack({});

        expect({ dependencies: actual.dependencies, recorded: actual.recorded }).toEqual({
            dependencies: { files: [], missing: [] },
            recorded: null,
        });
    }, 90000);
});

const sourcePath = (fileName: string): string => path.join(testDirs.SOURCE_DIR, fileName);

const waitForNewModificationTime = () => new Promise(resolve => setTimeout(resolve, 1100));

const writeProject = (module: string, target: { esm?: { runtime: "node" | "bundler" } }) => {
    writeSourceFile(
        "tsconfig.json",
        JSON.stringify({
            compilerOptions: {
                target: "es2020",
                module,
                moduleResolution: MODULE_RESOLUTIONS[module],
                rootDir: testDirs.SOURCE_DIR,
                outDir: path.join(testDirs.PROJECT_DIR, "tsout"),
            },
        }),
        testDirs.PROJECT_DIR
    );
    writeSourceFile("websmith.config.json", JSON.stringify({ profiles: { target } }), testDirs.PROJECT_DIR);
};

const runWebpack = ({ threadLoader, cache, edit }: RunOptions): BuildReport[] => {
    const builds = edit ? 2 : 1;
    const script = `
        const fs = require("node:fs");
        const path = require("node:path");
        const webpack = require(${JSON.stringify(require.resolve("webpack"))});
        const projectDir = ${JSON.stringify(testDirs.PROJECT_DIR)};
        const outputDir = ${JSON.stringify(testDirs.OUTPUT_DIR)};
        const moduleFile = ${JSON.stringify(sourcePath("a.ts"))};
        const edit = ${JSON.stringify(edit ?? null)};
        const compiler = webpack({
            mode: "development",
            devtool: false,
            target: "node",
            context: projectDir,
            entry: { main: "./src/a.ts" },
            output: { path: outputDir },
            ${cache ? `cache: { type: "filesystem", cacheDirectory: path.join(projectDir, ".cache") },` : ""}
            resolve: { extensions: [".ts", ".js"], extensionAlias: { ".js": [".ts", ".js"] } },
            module: {
                rules: [
                    {
                        test: /\\.ts$/,
                        use: [
                            ${threadLoader ? `{ loader: ${JSON.stringify(require.resolve("thread-loader"))}, options: { workers: 1 } },` : ""}
                            {
                                loader: ${JSON.stringify(require.resolve("websmith-loader"))},
                                options: {
                                    transpileOnly: true,
                                    tsConfigFile: path.join(projectDir, "tsconfig.json"),
                                    configFile: path.join(projectDir, "websmith.config.json"),
                                    profile: "target",
                                },
                            },
                        ],
                    },
                ],
            },
        });
        const packageJsons = files =>
            [...(files || [])].filter(cur => path.basename(cur) === "package.json").map(cur => path.relative(projectDir, cur)).sort();
        const report = stats => {
            const { compilation } = stats;
            const module = [...compilation.modules].find(cur => cur.resource === moduleFile);
            const buildInfo = (module && module.buildInfo) || {};
            const output = fs.readFileSync(path.join(outputDir, "main.js"), "utf-8");
            console.log("RESULT " + JSON.stringify({
                built: [...compilation.modules].filter(cur => compilation.builtModules.has(cur)).map(cur => cur.resource).filter(Boolean),
                format: /exports\\.a = /.test(output) ? "commonjs" : "esm",
                dependencies: { files: packageJsons(buildInfo.fileDependencies), missing: packageJsons(buildInfo.missingDependencies) },
                recorded: buildInfo.websmithPackageTypes || null,
            }));
        };
        if (!edit) {
            compiler.run((err, stats) => {
                if (err) {
                    console.error(err);
                    process.exitCode = 2;
                } else {
                    report(stats);
                }
                // Stores the persistent cache
                compiler.close(() => undefined);
            });
        } else {
            let watchdog;
            let built = false;
            let awaited = null;
            const watching = compiler.watch({ aggregateTimeout: 100 }, (err, stats) => {
                if (err) {
                    console.error(err);
                    process.exitCode = 2;
                    return watching.close(() => undefined);
                }
                const modified = compiler.modifiedFiles || new Set();
                if (!built) {
                    built = true;
                    report(stats);
                    const files = Object.keys(edit).map(fileName => path.join(projectDir, fileName));
                    watchdog = setTimeout(() => {
                        console.error("no compilation with " + files.join(", ") + " within 25000ms, modified files were: " + [...modified].join(", "));
                        process.exitCode = 2;
                        watching.close(() => undefined);
                    }, 25000);
                    // Let the watcher settle, so the write is seen as a change after this build; only then is a compilation awaited
                    setTimeout(() => {
                        Object.entries(edit).forEach(([fileName, content]) => fs.writeFileSync(path.join(projectDir, fileName), content));
                        awaited = files;
                    }, 1000);
                    return;
                }
                if (!awaited || !awaited.every(cur => modified.has(cur))) {
                    return;
                }
                clearTimeout(watchdog);
                report(stats);
                watching.close(() => undefined);
            });
        }
    `;
    const scriptPath = path.join(testDirs.PROJECT_DIR, "run-webpack.cjs");
    fs.writeFileSync(scriptPath, script, { encoding: "utf-8" });

    const result = spawnSync(process.execPath, [scriptPath], { cwd: testDirs.PROJECT_DIR, encoding: "utf-8", timeout: builds * 26000 + 15000 });
    const reports = result.stdout
        .split("\n")
        .filter(cur => cur.startsWith("RESULT "))
        .map(cur => JSON.parse(cur.slice("RESULT ".length)) as BuildReport);
    if (reports.length !== builds) {
        throw new Error(`webpack reported ${reports.length} builds, expected ${builds}: ${result.stdout}${result.stderr}`);
    }
    return reports;
};
