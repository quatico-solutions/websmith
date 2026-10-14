/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/**
 * Probe of `before` transformers on the pinned TypeScript 7.1 nightly, run by ts71-bench.cjs as a child and usable
 * alone: `TS71_VERSIONS_DIR=<dir> node perf/ts71-transformer-probe.cjs`, where <dir> holds the `npm ci` of
 * ts71-versions.lock.json (ts71-bench.cjs creates it).
 *
 * Runtime: calls the 7.1 `transpileModule` with `transformers: { before: [<appends a statement>] }` and records whether
 * the output changed ("applied"), stayed untransformed ("ignored") or the call threw ("threw: …").
 * Types: writes a 10-line .mts with the same call into the versions directory and type-checks it with 7.1's own tsc
 * (by package path, never node_modules/.bin, which the aliases share), recording the diagnostic codes.
 *
 * Prints one line: PROBE {"version":…,"runtime":"ignored"|"applied"|"threw: …","typeCheck":[codes]}.
 * Expected on 7.1.0-dev.20261013.1: runtime "ignored", typeCheck [2353] (`transformers` is not in TranspileOptions).
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const PROBE_SOURCE = `import { API } from "ts71/sync";
const api = new API({ cwd: "/" });
const appendStatement = (context: unknown) => (file: { statements: unknown[] }) => ({ ...file, statements: [...file.statements] });
const output = api.transpileModule("export const probe = 1;", {
    compilerOptions: { target: 9, module: 99 },
    fileName: "probe.ts",
    transformers: { before: [appendStatement] },
});
export const text: string = output.outputText;
api.close();
`;

const runtimeProbe = async (versionsDir, resolve) => {
    const { API } = await import(pathToFileURL(resolve("ts71/sync")).href);
    const api = new API({ cwd: versionsDir });
    try {
        const options = { compilerOptions: { target: 9, module: 99 }, fileName: "probe.ts" };
        const plain = api.transpileModule("export const probe = 1;", options).outputText;
        // The esm-watch-bench transformer shape: a factory that appends an expression statement to the source file
        const transformer = () => file => ({ ...file, statements: [...file.statements, { kind: "transformed" }] });
        const transformed = api.transpileModule("export const probe = 1;", { ...options, transformers: { before: [transformer] } }).outputText;
        return transformed === plain ? "ignored" : "applied";
    } catch (error) {
        return `threw: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
        api.close();
    }
};

const typeCheckProbe = (versionsDir, resolve) => {
    const probeFile = path.join(versionsDir, "ts71-transformer-probe.mts");
    fs.writeFileSync(probeFile, PROBE_SOURCE);
    const tsc = path.join(path.dirname(resolve("ts71/package.json")), "bin", "tsc");
    const args = [tsc, "--noEmit", "--module", "nodenext", "--target", "es2022", "--lib", "esnext", "--skipLibCheck", "--types", "", probeFile];
    const result = spawnSync(process.execPath, args, { cwd: versionsDir, encoding: "utf-8" });
    const output = `${result.stdout}\n${result.stderr}`;
    const codes = [...new Set([...output.matchAll(/error TS(\d+):/g)].map(match => Number(match[1])))].sort((a, b) => a - b);
    return { codes, output: output.trim() };
};

const main = async () => {
    const versionsDir = process.env.TS71_VERSIONS_DIR;
    if (!versionsDir) {
        throw new Error("TS71_VERSIONS_DIR must name the directory holding the npm ci of ts71-versions.lock.json");
    }
    const resolve = createRequire(path.join(versionsDir, "package.json")).resolve;
    const { version } = JSON.parse(fs.readFileSync(resolve("ts71/package.json"), "utf-8"));
    const runtime = await runtimeProbe(versionsDir, resolve);
    const { codes, output } = typeCheckProbe(versionsDir, resolve);
    console.log(`PROBE ${JSON.stringify({ version, runtime, typeCheck: codes, tscOutput: output })}`);
};

main().catch(error => {
    console.error(error);
    process.exit(2);
});
