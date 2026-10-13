/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compile } from "@quatico/websmith-node";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const OUTPUT_DIR = path.join(__dirname, "..", "lib");
const SOURCE_DIR = path.join(__dirname, "..", "src");

const tsDefaults = {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    outDir: OUTPUT_DIR,
    removeComments: true,
};

const itOnTs5 = Number(ts.versionMajorMinor.split(".")[0]) < 6 ? it : it.skip;

beforeAll(() => {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
});

beforeEach(() => {
    jest.spyOn(process.stdout, "write").mockImplementation(() => true);
});

describe("compile w/ tsc", () => {
    it("should build foobar-arrow.js with ES2020 target", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: {
                ...tsDefaults,
                target: ts.ScriptTarget.ES2020,
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "foobar-arrow.js"), "utf-8")).toMatchSnapshot();

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }, 60000);

    it("should build foobar-function.js with ES2020 target", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: {
                ...tsDefaults,
                target: ts.ScriptTarget.ES2020,
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8")).toMatchSnapshot();

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }, 60000);

    itOnTs5(
        "should build foobar-arrow.js with ES5 target on TypeScript 5",
        async () => {
            await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
                // ES5 implies module CommonJS, where an unset moduleResolution is node10 and bundler is TS5095
                tsConfig: {
                    outDir: OUTPUT_DIR,
                    removeComments: true,
                    target: ts.ScriptTarget.ES5,
                },
            });

            expect(fs.readFileSync(path.join(OUTPUT_DIR, "foobar-arrow.js"), "utf-8")).toMatchSnapshot();

            fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
        },
        60000
    );
});
