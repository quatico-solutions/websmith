/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "node:fs";
import path from "node:path";
import { type BuildReport, type RunOptions, runWebpack as runWebpackIn } from "./run-webpack";
import { writeSourceFile } from "./test-files";

const getProjectDir = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    return path.resolve(__dirname, "..", `test-output-${testId}_${Date.now()}`);
};

let projectDir: string;

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

    it("emits new processor output of edited asset dependency", () => {
        writeTsConfig({});
        writeSourceFile("websmith.config.json", JSON.stringify({ addonsDir: "./addons", profiles: { target: { addons: ["datap"] } } }), projectDir);
        writeSourceFile(
            "addons/datap/addon.js",
            `
                const fs = require("node:fs");
                const data = ${JSON.stringify(path.join(projectDir, "data.txt"))};
                exports.activate = ctx => ctx.registerProcessor((file, content) => {
                    ctx.addAssetDependency(data, file);
                    return content.replaceAll("DATA_IN", fs.readFileSync(data, "utf-8"));
                });
            `,
            projectDir
        );
        writeSourceFile("data.txt", "DATA1", projectDir);
        writeSourceFile("src/a.ts", `export const greeting: string = "DATA_IN";\n`, projectDir);

        const actual = runWebpack({
            config: singleRule({ profile: "target", transpileOnly: false }),
            outputs: ["dist/main.js"],
            steps: [{ "data.txt": "DATA2" }],
        }).map(cur => cur.outputs["dist/main.js"].match(/DATA\d/)?.[0]);

        expect(actual).toEqual(["DATA1", "DATA2"]);
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

const runWebpack = (options: RunOptions): BuildReport[] => runWebpackIn(projectDir, options);
