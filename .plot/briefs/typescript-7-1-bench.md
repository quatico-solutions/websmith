<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — typescript-6-support (slice: 7.1 bench)

- **Plan (canonical):** `docs/plans/2026-10-02-typescript-6-support.md` on `develop`. Read the slice line (`:314`)
  and the **Spike** bullet under Design → Approach (`:214-250`). This brief turns them into files and commands.
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #144 merged
- **Branch:** `infra/typescript-7-1-bench` (base: `develop`, at `9dccca77` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This slice waits on nothing. The plan placed the spike before the #135-gated slice so that a late #135
cannot stall the measurement. Toolchain (#166), CI leg (#171), fixtures (#183) and websmith-node (#184) are merged.
**`docs/typescript-7-1-measurement` waits on this branch.** It runs this harness at full size, cites this branch's
merge commit, and copies the JSON result next to its report. If a metric is missing, the result format is ambiguous,
or a run cannot be reproduced, that slice is blocked. Its consumer contract is in "Output" below.

Line numbers are from `develop` at `9dccca77`. If lines have moved, find the code by name.

### What changed since the plan (verified 2026-10-13)

- **The 7.1 nightly is `typescript@next`, not `@typescript/native-preview`.** `native-preview` stopped at
  `7.0.0-dev.20260707.2`. TypeScript 7 publishes as `typescript` itself:
  - `latest` is `7.0.2`;
  - `next` is **`7.1.0-dev.20261013.1`**, one nightly per day.
- **The API entry points were renamed on 2026-10-09.** Up to `7.1.0-dev.20261008.1` (and `7.0.2`) they were
  `typescript/unstable/sync` and `typescript/unstable/async`. From `7.1.0-dev.20261009.1` on they are
  `typescript/sync` and `typescript/async`. The story's analysis (`analysis-ts7-api-gap.md:86-88`) still names
  `unstable/*`. This is why the pin matters. Re-pinning must re-check the entry points (see "Re-pinning").
- **Package shape of `7.1.0-dev.20261013.1`** (checked with `npm view` and a scratch install):
  - `"type": "module"`. There is no `main`. The `"."` export is `./lib/version.cjs`, which exports only `version`.
  - The native `tsc` binary comes from seven platform packages, `@typescript/typescript-<platform>-<arch>` at the
    same version, listed as both dependencies and optional dependencies. On this machine (Apple M1 Max, arm64) that
    is `@typescript/typescript-darwin-arm64`.
  - None of these packages has an install script. `npm ci --ignore-scripts` is safe.
  - The installed tree is about 79 MB (5.7.3, 6.0.3 and 7.1 together).
- **The API surface the workloads need is all there.** Both `API` classes have `transpileModule(input, options)`,
  with `TranspileOptions = { compilerOptions, fileName, reportDiagnostics }` and **no `transformers` field**. They
  also have `createProgram(rootFiles, compilerOptions)` → `Program.getJavaScriptEmit(files)`, `createSnapshot` /
  `Snapshot.update`, `getTimingInfo` / `resetTimingInfo`, and `close`. File paths are in the `dist/api/sync/api.d.ts`
  and `dist/api/async/api.d.ts` of the installed package.
- **IPC encodings**, read from the pinned package:
  - The sync client (`dist/api/syncChannel.js:1-11`, `dist/api/sync/client.js:48`) spawns `tsc --api`. It speaks a
    MessagePack tuple protocol `[type, method, payload]` over stdin/stdout, and each payload is
    `JSON.stringify(params)`.
  - The async client (`dist/api/async/client.js`) speaks JSON-RPC (`vscode-jsonrpc`) over stdio.
  - The report names both: MessagePack-framed JSON for (a)–(e), JSON-RPC for (f).
- **Five behaviours I executed** (Node 22.17.0 and 24.21.0, scratch install, all reproduced):
  1. **String enum values make the server panic.** `transpileModule(…, { compilerOptions: { module: "esnext" } })`
     ends with `panic: interface conversion: interface {} is string, not float64`. `RawCompilerOptions` takes enum
     **numbers**. Pass every enum option as a number in all variants. The numbers are the same in 5.7.3, 6.0.3 and
     7.1: `ModuleKind.ESNext` 99, `ScriptTarget.ES2022` 9, `JsxEmit.React` 2.
  2. **A `transformers` option is silently ignored at runtime.** `transpileModule(src, { transformers: { before:
     [...] } })` returns the untransformed output with no error. Type-checking the call against 7.1's own typings
     gives `TS2353: Object literal may only specify known properties, and 'transformers' does not exist in type
     'TranspileOptions'`. Use `node <dir>/node_modules/ts71/bin/tsc --noEmit --module nodenext --target es2022
     --lib esnext --skipLibCheck --types "" probe.mts`. Without `--lib esnext`, the 7.1 `.d.ts` files report TS2550 on
     `Symbol.dispose`.
  3. **A snapshot update reflects an edit only with a synthetic program and `ensurePrograms: true`.**
     `api.createSnapshot({ createPrograms: [{ rootFiles, compilerOptions }] })`, then the edit, then
     `snapshot.update({ fileNotifications: { changed: [file] }, ensurePrograms: true })`, then
     `getProgram(id).getJavaScriptEmit([file])` emits the new text. A layer works too:
     `update({ fileSystem: { kind: "layer", files: { [file]: text } }, ensurePrograms: true })`. A snapshot opened with
     `openFiles` (a configured project) and updated with `fileNotifications` alone **kept emitting the old text**. So
     workload (e) must assert that the emitted text contains the edit, or it times a stale emit.
  4. **`getJavaScriptEmit` returns `outputFiles` as a `Map`.** Each key is the output path and each value is
     `{ text, sourceFileName }`. `JSON.stringify` prints it as `{}`.
  5. **`collectTiming: true` on either client fills `getTimingInfo().totals`** with
     `{ requestCount, roundTripMs, bytesSent, bytesReceived, serverTimeMs, transportOverheadMs, … }`. Example run on
     this machine (Node 22): 202 tiny `transpileModule` calls sent 21,611 bytes and received 8,593 bytes, with 40 ms
     server time out of 161 ms round trip. Use this for "payload bytes per file".
- **Aliased install works.** One npm manifest with `"ts573": "npm:typescript@5.7.3"`, `"ts603":
  "npm:typescript@6.0.3"` and `"ts71": "npm:typescript@7.1.0-dev.20261013.1"` installs all three side by side:
  - 7.1 finds its platform binary from the alias directory;
  - `createRequire(<dir>/package.json).resolve("ts71/sync")` gives the ESM file to `import()`;
  - `require("ts603")` and `require("ts573")` load the classic API in-process;
  - `node_modules/.bin/tsc` collides between the aliases (it was 5.7.3). Always call a binary by its package path.
- **`npm ci` enforces the committed integrity.** A lockfile with one altered `typescript-7.1.0-dev` hash failed with
  `npm error code EINTEGRITY … wanted sha512-AAAAAA… but got sha512-wEt6fQ…`.
- **websmith's `before` transformer call site moved.** The plan cites `Compiler.ts:1089`. The fast path now calls
  `ts.transpileModule(content, { compilerOptions, fileName, reportDiagnostics: true, transformers:
  ctx.getTransformers() })` at `packages/core/src/compiler/Compiler.ts:1430`, inside `transpileSourceCode` (`:1299`).
  The cached program with `oldProgram` is at `:1052-1057` (`createProgram`, `:1036`). The harness mirrors these two
  call shapes in-process.

### The pins

The new `ts71-versions.json` (below) pins these versions. The integrity values come from the npm registry,
`dist.integrity`:

| Alias | Package | Integrity |
|---|---|---|
| `ts573` | `typescript@5.7.3` | `sha512-84MVSjMEHP+FQRPy3pX9sTVV/INIex71s9TL2Gm5FG/WG1SqXeKyZ0k7/blY/4FdOzI12CBy1vGc4og/eus0fw==` |
| `ts603` | `typescript@6.0.3` | `sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw==` |
| `ts71` | `typescript@7.1.0-dev.20261013.1` | `sha512-wEt6fQCqhZ3hrbIUaO2LS7d94FSzH+xGP+/KJCxFNFHQiG/W2L0rJ/1B7lAQv6VKntlmjWuzYQ8LABuLZ3W/sg==` |
| (binary) | `@typescript/typescript-darwin-arm64@7.1.0-dev.20261013.1` | `sha512-V22DvbTQjg6kMEqU5hhZmxhZqTNdbwNz3YB1CULEtxH7gxMxPvFpMM5rbJQgZlhabo0DxvsFfTdUNjOTr4IPIQ==` |

The lockfile records all seven platform binaries with their integrity, and npm installs only the matching one.
Check your generated lockfile against this table. A mismatch means the registry changed or you resolved a different
version. Stop and report it.

**Why not `pnpm-lock.yaml`.** The plan requires "installed in an isolated directory outside the workspace (so it
never joins the matrix)". Any `package.json` under `packages/` is a workspace package, because `pnpm-workspace.yaml:2`
says `packages/**`. That has three effects:

- `pnpm install` in CI would install a 7.x `typescript`.
- The CI version assertion (`.github/workflows/pull-request.yml`, the `assert typescript version` step) counts
  workspace packages and requires every one to resolve the matrix `typescript`. One more package that resolves
  7.1 or 5.7.3 makes the 6.0.3 cell fail.
- nx would pick it up as a project.

A `devDependencies` alias in `packages/webpack-test/package.json` is rejected for the same reasons: it enters the CI
install, and the override cell's `pnpm.overrides.typescript` may rewrite it. So:

- the pin is an **npm lockfile committed under a name that is not `package-lock.json`**, next to a manifest that is
  not named `package.json`;
- the harness copies both into an isolated directory **outside the repository** and runs `npm ci` there;
- `pnpm-lock.yaml` does not change, and no `package.json` gains a dependency.

### What to build

All new files go **directly** in `packages/webpack-test/perf/`, as `.cjs`. That matters for two reasons:

- the lint script globs `perf/**/*.{js,cjs,ts,tsx}` (`packages/webpack-test/package.json:9`);
- the ESLint block for plain CommonJS scripts (`eslint.config.js:138-152`, `files: ["**/perf/*.cjs"]`) matches only
  `.cjs` files directly in `perf/`. It turns off `no-require-imports` and `no-console` and sets node globals. A `.mjs`
  file or a subdirectory falls outside it.

The 7.1 API is ESM. Load it from `.cjs` with `await import(pathToFileURL(resolved).href)`.

1. **`ts71-versions.json` + `ts71-versions.lock.json`** (the pin):
   - The manifest is `{ "name": "websmith-ts71-bench-versions", "private": true, "dependencies": { "ts573":
     "npm:typescript@5.7.3", "ts603": "npm:typescript@6.0.3", "ts71": "npm:typescript@7.1.0-dev.20261013.1" } }`.
   - The lockfile is npm's `lockfileVersion: 3`. Generate it once in a scratch directory and copy it in:

     ```bash
     export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"
     D=$(mktemp -d /private/tmp/claude-501/ts71-pin.XXXX); : > "$D/.empty-npmrc"
     command cp -f packages/webpack-test/perf/ts71-versions.json "$D/package.json"
     (cd "$D" && NPM_CONFIG_USERCONFIG="$D/.empty-npmrc" npm install --package-lock-only --ignore-scripts \
        --registry=https://registry.npmjs.org/)
     command cp -f "$D/package-lock.json" packages/webpack-test/perf/ts71-versions.lock.json
     trash "$D"
     ```

   - Check that the lockfile has 10 `"integrity"` entries: 3 aliases and 7 platform binaries. Compare them with the
     table above.
2. **`ts71-corpus.cjs`**, the seeded corpus generator. It is a module with no side effects on load, exporting
   `writeCorpus(dir, { size, seed })` → `{ files, markerFiles, hash }`:
   - **Seeded PRNG.** Use something small and explicit, such as mulberry32. The default seed is a committed
     constant. Never use `Math.random`.
   - **Module sizes** are drawn from websmith's own `packages/*/src` line-count distribution, committed as a constant
     array. Measured at `9dccca77`: 167 files (`*.ts`/`*.tsx` under `packages/*/src`, excluding `*.spec.*`,
     `*.test.*` and `*.d.ts`), with min 2, p25 12, p50 29, p75 81, p90 236 and max 1654 lines. Commit the raw
     per-file counts and the one-line command that produced them, in a comment. Draw from that array with the PRNG.
     Then fill each module to its drawn line count with repeated code blocks of the kind `esm-watch-bench.cjs:96-117`
     emits (interface, class with a method, exported consts).
   - **Import shape:** the binary tree of `esm-watch-bench.cjs:91-92`. Module *i* imports *2i+1* and *2i+2*, through
     relative `.js` specifiers, in `d<i % 10>/m<i>.ts` directories (`:82-83`).
   - **About 10% transformer-marked modules,** as `esm-watch-bench.cjs:93` does (`index % 10 === 3` →
     `// bench-addon`).
   - **The `webpack-test` fixtures are part of the corpus.** Copy the 9 files of `packages/webpack-test/src`
     (`*.ts` and `index.tsx`) into `fixtures/`. A corpus of size *N* is those 9 plus *N − 9* generated modules, so
     "200" and "1,000 modules" are exact totals. `index.tsx` imports `react`, which is not installed in the corpus
     directory. That costs only diagnostics, and no workload requests diagnostics in a timed loop.
   - **`hash`:** sha256 over the sorted relative paths and contents. The same `size` and `seed` must give the same
     hash, on Node 22 and 24.
   - Write the corpus to `fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "websmith-ts71-corpus-")))`, as
     `esm-watch-bench.cjs:312` does, because the native side needs real paths on macOS. Remove it unless `--keep`.
3. **`ts71-bench.cjs`**, the harness (parent and child in one file, like `esm-watch-bench.cjs:385-389`):
   - **Version setup** (parent, before any run):
     - Use the directory `--versions-dir`, default `path.join(os.tmpdir(), "websmith-ts71-versions-<first 12 hex of
       sha256(lockfile)>")`. It must be outside the repository.
     - Copy `ts71-versions.json` → `package.json` and `ts71-versions.lock.json` → `package-lock.json`, and write an
       empty `.npmrc` beside them.
     - Run `npm ci --ignore-scripts --registry=https://registry.npmjs.org/` there, with `NPM_CONFIG_USERCONFIG`
       pointing at that empty file. **Never read or edit `~/.npmrc`.** Use the npm next to `process.execPath`, so
       that npm and node come from the same installation.
     - Skip the install when a marker file in the directory holds the same lockfile hash.
     - Afterwards, read each alias's `package.json` version and the lockfile's `integrity`. **Abort** if either
       differs from the committed lockfile. Also abort if the platform binary for `process.platform`-`process.arch`
       is missing, naming the platform.
   - **Variants:**
     - `5.7.3` and `6.0.3` run in-process through `require` of the alias (the classic API).
     - `7.1` runs through the pinned `ts71/sync` for (a)–(e) and `ts71/async` for (f).
     - Resolve every path through `createRequire(path.join(versionsDir, "package.json"))`. Never use the
       workspace's `typescript`: after `feature/typescript-6-peer-range` the workspace pin moves, and the harness must
       not move with it.
   - **Compiler options, identical in every variant, numeric enums only** (finding 1): `target` 9, `module` 99,
     `jsx` 2, `strict` true. Add `moduleResolution` 100 (Bundler, valid with `module` ESNext on 5.7.3 and 6.0.3) for
     (c) and (e) only.
   - **Workloads** (plan `:219-225`). Each runs once per child process. Record raw samples in milliseconds from
     `performance.now()`.
     - **(a) Cold start.**
       - In-process: `require` of the alias plus the first `transpileModule`.
       - 7.1: `new API({ cwd })` (which spawns `tsc --api`) plus the first `transpileModule`.
       - Measure it as the first thing a fresh child does.
     - **(b) Per-file `transpileModule`,** one call per corpus module, with the source text passed per call as the
       loader holds it (`transpileModule(text, { compilerOptions, fileName, reportDiagnostics: true })`).
       - In-process: the marker modules get `transformers: { before: [<the esm-watch-bench transformer,
         :129-144>] }`, which mirrors `Compiler.ts:1430`.
       - 7.1 cannot express it: record `transformersApplied: false` and the number of marker modules.
       - Run two passes over the corpus in the same child. Pass 1 is **cold**; pass 2 is **warm**.
       - Keep every per-call duration, so that p95 can be computed.
     - **(c) Type-checked loader path, cold.** One `createProgram` over the corpus, then one emit per file. Time the
       `createProgram` and each per-file emit separately; the workload total is their sum.
       - In-process: `ts.createProgram(files, options)`, then `program.emit(sourceFile, writeFile)` with the output
         captured in memory.
       - 7.1: `api.createProgram(files, options)`, then `program.getJavaScriptEmit([file])` per file.
     - **(d)** is (b) and (c) on 5.7.3 and 6.0.3. There is nothing separate to build. The summary shows them as
       baseline columns. The rule reads 6.0.3; 5.7.3 is context.
     - **(e) Watch rebuild.** Start from a built program over the corpus, then make 30 edits (`--edits`, the
       `esm-watch-bench` default), each to a different leaf.
       - Choose the leaves as `esm-watch-bench.cjs:232` does: `Math.floor(n / 2) + ((i * 7) % Math.floor(n / 2))`.
       - In-process: `ts.createProgram({ rootNames, options, host, oldProgram })` with a host that serves the edited
         text, then emit the edited file. This mirrors `Compiler.ts:1052-1057`.
       - 7.1: write the file, then `snapshot.update({ fileNotifications: { changed: [file] }, ensurePrograms: true })`
         on a snapshot created with `createPrograms`, then `getJavaScriptEmit([file])` (finding 3).
       - **In every variant, assert that the emitted text contains the edit's marker.** Abort on a stale emit.
     - **(f) Concurrency.**
       - 7.1, one async `API` (one JSON-RPC channel): all corpus modules with 8 calls in flight (a pool of 8 workers
         over one queue), against the same modules sequentially on that channel.
       - In-process 6.0.3 and 5.7.3: the same modules sequentially. They have one thread, so 8 in flight has no
         meaning there.
       - Report throughput in modules per second.
   - **Payload bytes** (plan `:226-227`): in a separate, **untimed** 7.1 pass per size, so that timing collection does
     not perturb the timed runs:
     - use `new API({ cwd, collectTiming: true })`, call `resetTimingInfo()`, run (b) once, then read
       `getTimingInfo().totals`;
     - report bytes sent and bytes received per file, server ms per file, transport overhead ms per file, and the
       corpus' mean source bytes per file for reference.
   - **"Not measurable"** (plan `:225`): wrap each 7.1 workload. A thrown error or a missing method records
     `{ status: "not measurable", reason }` and the run continues. The decision summary counts it as **not met**.
     Never let one workload's failure abort the others. A correctness failure (a stale emit in (e), or a wrong
     version) is different: it aborts the run.
   - **Runs** (plan `:228-229`):
     - The default is `--runs 5` per variant and `--sizes 200,1000`.
     - Per round and per size, spawn one child per variant **in interleaved order** (5.7.3, 6.0.3, 7.1, then the next
       round), as `esm-watch-bench.cjs:319-341` does. Use `spawnSync(process.execPath, [__filename, "--child"])` and
       the variant passed through an env variable.
     - Each child prints one `BENCH <json>` line, which the parent parses as `esm-watch-bench.cjs:330-334` does.
     - Summaries are the **median with min and max** over runs, never means.
     - For p95: compute p95 within each run over its per-call durations, then take the median over runs.
   - **Machine and Node reporting.** Write it once, at the top of the output and into the JSON:
     - `process.version`, `process.versions.v8`, `os.platform()`, `os.arch()`, `os.release()`;
     - `os.cpus()[0].model`, the CPU count and `os.totalmem()`;
     - `os.loadavg()` at start and end;
     - on darwin, the first line of `pmset -g batt` (AC or battery; skip it if the command fails);
     - the repo's `git rev-parse HEAD`, and whether `git status --porcelain -- packages/webpack-test/perf` is dirty;
     - the three resolved versions with their lockfile integrity, the platform binary's integrity, and the IPC
       encodings;
     - the corpus hash per size, the seed, and the full options.
   - **Options:** `--runs 5 --sizes 200,1000 --edits 30 --in-flight 8 --seed <default> --loader-instances 1
     --versions-dir <dir> --out <file> --keep`. Reject unknown options, as `esm-watch-bench.cjs:57-70` does.
4. **`ts71-transformer-probe.cjs`**, the `before`-transformer probe (plan `:233-235`):
   - Run the pinned 7.1 `transpileModule` with `transformers: { before: [<appends a statement>] }` and record whether
     the output changed and whether anything was thrown.
   - Type-check the same call: write a 10-line `.mts` into the versions directory and run 7.1's own `tsc` by path,
     with the flags of finding 2. Record the diagnostic codes.
   - Print one `PROBE <json>` line: `{ version, runtime: "ignored" | "applied" | "threw: …", typeCheck: [codes] }`.
     Expected on `7.1.0-dev.20261013.1`: `runtime: "ignored"`, `typeCheck: [2353]`.
   - `ts71-bench.cjs` runs the probe once (as a child) and puts its result in the JSON.
   - Recording the status of microsoft/TypeScript#63875 and TypeStrong/ts-loader#1704 is the measurement slice's job,
     not this one's.
5. **Header comment of `ts71-bench.cjs`.** Model it on `esm-watch-bench.cjs:7-46`. It says:
   - what is measured, and that the harness runs in no suite and not in CI;
   - the run commands (below);
   - the decision rule it prints (plan `:236-242`), quoted with its thresholds;
   - "Re-pinning" (below).
6. **`"perf:ts71": "node perf/ts71-bench.cjs"`** in the `scripts` of `packages/webpack-test/package.json`, next to
   `perf:esm` (`:15`). That is the whole manifest change.

**Decision summary, printed after the runs.** Print one line per rule criterion, with the measured value, the
threshold and `met` / `not met` / `not measurable`. All are read at the largest size (1,000), against in-process
6.0.3:

| # | Criterion (plan `:236-242`) | Metric |
|---|---|---|
| 1 | (b) ≤ 1.5× | median over runs of the per-run median per-file `transpileModule`, **warm pass**, 7.1 / 6.0.3 |
| 2 | (c) ≤ 2× | median workload total (`createProgram` + all per-file emits), 7.1 / 6.0.3 |
| 3 | (e) ≤ 2× | median per edit, 7.1 / 6.0.3 |
| 4 | p95 ≤ 3× own median, (b) and (c) | 7.1 p95 / 7.1 median, per-call durations (b warm, c emits) |
| 5 | (f) ≥ 1/1.5 | 7.1 throughput with 8 in flight / 6.0.3 in-process sequential throughput |
| 6 | (a) | 7.1 median cold start. If above 1 s, also print × `--loader-instances`; it counts against speed only above 2 s |

- Also print "Speed: met / not met" (met when all six are met).
- Do **not** print a Decisions row. 3C is outside the harness, and the measurement slice picks the row.
- Print the cold pass of (b) beside the warm pass, unjudged.

**Output: what the measurement slice consumes.**

- **stdout:** the machine block, one line per child run, the per-workload summary per size and variant (median
  [min–max]), the IPC block, the probe line, and the decision summary.
- **JSON file:** `--out`, default `path.join(os.tmpdir(), "websmith-ts71-bench-<ISO timestamp>.json")`. The last
  stdout line is `RESULT <absolute path>`. The schema is `{ schema: "websmith-ts71-bench/1", meta: {machine, node,
  git, versions, options, corpus}, runs: [raw child results], summary: {[size]: {[workload]: {[variant]: {median, min,
  max, …}}}}, ipc: {...}, probe: {...}, decision: [{ criterion, value, threshold, status }] }`.
- Keep the `schema` string fixed. A later change bumps it.
- `docs/typescript-7-1-measurement` runs `pnpm perf:ts71` at the defaults, copies the JSON next to
  `docs/stories/ts7-rearchitecture/analysis-ts71-measurement.md`, and quotes `meta` and `decision` in the report.

**Run commands** (for the header and the PR):

```bash
export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"   # pnpm 10, npm 10.9.2
pnpm build                                                  # not needed by the harness, but the DoD gates run anyway
cd packages/webpack-test
pnpm perf:ts71 --sizes 20 --runs 1 --edits 3                # dry run
$HOME/.nvm/versions/node/v24.21.0/bin/node perf/ts71-bench.cjs --sizes 20 --runs 1 --edits 3   # Node 24, npm 11
pnpm perf:ts71                                              # full run: the measurement slice's, not this one's
```

**Re-pinning,** for the header. Pick the nightly with `npm view typescript dist-tags` (with an empty
`NPM_CONFIG_USERCONFIG` and `--registry=https://registry.npmjs.org/`). Then:

1. edit the `ts71` alias;
2. regenerate the lockfile with the command above;
3. check `npm view typescript@<v> exports`: the harness needs `./sync` and `./async`;
4. check the `TranspileOptions` / `Snapshot.update` shapes in the new `.d.ts` files;
5. do a dry run;
6. commit both files together.

### The decisions — do not re-derive them

- **No benchmark of websmith end to end.** All three variants call the TypeScript API directly, in the shapes
  websmith uses (`Compiler.ts:1430`, `:1052-1057`). websmith has no 7.x backend that could run on 7.1. Comparing the
  API with the same options, inputs and call pattern is what the plan's rule measures.
- **(b) is judged warm, (c) cold.** The plan calls (c) "the type-checked loader path, cold". For (b), the loader
  transpiles many modules in one long-lived process, so the steady state is the relevant cost. The cold pass is still
  reported.
- **The corpus counts the 9 fixtures in its size.** The plan's "200 and 1,000 modules" are totals.
- **Bytes are measured in an untimed pass,** because `collectTiming` adds work to every request.
- **5.7.3 and 6.0.3 come from the pinned lockfile too, not from the workspace.** The measurement must not change when
  the peer-range slice moves the workspace pin.

### Done when

The plan's slice line is the specification: a dry run with 20 modules and 1 run per variant completes on 5.7.3,
6.0.3 and the nightly, and prints every metric the decision rule needs. `pnpm lint` and the Definition of Done are
green. There is no product code.

A naive implementation would pass without these:

- **The dry run on both Node versions:** `--sizes 20 --runs 1 --edits 3` on Node 22.17.0 (via `pnpm perf:ts71`) and
  Node 24.21.0 (`node perf/ts71-bench.cjs`). Each prints all six decision lines with numbers or `not measurable` with
  a reason, the IPC block, `PROBE {…"runtime":"ignored","typeCheck":[2353]}` and `RESULT <path>`. Paste both outputs
  into the PR.
- **From an empty versions directory:** use `--versions-dir $(mktemp -d)/v` once, so the `npm ci` path runs, and show
  that it ran with no `~/.npmrc` involved. A second run reuses the directory without reinstalling.
- **Integrity is enforced:** in a throwaway copy, alter one `integrity` in a copied lockfile. The harness must fail
  with npm's `EINTEGRITY`, and you trash the copy afterwards. Show the error line in the PR.
- **The corpus is reproducible:** two runs with the same `--sizes` and seed print the same corpus hash, on Node 22
  and 24.
- **(e) asserts its emit:** temporarily drop `ensurePrograms: true`. If that makes the 7.1 (e) abort with the stale
  emit message, say so in the PR. If 7.1 emits correctly either way, say that instead. Do not commit the variation.
- **Nothing leaks into the workspace or CI:**
  - `git diff origin/develop --stat` shows only the files in the Scope guard;
  - `git diff origin/develop -- pnpm-lock.yaml` is empty;
  - `pnpm -r ls --depth -1 --json` counts the same packages as on `develop`;
  - no `package.json` or `node_modules` was created under `packages/webpack-test/perf`.
- **Lint:** `pnpm lint` passes with the new `.cjs` files linted under the `**/perf/*.cjs` block. Run
  `pnpm --filter websmith-loader-test lint:fix` for Prettier (`printWidth` 150).
- **License headers by hand:** `license-config.json:33` ignores every extension except `ts|tsx|js|jsx|scss|…|md`,
  so `pnpm license:add` skips `.cjs`. Copy the header block of `esm-watch-bench.cjs:1-6` into each new `.cjs`. The
  two `.json` files cannot carry a header and are ignored by the tool. Do not touch the `license:check` list.
- **Gates:** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache` and `pnpm test:e2e --skip-nx-cache`, all green
  locally. CI `dist (22)` and `dist (24)` green. The advisory 6.0.3 cell is unaffected by this diff; report its
  result, do not fix it.
- **No Jest test.** The plan says "in no suite", and its test for this slice is the dry run. Say so in the PR, so
  the reviewer does not ask for a unit test under the Definition of Done. Keep `ts71-corpus.cjs` free of side effects
  anyway, so that a later slice can test it.
- **No `Release-Notes.md` entry and no README change.** Nothing users install changes.

### Repo mechanics

- **pnpm 10** from `$HOME/.nvm/versions/node/v22.17.0/bin`: put it first on `PATH`. The Homebrew pnpm 11 fails with
  E401. Node 24 is at `$HOME/.nvm/versions/node/v24.21.0/bin/node` (npm 11.19.0 beside it).
- **Workspace installs:** `pnpm install --offline`. This branch adds no workspace dependency.
- **Registry:** the Artifactory login in `~/.npmrc` is expired. **Never edit `~/.npmrc`.** For the isolated install,
  use an empty `NPM_CONFIG_USERCONFIG` file plus `--registry=https://registry.npmjs.org/`, as the harness does.
- **Shell:** `cp` and `mv` are aliased to `-i`. Use `command cp -f`. Delete with `trash`, never `rm`.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). This is test and tooling only, so use a
  lowercase `t`, for example `t Adds a TypeScript 7.1 IPC benchmark harness`, `t Pins the TypeScript 7.1 nightly
  with its integrity`, `t Adds the before-transformer probe for TypeScript 7.1`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Give it a descriptive title: the wave heading alone
  reads "7.1 bench".
- Append `→ #<PR>` to the `infra/typescript-7-1-bench` line in the plan's `## Slices` (`:314`), and commit that on
  this branch.

### Scope guard

This branch owns:

- the new `packages/webpack-test/perf/ts71-bench.cjs`, `ts71-corpus.cjs`, `ts71-transformer-probe.cjs`,
  `ts71-versions.json` and `ts71-versions.lock.json`;
- one `scripts` line, `perf:ts71`, in `packages/webpack-test/package.json`;
- the `→ #<PR>` suffix on its own line in the plan.

Do not touch:

- `pnpm-lock.yaml`, `pnpm-workspace.yaml`, any dependency in any `package.json`, or the root `package.json`;
- `esm-watch-bench.cjs` and `watch-steps.cjs`: copy the shapes, do not refactor them to share code;
- `eslint.config.js`, `license-config.json`, tsconfigs, `jest.config.ts`, `.github/`;
- product code (`packages/*/src`), tests and snapshots, `Release-Notes.md`, READMEs;
- `docs/stories/ts7-rearchitecture/`. The report and the Decisions row belong to `docs/typescript-7-1-measurement`.

Do not create a `package.json` or a `node_modules` anywhere under `packages/`.

Branches in flight, checked on 2026-10-13:

- `bug/typescript-6-own-compilations` (this plan, dispatched out of wave order; brief on `develop`). It touches
  `AddonRegistry.ts`, `WebpackAddonService.ts`, `environment.ts`, `defaults.ts`, `check-esm.ts`, core/loader/testing
  specs, e2e cases in `packages/compiler-test` and `packages/webpack-test/tests`, `Release-Notes.md`, and its own
  line in the same plan file.
  - **No file overlap.** Both branches append `→ #` to different lines of the plan, which merges cleanly. Whichever
    merges second rebases.
  - None of its changes reach the harness, because the harness calls TypeScript directly and not websmith.
- `bug/loader-unknown-profile-error` (#188, `docs/plans/2026-10-02-loader-options-once.md`): core config modules,
  `packages/webpack/src`, `packages/webpack-test/tests/*`, READMEs, `Release-Notes.md`. No overlap.
- Dependabot #185 and #186: dependency versions in every `package.json`, `packages/webpack-test/package.json`
  included, and `pnpm-lock.yaml`. Your one `scripts` line is a different hunk of `packages/webpack-test/package.json`.
  If one of them merges first, rebase. Their `typescript` bumps, if any, do not reach the harness, which installs its
  own pins.
- `bug/typescript-6-root-dir-once` waits on own-compilations. No overlap.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside scope. That
includes a workload the pinned 7.1 cannot express, a 7.1 API that panics on valid input, and numbers that look
implausible in the dry run.
