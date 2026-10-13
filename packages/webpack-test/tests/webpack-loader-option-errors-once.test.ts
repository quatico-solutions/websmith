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

// Webpack runs in a separate Node process, like in webpack-profile-config.test.ts
const getProjectDir = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    return path.resolve(__dirname, "..", `test-output-option-errors-${testId}_${Date.now()}`);
};

let projectDir: string;
// TS5053 prefix; the loader reports TypeScript's message without its code
const OPTION_ERROR = "Option 'reactNamespace' cannot be specified with option 'jsxFactory'";

beforeEach(() => {
    projectDir = getProjectDir();
    // TS5053: jsxFactory excludes reactNamespace, an option error every module of the fast path returns on TypeScript 5 and 6
    writeSourceFile(
        "tsconfig.json",
        JSON.stringify({
            compilerOptions: {
                target: "es2020",
                module: "commonjs",
                jsx: "react",
                jsxFactory: "h",
                reactNamespace: "R",
                rootDir: "src",
                outDir: "tsout",
            },
        }),
        projectDir
    );
    writeSourceFile("websmith.config.json", JSON.stringify({ profiles: { one: {}, two: {} } }), projectDir);
    writeSourceFile("src/index.ts", `import { a } from "./one/a";\nimport { b } from "./two/b";\nexport const main = [a, b];\n`, projectDir);
    writeSourceFile("src/one/a.ts", `export const a = 1;\n`, projectDir);
    writeSourceFile("src/two/b.ts", `export const b = 2;\n`, projectDir);
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader and an invalid tsconfig.json option", () => {
    it("should fail w/ option error once w/ one loader rule over three modules", () => {
        const actual = runWebpack(`[{ test: /\\.ts$/, use: [{ loader, options: loaderOptions("one") }] }]`);

        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, OPTION_ERROR)).toBe(1);
    }, 60000);

    it("should fail w/ option error once w/ two loader rules in one compiler", () => {
        const actual = runWebpack(`[
            { test: /\\.ts$/, include: [path.join(projectDir, "src", "two")], use: [{ loader, options: loaderOptions("two") }] },
            { test: /\\.ts$/, exclude: [path.join(projectDir, "src", "two")], use: [{ loader, options: loaderOptions("one") }] },
        ]`);

        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, OPTION_ERROR)).toBe(1);
    }, 60000);

    it("should fail w/ option error once w/ thread-loader and one worker", () => {
        const actual = runWebpack(
            `[{ test: /\\.ts$/, use: [{ loader: threadLoader, options: { workers: 1 } }, { loader, options: loaderOptions("one") }] }]`
        );

        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, OPTION_ERROR)).toBe(1);
    }, 60000);
});

/** Runs webpack with `rules`, a JavaScript expression with `projectDir`, `loader`, `threadLoader` and `loaderOptions` in scope. */
const runWebpack = (rules: string): { exitCode: number | null; output: string } => {
    const script = `
        const path = require("node:path");
        const webpack = require(${JSON.stringify(require.resolve("webpack"))});
        const projectDir = ${JSON.stringify(projectDir)};
        const loader = ${JSON.stringify(require.resolve("websmith-loader"))};
        const threadLoader = ${JSON.stringify(require.resolve("thread-loader"))};
        const loaderOptions = profile => ({
            transpileOnly: true,
            tsConfigFile: path.join(projectDir, "tsconfig.json"),
            configFile: path.join(projectDir, "websmith.config.json"),
            profile,
        });
        webpack(
            {
                mode: "development",
                devtool: false,
                target: "node",
                context: projectDir,
                entry: { main: "./src/index.ts" },
                output: { path: path.join(projectDir, "dist") },
                resolve: { extensions: [".ts", ".js"] },
                module: { rules: ${rules} },
            },
            (err, stats) => {
                if (err || stats.hasErrors()) {
                    console.error(err ?? stats.toString("errors-only"));
                    process.exitCode = 1;
                }
            }
        );
    `;
    const scriptPath = path.join(projectDir, "run-webpack.cjs");
    fs.writeFileSync(scriptPath, script, { encoding: "utf-8" });

    const result = spawnSync(process.execPath, [scriptPath], { cwd: projectDir, encoding: "utf-8", timeout: 50000 });
    return { exitCode: result.status, output: `${result.stdout}${result.stderr}` };
};

const countOf = (text: string, part: string): number => text.split(part).length - 1;
