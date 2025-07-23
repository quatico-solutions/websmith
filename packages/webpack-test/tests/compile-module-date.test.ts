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
import { getOutput, writeWebsmithConfig } from "./test-files";

const OUTPUT_DIR = path.join(__dirname, "..", "lib");
const SOURCE_DIR = path.join(__dirname, "..", "src");
const ADDONS_DIR = path.join(__dirname, "..", "..", "example-addons", "src");

const tsDefaults = {
    moduleResolution: ts.ModuleResolutionKind.Node10,
    outDir: OUTPUT_DIR,
    removeComments: true,
};

const webpackDefaults = {
    output: {
        path: OUTPUT_DIR,
    },
    module: {
        rules: [
            {
                test: /\.[j|t]sx?$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: require.resolve("websmith-loader"),
                        options: {
                            transpileOnly: true,
                            tsConfigFile: path.join(__dirname, "..", "tsconfig.json"),
                        },
                    },
                    {
                        loader: require.resolve("ts-loader"),
                        options: {
                            transpileOnly: true,
                            configFile: path.join(__dirname, "..", "tsconfig.json"),
                        },
                    },
                ],
            },
        ],
    },
};

beforeAll(() => {
    fs.rmSync(path.resolve(path.join(__dirname, "..", "..", "example-addons", "lib")), { recursive: true, force: true });
});

describe("project bundling", () => {
    afterEach(() => {
        fs.rmSync(path.resolve(OUTPUT_DIR), { recursive: true, force: true });
    });

    it("yields bundled output", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                noWrite: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                devtool: "source-map",
                entry: {
                    main: path.join(SOURCE_DIR, "index.tsx"),
                    functions: path.join(SOURCE_DIR, "functions", "getDate.ts"),
                },
            },
            tsLoader: {
                compilerOptions: {
                    ...tsDefaults,
                    jsx: ts.JsxEmit.React,
                },
            },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profile: "noWrite",
            },
        });

        expect(fs.readdirSync(OUTPUT_DIR)).toEqual([
            "functions.js",
            "functions.js.map",
            "main.js",
            "main.js.map",
            "output.yaml",
            "websmith.config.json",
        ]);

        const expected = getOutput("output.yaml");
        [
            `-file: "${path.resolve(SOURCE_DIR, "index.tsx")}"\nexports: [render]`,
            `-file: "${path.resolve(SOURCE_DIR, "functions/getDate.ts")}"\nexports: [getDate]`,
            `-file: "${path.resolve(SOURCE_DIR, "model/index.ts")}"\nexports: []`,
            `-file: "${path.resolve(SOURCE_DIR, "model/create-message.ts")}"\nexports: [createMessage]`,
        ].forEach(it => expect(expected).toContain(it));
    });
});
