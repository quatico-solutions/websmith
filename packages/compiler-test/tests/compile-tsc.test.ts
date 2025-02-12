import { compile } from "@quatico/websmith-node";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const OUTPUT_DIR = path.join(__dirname, "..", "lib");
const SOURCE_DIR = path.join(__dirname, "..", "src");

const tsDefaults = {
    moduleResolution: ts.ModuleResolutionKind.Node10,
    outDir: OUTPUT_DIR,
    removeComments: true,
};

beforeAll(() => {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
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
    });

    it("should build foobar-function.js with ES2020 target", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-function.ts")], {
            tsConfig: {
                ...tsDefaults,
                target: ts.ScriptTarget.ES2020,
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "foobar-function.js"), "utf-8")).toMatchSnapshot();

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it("should build foobar-arrow.js with ES5 target", async () => {
        await compile([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            tsConfig: {
                ...tsDefaults,
                target: ts.ScriptTarget.ES5,
            },
        });

        expect(fs.readFileSync(path.join(OUTPUT_DIR, "foobar-arrow.js"), "utf-8")).toMatchSnapshot();

        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });
});
