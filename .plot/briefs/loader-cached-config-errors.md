<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief: loader-options-once (slice: Cached builds)

- **Plan (canonical):** `docs/plans/2026-10-02-loader-options-once.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #134 merged
- **Branch:** `bug/loader-cached-config-errors` (base: `develop`, at `c2622c3f` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** The slice line carries `<!-- waits: bug/loader-resolve-options-once -->` and
`<!-- waits: bug/loader-option-errors-once -->` (`docs/plans/2026-10-02-loader-options-once.md:263`). Both merged:
#165 made the options files module dependencies (`packages/webpack/src/loader.ts:38-41`), and #181 added the
file-less error store and the carrier map (`packages/core/src/compiler/ModuleCompiler.ts:187-189`, `:265-277`). #188,
#191 and #197 merged too. So this slice can start now. It is the plan's **last** slice: no slice waits on it.

The only open PR that touches files of this slice is #200 (`bug/typescript-6-root-dir-once`). It edits
`Release-Notes.md` and one test at `packages/webpack/src/loader.spec.ts:303-310`. Keep your hunks away from that test.
Whoever merges second rebases.

Line numbers are from `develop` at `c2622c3f`. If they move, find the code by name.

### What changed on `develop` since the plan was approved

The plan's item 8 (`:72`), its Design bullet "Cached builds (item 8)" (`:179-184`) and its Open Point "Item 8
mechanism" (`:214-217`) predate #165, #174, #181, #188, #191 and #197.

| Plan says | Now on `develop` |
|---|---|
| The compilation hooks that report config errors are `webpack-hooks.ts:115-136`, registered only when the loader creates the instance (`compiler-instances.ts:35-41`) | `afterCompile` reports them at `packages/webpack/src/webpack-hooks.ts:55-75`. It pushes each formatted message once per compilation into `compilation.errors` (`:64-74`). The hooks are still registered only when the loader creates the instance (`packages/webpack/src/compiler-instances.ts:32-50`). So a process that restores every module from the cache still registers none. |
| "The loader attaches each config error as a module error to one carrier module per compilation (the first module that reports it); webpack serializes module errors with the module" | With compilation hooks, config errors are **never** module errors: they are compilation errors, which webpack does not cache. A carrier exists only **without** hooks: `takeUnreportedConfigErrors(resourcePath)` (`ModuleCompiler.ts:260-277`, called at `loader.ts:43-46`) pins each error to the first module that asks. The pin lasts until `setOptions` clears the map (`:236-243`), not one compilation. |
| (not in the plan) | #181 keeps file-less TypeScript errors, e.g. TS5095, in `fileLessErrors` (`ModuleCompiler.ts:187-188`, `takeFileLessErrors` `:598-616`). They exist only as outputs of a `build`. `getConfigErrors` (`:251-257`) returns them after the configuration errors. #191 adds a dependent profile's file-less errors there, labelled `(profile "<name>")` (`:420-430`). |
| (not in the plan) | #188 already keeps one kind of config error out of the cache: with an unconfigured `profile`, the loader calls `this.cacheable?.(false)` (`loader.ts:47-53`), so the next run rebuilds the module and reports the error again. `packages/webpack/README.md:117-119` documents it. This slice extends that mechanism. |
| (not in the plan) | #197's `needBuild` tap and `buildInfo` record (`webpack-hooks.ts:92-120`, `loader.ts:62-82`) fall back to plain dependencies under the persistent cache (`loader.ts:75`). The root cause is the same as this slice's: a process that restores every module runs no websmith code. This slice does **not** change that fallback (see Scope guard). |
| `needBuild`/cache behaviour read in webpack 5.97.1 | The repo installs webpack **5.111.1** and thread-loader **4.0.4**. `Module.serialize` writes `_errors` (`webpack/lib/Module.js:1333-1335`). `NormalModule.needBuild` rebuilds a module whose `buildInfo.cacheable` is false (`lib/NormalModule.js:2062-2063`). thread-loader copies the worker's `cacheable` back onto the module (`thread-loader/dist/index.js:63`). |
| (not in the plan) | thread-loader's default `poolTimeout` is 500 ms, and `poolRespawn` defaults to false (`thread-loader/dist/workerPools.js:26-28`). After 500 ms idle, the pool **terminates** (`WorkerPool.js:448-452`). From then on, `pitch` returns early (`index.js:12-14`), and websmith-loader runs **in webpack's process, with hooks**. In watch mode, workers therefore only stay alive with `poolTimeout: Infinity`, which thread-loader's docs recommend for watch. |

### Current behaviour, reproduced

Reproduced on `c2622c3f` in a scratch worktree with Node 22.17.0, TypeScript 5.7.3, webpack 5.111.1 and
thread-loader 4.0.4.

**The setup.** A separate Node process ran webpack with:

- `mode: "development"`, `target: "node"`;
- the loader with `transpileOnly: true`, a `tsConfigFile`, a `configFile` and `profile: "target"`;
- tsconfig `{ target: "es2020", module: "esnext", moduleResolution: "bundler" }`, unless listed otherwise.

**How the cases ran.**

- "Cache" cases used `cache: { type: "filesystem", cacheDirectory: <project>/.cache }`. Each run was a **new
  process**: `compiler.run()`, then `compiler.close()`. The runs were 1.1 s apart.
- Watch cases wrote the edit 1 s after a build. The result is the compilation whose `modifiedFiles`/`removedFiles`
  hold the edited path.
- "Errors" lists `stats.toJson().errors`. `[-]` is a compilation error; `[./src/x.ts]` is a module error of that
  module.

**In-process, with the persistent cache:**

| Case | Run 1 | Run 2, nothing edited |
|---|---|---|
| A: config error (`esm: { runtime: "bogus" }`) | built `[a.ts]`, `[-] Unknown 'esm.runtime' value 'bogus' …` | **built `[]`, errors `[]`** |
| A2: tsconfig error (`"nope": true` in `compilerOptions`) | `[-] …tsconfig.json (1,86): Unknown compiler option 'nope'.` | **built `[]`, errors `[]`** |
| B: file-less option error of the target (`module: "commonjs"` with `moduleResolution: "bundler"`, TS5095) | `[-] Option 'bundler' can only be used when …` | **built `[]`, errors `[]`** |
| C: file-less option error **only in a dependent profile** (`target` with `depends: ["dep"]` and `tsConfig: { module: "esnext", target: "es2020" }`; `dep` with `tsConfig: { module: "commonjs", target: "es5" }`); `a.ts` imports `b.ts` | `[-] Option 'bundler' … (profile "dep")` | **built `[]`, errors `[]`** |
| C3: C, with `b.ts` edited before run 2 | – | built `[b.ts]`, the labelled error **once** |
| F: unconfigured `profile: "missing"` (#188) | `[-] Profile 'missing' is not configured …` | built `[a.ts]`, reported again |
| G1: A, with the config **fixed** before run 2 | – | built `[a.ts]`, errors `[]` |
| G2: clean, with the tsconfig **broken** before run 3 | – | built `[a.ts]`, the tsconfig error. Run 4, unchanged: **built `[]`, errors `[]`** |

So:

- **The persistent cache loses every configuration error, and every file-less error, of the target and of
  dependent profiles alike.** The exception is the unconfigured profile, which #188 keeps out of the cache.
- **Invalidation already works:** G1 and G2 rebuild after a config or tsconfig edit, through #165's module
  dependencies. The slice line's "a config or `tsconfig.json` edit between two runs invalidates it" needs guard
  tests, not code.
- The follow-up "the persistent cache may hide dependent profiles' file-less errors" holds, but it is **not
  dependent-specific**: C fails exactly like B.

**Is the plan's mechanism viable?** I checked with a throwaway loader that calls `this.emitError(new WebpackError(…))`
under the filesystem cache. Run 2 built nothing and **still reported the module error**. So webpack does restore
in-process module errors. But under thread-loader the module error is a `WorkerError`. webpack cannot serialize
that, and logs:

```text
[webpack.cache.PackFileCacheStrategy] Skipped not serializable cache item '…a.ts': No serializer registered for WorkerError
```

So a thread-loader carrier is never cached; it is rebuilt every run.

**thread-loader** (`workers: 1` unless listed):

| Case | Result on `develop` |
|---|---|
| C4: C under thread-loader with the cache, run twice | Run 2 rebuilt `a.ts` (the carrier, which was not cached) and reported the error once. **Green by accident**, through the `WorkerError` above. |
| E1: watch, default `poolTimeout`. `index.js` imports `b.ts` and `c.ts`; carrier `b.ts`. Then `index.js` drops the `b` import. | built `[index.js]`, **errors `[]`**: lost |
| E3: E1 with `poolTimeout: Infinity`, plus an edit of `c.ts` | built `[index.js, c.ts]`, **errors `[]`**: lost (`c.ts` asks a worker whose carrier is `b.ts`) |
| T10: `poolTimeout: Infinity`, chain `index.js → b.ts → c.ts`, so `b.ts` is always the carrier. Then `index.js` imports `c.ts` directly. | built `[index.js]`, **errors `[]`**. Deterministic: 3 of 3 runs. |
| E4: watch, default `poolTimeout`, edit the non-carrier `c.ts` | `[./src/b.ts] …` **and** `[-] …`: **twice**. The pool had terminated, so `c.ts` ran in-process with hooks, while `b.ts` kept its cached `WorkerError`. |
| H: `workers: 2`, `poolTimeout: Infinity`, four modules. Two watch steps edit two modules each. | Run 1 two copies each step. **Runs 2 and 3: errors `[]` after step 1 or step 2.** Runs 4 and 5 kept two copies. So **2 of 5 runs went green with an invalid config.** Each worker pins its own carrier, and a rebuilt carrier landing on the other worker reports nothing. |
| E5: E1 without thread-loader | Once, through `afterCompile`. Correct on `develop`. |

**Prototype check.** I patched the built `packages/webpack/lib/loader.js` behind an environment variable:

- **With hooks:** the first module of each compilation that the instance builds while `getConfigErrors()` is
  non-empty calls `this.cacheable(false)`. Reporting stays in `afterCompile`, unchanged.
- **Without hooks:** every module built while `getConfigErrors()` is non-empty calls `this.cacheable(false)`. Before
  `takeUnreportedConfigErrors`, the carrier map is cleared whenever `this._compiler.fsStartTime` differs from the
  last module's.

Results:

- **A, A2, B and C:** run 2 rebuilt **only `a.ts`** and reported the error once, with the label in C.
- **C3, partly restored:** once, no duplicate.
- **G after the fix:** run 2 built `[a.ts]` with errors `[]`. Run 3, unchanged, built `[]`. So modules are cacheable
  again once the config is valid.
- **E1, E3 and T10:** the error was reported once, on `c.ts`. T10 held 3 of 3 runs, also on a further edit of
  `c.ts`.
- **E4:** once, no duplicate.
- **H:** exactly two copies (once per worker) at every step, **5 of 5 runs**.

The prototype was reverted. The same build ran each case against the original file.

### What to build

The plan's Design bullet "Cached builds (item 8)" is the spec, with one resolution where `develop` contradicts it.

**Decisions (settled here, do not re-derive):**

1. **The carrier keeps its errors out of the cache by being uncacheable, not by holding them as module errors.**
   This departs from the plan's "attaches each config error as a module error" (`:181-182`). Reasons, all
   reproduced above:
   - With hooks, config errors are compilation errors (`webpack-hooks.ts:64-74`). Moving them onto a module would
     have to dedup a restored module's copy against `afterCompile`'s copy and against a new carrier's copy in a
     partly restored run (C3 shape). Otherwise errors show twice.
   - File-less errors (B, C) exist only as outputs of a `build`. A rebuilt carrier reproduces them, labels
     included. A serialized copy would go stale in ways `afterCompile` cannot see.
   - Under thread-loader, module errors are `WorkerError`s that webpack cannot serialize. The plan's mechanism
     cannot work there.
   - #188 already uses `cacheable(false)` for the same purpose (`loader.ts:47-53`).

   The plan's other half holds: the loader stays "just a loader", and it adds **no plugin**. The cost is one module
   compiled per compilation while the configuration is invalid (with hooks), and every module under thread-loader
   (decision 3). A build with an invalid configuration fails anyway.
2. **With compilation hooks (in-process).** Per compilation and per instance, the **first** module the instance
   builds while `instance.getConfigErrors().length > 0` (checked **after** `build`, so file-less errors count) calls
   `this.cacheable(false)`. Every other module stays cacheable.
   - Keep the per-compilation memory in `loader.ts`: a module-level `WeakMap<object, WeakSet<TsCompiler>>` keyed by
     `this._compilation`. Two loader rules are two instances on one compilation, and each marks its own carrier.
     Without `this._compilation`, e.g. from a context stub, mark the module.
   - Reporting does not change: `afterCompile` keeps pushing the errors once per compilation. The carrier's rebuild
     in the next process creates the instance, which registers the hooks.
3. **Without compilation hooks (thread-loader).** Two changes, because no websmith code runs in webpack's process,
   and a worker sees only the modules it builds:
   - Every module built while `getConfigErrors()` is non-empty calls `this.cacheable(false)`. So each compilation
     rebuilds them, and some worker always builds one while one is in the graph (fixes E1/E3/T10).
   - `ModuleCompiler.takeUnreportedConfigErrors(resourcePath, compilation?: unknown)` gets an optional token. When
     the token is defined and differs from the last call's, the carrier map is cleared first. So the first module
     each worker builds **in each watch compilation** carries the errors (fixes H). The loader passes
     `this._compiler?.fsStartTime`. webpack's `Watching` sets it per compilation (`lib/Watching.js:138`), and
     thread-loader forwards it (`index.js:25`).
   - Without the token, e.g. `compiler.run()`, behaviour is unchanged: the pin lasts until `setOptions`.
   - The doc comments of `takeUnreportedConfigErrors` (`ModuleCompiler.ts:260-264`) and of the class (`:162-171`)
     say this.
   - The result is at most one copy per worker per compilation, as documented today. A duplicate across
     compilations (E4) cannot happen, since every module with config errors is rebuilt.
4. **No change to the invalidation path.** G1 and G2 already work. They get guard tests.
5. **No change to `afterCompile`'s reporting, to #188's unconfigured-profile path (`loader.ts:47-53`), or to #197's
   package-type fallback.**

**Steps.**

1. **Red e2e first.** Write the e2e suite below. Run it against `develop`'s build and record each red case's
   actual result for the PR. Do not push a red commit. Commit the tests with the fix.
2. **Core: `ModuleCompiler.ts`.** Add `takeUnreportedConfigErrors`'s token parameter and a private
   `configErrorCompilation?: unknown` field next to `configErrorCarriers` (`:189`). It is cleared together with the
   map in `setOptions` (`:236-243`), with the same `?.` guard and comment: the `Compiler` constructor runs
   `setOptions` before field initializers. Replace the mutation inside `filter` (`:267-276`) with a plain loop while
   you are there. The #181 review asked for it, and it is the method you are changing.
3. **webpack: `loader.ts`.**
   - Pass `this._compiler?.fsStartTime` at `:45`.
   - After the no-hooks block (`:43-46`) and **before** the unconfigured-profile early return (`:49`), add the
     carrier marking of decisions 2 and 3 as one small function, e.g. `keepConfigErrorsOutOfCache(context,
     instance)`.
   - A module that is both carrier and unconfigured gets `cacheable(false)` twice. That is harmless; do not special
     case it.
4. **Docs and notes** (below).

No change to `webpack-hooks.ts`, `compiler-instances.ts`, `package-types.ts`, `TsCompiler.ts` or `packages/vite/**`.
The Vite plugin calls `getConfigErrors` only (`packages/vite/src/hooks.ts:146`, `:182`). The new parameter is
optional, so it compiles unchanged.

### Tests

Unit tests are red on `develop` unless marked *guard*.

**Core: `ModuleCompiler.spec.ts`**, next to the carrier tests (`:590-640`):

- with a token, a module that is not the carrier receives the errors after the token changes;
- with the same token, it receives none (*guard*: the existing "second module" test, with a token);
- without a token, the pin survives calls with changing resource paths, as today (*guard*);
- `setOptions` clears the token: after an option update, the first module with the old token carries again.

**webpack: `loader.spec.ts`** (`describe("loader")`, `:401-697`).

- Setup changes:
  - Extend `createLoaderContext` (`:388-399`) with an optional `_compilation`.
  - The mock `takeUnreportedConfigErrors` in `setUpLoader` (`:362-386`) records its arguments.
- With hooks:
  - the first module with config errors calls `cacheable(false)`;
  - a second module of the **same** `_compilation` does not;
  - the first module of a **new** `_compilation` does;
  - a module without config errors does not (*guard*).
- Without hooks:
  - every module with config errors calls `cacheable(false)`;
  - `takeUnreportedConfigErrors` receives `_compiler.fsStartTime`;
  - a module without config errors does not call `cacheable(false)` (*guard*).
- Leave the existing carrier tests (`:645-697`) and "marks module as not cacheable w/ unconfigured profile"
  (`:617`) unchanged.

Fresh `testObj` per test. Never a shared `let testObj`.

**E2E: a new `packages/webpack-test/tests/webpack-loader-cached-config-errors.test.ts`.** Model the runner on
`webpack-loader-package-type.test.ts:138-255`:

- spawn a separate Node process and print `RESULT` JSON lines;
- report `built` (the resources in `compilation.builtModules`);
- report `errors` from `stats.toJson({ all: false, errors: true }).errors`, as
  `{ module: e.moduleName ?? null, message }`;
- add a `threadLoader` flag with `workers` and `poolTimeout` options;
- add a `cache` flag (`{ type: "filesystem", cacheDirectory: <projectDir>/.cache }`);
- add an `entry` option, so `index.js` can be the entry;
- add a list of watch edits, where `null` deletes a file.

Always use `mode: "development"`: with `cache: false`, every module rebuilds and "restored" cannot be observed.
Match messages by a stable part, e.g. `Unknown 'esm.runtime' value 'bogus'`, `Unknown compiler option 'nope'`,
`Option 'bundler' can only be used when`, `(profile "dep")`. Never match the absolute path.

Red cases first:

| # | Test | On `develop` | Must yield |
|---|---|---|---|
| A | should report config error in second run w/ persistent cache w/ unchanged invalid config | run 2: built `[]`, no error | run 2: the error once |
| A2 | should report tsconfig error in second run w/ persistent cache | run 2: no error | the error once |
| B | should report option error in second run w/ persistent cache | run 2: no error | TS5095 once |
| C | should report dependent profile's option error in second run w/ persistent cache | run 2: no error | once, with `(profile "dep")` |
| K | should rebuild one module per run w/ invalid config w/ persistent cache (`a.ts` imports `b.ts`) | run 2: built `[]` | run 2: built has length 1 |
| T10 | should report config error after carrier module leaves graph under thread-loader watch (`poolTimeout: Infinity`, chain `index.js → b.ts → c.ts`, then `index.js` imports `c.ts`) | step 1: no error | the error once |
| H | should report config error in every watch rebuild w/ two thread-loader workers (`workers: 2`, `poolTimeout: Infinity`, four modules, two steps of two edits) | no error in some runs (2 of 5 here) | between 1 and 2 copies at every step |

Guards (green on `develop`; they catch over-eager fixes):

| # | Test | Must yield |
|---|---|---|
| C3 | should report option error once w/ one module edited between runs w/ persistent cache | once, no duplicate |
| G1 | should build w/o errors w/ config fixed between runs w/ persistent cache, then restore every module in a third run | run 2: no error. Run 3: built `[]`. |
| G2 | should report tsconfig error w/ tsconfig broken between runs w/ persistent cache | the error once |
| V | should restore every module w/ valid config w/ persistent cache | run 2: built `[]` |
| C4 | should report dependent profile's option error in second run w/ persistent cache under thread-loader | once |
| E5 | should report config error once after carrier module leaves graph w/o thread-loader | once |

**webpack 5.111 clears a module's `buildInfo.fileDependencies` and `missingDependencies` after the build.** #197's
review found this. If any test asserts dependencies, read them from `buildInfo.snapshot` (`getFileIterable()`,
`getMissingIterable()`), as `webpack-loader-package-type.test.ts:179-182` does. Never read the cleared fields: they
are always empty, so such an assertion passes on any code.

**Show every assertion failing on `develop` first.**

- Build `develop` (or stash your `src` changes and rebuild), run the new suite, and paste each red case's actual
  result into the PR.
- A guard must be green there. If a "red" case is green on `develop`, the test does not test the fix: rework it.
- For H, red is probabilistic. Run it 5 times against `develop`; it must fail at least once (the reproduction lost
  the error in 2 of 5 runs). With the fix it must pass 5 of 5.
- Also show K red for the reason "built `[]`", not for a runner error.

**Keep the watch and cache tests deterministic.** Watch e2e has been flaky here before.

- **Arm the "awaited" filter only after the edit is written.** The next result is the first compilation whose
  `compiler.modifiedFiles` or `removedFiles` holds the edited paths. Copy the arming from
  `webpack-loader-package-type.test.ts:218-237`, not from the older runners.
- **Wait 1000 ms after a build before writing**, so the watcher has settled and the mtime differs.
- **Use `poolTimeout: Infinity` in every thread-loader watch test.** With the default 500 ms, the pool terminates
  between rebuilds, and the loader runs in webpack's process. The test would then not test thread-loader at all.
  That is case E4 above.
- **Make the carrier deterministic with a chain of imports** (T10). With `index.js` importing `b.ts` and `c.ts` side
  by side, either module may be built first.
- **Assert on `built` and error counts, never on timing.**
- **For the two-process cache tests:**
  - wait ≥1100 ms between runs, or bump the mtime of an edited file with `fs.utimesSync`;
  - call `compiler.close` after each `run`, so the cache is stored.
- **Timeouts and fixtures:**
  - a per-step watchdog of 25 s that prints the modified files and exits with code 2;
  - `spawnSync` timeout = builds × 26 s + 15 s;
  - a Jest timeout of 90 s, or 120 s for H;
  - a unique `test-output-<name>_<Date.now()>` directory, removed in `afterEach`.
- **Copy, do not import.** Each suite copies its runner. Do not edit the other suites' runners.
- **Run the new suite 5 times in a row** before opening the PR, e.g.
  `for i in 1 2 3 4 5; do pnpm --filter websmith-loader-test exec jest tests/webpack-loader-cached-config-errors.test.ts || break; done`.
  Report 5/5 in the PR.

The existing suites stay green unchanged. The relevant ones:

- `webpack-loader-option-errors-once.test.ts`. Its thread-loader case (`:68`) counts one error over three modules.
  It still does: one worker, one `run()`, no `fsStartTime`.
- `webpack-profile-config.test.ts:71-80` (thread-loader, config error once).
- `webpack-loader-unknown-profile.test.ts`, `webpack-loader-dependent-profile-diagnostics.test.ts`,
  `webpack-loader-package-type.test.ts`, `webpack-loader-resolve-once.test.ts`.

### Release notes and docs

- `Release-Notes.md`, `## [Unreleased]` (`:13`) → `### Fixed` (`:138`). Add one bullet, e.g.:

  > With webpack's persistent cache (`cache: { type: "filesystem" }`), the webpack loader reports configuration
  > errors, `tsconfig.json` errors and TypeScript option errors, also of dependent profiles, in every build while
  > they remain. Before, a build that restored every module from the cache reported none and passed. While such an
  > error remains, one module per build is not cached. Under `thread-loader`, a configuration error is no longer
  > lost when the module that reported it leaves the build, or when several workers rebuild modules: while it
  > remains, the loader's modules are not cached, and each worker reports it on the first module it builds in each
  > watch compilation.

  Leave Vite out.
- `packages/webpack/README.md`, the configuration-error paragraph (`:107-119`). Replace the two sentences starting
  "Without compiler hooks, e.g. under `thread-loader`, …" and "With webpack's persistent cache …":
  - **Persistent cache:** while there are configuration errors, the first module the loader compiles in a build is
    not cached. So the next build compiles it again and reports them, also when every other module is restored.
  - **thread-loader:** each worker reports them on the first module it builds in each compilation. While they
    remain, none of the loader's modules is cached, because only the workers can report them. They appear at most
    once per worker.
  - Keep the unconfigured-profile sentence.
  - Add one sentence: thread-loader's default `poolTimeout` ends its workers after 500 ms idle, and the loader then
    runs in webpack's process, where errors are reported once per compilation.
- No `packages/api`, `packages/compiler` or `packages/core` README change: no flag, config key or addon API changes.

### Done when

The slice line is the specification: "a build restored from the persistent cache reports config errors, and a config
or `tsconfig.json` edit between two runs invalidates it; … e2e with `cache: { type: "filesystem" }` built twice, and
edited between runs". These are the assertions a naive implementation would pass without:

- **A fully restored second run reports the error once:** config (A), tsconfig (A2), file-less (B) and dependent
  file-less (C). All are red on `develop`.
- **Only one module is rebuilt** in that run (K): no "mark every module" shortcut in-process.
- **No duplicate in a partly restored run** (C3).
- **A valid config restores every module** (V, and G1's third run). A carrier that stays uncacheable after the fix
  fails these.
- **Invalidation guards:** G1 and G2.
- **thread-loader:**
  - T10 is red on `develop` and reports once;
  - H gives 1–2 copies at every step, 5 of 5, and was shown red at least once in 5 runs on `develop`;
  - C4 stays green.
- **Gates, all green:** `pnpm lint`, `pnpm build --skip-nx-cache`, `pnpm test --skip-nx-cache`,
  `pnpm test:e2e --skip-nx-cache`. The shared `.nx-cache` replays outputs from other worktrees. Say in the PR
  whether the advisory TS 6.0.3 cell is green.
- **Tests follow `docs/rules/testing.md`:**
  - assemble / act / assert, with one blank line between the parts and no part comments;
  - `testObj` and `actual` (`target` for observed objects, `whatever` for meaningless values);
  - no shared `testObj`.
- **New files carry the MIT header** (`pnpm license:add`). Do not add them to the `license:check` list.
- **The PR states:**
  - decision 1, the departure from the plan's "module error" carrier, with the reasons and the `WorkerError` warning;
  - decisions 2 and 3, and their cost while the config is invalid;
  - the red results on `develop`, per case;
  - the `poolTimeout` finding: the thread-loader watch e2e of #197 (`webpack-loader-package-type.test.ts:75`) runs
    with the default pool timeout, so its rebuild probably runs in-process. Report it; do not change that suite;
  - the follow-ups scoped out (below).

### Repo mechanics

- **pnpm:** use the corepack-cached pnpm 10.8.0 through a shim. pnpm 10.34's frozen install fails here, and the
  Homebrew pnpm 11 fails with E401.

  ```sh
  mkdir -p "$TMPDIR/pnpm-shim" && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > "$TMPDIR/pnpm-shim/pnpm" && chmod +x "$TMPDIR/pnpm-shim/pnpm"
  export PATH="$TMPDIR/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline
  ```

- **Never edit** `pnpm-lock.yaml`, `~/.npmrc` or the root `package.json`. This branch adds no package. If the e2e
  gates leave `test-output-*` importers in `pnpm-lock.yaml`, restore it with `git checkout pnpm-lock.yaml`.
- **Merges:** if you merge `develop` in, use `git -c rerere.enabled=false merge …`.
- **The webpack-test e2e runs against the built packages:** run `pnpm build --skip-nx-cache` before
  `pnpm test:e2e`. After a core-only edit, `pnpm --filter @quatico/websmith-core build` refreshes what the loader
  loads.
- **Reproducing by hand:** put fixtures under `packages/webpack-test/test-output-<name>` (git-ignored by
  `test-output*`). Resolve `webpack`, `thread-loader` and `websmith-loader` from `packages/webpack-test`. Remove the
  fixtures afterwards with `trash`.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill), e.g.:
  - `B Reports config errors of a build restored from the persistent cache`
  - `B Keeps thread-loader config errors when the carrier module leaves the build`
  - `t Covers config errors across persistent-cache runs end to end`
  - `d Documents config errors under the persistent cache and thread-loader`
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first green commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`, then give it a descriptive title.
- Append `→ #<number>` to the `bug/loader-cached-config-errors` line (`docs/plans/2026-10-02-loader-options-once.md:263`),
  before its `<!-- builds: -->` comment, and commit that on this branch. Do not edit anything else in the plan.
  Delivering the plan (`/plot-deliver`) is the maintainer's step, not yours.

### Scope guard

This branch owns:

- `packages/core/src/compiler/ModuleCompiler.ts`, limited to:
  - `takeUnreportedConfigErrors`, with its doc comment;
  - the new token field;
  - the two `clear` lines in `setOptions`;
  - the class doc comment's host contract (`:162-171`);
- `packages/webpack/src/loader.ts`: `:43-46`, plus the new carrier-marking function and its call;
- their specs as listed, and the new e2e file;
- `Release-Notes.md` (one bullet), `packages/webpack/README.md` (`:107-119`), and the `→ #<PR>` line in the plan.

Do not touch:

- `webpack-hooks.ts`. `afterCompile`'s reporting and #197's package-type hooks stay as they are.
- `loader.ts:47-53` (#188's unconfigured profile) and `:62-82` (#197's `registerPackageTypes`).
- `compiler-instances.ts`, `instance-cache.ts`, `TsCompiler.ts`, `package-types.ts`, `WebpackAddonService.ts`.
- In `ModuleCompiler.ts`: `build`, `takeFileLessErrors`, `labelWithProfile`, `getConfigErrors`, `refreshOptions`.
- `packages/core/src/compiler/Compiler.ts` (#200 edits it), `packages/vite/**`, `packages/vite-test/**`,
  `packages/webpack-test/perf/**`.
- Other suites' runners, snapshots, `package.json` files, `pnpm-lock.yaml`, tsconfigs, `.github/`.

### Not in this slice

- **#197's gap: deleting a nearer `package.json` without `"type"` does not rebuild.** Reproduced on `c2622c3f`: a
  `nodenext` profile, a project `package.json` with `"type": "module"`, and `src/package.json` `{"name":"inner"}`.
  Deleting `src/package.json` under watch built `[]`, and `dist/main.js` kept CommonJS. Cause: the recorded `null`
  equals the `null` that `readPackageType` returns for a missing file (`webpack-hooks.ts:100-104`). The parent's
  `"type"` is not recorded at all.
  - **Excluded.** It is a package-type tracking defect (`package-types.ts`, `classify-module.ts`), unrelated to
    config errors, and its fix changes #197's recorded format.
  - Mention it in the PR as an open follow-up for its own bug branch.
- **The #177 follow-ups. Excluded:** they are option-validation semantics, not caching, and touch
  `ResolvedCompilerOptions` / `convert-enum-options.ts`, which this slice does not own.
  - A file profile pulled in only by an inline `depends` loses an invalid value silently.
  - The "…in the loader options." wording (`ResolvedCompilerOptions.ts:424`) also applies to non-loader callers.
  - `profiles: undefined` is rejected: `"profiles" in loaderOptions` (`ResolvedCompilerOptions.ts:189`) is true
    for an undefined value. Confirmed by reading.
- **#197's persistent-cache fallback** (`loader.ts:75`) stays. This slice does not register hooks without a loader
  run, so `buildInfo`-only type tracking under the filesystem cache is still not possible.
- **A carrier that leaves the graph in-process, in a compilation that rebuilds no websmith module, followed by a
  new process that restores everything.** That compilation reports the error through `afterCompile`, but it stores
  no uncacheable carrier. Narrow; any edit of a websmith module restores it. Mention it as a known limit in the PR.
- **Repeated `compiler.run()` in one process under thread-loader** has no `fsStartTime`, so carriers stay pinned as
  today.
- **File-less warnings** stay on their module (#181's decision).

If you find something else the plan did not anticipate, report it in the PR rather than improvising outside scope.
