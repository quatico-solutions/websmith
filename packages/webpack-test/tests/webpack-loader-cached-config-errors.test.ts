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

// Webpack runs in a separate Node process, like in webpack-loader-package-type.test.ts, and reports each compilation as a JSON line.
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-${testId}_${Date.now()}`);
    return { PROJECT_DIR, OUTPUT_DIR: path.join(PROJECT_DIR, "dist"), SOURCE_DIR: path.join(PROJECT_DIR, "src") };
};

let testDirs: ReturnType<typeof getTestDirs>;

type BuildReport = {
    /** Resources of the modules the compilation built, relative to the project. */
    built: string[];
    errors: { module: string | null; message: string }[];
};
type RunOptions = {
    threadLoader?: { workers: number; poolTimeout?: number };
    cache?: boolean;
    /** Entry module, relative to the project. */
    entry?: string;
    /** Files to write after each watch build, relative to the project, where null deletes the file; runs webpack once when absent. */
    edits?: Record<string, string | null>[];
};

const CONFIG_ERROR = "Unknown 'esm.runtime' value 'bogus'";
const TSCONFIG_ERROR = "Unknown compiler option 'nope'";
// TS5053 prefix: jsxFactory excludes reactNamespace, a file-less option error TypeScript 5 and 6 report; the loader drops the code
const OPTION_ERROR = "Option 'reactNamespace' cannot be specified with option 'jsxFactory'";
const DEPENDENT_LABEL = '(profile "dep")';
const TSCONFIG = { target: "es2020", module: "esnext", moduleResolution: "bundler", rootDir: "src", outDir: "tsout" };
const BOGUS_CONFIG = { profiles: { target: { esm: { runtime: "bogus" } } } };
const DEPENDENT_CONFIG = {
    profiles: {
        target: { depends: ["dep"], tsConfig: { module: "esnext", target: "es2020" } },
        dep: { tsConfig: { module: "commonjs", target: "es5" } },
    },
};

beforeEach(() => {
    testDirs = getTestDirs();
    writeTsConfig(TSCONFIG);
    writeConfig({ profiles: { target: {} } });
    writeSourceFile("a.ts", `import { b } from "./b";\nexport const a = b;\n`, testDirs.SOURCE_DIR);
    writeSourceFile("b.ts", "export const b = 1;\n", testDirs.SOURCE_DIR);
});

afterEach(() => {
    fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader and config errors w/ persistent cache", () => {
    it("should report config error in second run w/ persistent cache w/ unchanged invalid config", async () => {
        writeConfig(BOGUS_CONFIG);
        runWebpack({ cache: true });
        await waitForNewModificationTime();

        const [actual] = runWebpack({ cache: true });

        expect(countOf(actual, CONFIG_ERROR)).toBe(1);
    }, 90000);

    it("should report tsconfig error in second run w/ persistent cache", async () => {
        writeTsConfig({ ...TSCONFIG, nope: true });
        runWebpack({ cache: true });
        await waitForNewModificationTime();

        const [actual] = runWebpack({ cache: true });

        expect(countOf(actual, TSCONFIG_ERROR)).toBe(1);
    }, 90000);

    it("should report option error in second run w/ persistent cache", async () => {
        writeTsConfig({ ...TSCONFIG, jsx: "react", jsxFactory: "h", reactNamespace: "R" });
        runWebpack({ cache: true });
        await waitForNewModificationTime();

        const [actual] = runWebpack({ cache: true });

        expect(countOf(actual, OPTION_ERROR)).toBe(1);
    }, 90000);

    it("should report dependent profile's option error in second run w/ persistent cache", async () => {
        writeConfig(DEPENDENT_CONFIG);
        runWebpack({ cache: true });
        await waitForNewModificationTime();

        const [actual] = runWebpack({ cache: true });

        expect(countOf(actual, DEPENDENT_LABEL)).toBe(1);
    }, 90000);

    it("should rebuild one module per run w/ invalid config w/ persistent cache", async () => {
        writeConfig(BOGUS_CONFIG);
        runWebpack({ cache: true });
        await waitForNewModificationTime();

        const [actual] = runWebpack({ cache: true });

        expect(actual.built).toHaveLength(1);
    }, 90000);

    it("should report option error once w/ one module edited between runs w/ persistent cache", async () => {
        writeConfig(DEPENDENT_CONFIG);
        runWebpack({ cache: true });
        await waitForNewModificationTime();
        writeSourceFile("b.ts", "export const b = 2;\n", testDirs.SOURCE_DIR);

        const [actual] = runWebpack({ cache: true });

        expect(countOf(actual, DEPENDENT_LABEL)).toBe(1);
    }, 90000);

    it("should build w/o errors w/ config fixed between runs w/ persistent cache, then restore every module in a third run", async () => {
        writeConfig(BOGUS_CONFIG);
        runWebpack({ cache: true });
        await waitForNewModificationTime();
        writeConfig({ profiles: { target: {} } });
        const [fixed] = runWebpack({ cache: true });
        await waitForNewModificationTime();

        const [actual] = runWebpack({ cache: true });

        expect({ fixed: fixed.errors, built: actual.built }).toEqual({ fixed: [], built: [] });
    }, 90000);

    it("should report tsconfig error w/ tsconfig broken between runs w/ persistent cache", async () => {
        runWebpack({ cache: true });
        await waitForNewModificationTime();
        writeTsConfig({ ...TSCONFIG, nope: true });

        const [actual] = runWebpack({ cache: true });

        expect(countOf(actual, TSCONFIG_ERROR)).toBe(1);
    }, 90000);

    it("should restore every module w/ valid config w/ persistent cache", async () => {
        runWebpack({ cache: true });
        await waitForNewModificationTime();

        const [actual] = runWebpack({ cache: true });

        expect(actual.built).toEqual([]);
    }, 90000);

    it("should report dependent profile's option error in second run w/ persistent cache under thread-loader", async () => {
        writeConfig(DEPENDENT_CONFIG);
        runWebpack({ cache: true, threadLoader: { workers: 1 } });
        await waitForNewModificationTime();

        const [actual] = runWebpack({ cache: true, threadLoader: { workers: 1 } });

        expect(countOf(actual, DEPENDENT_LABEL)).toBe(1);
    }, 90000);
});

describe("webpack w/ websmith-loader and config errors under watch", () => {
    it("should report config error once after carrier module leaves graph w/o thread-loader", () => {
        writeConfig(BOGUS_CONFIG);
        writeChain();

        const [, actual] = runWebpack({ entry: "src/index.js", edits: [{ "src/index.js": `import { c } from "./c";\nexport const main = c;\n` }] });

        expect(countOf(actual, CONFIG_ERROR)).toBe(1);
    }, 90000);

    it("should report config error after carrier module leaves graph under thread-loader watch", () => {
        writeConfig(BOGUS_CONFIG);
        writeChain();

        const [, actual] = runWebpack({
            entry: "src/index.js",
            threadLoader: { workers: 1, poolTimeout: Infinity },
            edits: [{ "src/index.js": `import { c } from "./c";\nexport const main = c;\n` }],
        });

        expect(countOf(actual, CONFIG_ERROR)).toBe(1);
    }, 90000);

    it("should report config error in every watch rebuild w/ two thread-loader workers", () => {
        writeConfig(BOGUS_CONFIG);
        ["a", "b", "c", "d"].forEach(cur => writeSourceFile(`${cur}.ts`, `export const ${cur} = 1;\n`, testDirs.SOURCE_DIR));
        writeSourceFile(
            "index.js",
            `import { a } from "./a";\nimport { b } from "./b";\nimport { c } from "./c";\nimport { d } from "./d";\nexport const main = [a, b, c, d];\n`,
            testDirs.SOURCE_DIR
        );

        const actual = runWebpack({
            entry: "src/index.js",
            threadLoader: { workers: 2, poolTimeout: Infinity },
            edits: [
                { "src/a.ts": "export const a = 2;\n", "src/b.ts": "export const b = 2;\n" },
                { "src/c.ts": "export const c = 2;\n", "src/d.ts": "export const d = 2;\n" },
            ],
        }).map(cur => countOf(cur, CONFIG_ERROR));

        expect(actual.filter(cur => cur < 1 || cur > 2)).toEqual([]);
    }, 120000);
});

const waitForNewModificationTime = () => new Promise(resolve => setTimeout(resolve, 1100));

const countOf = ({ errors }: BuildReport, part: string): number => errors.filter(cur => cur.message.includes(part)).length;

const writeTsConfig = (compilerOptions: Record<string, unknown>) =>
    writeSourceFile("tsconfig.json", JSON.stringify({ compilerOptions }), testDirs.PROJECT_DIR);

const writeConfig = (config: object) => writeSourceFile("websmith.config.json", JSON.stringify(config), testDirs.PROJECT_DIR);

/** Writes the import chain index.js → b.ts → c.ts, so b.ts is always the first module the loader builds. */
const writeChain = () => {
    writeSourceFile("index.js", `import { b } from "./b";\nexport const main = b;\n`, testDirs.SOURCE_DIR);
    writeSourceFile("b.ts", `import { c } from "./c";\nexport const b = c;\n`, testDirs.SOURCE_DIR);
    writeSourceFile("c.ts", "export const c = 1;\n", testDirs.SOURCE_DIR);
};

const runWebpack = ({ threadLoader, cache, entry = "src/a.ts", edits }: RunOptions): BuildReport[] => {
    const builds = 1 + (edits?.length ?? 0);
    const script = `
        const fs = require("node:fs");
        const path = require("node:path");
        const webpack = require(${JSON.stringify(require.resolve("webpack"))});
        const projectDir = ${JSON.stringify(testDirs.PROJECT_DIR)};
        const outputDir = ${JSON.stringify(testDirs.OUTPUT_DIR)};
        const edits = ${JSON.stringify(edits ?? null)};
        const compiler = webpack({
            mode: "development",
            devtool: false,
            target: "node",
            context: projectDir,
            entry: { main: ${JSON.stringify(`./${entry}`)} },
            output: { path: outputDir },
            ${cache ? `cache: { type: "filesystem", cacheDirectory: path.join(projectDir, ".cache") },` : ""}
            resolve: { extensions: [".ts", ".js"], extensionAlias: { ".js": [".ts", ".js"] } },
            module: {
                rules: [
                    {
                        test: /\\.ts$/,
                        use: [
                            ${
                                threadLoader
                                    ? `{ loader: ${JSON.stringify(require.resolve("thread-loader"))}, options: { workers: ${threadLoader.workers}${
                                          threadLoader.poolTimeout === Infinity ? ", poolTimeout: Infinity" : ""
                                      } } },`
                                    : ""
                            }
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
        const report = stats => {
            const { compilation } = stats;
            console.log("RESULT " + JSON.stringify({
                built: [...compilation.modules]
                    .filter(cur => compilation.builtModules.has(cur) && cur.resource)
                    .map(cur => path.relative(projectDir, cur.resource))
                    .sort(),
                errors: stats.toJson({ all: false, errors: true }).errors.map(cur => ({ module: cur.moduleName ?? null, message: cur.message })),
            }));
        };
        // Workers with an infinite pool timeout keep the process alive: exits once the reports are written
        const exit = () => process.stdout.write("", () => process.exit());
        if (!edits) {
            compiler.run((err, stats) => {
                if (err) {
                    console.error(err);
                    process.exitCode = 2;
                } else {
                    report(stats);
                }
                // Stores the persistent cache
                compiler.close(exit);
            });
        } else {
            let watchdog;
            let step = -1;
            let awaited = null;
            const watching = compiler.watch({ aggregateTimeout: 100 }, (err, stats) => {
                if (err) {
                    console.error(err);
                    process.exitCode = 2;
                    return watching.close(exit);
                }
                const modified = compiler.modifiedFiles || new Set();
                const removed = compiler.removedFiles || new Set();
                if (step >= 0 && (!awaited || !awaited.every(cur => modified.has(cur) || removed.has(cur)))) {
                    return;
                }
                clearTimeout(watchdog);
                report(stats);
                step++;
                awaited = null;
                if (step >= edits.length) {
                    return watching.close(exit);
                }
                const edit = edits[step];
                const files = Object.keys(edit).map(fileName => path.join(projectDir, fileName));
                watchdog = setTimeout(() => {
                    console.error("no compilation with " + files.join(", ") + " within 25000ms, modified files were: " + [...modified].join(", "));
                    process.exitCode = 2;
                    watching.close(exit);
                }, 25000);
                // Let the watcher settle, so the write is seen as a change after this build; only then is a compilation awaited
                setTimeout(() => {
                    Object.entries(edit).forEach(([fileName, content]) =>
                        content === null ? fs.rmSync(path.join(projectDir, fileName)) : fs.writeFileSync(path.join(projectDir, fileName), content)
                    );
                    awaited = files;
                }, 1000);
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
