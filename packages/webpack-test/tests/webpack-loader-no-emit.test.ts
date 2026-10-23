/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { writeSourceFile, writeWebsmithConfig } from "./test-files";

// Webpack runs in a separate Node process with the project as working directory: the loader's default outDir is ./lib
// of the working directory, so a file written there shows up in the project
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-no-emit-${testId}_${Date.now()}`);
    return { PROJECT_DIR, BUNDLE_DIR: path.join(PROJECT_DIR, "bundle"), SOURCE_DIR: path.join(PROJECT_DIR, "src") };
};

// The compilerOptions of create-vite's tsconfig.app.json, without types: ["vite/client"], which is not installed here
const VITE_TEMPLATE_OPTIONS = {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "bundler",
    allowImportingTsExtensions: true,
    verbatimModuleSyntax: true,
    noEmit: true,
    strict: true,
    skipLibCheck: true,
};

const REPLACER_ADDON = `module.exports = { activate: ctx => ctx.registerProcessor((_fileName, content) => content.replaceAll("MARK_IN", "MARK_OUT")) };`;

// Both modules changed by the addon, none left unchanged
const BUNDLED_ADDON_OUTPUT = /^(?![\s\S]*MARK_IN)(?=[\s\S]*MARK_OUT main)(?=[\s\S]*MARK_OUT dep)/;

let testDirs: ReturnType<typeof getTestDirs>;

beforeEach(() => {
    testDirs = getTestDirs();

    writeSourceFile("main.ts", `import { dep } from "./dep.ts";\nexport const main: string = "MARK_IN main " + dep;\n`, testDirs.SOURCE_DIR);
    writeSourceFile("dep.ts", `export const dep: string = "MARK_IN dep";\n`, testDirs.SOURCE_DIR);
    writeSourceFile("addons/replacer/addon.js", REPLACER_ADDON, testDirs.PROJECT_DIR);
    writeWebsmithConfig({ addonsDir: "./addons", profiles: { app: { addons: ["replacer"] } } }, testDirs.PROJECT_DIR);
});

afterEach(() => {
    fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader and noEmit", () => {
    it.each([false, true])(
        "should bundle addon output and write no file w/ noEmit and allowImportingTsExtensions w/ transpileOnly %s",
        transpileOnly => {
            writeTsConfig(VITE_TEMPLATE_OPTIONS);
            const expected = listProjectFiles();

            const actual = runWebpack({ transpileOnly });

            expect(actual.exitCode).toBe(0);
            expect(actual.output).not.toMatch(/5011/);
            expect(readBundle()).toMatch(BUNDLED_ADDON_OUTPUT);
            expect(listProjectFiles()).toEqual(expected);
        },
        60000
    );

    it("should bundle addon output w/o TS5096 and w/o declaration asset w/ noEmit, allowImportingTsExtensions and declaration", () => {
        writeTsConfig({ ...VITE_TEMPLATE_OPTIONS, declaration: true });
        const expected = listProjectFiles();

        const actual = runWebpack({ transpileOnly: false });

        expect(actual.exitCode).toBe(0);
        expect(actual.output).not.toMatch(/5096|allowImportingTsExtensions/);
        expect(readBundle()).toMatch(BUNDLED_ADDON_OUTPUT);
        expect(listFiles(testDirs.BUNDLE_DIR).filter(cur => cur.endsWith(".d.ts"))).toEqual([]);
        expect(listProjectFiles()).toEqual(expected);
    }, 60000);

    it("should bundle addon output and write declarations only w/ emitDeclarationOnly and declaration", () => {
        writeTsConfig({
            ...VITE_TEMPLATE_OPTIONS,
            noEmit: undefined,
            emitDeclarationOnly: true,
            declaration: true,
            outDir: "./types",
            rootDir: "./src",
        });

        const actual = runWebpack({ transpileOnly: false });

        expect(actual.exitCode).toBe(0);
        expect(readBundle()).toMatch(BUNDLED_ADDON_OUTPUT);
        expect(fs.existsSync(path.join(testDirs.PROJECT_DIR, "types", "main.d.ts"))).toBe(true);
        expect(fs.existsSync(path.join(testDirs.PROJECT_DIR, "types", "main.js"))).toBe(false);
    }, 60000);

    it("should bundle addon output w/ emitDeclarationOnly and transpileOnly", () => {
        writeTsConfig({
            ...VITE_TEMPLATE_OPTIONS,
            noEmit: undefined,
            emitDeclarationOnly: true,
            declaration: true,
            outDir: "./types",
            rootDir: "./src",
        });

        const actual = runWebpack({ transpileOnly: true });

        expect(actual.exitCode).toBe(0);
        expect(readBundle()).toMatch(BUNDLED_ADDON_OUTPUT);
        expect(fs.existsSync(path.join(testDirs.PROJECT_DIR, "types", "main.js"))).toBe(false);
    }, 60000);

    it("should keep the dependent profile's output in its outDir w/ noEmit in the webpack profile", () => {
        writeTsConfig(VITE_TEMPLATE_OPTIONS);
        writeWebsmithConfig(
            {
                addonsDir: "./addons",
                profiles: {
                    app: { depends: ["lib"], addons: ["replacer"], tsConfig: { noEmit: true } },
                    lib: { tsConfig: { noEmit: false, allowImportingTsExtensions: false, outDir: "./lib-out", rootDir: "./src" } },
                },
            },
            testDirs.PROJECT_DIR
        );

        const actual = runWebpack({ transpileOnly: false });

        expect(actual.exitCode).toBe(0);
        expect(readBundle()).toMatch(BUNDLED_ADDON_OUTPUT);
        expect(fs.readFileSync(path.join(testDirs.PROJECT_DIR, "lib-out", "main.js"), "utf-8")).not.toContain("MARK_OUT");
    }, 60000);

    it("should bundle addon output w/ noEmit, noEmitOnError and .ts imports", () => {
        writeTsConfig({ ...VITE_TEMPLATE_OPTIONS, noEmitOnError: true });
        const expected = listProjectFiles();

        const actual = runWebpack({ transpileOnly: false });

        expect(actual.exitCode).toBe(0);
        expect(readBundle()).toMatch(BUNDLED_ADDON_OUTPUT);
        expect(listProjectFiles()).toEqual(expected);
    }, 60000);
});

const writeTsConfig = (compilerOptions: Record<string, unknown>): void =>
    writeSourceFile("tsconfig.json", JSON.stringify({ compilerOptions, include: ["src"] }), testDirs.PROJECT_DIR);

const listFiles = (dir: string): string[] =>
    fs.existsSync(dir)
        ? fs
              .readdirSync(dir, { recursive: true, withFileTypes: true })
              .flatMap(cur => (cur.isFile() ? [path.relative(testDirs.PROJECT_DIR, path.join(cur.parentPath, cur.name))] : []))
              .sort()
        : [];

// Every file of the project outside webpack's output directory, with the script that runs webpack
const listProjectFiles = (): string[] =>
    [...new Set([...listFiles(testDirs.PROJECT_DIR).filter(cur => !cur.startsWith(`bundle${path.sep}`)), "run-webpack.cjs"])].sort();

const readBundle = (): string => fs.readFileSync(path.join(testDirs.BUNDLE_DIR, "main.js"), "utf-8");

const runWebpack = ({ transpileOnly }: { transpileOnly: boolean }): { exitCode: number | null; output: string } => {
    const loaderOptions = {
        transpileOnly,
        tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
        configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
        profile: "app",
    };
    const script = `
        const webpack = require(${JSON.stringify(require.resolve("webpack"))});
        webpack(
            {
                mode: "development",
                devtool: false,
                target: "node",
                entry: { main: ${JSON.stringify(path.join(testDirs.SOURCE_DIR, "main.ts"))} },
                output: { path: ${JSON.stringify(testDirs.BUNDLE_DIR)} },
                resolve: { extensions: [".ts", ".js"] },
                module: {
                    rules: [
                        {
                            test: /\\.ts$/,
                            use: [{ loader: ${JSON.stringify(require.resolve("websmith-loader"))}, options: ${JSON.stringify(loaderOptions)} }],
                        },
                    ],
                },
            },
            (err, stats) => {
                if (err || stats.hasErrors()) {
                    console.error(err ?? stats.toString("errors-only"));
                    process.exitCode = 1;
                } else if (stats.hasWarnings()) {
                    console.warn(stats.toString("errors-warnings"));
                }
            }
        );
    `;
    const scriptPath = path.join(testDirs.PROJECT_DIR, "run-webpack.cjs");
    fs.writeFileSync(scriptPath, script, { encoding: "utf-8" });

    const result = spawnSync(process.execPath, [scriptPath], { cwd: testDirs.PROJECT_DIR, encoding: "utf-8", timeout: 50000 });
    return { exitCode: result.status, output: `${result.stdout}${result.stderr}` };
};
