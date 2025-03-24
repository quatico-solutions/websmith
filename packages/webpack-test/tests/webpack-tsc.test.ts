/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { webpack } from "@quatico/websmith-node";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const OUTPUT_DIR = path.join(__dirname, "..", "lib");
const SOURCE_DIR = path.join(__dirname, "..", "src");

const webpackDefaults = {
    output: {
        path: OUTPUT_DIR,
    },
    module: {
        rules: [
            {
                test: /\.[jt]s?$/,
                loader: require.resolve("ts-loader"),
                options: {
                    transpileOnly: true,
                    configFile: path.join(__dirname, "..", "tsconfig.json"),
                },
            },
        ],
    },
};

beforeAll(() => {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
});

afterEach(() => {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
});

describe("webpack w/ ts-loader", () => {
    it("should build foobar-arrow.js with ES2020 target", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: {
                compilerOptions: {
                    target: ts.ScriptTarget.ES2020,
                },
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8")).toMatchSnapshot();
    });

    it("should build foobar-function.js with ES2020 target", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: {
                compilerOptions: {
                    target: ts.ScriptTarget.ES2020,
                },
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8")).toMatchSnapshot();
    });

    it("should build foobar-arrow.js with ES5 target", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: {
                compilerOptions: {
                    target: ts.ScriptTarget.ES5,
                },
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8")).toMatchSnapshot();
    });

    it("should build foobar-function.js with ES5 target", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: {
                compilerOptions: {
                    target: ts.ScriptTarget.ES5,
                },
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "main.js"), "utf-8")).toMatchSnapshot();
    });

    it("should build foobar-arrow.js with ESNEXT and ESM target", async () => {
        await webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: {
                ...webpackDefaults,
                experiments: {
                    outputModule: true,
                },
                target: "node",
            },
            tsLoader: {
                compilerOptions: {
                    target: ts.ScriptTarget.ESNext,
                    module: ts.ModuleKind.ESNext,
                },
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "main.mjs"), "utf-8")).toMatchSnapshot();
    });

    it("should throw error with transpileOnly false", async () => {
        await expect(() =>
            webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
                webpack: { ...webpackDefaults },
                tsLoader: {
                    compilerOptions: {
                        target: ts.ScriptTarget.ES2020,
                    },
                    transpileOnly: false,
                },
            })
        ).rejects.toThrow(/TypeScript emitted no output for .*\/src\/foobar-arrow\.ts/);
    });
});
