/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Compiler, createOptions, NoReporter } from "@quatico/websmith-core";
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

// websmith-node's tsc Compiler rejects on a non-zero exit; its message holds only the first output line, so read the full stdout
const compileTsc = async (): Promise<{ paths: string[]; codes: string[]; output: string }> => {
    const output = await compile([], { tsConfig: { project: path.join(projectDir, "tsconfig.tsc.json") } }).catch(
        (error: Error) => (error as Error & { getStdout?: () => string | undefined }).getStdout?.() ?? error.message
    );
    return { paths: readOutputPaths(path.join(projectDir, "tsc")), codes: readErrorCodes(output, / TS(\d+): /g), output };
};

const compileWebsmith = async (files: string[], tsConfigFile: string): Promise<{ paths: string[]; codes: string[] }> => {
    const output = await compile(files, { websmith: { tsConfigFile } });
    return { paths: readOutputPaths(path.join(projectDir, "websmith")), codes: readErrorCodes(output, /Error: (\d+):/g) };
};

// TypeScript 6 cannot infer rootDir for these sources and reports TS5011 once; TypeScript 5 infers it
const isTs5 = Number(ts.versionMajorMinor.split(".")[0]) < 6;

// Counts what websmith's reporter prints, as the CLI does: websmith-node's compile() reports the returned diagnostics once more
const countWebsmithRootDirErrors = (tsConfigFile: string): number => {
    const reporter = new NoReporter();
    const target = jest.spyOn(reporter, "reportDiagnostic");
    new Compiler({ ...createOptions({ tsConfigFile }, reporter, ts.sys), reporter }, {}, ts.sys).compile();
    return target.mock.calls.filter(([cur]) => cur.code === 5011).length;
};

describe("compile w/ websmith and tsc w/o rootDir", () => {
    it("emits to tsc's output paths and reports tsc's error codes w/ sources in src, outDir and no rootDir", async () => {
        const files = writeSources(SOURCES);
        const tsConfigFile = writeTsConfig(false);
        const { paths, codes } = await compileTsc();
        const expected = { paths, codes };

        const actual = await compileWebsmith(files, tsConfigFile);

        expect(expected.paths).toEqual(expect.arrayContaining([expect.stringMatching(/(^|\/)a\.js$/), expect.stringMatching(/(^|\/)sub\/b\.js$/)]));
        expect(actual).toEqual(expected);
    }, 60000);

    it.each([false, true])(
        "reports TS5011 as often as tsc w/ sources in src, outDir, no rootDir and declaration %s",
        async declaration => {
            writeSources(SOURCES);
            const tsConfigFile = writeTsConfig(declaration);
            const expected = (await compileTsc()).output.match(/ TS5011: /g)?.length ?? 0;

            const actual = countWebsmithRootDirErrors(tsConfigFile);

            expect(expected).toBe(isTs5 ? 0 : 1);
            expect(actual).toBe(expected);
        },
        60000
    );
});
