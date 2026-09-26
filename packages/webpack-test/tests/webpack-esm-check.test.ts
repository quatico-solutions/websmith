/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { CompilationProfile } from "@quatico/websmith-api";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { writeSourceFile } from "./test-files";

// Webpack runs in a separate Node process, like in webpack-esm-consumer.test.ts, and reports its stats as JSON lines.
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const uniqueId = `${testId}_${Date.now()}`;
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-${uniqueId}`);
    return {
        PROJECT_DIR,
        OUTPUT_DIR: path.join(PROJECT_DIR, "dist"),
        SOURCE_DIR: path.join(PROJECT_DIR, "src"),
        ADDONS_DIR: path.join(PROJECT_DIR, "addons"),
        NODE_DIR: path.join(PROJECT_DIR, "lib"),
    };
};

let testDirs: ReturnType<typeof getTestDirs>;

type Problem = { message: string; resource?: string };
type BuildReport = { errors: Problem[]; warnings: Problem[]; built: string[]; assets: string[] };
type RunOptions = {
    entry: Record<string, string>;
    /** webpack module type set on the loader rule, webpack decides by the resource path when absent */
    type?: string;
    devtool?: string;
    /** Files to write after each watch build, relative to the project; runs webpack once when absent */
    steps?: Record<string, string>[];
};

const REQUIRE_SOURCE = `declare const require: (id: string) => unknown;\nexport const x = require("node:path");\n`;
const DIRNAME_SOURCE = `declare const __dirname: string;\nexport const dir = __dirname;\n`;
const NODE_DEPENDENT = (): Record<string, CompilationProfile> => ({
    target: { depends: ["node"], tsConfig: { outDir: path.join(testDirs.PROJECT_DIR, "tsout") } },
    node: { tsConfig: { outDir: testDirs.NODE_DIR }, esm: { runtime: "node" } },
});

beforeEach(() => {
    testDirs = getTestDirs();

    fs.mkdirSync(testDirs.SOURCE_DIR, { recursive: true });
    writeSourceFile("package.json", JSON.stringify({ type: "module" }), testDirs.PROJECT_DIR);
    writeSourceFile(
        "tsconfig.json",
        JSON.stringify({
            compilerOptions: {
                target: "es2020",
                module: "esnext",
                rootDir: testDirs.SOURCE_DIR,
                outDir: path.join(testDirs.PROJECT_DIR, "tsout"),
                sourceMap: true,
            },
        }),
        testDirs.PROJECT_DIR
    );
});

afterEach(() => {
    fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader and ESM check", () => {
    it("reports error on second module and fails build w/ error in second module", () => {
        writeConfig({ target: { esm: { runtime: "bundler" } } });
        writeSources({ "a.ts": `import { x } from "./b";\nexport const y = x;\n`, "b.ts": REQUIRE_SOURCE });

        const [actual] = runWebpack({ entry: { main: "./src/a.ts" }, type: "javascript/esm" });

        expect(actual).toMatchObject({ exitCode: 1, errors: [{ message: expect.stringContaining("ESM91001"), resource: sourcePath("b.ts") }] });
    }, 60000);

    it("reports 91001 w/ addonEmitOnly and require in file no addon touched under javascript/esm rule", () => {
        writeConfig({ target: { esm: { runtime: "bundler" } } }, { addonEmitOnly: true });
        writeSources({ "a.ts": REQUIRE_SOURCE });

        const [actual] = runWebpack({ entry: { main: "./src/a.ts" }, type: "javascript/esm" });

        expect(actual.errors.map(cur => cur.message)).toEqual([expect.stringContaining("ESM91001")]);
    }, 60000);

    it("reports nothing w/ require in .ts module under module package and bundler runtime", () => {
        writeConfig({ target: { esm: { runtime: "bundler" } } });
        writeSources({ "a.ts": REQUIRE_SOURCE });

        const [actual] = runWebpack({ entry: { main: "./src/a.ts" } });

        expect(actual).toMatchObject({ exitCode: 0, errors: [], warnings: [] });
    }, 60000);

    it("reports warning and passes build w/ check warn", () => {
        writeConfig({ target: { esm: { runtime: "bundler", check: "warn" } } });
        writeSources({ "a.ts": REQUIRE_SOURCE });

        const [actual] = runWebpack({ entry: { main: "./src/a.ts" }, type: "javascript/esm" });

        expect(actual).toMatchObject({ exitCode: 0, errors: [], warnings: [{ message: expect.stringContaining("ESM91001") }] });
    }, 60000);

    it("reports only webpack's module not found w/ import of missing file in node dependent profile", () => {
        writeConfig(NODE_DEPENDENT());
        writeSources({ "a.ts": `import "./gone.js";\nexport const a = 1;\n` });

        const [actual] = runWebpack({ entry: { main: "./src/a.ts" } });

        expect(actual.errors.map(cur => cur.message)).toEqual([expect.stringContaining("Module not found")]);
    }, 60000);

    it("reports nothing w/ extensionless import under bundler runtime and javascript/esm rule", () => {
        writeConfig({ target: { esm: { runtime: "bundler" } } });
        writeSources({ "a.ts": `import { b } from "./b";\nexport const a = b;\n`, "b.ts": `export const b = 1;\n` });

        const [actual] = runWebpack({ entry: { main: "./src/a.ts" }, type: "javascript/esm" });

        expect(actual).toMatchObject({ exitCode: 0, errors: [], warnings: [] });
    }, 60000);

    it("reports diagnostic naming loader-activated transformer addon that injected require", () => {
        writeConfig({ target: { esm: { runtime: "bundler" } } }, { addonsDir: testDirs.ADDONS_DIR, addons: ["require-injector"] });
        writeRequireInjectorAddon();
        writeSources({ "a.ts": `export const a = 1;\n` });

        const [actual] = runWebpack({ entry: { main: "./src/a.ts" }, type: "javascript/esm" });

        expect(actual.errors.map(cur => cur.message)).toEqual([expect.stringMatching(/ESM91001: .*addons: require-injector/)]);
    }, 60000);

    it("builds .mts and .cts entries with attached source map and no .mjs.map asset", () => {
        writeConfig({ target: {} });
        writeSources({ "m.mts": `export const m = "mts-output";\n`, "c.cts": `export const c = "cts-output";\n` });

        const [{ exitCode, errors, assets }] = runWebpack({ entry: { m: "./src/m.mts", c: "./src/c.cts" }, devtool: "source-map" });
        const actual = {
            exitCode,
            errors,
            tsSourceMapAssets: assets.filter(cur => /\.[cm]js\.map$/.test(cur)),
            // TypeScript's source map names the source relative to its outDir, webpack's own relative to the context
            sourceMap: fs.readFileSync(path.join(testDirs.OUTPUT_DIR, "m.js.map"), "utf-8"),
        };

        expect(actual).toMatchObject({
            exitCode: 0,
            errors: [],
            tsSourceMapAssets: [],
            sourceMap: expect.stringContaining('"webpack:///../src/m.mts"'),
        });
    }, 60000);
});

describe("webpack watch w/ websmith-loader and ESM check", () => {
    it("rebuilds exactly the edited leaf module", () => {
        writeConfig({ target: { esm: { runtime: "bundler" } } });
        writeSources({ "a.ts": `import { b } from "./b.js";\nexport const a = b;\n`, "b.ts": `export const b = 1;\n` });

        const actual = runWebpack({ entry: { main: "./src/a.ts" }, steps: [{ "src/b.ts": `export const b = 2;\n` }] }).map(cur => cur.built);

        expect(actual[1]).toEqual([sourcePath("b.ts")]);
    }, 60000);

    it("rebuilds both modules and flips their diagnostics w/ type flip in package.json of node dependent output", () => {
        writeConfig(NODE_DEPENDENT());
        writeSourceFile("package.json", JSON.stringify({ type: "module" }), testDirs.NODE_DIR);
        writeSources({
            "a.ts": `import { dir } from "./b.js";\ndeclare const __dirname: string;\nexport const a = dir + __dirname;\n`,
            "b.ts": DIRNAME_SOURCE,
        });

        const actual = runWebpack({ entry: { main: "./src/a.ts" }, steps: [{ "lib/package.json": JSON.stringify({ type: "commonjs" }) }] }).map(
            cur => ({
                built: cur.built.sort(),
                codes: cur.errors.map(err => err.message.match(/ESM\d+/)?.[0]).sort(),
            })
        );

        expect(actual).toEqual([
            { built: [sourcePath("a.ts"), sourcePath("b.ts")], codes: ["ESM91003", "ESM91003"] },
            { built: [sourcePath("a.ts"), sourcePath("b.ts")], codes: ["ESM91031", "ESM91031"] },
        ]);
    }, 60000);

    it("rebuilds only module in sub directory w/ package.json created there in node dependent output", () => {
        writeConfig(NODE_DEPENDENT());
        writeSources({ "a.ts": `import { s } from "./sub/s.js";\nexport const a = s;\n`, "sub/s.ts": `export const s = 1;\n` });

        const actual = runWebpack({ entry: { main: "./src/a.ts" }, steps: [{ "lib/sub/package.json": JSON.stringify({ type: "commonjs" }) }] }).map(
            cur => cur.built
        );

        expect(actual[1]).toEqual([sourcePath("sub/s.ts")]);
    }, 60000);
});

const sourcePath = (fileName: string): string => path.join(testDirs.SOURCE_DIR, fileName);

const writeSources = (files: Record<string, string>) =>
    Object.entries(files).forEach(([fileName, content]) => writeSourceFile(fileName, content, testDirs.SOURCE_DIR));

const writeConfig = (profiles: Record<string, CompilationProfile>, config: Record<string, unknown> = {}) =>
    writeSourceFile("websmith.config.json", JSON.stringify({ ...config, profiles }), testDirs.PROJECT_DIR);

const writeRequireInjectorAddon = () =>
    writeSourceFile(
        "require-injector/addon.ts",
        `
            import ts from "typescript";
            export const activate = (ctx: any): void => {
                ctx.registerTransformer({
                    before: [
                        () => (file: ts.SourceFile) =>
                            ts.factory.updateSourceFile(file, [
                                ...file.statements,
                                ts.factory.createExpressionStatement(
                                    ts.factory.createCallExpression(ts.factory.createIdentifier("require"), undefined, [ts.factory.createStringLiteral("injected")])
                                ),
                            ]),
                    ],
                });
            };
        `,
        testDirs.ADDONS_DIR
    );

const runWebpack = ({ entry, type, devtool, steps }: RunOptions): (BuildReport & { exitCode: number | null })[] => {
    const script = `
        const fs = require("node:fs");
        const path = require("node:path");
        const webpack = require(${JSON.stringify(require.resolve("webpack"))});
        const projectDir = ${JSON.stringify(testDirs.PROJECT_DIR)};
        const steps = ${JSON.stringify(steps ?? null)};
        const compiler = webpack({
            mode: "development",
            devtool: ${JSON.stringify(devtool ?? false)},
            target: "node",
            context: projectDir,
            entry: ${JSON.stringify(entry)},
            output: { path: ${JSON.stringify(testDirs.OUTPUT_DIR)} },
            resolve: { extensions: [".ts", ".mts", ".cts", ".js"], extensionAlias: { ".js": [".ts", ".js"] } },
            module: {
                rules: [
                    {
                        test: /\\.[cm]?ts$/,
                        ${type ? `type: ${JSON.stringify(type)},` : ""}
                        use: [
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
        const describe = cur => ({ message: cur.message, resource: cur.module && cur.module.resource });
        const report = stats => {
            const { compilation } = stats;
            console.log("RESULT " + JSON.stringify({
                errors: compilation.errors.map(describe),
                warnings: compilation.warnings.map(describe),
                built: [...compilation.modules].filter(cur => compilation.builtModules.has(cur)).map(cur => cur.resource).filter(Boolean),
                assets: Object.keys(compilation.assets),
            }));
        };
        if (!steps) {
            compiler.run((err, stats) => {
                if (err) {
                    console.error(err);
                    process.exitCode = 2;
                } else {
                    report(stats);
                    process.exitCode = stats.hasErrors() ? 1 : 0;
                }
                compiler.close(() => undefined);
            });
        } else {
            let step = 0;
            let watchdog;
            const watching = compiler.watch({ aggregateTimeout: 100 }, (err, stats) => {
                if (err) {
                    console.error(err);
                    process.exitCode = 2;
                    return watching.close(() => undefined);
                }
                report(stats);
                clearTimeout(watchdog);
                const files = steps[step++];
                if (!files) {
                    return watching.close(() => undefined);
                }
                // Let the watcher settle, so the write is seen as a change after this build; stop when it triggers none
                clearTimeout(watchdog);
                watchdog = setTimeout(() => watching.close(() => undefined), 10000);
                setTimeout(() => {
                    Object.entries(files).forEach(([fileName, content]) => {
                        const filePath = path.join(projectDir, fileName);
                        fs.mkdirSync(path.dirname(filePath), { recursive: true });
                        fs.writeFileSync(filePath, content);
                    });
                }, 1000);
            });
        }
    `;
    const scriptPath = path.join(testDirs.PROJECT_DIR, "run-webpack.cjs");
    fs.writeFileSync(scriptPath, script, { encoding: "utf-8" });

    const result = spawnSync(process.execPath, [scriptPath], { cwd: testDirs.PROJECT_DIR, encoding: "utf-8", timeout: 50000 });
    const reports = result.stdout
        .split("\n")
        .filter(cur => cur.startsWith("RESULT "))
        .map(cur => ({ ...(JSON.parse(cur.slice("RESULT ".length)) as BuildReport), exitCode: result.status }));
    if (reports.length === 0) {
        throw new Error(`webpack reported no build: ${result.stdout}${result.stderr}`);
    }
    return reports;
};
