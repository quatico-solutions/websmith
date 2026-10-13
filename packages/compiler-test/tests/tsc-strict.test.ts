/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compile } from "@quatico/websmith-node";
import fs from "node:fs";
import path from "node:path";

// The parameter has an implicit any: TS7006 under strict, nothing without it; the tsconfig leaves strict unset
const SOURCES: Record<string, string> = {
    "f.ts": `export const f = (a) => a;\n`,
};

let projectDir: string;

beforeEach(() => {
    projectDir = fs.mkdtempSync(path.resolve(__dirname, "..", "test-output-tsc-strict-"));
    fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify({ name: "tsc-strict", private: true }));
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

// The project's tsconfig.json has no strict; tsc gets the same one with its own outDir
const writeTsConfig = (): string => {
    const tsConfigFile = path.join(projectDir, "tsconfig.json");
    fs.writeFileSync(
        tsConfigFile,
        JSON.stringify({
            compilerOptions: { module: "commonjs", outDir: "websmith", rootDir: "src", skipLibCheck: true, types: [] },
            include: ["src/**/*"],
        })
    );
    fs.writeFileSync(
        path.join(projectDir, "tsconfig.tsc.json"),
        JSON.stringify({ extends: "./tsconfig.json", compilerOptions: { outDir: "tsc", pretty: false } })
    );
    return tsConfigFile;
};

// websmith type-checks only when an active addon needs type information; its fast path reports syntax and option errors only
const writeTypeInfoAddon = (): { addonsDir: string; addons: string[] } => {
    const addonsDir = path.join(projectDir, "addons");
    fs.mkdirSync(path.join(addonsDir, "type-info-addon"), { recursive: true });
    fs.writeFileSync(path.join(addonsDir, "type-info-addon", "addon.js"), "exports.activate = () => {};");
    return { addonsDir, addons: ["type-info-addon"] };
};

const readOutputPaths = (outDir: string): string[] =>
    fs.existsSync(outDir)
        ? fs
              .readdirSync(outDir, { recursive: true, encoding: "utf-8" })
              .filter(name => fs.statSync(path.join(outDir, name)).isFile())
              .map(name => name.split(path.sep).join("/"))
              .sort()
        : [];

// tsc prints "src/f.ts(1,19): error TS7006: <text>" (pretty is off, so no color codes); websmith's reporter prints
// "Error: <file> (1,19): <text>" without the code, so both sides compare the text
const readErrors = (output: string, pattern: RegExp): string[] => [...new Set([...output.matchAll(pattern)].map(cur => cur[1]))].sort();

// websmith-node's tsc Compiler rejects on a non-zero exit; its message holds only the first output line, so read the full stdout
const compileTsc = async (): Promise<{ paths: string[]; errors: string[] }> => {
    const output = await compile([], { tsConfig: { project: path.join(projectDir, "tsconfig.tsc.json") } }).catch(
        (error: Error) => (error as Error & { getStdout?: () => string | undefined }).getStdout?.() ?? error.message
    );
    return { paths: readOutputPaths(path.join(projectDir, "tsc")), errors: readErrors(output, /\): error TS\d+: (.*)$/gm) };
};

const compileWebsmith = async (files: string[], tsConfigFile: string): Promise<{ paths: string[]; errors: string[] }> => {
    const output = await compile(files, { websmith: { tsConfigFile, config: writeTypeInfoAddon() } });
    return { paths: readOutputPaths(path.join(projectDir, "websmith")), errors: readErrors(output, /^Error: \S+ \(\d+,\d+\): (.*)$/gm) };
};

describe("compile w/ websmith and tsc w/o strict", () => {
    it("reports tsc's errors for an implicit any w/ strict unset", async () => {
        const files = writeSources(SOURCES);
        const tsConfigFile = writeTsConfig();
        const expected = await compileTsc();

        const actual = await compileWebsmith(files, tsConfigFile);

        expect(expected.paths).toEqual(["f.js"]);
        expect(actual).toEqual(expected);
    }, 60000);
});
