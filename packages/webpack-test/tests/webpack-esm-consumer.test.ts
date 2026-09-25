/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { getOutput as getOutputBase, writeSourceFile, writeTsConfig } from "./test-files";

// Webpack runs in a separate Node process: Jest's own require ignores "type": "module" and would hide the failure.
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const uniqueId = `${testId}_${Date.now()}`;
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-${uniqueId}`);
    const OUTPUT_DIR = path.resolve(PROJECT_DIR, "dist");
    const SOURCE_DIR = path.join(PROJECT_DIR, "src");
    const ADDONS_DIR = path.join(PROJECT_DIR, "addons");
    return { PROJECT_DIR, OUTPUT_DIR, SOURCE_DIR, ADDONS_DIR };
};

let testDirs: ReturnType<typeof getTestDirs>;

const getOutput = (filePath: string) => getOutputBase(filePath, testDirs.OUTPUT_DIR);

beforeEach(() => {
    testDirs = getTestDirs();

    fs.mkdirSync(testDirs.OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(testDirs.SOURCE_DIR, { recursive: true });
    fs.copyFileSync(path.join(__dirname, "..", "src", "foobar-function.ts"), path.join(testDirs.SOURCE_DIR, "foobar-function.ts"));
    writeSourceFile("package.json", JSON.stringify({ type: "module" }), testDirs.PROJECT_DIR);
    writeTsConfig({ target: ts.ScriptTarget.ES2020, outDir: testDirs.OUTPUT_DIR }, testDirs.PROJECT_DIR);
    writeEsmAddons();
});

afterEach(() => {
    fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader and consumer package.json type module", () => {
    it("should apply .ts addon", () => {
        const log = runWebpack(["esm-processor"]);
        const actual = { mainJs: getOutput("main.js"), log };

        expect(actual).toMatchObject({ mainJs: expect.stringContaining("function esmProcessed(date)") });
    }, 60000);

    it("should apply multi-file .ts addon with cross-addon import", () => {
        const log = runWebpack(["esm-cross-processor"]);
        const actual = { mainJs: getOutput("main.js"), log };

        expect(actual).toMatchObject({ mainJs: expect.stringContaining("function crossAddonProcessed(date)") });
    }, 60000);

    it("should apply .ts addon importing package with types only under package.json exports", () => {
        writeExportsOnlyPackage();

        const log = runWebpack(["exports-only-processor"]);
        const actual = { mainJs: getOutput("main.js"), log };

        expect(actual).toMatchObject({ mainJs: expect.stringContaining("function exportsOnlyProcessed(date)") });
    }, 60000);

    it("should warn about unresolved package with types only under package.json exports", () => {
        writeExportsOnlyPackage();

        const actual = runWebpack(["exports-only-processor"]);

        expect(actual).toMatch(/WARN.*Cannot find module 'exports-only-package'/);
    }, 60000);
});

const writeExportsOnlyPackage = () => {
    const packageDir = path.join(testDirs.PROJECT_DIR, "node_modules", "exports-only-package");
    writeSourceFile(
        "package.json",
        JSON.stringify({ name: "exports-only-package", exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } } }),
        packageDir
    );
    writeSourceFile("dist/index.js", 'exports.REPLACEMENT = "exportsOnlyProcessed";', packageDir);
    writeSourceFile("dist/index.d.ts", "export declare const REPLACEMENT: string;", packageDir);
};

const writeEsmAddons = () => {
    const addonFiles: Record<string, string> = {
        "esm-processor/addon.ts": `
            export const replaceFoobar = (content: string, replacement: string): string => content.replace(/foobar/g, replacement);
            export const activate = (ctx: any): void => {
                ctx.registerProcessor((_fileName: string, content: string) => replaceFoobar(content, "esmProcessed"));
            };
        `,
        "esm-cross-processor/addon.ts": `
            import { replaceFoobar } from "../esm-processor/addon";
            import { REPLACEMENT } from "./replacement";
            export const activate = (ctx: any): void => {
                ctx.registerProcessor((_fileName: string, content: string) => replaceFoobar(content, REPLACEMENT));
            };
        `,
        "esm-cross-processor/replacement.ts": `export const REPLACEMENT = "crossAddonProcessed";`,
        "exports-only-processor/addon.ts": `
            import { REPLACEMENT } from "exports-only-package";
            import { replaceFoobar } from "../esm-processor/addon";
            export const activate = (ctx: any): void => {
                ctx.registerProcessor((_fileName: string, content: string) => replaceFoobar(content, REPLACEMENT));
            };
        `,
    };
    for (const [fileName, content] of Object.entries(addonFiles)) {
        writeSourceFile(fileName, content, testDirs.ADDONS_DIR);
    }
};

const runWebpack = (addons: string[]): string => {
    const script = `
        const webpack = require(${JSON.stringify(require.resolve("webpack"))});
        webpack(
            {
                mode: "development",
                devtool: false,
                target: "node",
                entry: ${JSON.stringify(path.join(testDirs.SOURCE_DIR, "foobar-function.ts"))},
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
                                        transpileOnly: true,
                                        tsConfigFile: ${JSON.stringify(path.join(testDirs.PROJECT_DIR, "tsconfig.json"))},
                                        config: { addonsDir: ${JSON.stringify(testDirs.ADDONS_DIR)}, addons: ${JSON.stringify(addons)} },
                                    },
                                },
                            ],
                        },
                    ],
                },
            },
            (err, stats) => {
                if (err || stats.hasErrors()) {
                    console.error(err ?? stats.toString("errors-only"));
                    process.exitCode = 1;
                }
            }
        );
    `;
    const scriptPath = path.join(testDirs.PROJECT_DIR, "run-webpack.cjs");
    fs.writeFileSync(scriptPath, script, { encoding: "utf-8" });

    const result = spawnSync(process.execPath, [scriptPath], { cwd: testDirs.PROJECT_DIR, encoding: "utf-8", timeout: 50000 });
    return `${result.stdout}${result.stderr}`;
};
