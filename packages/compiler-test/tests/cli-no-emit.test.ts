/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BIN_PATH = path.resolve(__dirname, "..", "..", "compiler", "bin", "bin.js");

// A generator records each file it sees outside the output directory, so the addon is shown to have run without an emit
const MARKER_ADDON = `exports.needsTypeInfo = false;
exports.activate = ctx => {
    ctx.registerGenerator(fileName => require("fs").appendFileSync(require("path").join(process.cwd(), "generated.txt"), require("path").basename(fileName) + "\\n"));
};
`;

let projectDir: string;

beforeEach(() => {
    projectDir = fs.mkdtempSync(path.resolve(__dirname, "..", "test-output-cli-no-emit-"));
    fs.mkdirSync(path.join(projectDir, "src"));
    fs.writeFileSync(path.join(projectDir, "src", "a.ts"), "export const a = 1;\n");
    fs.mkdirSync(path.join(projectDir, "addons", "marker"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "addons", "marker", "addon.js"), MARKER_ADDON);
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
});

const writeTsConfig = (compilerOptions: Record<string, unknown>): void => {
    fs.writeFileSync(
        path.join(projectDir, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { outDir: "dist", rootDir: "src", types: [], ...compilerOptions }, include: ["src/**/*"] })
    );
};

const readOutputPaths = (): string[] => {
    const outDir = path.join(projectDir, "dist");
    return fs.existsSync(outDir) ? fs.readdirSync(outDir, { recursive: true, encoding: "utf-8" }).sort() : [];
};

const readGenerated = (): string[] => {
    const filePath = path.join(projectDir, "generated.txt");
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean) : [];
};

const runCli = (args: string[]): { status: number | null; output: string } => {
    const { status, stdout, stderr } = spawnSync(process.execPath, [BIN_PATH, "--project", path.join(projectDir, "tsconfig.json"), ...args], {
        cwd: projectDir,
        encoding: "utf-8",
        timeout: 30000,
    });
    return { status, output: `${stdout}${stderr}` };
};

const waitFor = async (predicate: () => boolean, timeoutMs: number, getOutput: () => string): Promise<void> => {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error(`Timed out after ${timeoutMs} ms. Output:\n${getOutput()}`);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
};

// Waits for the exit, so the cleanup does not race the watcher
const stopChild = async (child: ChildProcess): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }
    const exited = new Promise(resolve => child.once("exit", resolve));
    child.kill();
    await exited;
};

describe("websmith CLI w/ noEmit", () => {
    it.each([
        { name: "noEmit in tsconfig.json", tsConfig: { noEmit: true }, args: [] },
        { name: "the --noEmit flag", tsConfig: {}, args: ["--noEmit"] },
    ])("writes no file and exits 0 w/ $name", ({ tsConfig, args }) => {
        writeTsConfig(tsConfig);

        const { status } = runCli(args);
        const actual = { status, paths: readOutputPaths() };

        expect(actual).toEqual({ status: 0, paths: [] });
    }, 60000);

    it.each([
        { name: "noEmit in tsconfig.json", tsConfig: { noEmit: true }, args: [] },
        { name: "the --noEmit flag", tsConfig: {}, args: ["--noEmit"] },
    ])("writes no file, exits 0 and runs the addon w/ $name and an addon without type information", ({ tsConfig, args }) => {
        writeTsConfig(tsConfig);

        const { status } = runCli(["--addonsDir", path.join(projectDir, "addons"), "--addons", "marker", ...args]);
        const actual = { status, paths: readOutputPaths(), generated: readGenerated() };

        expect(actual).toEqual({ status: 0, paths: [], generated: ["a.ts"] });
    }, 60000);

    it("writes the output file w/o noEmit and an addon without type information", () => {
        writeTsConfig({});

        const { status } = runCli(["--addonsDir", path.join(projectDir, "addons"), "--addons", "marker"]);
        const actual = { status, paths: readOutputPaths(), generated: readGenerated() };

        expect(actual).toEqual({ status: 0, paths: ["a.js"], generated: ["a.ts"] });
    }, 60000);

    it("writes no file w/ noEmit in tsconfig.json and --watch", async () => {
        writeTsConfig({ noEmit: true });
        const child = spawn(
            process.execPath,
            [BIN_PATH, "--project", path.join(projectDir, "tsconfig.json"), "--addonsDir", path.join(projectDir, "addons"), "--addons", "marker", "--watch"],
            { cwd: projectDir }
        );
        let output = "";
        child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
        child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
        try {
            await waitFor(() => readGenerated().length > 0, 30000, () => output);
            // The generator runs before the file's emit; give the emit time to write, as it did before the fix
            await new Promise(resolve => setTimeout(resolve, 1500));

            const actual = readOutputPaths();

            expect(actual).toEqual([]);
        } finally {
            await stopChild(child);
        }
    }, 60000);
});
