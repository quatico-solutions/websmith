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

// Sources live in src/ on two levels; the tsconfig sets outDir and no rootDir, so the TypeScript major decides the layout
const SOURCES: Record<string, string> = {
    "a.ts": `import { b } from "./sub/b";\nexport const a = b + 1;\n`,
    "sub/b.ts": `export const b = 1;\n`,
};

let projectDir: string;

beforeEach(() => {
    projectDir = fs.mkdtempSync(path.resolve(__dirname, "..", "test-output-tsc-root-dir-"));
    fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify({ name: "tsc-root-dir", private: true }));
    jest.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
});

const writeSources = (sources: Record<string, string>): string[] =>
    Object.entries(sources).map(([name, content]) => {
        const filePath = path.join(projectDir, "src", name);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content);
        return filePath;
    });

// The project's tsconfig.json has outDir and no rootDir; tsc gets the same one with its own outDir
const writeTsConfig = (declaration: boolean): string => {
    const tsConfigFile = path.join(projectDir, "tsconfig.json");
    fs.writeFileSync(
        tsConfigFile,
        JSON.stringify({
            compilerOptions: { declaration, module: "commonjs", outDir: "websmith", skipLibCheck: true, types: [] },
            include: ["src/**/*"],
        })
    );
    fs.writeFileSync(
        path.join(projectDir, "tsconfig.tsc.json"),
        JSON.stringify({ extends: "./tsconfig.json", compilerOptions: { outDir: "tsc", pretty: false } })
    );
    return tsConfigFile;
};

const readOutputPaths = (outDir: string): string[] =>
    fs.existsSync(outDir)
        ? fs
              .readdirSync(outDir, { recursive: true, encoding: "utf-8" })
              .filter(name => fs.statSync(path.join(outDir, name)).isFile())
              .map(name => name.split(path.sep).join("/"))
              .sort()
        : [];

// tsc prints "error TS5011: …" (pretty is off, so no color codes); websmith's reporter prints "Error: 5011: …"
const readErrorCodes = (output: string, pattern: RegExp): string[] => [...new Set([...output.matchAll(pattern)].map(cur => cur[1]))].sort();

// TypeScript 6 cannot infer rootDir (TS5011) for sources in src/ and tsc reports it once; TypeScript 5 infers it
const ROOT_DIR_ERRORS = Number(ts.versionMajorMinor.split(".")[0]) < 6 ? 0 : 1;

// websmith-node's tsc Compiler rejects on a non-zero exit; its message holds only the first output line, so read the full stdout
const compileTsc = async (): Promise<{ paths: string[]; codes: string[] }> => {
    const output = await compile([], { tsConfig: { project: path.join(projectDir, "tsconfig.tsc.json") } }).catch(
        (error: Error) => (error as Error & { getStdout?: () => string | undefined }).getStdout?.() ?? error.message
    );
    return { paths: readOutputPaths(path.join(projectDir, "tsc")), codes: readErrorCodes(output, / TS(\d+): /g) };
};

const compileWebsmith = async (files: string[], tsConfigFile: string): Promise<{ paths: string[]; codes: string[]; output: string }> => {
    const output = await compile(files, { websmith: { tsConfigFile } });
    return { paths: readOutputPaths(path.join(projectDir, "websmith")), codes: readErrorCodes(output, /Error: (\d+):/g), output };
};

describe("compile w/ websmith and tsc w/o rootDir", () => {
    it.each([false, true])(
        "emits to tsc's output paths and reports tsc's error codes w/ sources in src, outDir, no rootDir and declaration %s",
        async declaration => {
            const files = writeSources(SOURCES);
            const tsConfigFile = writeTsConfig(declaration);
            const expected = await compileTsc();

            const { output, ...actual } = await compileWebsmith(files, tsConfigFile);

            expect(expected.paths).toEqual(
                expect.arrayContaining([expect.stringMatching(/(^|\/)a\.js$/), expect.stringMatching(/(^|\/)sub\/b\.js$/)])
            );
            expect(actual).toEqual(expected);
            expect(output.match(/Error: 5011:/g) ?? []).toHaveLength(ROOT_DIR_ERRORS);
        },
        60000
    );
});
