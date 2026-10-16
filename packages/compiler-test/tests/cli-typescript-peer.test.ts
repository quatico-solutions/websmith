/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const COMPILER_DIR = path.resolve(__dirname, "..", "..", "compiler");
const TS7_MANIFEST = {
    name: "typescript",
    version: "7.0.2",
    type: "module",
    exports: { ".": "./lib/version.cjs", "./package.json": "./package.json" },
};

let packDir: string;
let tarball: string;
let projectDir: string;

beforeAll(() => {
    packDir = fs.mkdtempSync(path.join(os.tmpdir(), "websmith-cli-peer-pack-"));
    execFileSync("pnpm", ["pack", "--pack-destination", packDir], { cwd: COMPILER_DIR, stdio: "pipe", timeout: 60000 });
    const [name] = fs.readdirSync(packDir).filter(file => file.endsWith(".tgz"));
    tarball = path.join(packDir, name);
}, 60000);

afterAll(() => {
    fs.rmSync(packDir, { recursive: true, force: true });
});

beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "websmith-cli-peer-"));
    const cliDir = path.join(projectDir, "node_modules", "@quatico", "websmith-compiler");
    fs.mkdirSync(cliDir, { recursive: true });
    execFileSync("tar", ["-xzf", tarball, "-C", cliDir, "--strip-components", "1"]);
    fs.mkdirSync(path.join(projectDir, "src"));
    fs.writeFileSync(path.join(projectDir, "src", "a.ts"), "export const a = 1;\n");
    fs.writeFileSync(
        path.join(projectDir, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { module: "commonjs", target: "es2020", rootDir: "src", outDir: "dist", types: [] } })
    );
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
});

const runCli = (): { status: number | null; output: string } => {
    const env = { ...process.env };
    delete env.NODE_PATH;
    const result = spawnSync(process.execPath, [path.join(projectDir, "node_modules", "@quatico", "websmith-compiler", "bin", "bin.js"), "-p", "."], {
        cwd: projectDir,
        env,
        encoding: "utf-8",
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
};

describe("websmith CLI w/ typescript as a peer dependency", () => {
    it("exits 1 w/ 'none was found' without typescript", () => {
        const actual = runCli();

        expect(actual.status).toBe(1);
        expect(actual.output).toContain("websmith needs typescript >=5.7 <7; none was found. Add typescript to your project.");
    }, 60000);

    it("exits 1 w/ 'found 7' for TypeScript 7", () => {
        const tsDir = path.join(projectDir, "node_modules", "typescript");
        fs.mkdirSync(path.join(tsDir, "lib"), { recursive: true });
        fs.writeFileSync(path.join(tsDir, "package.json"), JSON.stringify(TS7_MANIFEST));
        fs.writeFileSync(path.join(tsDir, "lib", "version.cjs"), `exports.version = "7.0.2"; exports.versionMajorMinor = "7.0";\n`);

        const actual = runCli();

        expect(actual.status).toBe(1);
        expect(actual.output).toContain("websmith needs typescript >=5.7 <7; found 7.0.2.");
    }, 60000);

    it("compiles w/ the project's typescript", () => {
        fs.symlinkSync(path.dirname(require.resolve("typescript/package.json")), path.join(projectDir, "node_modules", "typescript"), "dir");

        const actual = runCli();

        expect(actual.status).toBe(0);
        expect(fs.existsSync(path.join(projectDir, "dist", "a.js"))).toBe(true);
    }, 60000);

    it("declares typescript only as a peer", () => {
        const actual = JSON.parse(
            fs.readFileSync(path.join(projectDir, "node_modules", "@quatico", "websmith-compiler", "package.json"), "utf-8")
        ) as {
            dependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
        };

        expect(actual.dependencies?.typescript).toBeUndefined();
        expect(actual.peerDependencies?.typescript).toBe(">=5.7 <7");
    });
});
