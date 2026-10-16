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

interface Manifest {
    name: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}

const PACKAGES_DIR = path.resolve(__dirname, "..", "..");
const REPO_DIR = path.resolve(PACKAGES_DIR, "..");
const PACKED = ["webpack", "core", "api"];
const LOOKUP_DIRS = [path.join(PACKAGES_DIR, "webpack"), path.join(PACKAGES_DIR, "core"), REPO_DIR];
const TYPESCRIPT_DIR = path.dirname(require.resolve("typescript/package.json"));
const SCRIPT = `
try {
    require("websmith-loader");
    console.log(JSON.stringify(Object.keys(require.cache).filter(key => key.endsWith(require("path").join("typescript", "lib", "typescript.js")))));
} catch (err) {
    console.log(err.message);
    process.exit(1);
}
`;

let packDir: string;
const tarballs = new Map<string, string>();
const manifests = new Map<string, Manifest>();
let workspaceDir: string;

beforeAll(() => {
    packDir = fs.mkdtempSync(path.join(os.tmpdir(), "websmith-loader-peer-pack-"));
    for (const name of PACKED) {
        const before = new Set(fs.readdirSync(packDir));
        execFileSync("pnpm", ["pack", "--pack-destination", packDir], { cwd: path.join(PACKAGES_DIR, name), stdio: "pipe", timeout: 60000 });
        const [file] = fs.readdirSync(packDir).filter(it => it.endsWith(".tgz") && !before.has(it));
        const extractDir = fs.mkdtempSync(path.join(packDir, "manifest-"));
        execFileSync("tar", ["-xzf", path.join(packDir, file), "-C", extractDir, "--strip-components", "1", "package/package.json"]);
        const manifest = JSON.parse(fs.readFileSync(path.join(extractDir, "package.json"), "utf-8")) as Manifest;
        tarballs.set(manifest.name, path.join(packDir, file));
        manifests.set(manifest.name, manifest);
    }
}, 180000);

afterAll(() => {
    fs.rmSync(packDir, { recursive: true, force: true });
});

beforeEach(() => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "websmith-loader-peer-"));
    const appTypeScript = path.join(workspaceDir, "app", "node_modules", "typescript");
    fs.mkdirSync(path.dirname(appTypeScript), { recursive: true });
    fs.symlinkSync(TYPESCRIPT_DIR, appTypeScript, "dir");
    for (const [name, tarball] of tarballs) {
        const packageDir = storeDir(name);
        fs.mkdirSync(packageDir, { recursive: true });
        execFileSync("tar", ["-xzf", tarball, "-C", packageDir, "--strip-components", "1"]);
    }
    for (const [name, manifest] of manifests) {
        const modulesDir = storeModulesDir(name);
        for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })) {
            link(resolveTarget(dependency, appTypeScript), path.join(modulesDir, dependency));
        }
    }
    link(storeDir("websmith-loader"), path.join(workspaceDir, "app", "node_modules", "websmith-loader"));
});

afterEach(() => {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
});

const storeModulesDir = (name: string): string => path.join(workspaceDir, "node_modules", ".pnpm", name.replace("/", "+"), "node_modules");

const storeDir = (name: string): string => path.join(storeModulesDir(name), name);

const resolveTarget = (name: string, appTypeScript: string): string => {
    if (manifests.has(name)) {
        return storeDir(name);
    }
    if (name === "typescript") {
        return appTypeScript;
    }
    const found = LOOKUP_DIRS.map(dir => path.join(dir, "node_modules", name)).find(dir => fs.existsSync(dir));
    if (!found) {
        throw new Error(`Cannot link "${name}": not installed in the workspace.`);
    }
    return fs.realpathSync(found);
};

const link = (target: string, linkPath: string): void => {
    if (!fs.existsSync(linkPath)) {
        fs.mkdirSync(path.dirname(linkPath), { recursive: true });
        fs.symlinkSync(target, linkPath, "dir");
    }
};

const runLoader = (): { status: number | null; output: string } => {
    const env = { ...process.env, HOME: workspaceDir, USERPROFILE: workspaceDir };
    delete env.NODE_PATH;
    const result = spawnSync(process.execPath, ["-e", SCRIPT], { cwd: path.join(workspaceDir, "app"), env, encoding: "utf-8" });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
};

describe("websmith-loader w/ typescript as a peer dependency in a strict pnpm layout", () => {
    it("loads the app's typescript through the loader's peer", () => {
        const actual = runLoader();

        expect(actual).toEqual({ status: 0, output: `${JSON.stringify([fs.realpathSync(path.join(TYPESCRIPT_DIR, "lib", "typescript.js"))])}\n` });
    }, 60000);

    it("declares typescript >=5.7 <7 as a peer", () => {
        const actual = [...manifests.values()].map(it => [it.name, it.peerDependencies?.typescript]);

        expect(actual).toEqual([
            ["websmith-loader", ">=5.7 <7"],
            ["@quatico/websmith-core", ">=5.7 <7"],
            ["@quatico/websmith-api", ">=5.7 <7"],
        ]);
    });

    it("declares tslib as a dependency", () => {
        const actual = [...manifests.values()].map(it => [it.name, it.dependencies?.tslib !== undefined]);

        expect(actual).toEqual([
            ["websmith-loader", true],
            ["@quatico/websmith-core", true],
            ["@quatico/websmith-api", true],
        ]);
    });
});
