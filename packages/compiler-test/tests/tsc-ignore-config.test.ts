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

let outDir: string;

beforeEach(() => {
    outDir = fs.mkdtempSync(path.resolve(__dirname, "..", "test-output-tsc-ignore-config-"));
    jest.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
});

// websmith-node spawns the tsc of the typescript it resolves, which may differ from this package's typescript
const spawnedTypeScriptVersion = (): string => {
    const manifestPath = require.resolve("typescript/package.json", { paths: [path.dirname(require.resolve("@quatico/websmith-node"))] });
    return (JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as { version: string }).version;
};

const writeSource = (): string => {
    const srcDir = path.join(outDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    const filePath = path.join(srcDir, "foobar.ts");
    fs.writeFileSync(filePath, `export const foobar = (value: string): string => value.toUpperCase();\n`);
    return filePath;
};

describe("compile w/ tsc and a tsconfig.json in the working directory", () => {
    it("should find tsconfig.json in the working directory", () => {
        const actual = ts.findConfigFile(process.cwd(), ts.sys.fileExists);

        expect(actual).toBe(path.join(process.cwd(), "tsconfig.json").split(path.sep).join("/"));
    });

    it("should compile a single file w/ tsconfig.json in the working directory", async () => {
        const file = writeSource();
        const libDir = path.join(outDir, "lib");

        await compile([file], { tsConfig: { outDir: libDir, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, removeComments: true } });

        expect(fs.existsSync(path.join(libDir, "foobar.js"))).toBe(true);
    }, 60000);

    it("should pass target 12 by name", async () => {
        const file = writeSource();

        const actual = compile([file], { tsConfig: { noEmit: true, module: ts.ModuleKind.CommonJS, target: 12 as ts.ScriptTarget } });

        if (Number(spawnedTypeScriptVersion().split(".")[0]) >= 6) {
            await expect(actual).resolves.toBeDefined();
        } else {
            await expect(actual).rejects.toThrow(/TS6046.*'--target'/);
        }
    }, 60000);
});
