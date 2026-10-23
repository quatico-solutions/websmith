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

// Webpack runs in a separate Node process, like in webpack-loader-package-type.test.ts, and reports each compilation as a
// JSON line.
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-${testId}_${Date.now()}`);
    return { PROJECT_DIR, OUTPUT_DIR: path.join(PROJECT_DIR, "dist"), SOURCE_DIR: path.join(PROJECT_DIR, "src") };
};

let testDirs: ReturnType<typeof getTestDirs>;

type BuildReport = {
    /** The modules the compilation built, relative to the project. */
    built: string[];
    /** The messages of the compilation's errors. */
    errors: string[];
    /** The files in the build snapshot of the main.ts module, relative to the project. */
    dependencies: string[];
};
type RunOptions = {
    transpileOnly?: boolean;
    /** Files to write one after the other after the first watch build, relative to the project; runs webpack once when empty. */
    edits?: Record<string, string>[];
};

const MAIN = [
    `import type { Make } from "./types";`,
    `import { b } from "./b";`,
    `declare const make: Make;`,
    `export const v = make();`,
    `export const w = b;`,
    ``,
].join("\n");
const GOOD = `export interface Hidden { a: number }\nexport type Make = () => Hidden;\n`;
const BAD = `interface Hidden { a: number }\nexport type Make = () => Hidden;\n`;
const DECLARATION_ERROR = "has or is using name 'Hidden'";

beforeEach(() => {
    testDirs = getTestDirs();
    writeSourceFile("main.ts", MAIN, testDirs.SOURCE_DIR);
    writeSourceFile("types.ts", GOOD, testDirs.SOURCE_DIR);
    writeSourceFile("b.ts", "export const b = 1;\n", testDirs.SOURCE_DIR);
    writeSourceFile("websmith.config.json", JSON.stringify({ profiles: { target: {} } }), testDirs.PROJECT_DIR);
    writeSourceFile(
        "tsconfig.json",
        JSON.stringify({
            compilerOptions: {
                target: "es2020",
                module: "esnext",
                moduleResolution: "bundler",
                strict: true,
                declaration: true,
                rootDir: "src",
                outDir: "tsout",
            },
        }),
        testDirs.PROJECT_DIR
    );
});

afterEach(() => {
    fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader and type-only import", () => {
    it("should report declaration error on importer w/ edit of type-only import under watch", () => {
        const [, actual] = runWebpack({ edits: [{ "src/types.ts": BAD }] });

        expect(actual.built).toContain(path.join("src", "main.ts"));
        expect(actual.errors.join("\n")).toContain(DECLARATION_ERROR);
    }, 90000);

    it("should clear declaration error w/ revert of type-only import under watch", () => {
        const [, , actual] = runWebpack({ edits: [{ "src/types.ts": BAD }, { "src/types.ts": GOOD }] });

        expect(actual.built).toContain(path.join("src", "main.ts"));
        expect(actual.errors).toEqual([]);
    }, 90000);

    it("should rebuild importer w/ edit of type re-exported through barrel under watch", () => {
        writeSourceFile("main.ts", MAIN.replace(`from "./types"`, `from "./barrel"`), testDirs.SOURCE_DIR);
        writeSourceFile("barrel.ts", `export * from "./types";\n`, testDirs.SOURCE_DIR);

        const [, actual] = runWebpack({ edits: [{ "src/types.ts": BAD }] });

        expect(actual.built).toContain(path.join("src", "main.ts"));
        expect(actual.errors.join("\n")).toContain(DECLARATION_ERROR);
    }, 90000);

    it("should register no type dependency w/ transpileOnly", () => {
        const [actual] = runWebpack({ transpileOnly: true });

        expect(actual.dependencies).not.toContain(path.join("src", "types.ts"));
    }, 90000);

    it("should register no node_modules or lib file as dependency", () => {
        writeSourceFile(
            "main.ts",
            `${MAIN}import type { ScriptTarget } from "typescript";\nexport const t: ScriptTarget | undefined = undefined;\n`,
            testDirs.SOURCE_DIR
        );

        const [actual] = runWebpack({});

        expect(actual.dependencies).toContain(path.join("src", "types.ts"));
        expect(actual.dependencies.filter(cur => cur.includes("node_modules"))).toEqual([]);
    }, 90000);
});

const runWebpack = ({ transpileOnly = false, edits = [] }: RunOptions): BuildReport[] => {
    const builds = edits.length + 1;
    const script = `
        const fs = require("node:fs");
        const path = require("node:path");
        const webpack = require(${JSON.stringify(require.resolve("webpack"))});
        const projectDir = ${JSON.stringify(testDirs.PROJECT_DIR)};
        const moduleFile = path.join(projectDir, "src", "main.ts");
        const edits = ${JSON.stringify(edits)};
        const compiler = webpack({
            mode: "development",
            devtool: false,
            target: "node",
            context: projectDir,
            entry: { main: "./src/main.ts" },
            output: { path: ${JSON.stringify(testDirs.OUTPUT_DIR)} },
            resolve: { extensions: [".ts", ".js"] },
            module: {
                rules: [
                    {
                        test: /\\.ts$/,
                        use: [
                            {
                                loader: ${JSON.stringify(require.resolve("websmith-loader"))},
                                options: {
                                    transpileOnly: ${transpileOnly},
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
        const relative = files => [...(files || [])].map(cur => path.relative(projectDir, cur)).sort();
        const report = stats => {
            const { compilation } = stats;
            const module = [...compilation.modules].find(cur => cur.resource === moduleFile);
            const snapshot = module && module.buildInfo && module.buildInfo.snapshot;
            console.log("RESULT " + JSON.stringify({
                built: relative([...compilation.modules].filter(cur => compilation.builtModules.has(cur)).map(cur => cur.resource).filter(Boolean)),
                errors: compilation.errors.map(cur => cur.message),
                // webpack moves a module's file dependencies into its snapshot and clears them after the build
                dependencies: relative(snapshot && snapshot.getFileIterable()),
            }));
        };
        if (edits.length === 0) {
            compiler.run((err, stats) => {
                if (err) {
                    console.error(err);
                    process.exitCode = 2;
                } else {
                    report(stats);
                }
                compiler.close(() => undefined);
            });
        } else {
            let watchdog;
            let next = 0;
            let awaited = null;
            const editNext = () => {
                const edit = edits[next++];
                const files = Object.keys(edit).map(fileName => path.join(projectDir, fileName));
                watchdog = setTimeout(() => {
                    console.error("no compilation with " + files.join(", ") + " within 25000ms");
                    process.exitCode = 2;
                    watching.close(() => undefined);
                }, 25000);
                // Let the watcher settle, so the write is seen as a change after this build; only then is a compilation awaited
                setTimeout(() => {
                    Object.entries(edit).forEach(([fileName, content]) => fs.writeFileSync(path.join(projectDir, fileName), content));
                    awaited = files;
                }, 1000);
            };
            const watching = compiler.watch({ aggregateTimeout: 100 }, (err, stats) => {
                if (err) {
                    console.error(err);
                    process.exitCode = 2;
                    return watching.close(() => undefined);
                }
                const modified = compiler.modifiedFiles || new Set();
                if (next > 0 && (!awaited || !awaited.every(cur => modified.has(cur)))) {
                    return;
                }
                clearTimeout(watchdog);
                awaited = null;
                report(stats);
                if (next < edits.length) {
                    editNext();
                } else {
                    watching.close(() => undefined);
                }
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
