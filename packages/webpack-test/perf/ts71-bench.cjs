/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/**
 * Manual benchmark of the TypeScript 7.1 (native, out-of-process) API against the in-process 5.7.3 and 6.0.3 APIs,
 * in the call shapes websmith's loader uses. It runs in no suite and not in CI: timing noise on shared runners
 * exceeds the thresholds, and the pinned 7.1 nightly must never join the workspace's TypeScript matrix. It is the
 * spike of docs/plans/2026-10-02-typescript-6-support.md; the measurement slice runs it at full size.
 *
 * Versions come from ts71-versions.json and ts71-versions.lock.json, installed with `npm ci --ignore-scripts` into a
 * directory outside the repository (--versions-dir, default a temp directory named after the lockfile hash), with an
 * empty .npmrc and never ~/.npmrc. The installed versions and integrities are checked against the committed
 * lockfile before any run. Never the workspace's typescript: the workspace pin moves, the harness must not.
 *
 * Corpus (ts71-corpus.cjs): the 9 webpack-test fixtures plus seeded generated modules up to each --sizes total, in a
 * temp directory, regenerated before every child so that the watch edits of one child never reach the next.
 *
 * Workloads, each once per child process, one child per variant and round in interleaved order (5.7.3, 6.0.3, 7.1):
 *   (a) cold start: load the API (require, or import plus `new API` which spawns `tsc --api`) and one transpileModule
 *   (b) per-file transpileModule, source text passed per call as the loader holds it; two passes, cold then warm.
 *       In process the marker modules get a `before` transformer (Compiler.ts transpileSourceCode); 7.1 cannot
 *       express that and records transformersApplied: false
 *   (c) type-checked loader path, cold: one createProgram, then per file its semantic diagnostics and its emit
 *       (ts.createProgram + getSemanticDiagnostics + program.emit; api.createProgram + getSemanticDiagnostics +
 *       getJavaScriptEmit). The explicit check makes both sides type-check every file, as websmith's
 *       getPreEmitDiagnostics does: in process the emit resolver would check anyway, 7.1's getJavaScriptEmit does not
 *   (d) is (b) and (c) on 5.7.3 and 6.0.3, the baseline columns
 *   (e) watch rebuild: --edits edits of different leaves on a built program; in process createProgram with
 *       oldProgram and a host serving the edited text, on 7.1 snapshot.update with fileNotifications and
 *       ensurePrograms; every variant asserts that the emit contains the edit's marker and aborts on a stale emit.
 *       Two in-process rows: the judged one uses websmith's host (ts.createCompilerHost, compile-service.ts
 *       createCompileHost, as Compiler.ts passes it with oldProgram), which caches no SourceFile, so most of its cost
 *       per edit is re-parsing every file. The unjudged "cached host" row repeats the edits with a host that reuses
 *       every unchanged SourceFile, so that the measurement can tell the native compiler's gain from the cache's
 *   (f) concurrency: on 7.1 the async API (JSON-RPC) with --in-flight calls in flight against sequential calls on the
 *       same channel; in process sequential only (one thread)
 * Payload bytes: an untimed 7.1 pass per size with collectTiming reports bytes and server ms per file.
 * Transformer probe: ts71-transformer-probe.cjs, once, as a child.
 * A 7.1 workload that throws or lacks a method is "not measurable" and the run continues; the decision counts it as
 * not met. A correctness failure (stale emit, wrong version) aborts the run.
 *
 * Summaries are the median with min and max over runs, never means; p95 is computed within each run over its
 * per-call durations and the median of those is reported.
 *
 * Decision rule (plan, Design → Approach → Spike), read at the largest size against in-process 6.0.3:
 *   1  (b) 7.1 median per-file transpileModule, warm pass        <= 1.5 x 6.0.3
 *   2  (c) 7.1 createProgram + all per-file checks and emits    <= 2 x 6.0.3
 *   3  (e) 7.1 median per edit                                  <= 2 x 6.0.3
 *   4  7.1 p95 <= 3 x its own median, in (b warm) and (c per file, check + emit)
 *   5  (f) 7.1 throughput with --in-flight in flight            >= 1/1.5 x 6.0.3 in-process sequential throughput
 *   6  (a) 7.1 median cold start: above 1 s it is also reported x --loader-instances, and counts against speed only
 *      when that exceeds 2 s
 * "Speed: met" when all six are met. The Decisions row (3C, the released-7.x criterion) is the measurement slice's.
 *
 * Run (pnpm 10 and npm 10.9.2 come with Node 22.17.0):
 *   export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"
 *   cd packages/webpack-test
 *   pnpm perf:ts71 --sizes 20 --runs 1 --edits 3                                               # dry run
 *   $HOME/.nvm/versions/node/v24.21.0/bin/node perf/ts71-bench.cjs --sizes 20 --runs 1 --edits 3  # Node 24
 *   pnpm perf:ts71                                                                             # full run
 * The last stdout line is `RESULT <json file>` (--out, default a temp file), schema websmith-ts71-bench/1.
 *
 * Re-pinning: pick the nightly with `npm view typescript dist-tags` (empty NPM_CONFIG_USERCONFIG,
 * --registry=https://registry.npmjs.org/), then
 *   1. edit the ts71 alias in ts71-versions.json;
 *   2. regenerate ts71-versions.lock.json: copy ts71-versions.json to package.json in a scratch directory, run
 *      `npm install --package-lock-only --ignore-scripts --registry=https://registry.npmjs.org/` there with the empty
 *      user config, copy package-lock.json back as ts71-versions.lock.json;
 *   3. check `npm view typescript@<v> exports`: the harness needs ./sync and ./async (before 7.1.0-dev.20261009.1
 *      they were ./unstable/sync and ./unstable/async);
 *   4. check the TranspileOptions and Snapshot.update shapes in dist/api/sync/api.d.ts and dist/api/async/api.d.ts;
 *   5. do a dry run;
 *   6. commit both files together.
 *
 * Options: --runs 5 --sizes 200,1000 --edits 30 --in-flight 8 --seed <corpus default> --loader-instances 1
 *          --versions-dir <dir> --out <file> --keep
 */
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const corpusModule = require("./ts71-corpus.cjs");

const SCHEMA = "websmith-ts71-bench/2";
const VARIANTS = ["5.7.3", "6.0.3", "7.1"];
const ALIASES = { "5.7.3": "ts573", "6.0.3": "ts603", "7.1": "ts71" };
const BASELINE = "6.0.3";
const NATIVE = "7.1";
const VERSIONS_MANIFEST = path.join(__dirname, "ts71-versions.json");
const VERSIONS_LOCKFILE = path.join(__dirname, "ts71-versions.lock.json");
const LOCKFILE_MARKER = ".websmith-ts71-lockfile-sha256";
const IPC_ENCODINGS = {
    sync: "MessagePack-framed JSON over stdio (tsc --api; [type, method, JSON payload] tuples)",
    async: "JSON-RPC (vscode-jsonrpc) over stdio",
};
// Numeric enums only: the 7.1 server panics on string enum values. The numbers are the same in 5.7.3, 6.0.3 and 7.1.
const COMPILER_OPTIONS = { target: 9, module: 99, jsx: 2, strict: true };
const PROGRAM_OPTIONS = { ...COMPILER_OPTIONS, moduleResolution: 100 };
const NOT_MEASURABLE = "not measurable";

const parseOptions = argv => {
    const options = {
        runs: 5,
        sizes: "200,1000",
        edits: 30,
        "in-flight": 8,
        seed: corpusModule.DEFAULT_SEED,
        "loader-instances": 1,
        "versions-dir": undefined,
        out: undefined,
        keep: false,
    };
    const strings = new Set(["sizes", "versions-dir", "out"]);
    for (let i = 0; i < argv.length; i++) {
        const name = argv[i].replace(/^--/, "");
        if (argv[i] === "--") {
            // pnpm passes a bare "--" through: `pnpm perf:ts71 -- --sizes 20`
            continue;
        } else if (name === "keep") {
            options.keep = true;
        } else if (name in options) {
            const value = argv[++i];
            if (value === undefined) {
                throw new Error(`Option "${argv[i - 1]}" needs a value`);
            }
            options[name] = strings.has(name) ? value : Number(value);
            if (!strings.has(name) && !Number.isFinite(options[name])) {
                throw new Error(`Option "${argv[i - 1]}" needs a number, got "${value}"`);
            }
        } else {
            throw new Error(`Unknown option "${argv[i]}"`);
        }
    }
    // (e) picks its leaves among the generated modules and needs at least two of them beside the fixtures
    const minSize = corpusModule.FIXTURE_COUNT + 2;
    options.sizes = String(options.sizes)
        .split(",")
        .map(cur => {
            const size = cur.trim() === "" ? NaN : Number(cur);
            if (!Number.isInteger(size) || size < minSize) {
                throw new Error(`--sizes needs integers of at least ${minSize} (${corpusModule.FIXTURE_COUNT} fixtures plus 2 generated modules), got "${cur}"`);
            }
            return size;
        });
    return options;
};

const median = values => {
    if (values.length === 0) {
        return undefined;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const percentile = (values, fraction) => {
    if (values.length === 0) {
        return undefined;
    }
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
};

const stats = values => {
    const defined = values.filter(cur => typeof cur === "number" && Number.isFinite(cur));
    return defined.length ? { median: median(defined), min: Math.min(...defined), max: Math.max(...defined), runs: defined.length } : undefined;
};

const fmt = (value, digits = 1) => (typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "n/a");
const fmtStats = (cur, digits = 1) => (cur ? `${fmt(cur.median, digits)} [${fmt(cur.min, digits)}–${fmt(cur.max, digits)}]` : "n/a");

const sha256 = content => createHash("sha256").update(content).digest("hex");

class CorrectnessError extends Error {}

// ---------------------------------------------------------------------------------------------------------------------
// Versions: the isolated npm ci of the committed lockfile
// ---------------------------------------------------------------------------------------------------------------------

const platformBinary = () => `@typescript/typescript-${process.platform}-${process.arch}`;

const expectedVersions = () => {
    const manifest = JSON.parse(fs.readFileSync(VERSIONS_MANIFEST, "utf-8"));
    const lockfile = JSON.parse(fs.readFileSync(VERSIONS_LOCKFILE, "utf-8"));
    const entry = name => {
        const locked = lockfile.packages[`node_modules/${name}`];
        if (!locked) {
            throw new Error(`${path.basename(VERSIONS_LOCKFILE)} has no entry for node_modules/${name}`);
        }
        return { version: locked.version, integrity: locked.integrity };
    };
    const aliases = Object.fromEntries(
        Object.entries(manifest.dependencies).map(([alias, spec]) => {
            const version = spec.replace(/^npm:typescript@/, "");
            const locked = entry(alias);
            if (locked.version !== version) {
                throw new Error(`${alias}: manifest says ${version}, lockfile says ${locked.version}; regenerate the lockfile`);
            }
            return [alias, { package: "typescript", ...locked }];
        })
    );
    return { aliases, binary: { name: platformBinary(), ...entry(platformBinary()) } };
};

const npmPath = () => path.join(path.dirname(process.execPath), process.platform === "win32" ? "npm.cmd" : "npm");

const installVersions = (versionsDir, lockfileHash) => {
    fs.mkdirSync(versionsDir, { recursive: true });
    const npmrc = path.join(versionsDir, ".npmrc");
    fs.copyFileSync(VERSIONS_MANIFEST, path.join(versionsDir, "package.json"));
    fs.copyFileSync(VERSIONS_LOCKFILE, path.join(versionsDir, "package-lock.json"));
    fs.writeFileSync(npmrc, "");
    const marker = path.join(versionsDir, LOCKFILE_MARKER);
    const installed = fs.existsSync(marker) && fs.readFileSync(marker, "utf-8").trim() === lockfileHash && fs.existsSync(path.join(versionsDir, "node_modules"));
    if (installed) {
        return { installed: false, npm: npmPath() };
    }
    fs.rmSync(marker, { force: true });
    console.log(`Installing the pinned versions into ${versionsDir} with ${npmPath()} (npm ci --ignore-scripts, empty user config)`);
    const result = spawnSync(npmPath(), ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org/"], {
        cwd: versionsDir,
        encoding: "utf-8",
        env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrc },
        stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== 0) {
        throw new Error(`npm ci failed in ${versionsDir} (exit ${result.status}):\n${result.stdout}\n${result.stderr}`);
    }
    fs.writeFileSync(marker, `${lockfileHash}\n`);
    return { installed: true, npm: npmPath() };
};

const verifyVersions = (versionsDir, expected) => {
    const hiddenLockfile = path.join(versionsDir, "node_modules", ".package-lock.json");
    if (!fs.existsSync(hiddenLockfile)) {
        throw new CorrectnessError(`${hiddenLockfile} is missing: npm ci did not write its hidden lockfile`);
    }
    const installed = JSON.parse(fs.readFileSync(hiddenLockfile, "utf-8")).packages;
    const resolved = {};
    Object.entries(expected.aliases).forEach(([alias, locked]) => {
        const packageJson = path.join(versionsDir, "node_modules", alias, "package.json");
        if (!fs.existsSync(packageJson)) {
            throw new CorrectnessError(`${alias} is not installed in ${versionsDir}`);
        }
        const { version } = JSON.parse(fs.readFileSync(packageJson, "utf-8"));
        const integrity = installed[`node_modules/${alias}`]?.integrity;
        if (version !== locked.version) {
            throw new CorrectnessError(`${alias}: installed ${version}, committed lockfile pins ${locked.version}`);
        }
        if (integrity !== locked.integrity) {
            throw new CorrectnessError(`${alias}: installed integrity ${integrity}, committed lockfile pins ${locked.integrity}`);
        }
        resolved[alias] = { version, integrity, package: "typescript" };
    });
    const binaryDir = path.join(versionsDir, "node_modules", expected.binary.name);
    if (!fs.existsSync(binaryDir)) {
        throw new CorrectnessError(`The 7.1 platform binary ${expected.binary.name} for ${process.platform}-${process.arch} is not installed in ${versionsDir}`);
    }
    const binaryIntegrity = installed[`node_modules/${expected.binary.name}`]?.integrity;
    if (binaryIntegrity !== expected.binary.integrity) {
        throw new CorrectnessError(`${expected.binary.name}: installed integrity ${binaryIntegrity}, committed lockfile pins ${expected.binary.integrity}`);
    }
    return { ...resolved, binary: { name: expected.binary.name, version: expected.binary.version, integrity: binaryIntegrity } };
};

// ---------------------------------------------------------------------------------------------------------------------
// Child: the workloads of one variant over one corpus
// ---------------------------------------------------------------------------------------------------------------------

const createBeforeTransformer = (ts, marker) => () => file =>
    file.text.includes(marker)
        ? ts.factory.updateSourceFile(file, [...file.statements, ts.factory.createExpressionStatement(ts.factory.createStringLiteral("transformed"))])
        : file;

const measure = fn => {
    const start = performance.now();
    const result = fn();
    return { ms: performance.now() - start, result };
};

// (b) in-process and sync 7.1 share this loop; `transformersFor` returns the per-file transformers or undefined
const transpilePass = (transpile, sources, transformersFor) => {
    const durations = [];
    let transformed = 0;
    sources.forEach(({ fileName, text }) => {
        const transformers = transformersFor(fileName);
        const { ms, result } = measure(() =>
            transpile(text, { compilerOptions: COMPILER_OPTIONS, fileName, reportDiagnostics: true, ...(transformers && { transformers }) })
        );
        durations.push(ms);
        if (result.outputText.includes('"transformed"')) {
            transformed++;
        }
    });
    return { durations, transformed };
};

const summarizeCalls = durations => ({
    calls: durations.length,
    totalMs: durations.reduce((sum, cur) => sum + cur, 0),
    medianMs: median(durations),
    p95Ms: percentile(durations, 0.95),
    maxMs: Math.max(...durations),
    durations,
});

// (c) in-process and 7.1 share this loop: per file a timed semantic check, then a timed emit
const typeCheckedPass = (created, files, callsFor) => {
    const checks = [];
    const emits = [];
    let diagnostics = 0;
    files.forEach(fileName => {
        const { check, emit } = callsFor(fileName);
        const checked = measure(check);
        diagnostics += checked.result;
        checks.push(checked.ms);
        emits.push(measure(emit).ms);
    });
    const perFile = checks.map((cur, i) => cur + emits[i]);
    return {
        status: "ok",
        createProgramMs: created.ms,
        checks: summarizeCalls(checks),
        emits: summarizeCalls(emits),
        perFile: summarizeCalls(perFile),
        totalMs: created.ms + perFile.reduce((sum, cur) => sum + cur, 0),
        semanticDiagnostics: diagnostics,
    };
};

const leafIndices = (count, edits) => Array.from({ length: edits }, (_, i) => Math.floor(count / 2) + ((i * 7) % Math.floor(count / 2)));

const readSources = files => files.map(fileName => ({ fileName, text: fs.readFileSync(fileName, "utf-8") }));

// a source and its emitted JavaScript share the path without extension, which splits a batched emit per file
const stem = fileName => fileName.replace(/\.[cm]?[jt]sx?$/, "");

// The text a file's emitted JavaScript must contain: a generated module's revision value (as (e) left it), else the
// name of the file's first export (the fixtures)
const markerOf = ({ fileName, text }) => {
    const found = /export const revision\d+ = "([^"]+)"/.exec(text) ?? /export\s+(?:const|function|class)\s+(\w+)|export\s*\{\s*(\w+)/.exec(text);
    const marker = found?.slice(1).find(Boolean);
    if (!marker) {
        throw new CorrectnessError(`${fileName} has neither a revision constant nor an export to assert`);
    }
    return marker;
};

// (g) and (h): every source's marker in its own output, `outputs` keyed by stem
const assertMarkers = (label, sources, outputs) => {
    sources.forEach(source => {
        const marker = markerOf(source);
        if (!outputs.get(stem(source.fileName))?.includes(marker)) {
            throw new CorrectnessError(`${label}: the output for ${source.fileName} is missing "${marker}"`);
        }
    });
    return sources.length;
};

const chunksOf = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

const cliBatchResult = (created, checked, emitted, markersAsserted) => ({
    status: "ok",
    createProgramMs: created.ms,
    checkMs: checked.ms,
    emitMs: emitted.ms,
    totalMs: created.ms + checked.ms + emitted.ms,
    diagnostics: checked.result,
    markersAsserted,
});

// (h) in-process and 7.1 share this loop: one timed `runBatch` per chunk, which returns [stem, output] per file
const microBatchPass = (chunks, runBatch) => {
    const durations = [];
    const outputs = new Map();
    chunks.forEach(chunk => {
        const { ms, result } = measure(() => runBatch(chunk));
        durations.push(ms);
        result.forEach(([key, text]) => outputs.set(key, text));
    });
    const files = chunks.reduce((sum, cur) => sum + cur.length, 0);
    const batches = summarizeCalls(durations);
    return {
        outputs,
        summary: { ...batches, files, perFile: summarizeCalls(durations.map((ms, i) => ms / chunks[i].length)), perSecond: (files * 1000) / batches.totalMs },
    };
};

const microBatchResult = ({ inFlight, sources, label, transpiled, created, typeChecked, diagnostics }) => ({
    status: "ok",
    inFlight,
    transformersApplied: false,
    transpile: transpiled.summary,
    typeChecked: { createProgramMs: created.ms, ...typeChecked.summary, semanticDiagnostics: diagnostics },
    markersAsserted: assertMarkers(`${label} (h) transpileModule`, sources, transpiled.outputs) + assertMarkers(`${label} (h) type-checked`, sources, typeChecked.outputs),
});

const runInProcess = ({ variant, versionsDir, corpus, edits, inFlight }) => {
    const requireAlias = createRequire(path.join(versionsDir, "package.json"));
    const sources = corpus.files.map(fileName => ({ fileName, text: fs.readFileSync(fileName, "utf-8") }));
    const markers = new Set(corpus.markerFiles);
    const results = {};

    // (a) cold start: require of the alias plus the first transpileModule
    const load = measure(() => requireAlias(ALIASES[variant]));
    const ts = load.result;
    const first = measure(() => ts.transpileModule(sources[0].text, { compilerOptions: COMPILER_OPTIONS, fileName: sources[0].fileName, reportDiagnostics: true }));
    results.a = { status: "ok", ms: load.ms + first.ms, loadMs: load.ms, firstCallMs: first.ms, version: ts.version };

    // (b) per-file transpileModule, marker modules with the before transformer, cold then warm
    const before = [createBeforeTransformer(ts, corpusModule.ADDON_MARKER)];
    const transformersFor = fileName => (markers.has(fileName) ? { before } : undefined);
    const cold = transpilePass((text, options) => ts.transpileModule(text, options), sources, transformersFor);
    const warm = transpilePass((text, options) => ts.transpileModule(text, options), sources, transformersFor);
    results.b = {
        status: "ok",
        transformersApplied: true,
        markerModules: corpus.markerFiles.length,
        transformedCold: cold.transformed,
        transformedWarm: warm.transformed,
        cold: summarizeCalls(cold.durations),
        warm: summarizeCalls(warm.durations),
    };

    // (c) type-checked loader path, cold: one createProgram, then per file its semantic diagnostics and its emit in memory
    const emitted = new Map();
    const created = measure(() => ts.createProgram(corpus.files, PROGRAM_OPTIONS));
    results.c = typeCheckedPass(created, corpus.files, fileName => {
        const sourceFile = created.result.getSourceFile(fileName);
        return {
            check: () => created.result.getSemanticDiagnostics(sourceFile).length,
            emit: () => created.result.emit(sourceFile, (name, text) => emitted.set(name, text)),
        };
    });
    results.c.emittedFiles = emitted.size;

    // (e) watch rebuild: createProgram with oldProgram and a host serving the edited text, then emit the edited file
    const overrides = new Map();
    const host = ts.createCompilerHost(PROGRAM_OPTIONS, true); // as createCompileHost in packages/core
    const readFile = host.readFile;
    host.readFile = fileName => (overrides.has(fileName) ? overrides.get(fileName) : readFile(fileName));
    const getSourceFile = host.getSourceFile;
    host.getSourceFile = (fileName, languageVersionOrOptions, onError, shouldCreate) =>
        overrides.has(fileName)
            ? ts.createSourceFile(fileName, overrides.get(fileName), languageVersionOrOptions, true)
            : getSourceFile(fileName, languageVersionOrOptions, onError, shouldCreate);
    // per edit: write the edited leaf, rebuild with oldProgram and emit it; `firstRevision` keeps the markers unique
    const timeEdits = (firstRevision, rebuild) =>
        leafIndices(corpus.count, edits).map((leaf, i) => {
            const revision = firstRevision + i;
            const { file, lines } = corpus.modules[leaf];
            const text = corpusModule.createModuleSource(leaf, corpus.count, lines, revision);
            const marker = corpusModule.editMarker(leaf, revision);
            const { ms } = measure(() => {
                fs.writeFileSync(file, text);
                const rebuilt = rebuild(file, text);
                let output = "";
                rebuilt.emit(rebuilt.getSourceFile(file), (_name, emittedText) => (output += emittedText));
                if (!output.includes(marker)) {
                    throw new CorrectnessError(`${variant} (e): stale emit for ${file}, revision ${revision} missing "${marker}"`);
                }
            });
            return ms;
        });
    let program = ts.createProgram({ rootNames: corpus.files, options: PROGRAM_OPTIONS, host });
    const editSamples = timeEdits(1, (file, text) => {
        overrides.set(file, text);
        program = ts.createProgram({ rootNames: corpus.files, options: PROGRAM_OPTIONS, host, oldProgram: program });
        return program;
    });

    // (e) unjudged: the same leaves again, with a host that reuses every unchanged SourceFile across programs
    const sourceFiles = new Map();
    const cachingHost = ts.createCompilerHost(PROGRAM_OPTIONS, true);
    const parse = cachingHost.getSourceFile;
    cachingHost.getSourceFile = (fileName, languageVersionOrOptions, onError, shouldCreate) => {
        if (!sourceFiles.has(fileName)) {
            sourceFiles.set(fileName, parse(fileName, languageVersionOrOptions, onError, shouldCreate));
        }
        return sourceFiles.get(fileName);
    };
    let cachedProgram = ts.createProgram({ rootNames: corpus.files, options: PROGRAM_OPTIONS, host: cachingHost });
    const cachedSamples = timeEdits(edits + 1, file => {
        sourceFiles.delete(file);
        cachedProgram = ts.createProgram({ rootNames: corpus.files, options: PROGRAM_OPTIONS, host: cachingHost, oldProgram: cachedProgram });
        return cachedProgram;
    });
    results.e = { status: "ok", edits: summarizeCalls(editSamples), cachedHost: summarizeCalls(cachedSamples), emitAsserted: true };

    // (f) sequential throughput only: one thread, in-flight calls have no meaning in process
    const sequential = measure(() => sources.forEach(({ fileName, text }) => ts.transpileModule(text, { compilerOptions: COMPILER_OPTIONS, fileName, reportDiagnostics: true })));
    results.f = { status: "ok", modules: sources.length, sequentialMs: sequential.ms, sequentialPerSecond: (sources.length * 1000) / sequential.ms, inFlight: 1 };

    // (g) and (h) read the corpus as (e) left it on disk
    const batchedSources = readSources(corpus.files);

    // (g) CLI batch: createProgram, getPreEmitDiagnostics, then one program.emit() of every file
    const cliOutputs = new Map();
    const cliProgram = measure(() => ts.createProgram(corpus.files, PROGRAM_OPTIONS));
    const cliChecked = measure(() => ts.getPreEmitDiagnostics(cliProgram.result).length);
    const cliEmitted = measure(() => cliProgram.result.emit(undefined, (name, text) => cliOutputs.set(stem(name), text)));
    results.g = cliBatchResult(cliProgram, cliChecked, cliEmitted, assertMarkers(`${variant} (g)`, batchedSources, cliOutputs));

    // (h) the files of each --in-flight chunk as sequential calls, timed per chunk: transpileModule, then on a new
    // program each file's semantic diagnostics and emit
    const chunks = chunksOf(batchedSources, inFlight);
    const transpiled = microBatchPass(chunks, chunk =>
        chunk.map(cur => [stem(cur.fileName), ts.transpileModule(cur.text, { compilerOptions: COMPILER_OPTIONS, fileName: cur.fileName, reportDiagnostics: true }).outputText])
    );
    const checkedProgram = measure(() => ts.createProgram(corpus.files, PROGRAM_OPTIONS));
    let diagnostics = 0;
    const typeChecked = microBatchPass(chunks, chunk =>
        chunk.map(cur => {
            const sourceFile = checkedProgram.result.getSourceFile(cur.fileName);
            diagnostics += checkedProgram.result.getSemanticDiagnostics(sourceFile).length;
            let text = "";
            checkedProgram.result.emit(sourceFile, (_name, emittedText) => (text += emittedText));
            return [stem(cur.fileName), text];
        })
    );
    results.h = microBatchResult({ inFlight, sources: batchedSources, label: variant, transpiled, created: checkedProgram, typeChecked, diagnostics });
    return results;
};

const notMeasurable = error => ({ status: NOT_MEASURABLE, reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });

const guard = (results, key, fn) => {
    try {
        results[key] = fn();
    } catch (error) {
        if (error instanceof CorrectnessError) {
            throw error;
        }
        results[key] = notMeasurable(error);
    }
};

const guardAsync = async (results, key, fn) => {
    try {
        results[key] = await fn();
    } catch (error) {
        if (error instanceof CorrectnessError) {
            throw error;
        }
        results[key] = notMeasurable(error);
    }
};

const emitText = output => [...output.outputFiles.values()].map(cur => cur.text).join("\n");

const runNative = async ({ versionsDir, corpus, edits, inFlight }) => {
    const { resolve } = createRequire(path.join(versionsDir, "package.json"));
    const sources = corpus.files.map(fileName => ({ fileName, text: fs.readFileSync(fileName, "utf-8") }));
    const results = {};
    const cwd = corpus.dir;
    let api;

    // (a) cold start: import of ts71/sync, `new API` (spawns tsc --api) and the first transpileModule
    try {
        const loadStart = performance.now();
        const { API } = await import(pathToFileURL(resolve("ts71/sync")).href);
        const loadMs = performance.now() - loadStart;
        const first = measure(() => {
            api = new API({ cwd });
            return api.transpileModule(sources[0].text, { compilerOptions: COMPILER_OPTIONS, fileName: sources[0].fileName, reportDiagnostics: true });
        });
        const { version } = JSON.parse(fs.readFileSync(resolve("ts71/package.json"), "utf-8"));
        results.a = { status: "ok", ms: loadMs + first.ms, loadMs, firstCallMs: first.ms, version };
    } catch (error) {
        results.a = notMeasurable(error);
    }
    if (!api) {
        ["b", "c", "e", "f", "g", "h"].forEach(key => (results[key] = { status: NOT_MEASURABLE, reason: `no API: cold start failed (${results.a.reason})` }));
        return results;
    }

    // (b) per-file transpileModule, cold then warm; 7.1 has no transformers option (see ts71-transformer-probe.cjs)
    guard(results, "b", () => {
        const cold = transpilePass((text, options) => api.transpileModule(text, options), sources, () => undefined);
        const warm = transpilePass((text, options) => api.transpileModule(text, options), sources, () => undefined);
        return {
            status: "ok",
            transformersApplied: false,
            markerModules: corpus.markerFiles.length,
            transformedCold: cold.transformed,
            transformedWarm: warm.transformed,
            cold: summarizeCalls(cold.durations),
            warm: summarizeCalls(warm.durations),
        };
    });

    // (c) one createProgram, then per file getSemanticDiagnostics and getJavaScriptEmit
    guard(results, "c", () => {
        const created = measure(() => api.createProgram(corpus.files, PROGRAM_OPTIONS));
        let emittedFiles = 0;
        const result = typeCheckedPass(created, corpus.files, fileName => ({
            check: () => created.result.getSemanticDiagnostics([fileName]).length,
            emit: () => (emittedFiles += created.result.getJavaScriptEmit([fileName]).outputFiles.size),
        }));
        return { ...result, emittedFiles };
    });

    // (e) a snapshot with a synthetic program; per edit: write, update with fileNotifications and ensurePrograms, emit
    guard(results, "e", () => {
        let snapshot = api.createSnapshot({ createPrograms: [{ rootFiles: corpus.files, compilerOptions: PROGRAM_OPTIONS }] });
        const programId = snapshot.operation.createdPrograms[0].id;
        const editSamples = leafIndices(corpus.count, edits).map((leaf, i) => {
            const revision = i + 1;
            const { file, lines } = corpus.modules[leaf];
            const text = corpusModule.createModuleSource(leaf, corpus.count, lines, revision);
            const marker = corpusModule.editMarker(leaf, revision);
            const { ms } = measure(() => {
                fs.writeFileSync(file, text);
                const previous = snapshot;
                snapshot = snapshot.update({ fileNotifications: { changed: [file] }, ensurePrograms: true });
                previous.dispose();
                const output = emitText(snapshot.getProgram(programId).getJavaScriptEmit([file]));
                if (!output.includes(marker)) {
                    throw new CorrectnessError(`7.1 (e): stale emit for ${file}, revision ${revision} missing "${marker}"`);
                }
            });
            return ms;
        });
        snapshot.dispose();
        return { status: "ok", edits: summarizeCalls(editSamples), emitAsserted: true };
    });
    api.close();
    api = undefined;

    // (f) the async API: --in-flight calls in flight over one JSON-RPC channel against sequential calls on it
    await guardAsync(results, "f", async () => {
        const { API } = await import(pathToFileURL(resolve("ts71/async")).href);
        const asyncApi = new API({ cwd });
        try {
            const transpile = ({ fileName, text }) => asyncApi.transpileModule(text, { compilerOptions: COMPILER_OPTIONS, fileName, reportDiagnostics: true });
            await transpile(sources[0]);
            const sequentialStart = performance.now();
            for (const source of sources) {
                await transpile(source);
            }
            const sequentialMs = performance.now() - sequentialStart;
            const queue = [...sources];
            const worker = async () => {
                for (let next = queue.shift(); next; next = queue.shift()) {
                    await transpile(next);
                }
            };
            const concurrentStart = performance.now();
            await Promise.all(Array.from({ length: inFlight }, worker));
            const concurrentMs = performance.now() - concurrentStart;
            return {
                status: "ok",
                modules: sources.length,
                sequentialMs,
                sequentialPerSecond: (sources.length * 1000) / sequentialMs,
                concurrentMs,
                concurrentPerSecond: (sources.length * 1000) / concurrentMs,
                inFlight,
            };
        } finally {
            await asyncApi.close();
        }
    });

    // (g) and (h) on a new sync API, its server started by an untimed transpileModule as (b) starts it for (c) and (e);
    // they read the corpus as (e) left it on disk
    const batchedSources = readSources(corpus.files);
    try {
        const { API } = await import(pathToFileURL(resolve("ts71/sync")).href);
        api = new API({ cwd });
        api.transpileModule(sources[0].text, { compilerOptions: COMPILER_OPTIONS, fileName: sources[0].fileName, reportDiagnostics: true });
    } catch (error) {
        results.g = notMeasurable(error);
        results.h = notMeasurable(error);
        api?.close();
        return results;
    }

    // (g) CLI batch: createProgram, one getSemanticDiagnostics over every file, then one getJavaScriptEmit over every file
    guard(results, "g", () => {
        const created = measure(() => api.createProgram(corpus.files, PROGRAM_OPTIONS));
        const checked = measure(() => created.result.getSemanticDiagnostics(corpus.files).length);
        const emitted = measure(() => created.result.getJavaScriptEmit(corpus.files));
        const outputs = new Map([...emitted.result.outputFiles.entries()].map(([name, cur]) => [stem(name), cur.text]));
        return cliBatchResult(created, checked, emitted, assertMarkers("7.1 (g)", batchedSources, outputs));
    });

    // (h) loader micro-batch: per --in-flight chunk one api.batch of transpileModule generators, then on a new program
    // one api.batch of getSemanticDiagnostics and getJavaScriptEmit generators, one pair per file
    guard(results, "h", () => {
        const chunks = chunksOf(batchedSources, inFlight);
        const transpiled = microBatchPass(chunks, chunk =>
            api
                .batch(...chunk.map(cur => api.transpileModule.gen(cur.text, { compilerOptions: COMPILER_OPTIONS, fileName: cur.fileName, reportDiagnostics: true })))
                .map((output, i) => [stem(chunk[i].fileName), output.outputText])
        );
        const created = measure(() => api.createProgram(corpus.files, PROGRAM_OPTIONS));
        let diagnostics = 0;
        const typeChecked = microBatchPass(chunks, chunk => {
            const outputs = api.batch(...chunk.flatMap(cur => [created.result.getSemanticDiagnostics.gen([cur.fileName]), created.result.getJavaScriptEmit.gen([cur.fileName])]));
            return chunk.map((cur, i) => {
                diagnostics += outputs[2 * i].length;
                return [stem(cur.fileName), emitText(outputs[2 * i + 1])];
            });
        });
        return microBatchResult({ inFlight, sources: batchedSources, label: "7.1", transpiled, created, typeChecked, diagnostics });
    });
    api.close();
    return results;
};

// The untimed pass: (b) once on the sync 7.1 API with collectTiming, for bytes and server time per file
const runPayload = async ({ versionsDir, corpus }) => {
    const { resolve } = createRequire(path.join(versionsDir, "package.json"));
    const sources = corpus.files.map(fileName => ({ fileName, text: fs.readFileSync(fileName, "utf-8") }));
    const { API } = await import(pathToFileURL(resolve("ts71/sync")).href);
    const api = new API({ cwd: corpus.dir, collectTiming: true });
    try {
        api.transpileModule(sources[0].text, { compilerOptions: COMPILER_OPTIONS, fileName: sources[0].fileName, reportDiagnostics: true });
        api.resetTimingInfo();
        transpilePass((text, options) => api.transpileModule(text, options), sources, () => undefined);
        const totals = api.getTimingInfo().totals;
        const files = sources.length;
        const sourceBytes = sources.reduce((sum, cur) => sum + Buffer.byteLength(cur.text), 0);
        return {
            status: "ok",
            files,
            requestCount: totals.requestCount,
            bytesSentPerFile: totals.bytesSent / files,
            bytesReceivedPerFile: totals.bytesReceived / files,
            serverMsPerFile: totals.serverTimeMs / files,
            transportOverheadMsPerFile: totals.transportOverheadMs / files,
            roundTripMsPerFile: totals.roundTripMs / files,
            meanSourceBytesPerFile: sourceBytes / files,
            totals,
        };
    } finally {
        api.close();
    }
};

const runChild = async child => {
    const results =
        child.mode === "payload" ? await runPayload(child) : child.variant === NATIVE ? await runNative(child) : runInProcess(child);
    console.log(`BENCH ${JSON.stringify({ variant: child.variant, size: child.corpus.size, round: child.round, mode: child.mode, results })}`);
};

// ---------------------------------------------------------------------------------------------------------------------
// Parent: versions, machine block, interleaved children, summaries, the decision
// ---------------------------------------------------------------------------------------------------------------------

const command = (cmd, args, cwd) => {
    const result = spawnSync(cmd, args, { cwd, encoding: "utf-8" });
    return result.status === 0 ? result.stdout.trim() : undefined;
};

const machineBlock = () => {
    const git = {
        head: command("git", ["rev-parse", "HEAD"], __dirname),
        perfDirty: (command("git", ["status", "--porcelain", "--", "packages/webpack-test/perf"], __dirname) ?? "") !== "",
    };
    const power = process.platform === "darwin" ? command("pmset", ["-g", "batt"])?.split("\n")[0] : undefined;
    return {
        node: { version: process.version, v8: process.versions.v8, execPath: process.execPath },
        machine: {
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            cpu: os.cpus()[0]?.model,
            cpus: os.cpus().length,
            totalMemBytes: os.totalmem(),
            loadavgStart: os.loadavg(),
            loadavgEnd: undefined,
            power,
        },
        git,
    };
};

const printMachine = ({ node, machine, git }, versions, versionsDir, options) => {
    console.log(`Node ${node.version} (V8 ${node.v8}) at ${node.execPath}`);
    console.log(`Machine ${machine.platform} ${machine.arch} ${machine.release}, ${machine.cpu} x${machine.cpus}, ${(machine.totalMemBytes / 1024 ** 3).toFixed(0)} GiB`);
    console.log(`Load average at start ${machine.loadavgStart.map(cur => cur.toFixed(2)).join(" ")}${machine.power ? `, power: ${machine.power}` : ""}`);
    console.log(`Git ${git.head ?? "unknown"}${git.perfDirty ? " (packages/webpack-test/perf dirty)" : ""}`);
    console.log(`Versions in ${versionsDir}:`);
    Object.entries(versions).forEach(([alias, cur]) => console.log(`  ${alias}: ${cur.name ?? cur.package}@${cur.version} ${cur.integrity}`));
    console.log(`IPC: sync ${IPC_ENCODINGS.sync}; async ${IPC_ENCODINGS.async}`);
    console.log(`Options ${JSON.stringify(options)}`);
};

// The child config goes through a temp file, not the environment: at 1,000 modules it is about 220 KB, above Linux's 128 KiB
// limit for one environment string (E2BIG), and every grandchild (tsc --api) would inherit it.
const spawnChild = (child, label) => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "websmith-ts71-child-"));
    const configFile = path.join(configDir, "child.json");
    let result;
    try {
        fs.writeFileSync(configFile, JSON.stringify(child));
        result = spawnSync(process.execPath, [__filename, "--child", configFile], {
            cwd: child.corpus.dir,
            encoding: "utf-8",
            maxBuffer: 256 * 1024 * 1024,
        });
    } finally {
        fs.rmSync(configDir, { recursive: true, force: true });
    }
    const line = (result.stdout ?? "").split("\n").find(cur => cur.startsWith("BENCH "));
    if (!line) {
        throw new Error(`${label} reported no result (exit ${result.status}):\n${(result.stdout ?? "").slice(-4000)}\n${(result.stderr ?? "").slice(-4000)}`);
    }
    return JSON.parse(line.slice("BENCH ".length));
};

const runProbe = versionsDir => {
    const result = spawnSync(process.execPath, [path.join(__dirname, "ts71-transformer-probe.cjs")], {
        cwd: versionsDir,
        encoding: "utf-8",
        env: { ...process.env, TS71_VERSIONS_DIR: versionsDir },
    });
    const line = (result.stdout ?? "").split("\n").find(cur => cur.startsWith("PROBE "));
    if (!line) {
        return { status: NOT_MEASURABLE, reason: `probe printed no PROBE line (exit ${result.status}): ${(result.stderr ?? "").slice(-2000)}` };
    }
    console.log(line);
    return JSON.parse(line.slice("PROBE ".length));
};

const describeRun = run => {
    const { variant, results: r } = run;
    const part = (key, text) => (r[key]?.status === "ok" ? text : `${key} ${NOT_MEASURABLE}`);
    return (
        `round ${run.round + 1} size ${run.size} ${variant}: ` +
        [
            part("a", `a ${fmt(r.a?.ms, 0)} ms`),
            part("b", `b cold ${fmt(r.b?.cold?.medianMs, 2)} warm ${fmt(r.b?.warm?.medianMs, 2)} ms/file`),
            part("c", `c ${fmt(r.c?.totalMs, 0)} ms`),
            part("e", `e ${fmt(r.e?.edits?.medianMs, 1)}${r.e?.cachedHost ? ` (cached host ${fmt(r.e.cachedHost.medianMs, 1)})` : ""} ms/edit`),
            part("f", `f ${fmt(r.f?.sequentialPerSecond, 0)}${r.f?.concurrentPerSecond ? `/${fmt(r.f.concurrentPerSecond, 0)}` : ""} modules/s`),
            part("g", `g ${fmt(r.g?.totalMs, 0)} ms`),
            part("h", `h ${fmt(r.h?.transpile?.perSecond, 0)}/${fmt(r.h?.typeChecked?.perSecond, 0)} modules/s`),
        ].join(", ")
    );
};

const pick = (runs, variant, fn) => runs.filter(cur => cur.variant === variant).map(fn);
const okOnly = (runs, variant, key) => runs.filter(cur => cur.variant === variant && cur.results[key]?.status === "ok");
const reasons = (runs, variant, key) =>
    runs
        .filter(cur => cur.variant === variant && cur.results[key]?.status !== "ok")
        .map(cur => cur.results[key]?.reason)
        .filter(Boolean);

const summarizeSize = runs => {
    const summary = {};
    VARIANTS.forEach(variant => {
        const of = key => okOnly(runs, variant, key);
        const unmeasured = key => (of(key).length === 0 ? { status: NOT_MEASURABLE, reason: reasons(runs, variant, key)[0] ?? "no run" } : { status: "ok" });
        summary.a = { ...summary.a, [variant]: { ...unmeasured("a"), ...stats(pick(of("a"), variant, cur => cur.results.a.ms)), loadMs: stats(pick(of("a"), variant, cur => cur.results.a.loadMs)) } };
        summary.b = {
            ...summary.b,
            [variant]: {
                ...unmeasured("b"),
                warm: stats(pick(of("b"), variant, cur => cur.results.b.warm.medianMs)),
                cold: stats(pick(of("b"), variant, cur => cur.results.b.cold.medianMs)),
                warmP95: stats(pick(of("b"), variant, cur => cur.results.b.warm.p95Ms)),
                warmTotal: stats(pick(of("b"), variant, cur => cur.results.b.warm.totalMs)),
                coldTotal: stats(pick(of("b"), variant, cur => cur.results.b.cold.totalMs)),
                transformersApplied: of("b")[0]?.results.b.transformersApplied,
                markerModules: of("b")[0]?.results.b.markerModules,
                transformedWarm: of("b")[0]?.results.b.transformedWarm,
            },
        };
        summary.c = {
            ...summary.c,
            [variant]: {
                ...unmeasured("c"),
                total: stats(pick(of("c"), variant, cur => cur.results.c.totalMs)),
                createProgram: stats(pick(of("c"), variant, cur => cur.results.c.createProgramMs)),
                check: stats(pick(of("c"), variant, cur => cur.results.c.checks.medianMs)),
                emit: stats(pick(of("c"), variant, cur => cur.results.c.emits.medianMs)),
                perFile: stats(pick(of("c"), variant, cur => cur.results.c.perFile.medianMs)),
                perFileP95: stats(pick(of("c"), variant, cur => cur.results.c.perFile.p95Ms)),
                semanticDiagnostics: of("c")[0]?.results.c.semanticDiagnostics,
            },
        };
        summary.e = {
            ...summary.e,
            [variant]: {
                ...unmeasured("e"),
                perEdit: stats(pick(of("e"), variant, cur => cur.results.e.edits.medianMs)),
                perEditCachedHost: stats(pick(of("e"), variant, cur => cur.results.e.cachedHost?.medianMs)),
            },
        };
        summary.f = {
            ...summary.f,
            [variant]: {
                ...unmeasured("f"),
                sequentialPerSecond: stats(pick(of("f"), variant, cur => cur.results.f.sequentialPerSecond)),
                concurrentPerSecond: stats(pick(of("f"), variant, cur => cur.results.f.concurrentPerSecond)),
                inFlight: of("f")[0]?.results.f.inFlight,
            },
        };
        summary.g = {
            ...summary.g,
            [variant]: {
                ...unmeasured("g"),
                total: stats(pick(of("g"), variant, cur => cur.results.g.totalMs)),
                createProgram: stats(pick(of("g"), variant, cur => cur.results.g.createProgramMs)),
                check: stats(pick(of("g"), variant, cur => cur.results.g.checkMs)),
                emit: stats(pick(of("g"), variant, cur => cur.results.g.emitMs)),
                diagnostics: of("g")[0]?.results.g.diagnostics,
            },
        };
        const batches = (path, fn) => stats(pick(of("h"), variant, cur => fn(cur.results.h[path])));
        summary.h = {
            ...summary.h,
            [variant]: {
                ...unmeasured("h"),
                inFlight: of("h")[0]?.results.h.inFlight,
                ...Object.fromEntries(
                    ["transpile", "typeChecked"].map(path => [
                        path,
                        {
                            perFile: batches(path, cur => cur.perFile.medianMs),
                            batch: batches(path, cur => cur.medianMs),
                            batchP95: batches(path, cur => cur.p95Ms),
                            perSecond: batches(path, cur => cur.perSecond),
                            batches: of("h")[0]?.results.h[path].calls,
                        },
                    ])
                ),
            },
        };
    });
    return summary;
};

const printSummary = (size, summary, runs) => {
    console.log(`\nSize ${size} (${runs} runs per variant; median [min–max] over runs)`);
    const line = (label, fn) => {
        console.log(`  ${label}`);
        VARIANTS.forEach(variant => console.log(`    ${variant.padEnd(6)} ${fn(variant)}`));
    };
    const na = (cur, text) => (cur.status === "ok" ? text : `${NOT_MEASURABLE}: ${cur.reason}`);
    line("(a) cold start ms (load + first transpileModule)", v => na(summary.a[v], `${fmtStats(summary.a[v], 0)} (load ${fmtStats(summary.a[v].loadMs, 0)})`));
    line("(b) transpileModule ms per file, warm pass (judged)", v =>
        na(summary.b[v], `${fmtStats(summary.b[v].warm, 3)}, p95 ${fmtStats(summary.b[v].warmP95, 3)}, pass total ${fmtStats(summary.b[v].warmTotal, 0)} ms`)
    );
    line("(b) transpileModule ms per file, cold pass (unjudged)", v => na(summary.b[v], `${fmtStats(summary.b[v].cold, 3)}, pass total ${fmtStats(summary.b[v].coldTotal, 0)} ms`));
    line("(b) before transformer on marker modules", v =>
        na(summary.b[v], `${summary.b[v].transformersApplied ? "applied" : "not expressible"}: ${summary.b[v].transformedWarm}/${summary.b[v].markerModules} marker modules transformed`)
    );
    line("(c) createProgram + per-file semantic check and emit, cold, total ms", v =>
        na(
            summary.c[v],
            `${fmtStats(summary.c[v].total, 0)} (createProgram ${fmtStats(summary.c[v].createProgram, 0)}, per file ${fmtStats(summary.c[v].perFile, 3)} ms, ` +
                `p95 ${fmtStats(summary.c[v].perFileP95, 3)}; check ${fmtStats(summary.c[v].check, 3)}, emit ${fmtStats(summary.c[v].emit, 3)} ms/file; ` +
                `${summary.c[v].semanticDiagnostics} semantic diagnostics)`
        )
    );
    line("(e) watch rebuild ms per edit, judged (in process: websmith's host, which re-parses every file per edit)", v =>
        na(summary.e[v], fmtStats(summary.e[v].perEdit, 2))
    );
    line("(e) watch rebuild ms per edit, in process with a host reusing unchanged SourceFiles (unjudged)", v =>
        v === NATIVE ? "n/a (the 7.1 snapshot keeps its own SourceFiles: see the judged row)" : na(summary.e[v], fmtStats(summary.e[v].perEditCachedHost, 2))
    );
    line("(f) throughput modules/s, sequential / in flight", v =>
        na(summary.f[v], `${fmtStats(summary.f[v].sequentialPerSecond, 0)}${summary.f[v].concurrentPerSecond ? ` / ${fmtStats(summary.f[v].concurrentPerSecond, 0)} (${summary.f[v].inFlight} in flight)` : ""}`)
    );
    line("(g) CLI batch: createProgram + all checks + one emit of every file, total ms", v =>
        na(
            summary.g[v],
            `${fmtStats(summary.g[v].total, 0)} (createProgram ${fmtStats(summary.g[v].createProgram, 0)}, check ${fmtStats(summary.g[v].check, 0)}, ` +
                `emit ${fmtStats(summary.g[v].emit, 0)}; ${summary.g[v].diagnostics} diagnostics)`
        )
    );
    const microBatch = cur =>
        `${fmtStats(cur.perFile, 3)} ms/file, batch ${fmtStats(cur.batch, 2)} ms, p95 ${fmtStats(cur.batchP95, 2)} ms over ${cur.batches} batches, ${fmtStats(cur.perSecond, 0)} modules/s`;
    const unit = v => (v === NATIVE ? "one api.batch" : "sequential calls");
    line("(h) loader micro-batch, transpileModule (no transformers)", v => na(summary.h[v], `${unit(v)} per ${summary.h[v].inFlight} files: ${microBatch(summary.h[v].transpile)}`));
    line("(h) loader micro-batch, semantic check + emit", v => na(summary.h[v], `${unit(v)} per ${summary.h[v].inFlight} files: ${microBatch(summary.h[v].typeChecked)}`));
};

const printPayload = (size, payload) => {
    console.log(`\nIPC payload, size ${size} (untimed 7.1 pass of (b) with collectTiming)`);
    if (payload.status !== "ok") {
        console.log(`  ${NOT_MEASURABLE}: ${payload.reason}`);
        return;
    }
    console.log(`  encoding ${IPC_ENCODINGS.sync}`);
    console.log(
        `  per file: ${fmt(payload.bytesSentPerFile, 0)} bytes sent, ${fmt(payload.bytesReceivedPerFile, 0)} bytes received, ` +
            `server ${fmt(payload.serverMsPerFile, 3)} ms, transport overhead ${fmt(payload.transportOverheadMsPerFile, 3)} ms, ` +
            `round trip ${fmt(payload.roundTripMsPerFile, 3)} ms; mean source ${fmt(payload.meanSourceBytesPerFile, 0)} bytes (${payload.requestCount} requests)`
    );
};

const ratioOf = (value, base) => (typeof value === "number" && typeof base === "number" && base > 0 ? value / base : undefined);

// criteria 3 and 6 have no batched form (one edit is one snapshot update, a cold start is one): both results share them
const judgeWatch = (judge, e) =>
    judge("3 (e) watch rebuild per edit, 7.1 / 6.0.3", "ratio", ratioOf(e[NATIVE].perEdit?.median, e[BASELINE].perEdit?.median), 2, v => v <= 2, {
        reason: e[NATIVE].reason,
        native: e[NATIVE].perEdit?.median,
        baseline: e[BASELINE].perEdit?.median,
        baselineCachedHost: e[BASELINE].perEditCachedHost?.median,
    });

const judgeColdStart = (judge, a, options) => {
    // the plan multiplies by the loader instances of a multi-profile build only when one cold start exceeds 1 s
    const instances = options["loader-instances"];
    const cold = a[NATIVE].median;
    judge("6 (a) 7.1 cold start ms (x loader instances above 1 s)", "ms", typeof cold === "number" ? (cold > 1000 ? cold * instances : cold) : undefined, 2000, v => v <= 2000, {
        reason: a[NATIVE].reason,
        coldStartMs: cold,
        loaderInstances: instances,
    });
};

const speedResult = (result, judgeAll) => {
    const criteria = [];
    judgeAll((criterion, metric, value, threshold, ok, detail) => {
        const measurable = typeof value === "number" && Number.isFinite(value);
        criteria.push({ criterion, metric, value: measurable ? value : null, threshold, status: measurable ? (ok(value) ? "met" : "not met") : NOT_MEASURABLE, ...detail });
    });
    return { result, status: criteria.every(cur => cur.status === "met") ? "met" : "not met", criteria };
};

const maxOf = values => (values.every(cur => typeof cur === "number") ? Math.max(...values) : undefined);

const decide = (summary, options) => {
    const { a, b, c, e, f, g, h } = summary;
    const perCall = speedResult("Speed (per call)", judge => {
        judge("1 (b) per-file transpileModule, warm, 7.1 / 6.0.3", "ratio", ratioOf(b[NATIVE].warm?.median, b[BASELINE].warm?.median), 1.5, v => v <= 1.5, {
            reason: b[NATIVE].reason,
            native: b[NATIVE].warm?.median,
            baseline: b[BASELINE].warm?.median,
        });
        judge("2 (c) createProgram + per-file checks and emits, 7.1 / 6.0.3", "ratio", ratioOf(c[NATIVE].total?.median, c[BASELINE].total?.median), 2, v => v <= 2, {
            reason: c[NATIVE].reason,
            native: c[NATIVE].total?.median,
            baseline: c[BASELINE].total?.median,
        });
        judgeWatch(judge, e);
        const p95b = ratioOf(b[NATIVE].warmP95?.median, b[NATIVE].warm?.median);
        const p95c = ratioOf(c[NATIVE].perFileP95?.median, c[NATIVE].perFile?.median);
        judge("4 7.1 p95 / own median, max of (b warm) and (c per file)", "ratio", maxOf([p95b, p95c]), 3, v => v <= 3, {
            reason: b[NATIVE].reason ?? c[NATIVE].reason,
            bWarm: p95b,
            cPerFile: p95c,
            components: { "b warm": p95b, "c per file": p95c },
        });
        judge("5 (f) 7.1 throughput in flight / 6.0.3 sequential", "ratio", ratioOf(f[NATIVE].concurrentPerSecond?.median, f[BASELINE].sequentialPerSecond?.median), 1 / 1.5, v => v >= 1 / 1.5, {
            reason: f[NATIVE].reason,
            native: f[NATIVE].concurrentPerSecond?.median,
            baseline: f[BASELINE].sequentialPerSecond?.median,
            inFlight: f[NATIVE].inFlight,
        });
        judgeColdStart(judge, a, options);
    });
    // the same six thresholds over (g) and (h); criterion 4 reads p95 over batches, the unit a host waits for
    const batched = speedResult("Speed (batched)", judge => {
        judge("1 (h) per-file transpileModule in micro-batches, 7.1 / 6.0.3", "ratio", ratioOf(h[NATIVE].transpile?.perFile?.median, h[BASELINE].transpile?.perFile?.median), 1.5, v => v <= 1.5, {
            reason: h[NATIVE].reason,
            native: h[NATIVE].transpile?.perFile?.median,
            baseline: h[BASELINE].transpile?.perFile?.median,
        });
        judge("2 (g) createProgram + all checks + one emit, 7.1 / 6.0.3", "ratio", ratioOf(g[NATIVE].total?.median, g[BASELINE].total?.median), 2, v => v <= 2, {
            reason: g[NATIVE].reason,
            native: g[NATIVE].total?.median,
            baseline: g[BASELINE].total?.median,
        });
        judgeWatch(judge, e);
        const p95t = ratioOf(h[NATIVE].transpile?.batchP95?.median, h[NATIVE].transpile?.batch?.median);
        const p95c = ratioOf(h[NATIVE].typeChecked?.batchP95?.median, h[NATIVE].typeChecked?.batch?.median);
        judge("4 7.1 p95 / own median over batches, max of (h transpile) and (h check + emit)", "ratio", maxOf([p95t, p95c]), 3, v => v <= 3, {
            reason: h[NATIVE].reason,
            components: { "h transpile": p95t, "h check + emit": p95c },
        });
        judge("5 (h) 7.1 micro-batched transpileModule throughput / 6.0.3 sequential", "ratio", ratioOf(h[NATIVE].transpile?.perSecond?.median, h[BASELINE].transpile?.perSecond?.median), 1 / 1.5, v => v >= 1 / 1.5, {
            reason: h[NATIVE].reason,
            native: h[NATIVE].transpile?.perSecond?.median,
            baseline: h[BASELINE].transpile?.perSecond?.median,
            inFlight: h[NATIVE].inFlight,
        });
        judgeColdStart(judge, a, options);
    });
    return [perCall, batched];
};

const printDecision = (decision, size) => {
    decision.forEach(({ result, status, criteria }) => {
        console.log(`\nDecision, ${result} (size ${size}, 7.1 against in-process 6.0.3)`);
        criteria.forEach(cur => {
            const detail =
                cur.status === NOT_MEASURABLE
                    ? ` (${cur.reason ?? "no value"})`
                    : cur.metric === "ratio"
                      ? cur.components
                          ? ` (${Object.entries(cur.components).map(([name, value]) => `${name} ${fmt(value, 3)}`).join(", ")})`
                          : ` (7.1 ${fmt(cur.native, 3)} vs 6.0.3 ${fmt(cur.baseline, 3)}${cur.baselineCachedHost !== undefined ? `; unjudged: 6.0.3 with a SourceFile-caching host ${fmt(cur.baselineCachedHost, 3)}` : ""})`
                      : ` (cold start ${fmt(cur.coldStartMs, 0)} ms${cur.coldStartMs > 1000 ? ` x ${cur.loaderInstances} loader instances = ${fmt(cur.value, 0)} ms` : ""})`;
            const threshold = cur.metric === "ratio" ? (cur.criterion.startsWith("5") ? `>= ${fmt(cur.threshold, 3)}` : `<= ${cur.threshold}`) : `<= ${cur.threshold} ms`;
            console.log(`  ${cur.criterion}: ${cur.value === null ? "n/a" : fmt(cur.value, cur.metric === "ratio" ? 3 : 0)} ${threshold} ${cur.status}${detail}`);
        });
        console.log(`${result}: ${status}`);
    });
};

const main = () => {
    const options = parseOptions(process.argv.slice(2));
    const lockfileHash = sha256(fs.readFileSync(VERSIONS_LOCKFILE));
    const versionsDir = path.resolve(options["versions-dir"] ?? path.join(os.tmpdir(), `websmith-ts71-versions-${lockfileHash.slice(0, 12)}`));
    const repoRoot = command("git", ["rev-parse", "--show-toplevel"], __dirname);
    if (repoRoot && (versionsDir === repoRoot || versionsDir.startsWith(repoRoot + path.sep))) {
        throw new Error(`--versions-dir ${versionsDir} is inside the repository ${repoRoot}; the pinned versions must stay outside the workspace`);
    }
    const meta = machineBlock();
    const expected = expectedVersions();
    const install = installVersions(versionsDir, lockfileHash);
    const versions = verifyVersions(versionsDir, expected);
    const options2 = { ...options, "versions-dir": versionsDir };
    printMachine(meta, versions, versionsDir, { ...options2, installed: install.installed, npm: install.npm });
    console.log("");
    const probe = runProbe(versionsDir);

    const runs = [];
    const summary = {};
    const ipc = {};
    const corpora = {};
    options.sizes.forEach(size => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "websmith-ts71-corpus-")));
        try {
            const write = () => {
                const written = corpusModule.writeCorpus(dir, { size, seed: options.seed });
                if (corpora[size] && corpora[size].hash !== written.hash) {
                    throw new CorrectnessError(`Corpus hash changed between writes for size ${size}: ${corpora[size].hash} then ${written.hash}`);
                }
                return { ...written, dir };
            };
            let corpus = write();
            corpora[size] = { hash: corpus.hash, seed: options.seed, files: corpus.files.length, markerFiles: corpus.markerFiles.length, dir: options.keep ? dir : undefined };
            console.log(`Corpus size ${size}: ${corpus.files.length} files (${corpus.markerFiles.length} marker modules), seed ${options.seed}, hash ${corpus.hash}, in ${dir}`);
            for (let round = 0; round < options.runs; round++) {
                VARIANTS.forEach(variant => {
                    corpus = write();
                    const child = { mode: "timed", variant, round, corpus, versionsDir, edits: options.edits, inFlight: options["in-flight"] };
                    const run = spawnChild(child, `size ${size} round ${round + 1} ${variant}`);
                    runs.push(run);
                    console.log(describeRun(run));
                });
            }
            corpus = write();
            try {
                ipc[size] = spawnChild({ mode: "payload", variant: NATIVE, round: -1, corpus, versionsDir }, `size ${size} payload`).results;
            } catch (error) {
                ipc[size] = notMeasurable(error);
            }
            summary[size] = summarizeSize(runs.filter(cur => cur.size === size));
        } finally {
            if (!options.keep) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        }
    });

    options.sizes.forEach(size => {
        printSummary(size, summary[size], options.runs);
        printPayload(size, ipc[size]);
    });
    console.log(`\nPROBE ${JSON.stringify(probe)}`);
    const largest = Math.max(...options.sizes);
    const decision = decide(summary[largest], options);
    printDecision(decision, largest);
    meta.machine.loadavgEnd = os.loadavg();
    console.log(`Load average at end ${meta.machine.loadavgEnd.map(cur => cur.toFixed(2)).join(" ")}`);

    const out = path.resolve(options.out ?? path.join(os.tmpdir(), `websmith-ts71-bench-${new Date().toISOString().replace(/[:.]/g, "-")}.json`));
    const json = {
        schema: SCHEMA,
        meta: {
            machine: meta.machine,
            node: meta.node,
            git: meta.git,
            versions: { ...versions, versionsDir, ipc: IPC_ENCODINGS, compilerOptions: COMPILER_OPTIONS, programOptions: PROGRAM_OPTIONS, installed: install.installed },
            options: options2,
            corpus: corpora,
            decisionSize: largest,
            timestamp: new Date().toISOString(),
        },
        runs,
        summary,
        ipc,
        probe,
        decision,
    };
    fs.writeFileSync(out, JSON.stringify(json, null, 2));
    console.log(`RESULT ${out}`);
};

if (process.argv[2] === "--child") {
    runChild(JSON.parse(fs.readFileSync(process.argv[3], "utf-8"))).catch(error => {
        console.error(error);
        process.exit(2);
    });
} else {
    main();
}
