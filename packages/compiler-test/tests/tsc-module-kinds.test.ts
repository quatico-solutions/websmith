/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// The node module kinds of the installed TypeScript; node18 and node20 exist only in TypeScript 6
const NODE_MODULE_KINDS = ["Node16", "Node18", "Node20", "NodeNext"].filter(name => name in ts.ModuleKind).map(name => name.toLowerCase());

const describeOnTs5 = Number(ts.versionMajorMinor.split(".")[0]) < 6 ? describe : describe.skip;

let projectDir: string;

beforeEach(() => {
    projectDir = fs.mkdtempSync(path.resolve(__dirname, "..", "test-output-tsc-module-kinds-"));
    fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify({ name: "tsc-module-kinds", private: true, type: "module" }));
    fs.mkdirSync(path.join(projectDir, "src"));
    fs.writeFileSync(path.join(projectDir, "src", "a.ts"), "export const a = 1;\n");
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
});

// The project's tsconfig.json emits to websmith/; tsc gets its own outDir on the command line
const writeTsConfig = (compilerOptions: Record<string, unknown>): string => {
    const tsConfigFile = path.join(projectDir, "tsconfig.json");
    fs.writeFileSync(
        tsConfigFile,
        JSON.stringify({ compilerOptions: { rootDir: "src", outDir: "websmith", types: [], ...compilerOptions }, include: ["src/**/*"] })
    );
    return tsConfigFile;
};

const readOutputs = (outDir: string): Record<string, string> =>
    fs.existsSync(outDir)
        ? Object.fromEntries(
              fs
                  .readdirSync(outDir, { recursive: true, encoding: "utf-8" })
                  .filter(name => fs.statSync(path.join(outDir, name)).isFile())
                  .sort()
                  .map(name => [name.split(path.sep).join("/"), fs.readFileSync(path.join(outDir, name), "utf-8")])
          )
        : {};

// tsc prints "error TS5107: …" (pretty is off, so no color codes); websmith's reporter prints "Error: 5107: …"
const readErrorCodes = (output: string, pattern: RegExp): string[] => [...new Set([...output.matchAll(pattern)].map(cur => cur[1]))].sort();

type RunResult = { status: number | null; output: string };

// websmith's reporter prints errors to stderr, tsc to stdout; both streams are read
const run = (args: string[]): RunResult => {
    const { status, stdout, stderr } = spawnSync(process.execPath, args, { cwd: projectDir, encoding: "utf-8", timeout: 60000 });
    return { status, output: `${stdout}${stderr}` };
};

// Spawns the built CLI as a user runs it
const runWebsmithCli = (tsConfigFile: string, args: string[]): RunResult => {
    const binPath = path.resolve(__dirname, "..", "..", "compiler", "bin", "bin.js");
    if (!fs.existsSync(binPath)) {
        throw new Error(`Bundled compiler not found at ${binPath}. Please run 'pnpm build' first.`);
    }
    return run([binPath, "--project", tsConfigFile, ...args]);
};

const runTsc = (tsConfigFile: string, args: string[]): RunResult =>
    run([require.resolve("typescript/bin/tsc"), "--project", tsConfigFile, "--outDir", path.join(projectDir, "tsc"), "--pretty", "false", ...args]);

describe("compile w/ websmith and tsc w/ node module kinds", () => {
    describe.each(NODE_MODULE_KINDS)("w/ module %s", module => {
        it.each([{ args: [] }, { args: ["--transpileOnly"] }])(
            "emits tsc's output under type module w/ args $args",
            ({ args }) => {
                const tsConfigFile = writeTsConfig({ module });
                runTsc(tsConfigFile, []);
                const expected = readOutputs(path.join(projectDir, "tsc"));

                runWebsmithCli(tsConfigFile, args);
                const actual = readOutputs(path.join(projectDir, "websmith"));

                expect(Object.keys(expected)).toEqual(["a.js"]);
                expect(actual).toEqual(expected);
            },
            60000
        );
    });

    describeOnTs5("on TypeScript 5", () => {
        it("fails w/ TypeScript's own option error for module node20", () => {
            const tsConfigFile = writeTsConfig({ module: "node20" });
            const expected = ts.flattenDiagnosticMessageText(ts.convertCompilerOptionsFromJson({ module: "node20" }, "").errors[0].messageText, "\n");

            const actual = runWebsmithCli(tsConfigFile, []);

            expect(actual.status).not.toBe(0);
            expect(actual.output).toContain(expected);
        }, 60000);
    });

    it("reports tsc's errors w/ --ignoreDeprecations 6.0 and moduleResolution node10", () => {
        const tsConfigFile = writeTsConfig({ module: "esnext", moduleResolution: "node10" });
        const tscResult = runTsc(tsConfigFile, ["--ignoreDeprecations", "6.0"]);
        const expected = { codes: readErrorCodes(tscResult.output, / TS(\d+): /g), failed: tscResult.status !== 0 };

        const websmithResult = runWebsmithCli(tsConfigFile, ["--ignoreDeprecations", "6.0"]);
        const actual = { codes: readErrorCodes(websmithResult.output, /Error: (\d+):/g), failed: websmithResult.status !== 0 };

        expect(actual).toEqual(expected);
    }, 60000);
});
