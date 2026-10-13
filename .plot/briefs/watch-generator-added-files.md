<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — cli-error-exit-gaps (slice: Watch)

- **Plan (canonical):** `docs/plans/2026-10-02-cli-error-exit-gaps.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #136 merged
- **Branch:** `bug/watch-generator-added-files` (base: `develop`, at `fa114cbe` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on `PATH`). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is item 9 of the plan, the last slice (`### Watch`). Its line carries no `waits:`, and nothing waits
on it. Waves 1 to 3 and 6 have merged: #147, #163, #170 and #176. It runs **in parallel** with these branches:

- `bug/report-config-option-errors` (same plan). It adds one call at the start of `watch()`. You rewrite that method's
  loops, so you share a file and a method. See Scope guard.
- `bug/typescript-6-own-compilations`, `bug/loader-unknown-profile-error` and `bug/node-tsc-ignore-config`. None of
  them edits the code you own.

All line numbers below are from `develop` at `fa114cbe` (#182 merged). If they move, find the code by name.

### What changed on `develop` since the plan

| Plan says | Now on `develop` |
|---|---|
| `CompilationContext.ts:173-176` calls the watch callback on every `addInputFile` | still `packages/core/src/compiler/compilation/CompilationContext.ts:173-176`; `addInputFile` is `:159-178` |
| `Compiler.ts:889-920` pushes a new watcher each time | `registerWatch`, `packages/core/src/compiler/Compiler.ts:916-950`; the push is at `:924` |
| `watch()` takes the root files once before any generator runs (`Compiler.ts:245-266`) | `watch()` is `:219-253`; root files `:226`; the emit loops are `:237-239` (with profiles) and `:243-246` (without) |
| — | `fileWatchers` `:101`; `closeAllWatchers` `:255-258`; the context's `watchCallback` `:458`; `registerPackageJsonWatches` `:956-992` |

The plan marks item 9 "from the code only". **It now reproduces, by running.**

**Unit level**, with a throwaway spec on the virtual system (`createSystem(…, { virtual: true })`). A generator calls
`ctx.addInputFile("/src/added.ts")` whenever it sees `/src/target.ts`, `cliArgs.fileNames: ["/src/target.ts"]`, and
`fileSystem.watchFile` is spied:

| | no profile | profile `client` |
|---|---|---|
| watchers on `/src/added.ts` after `watch()` | 1 | 2 |
| `/out/added.js` after `watch()` | **missing** | **missing** |
| watchers after two edits of `target.ts` | 3 | 4 |
| reports of one syntax error then written into `added.ts` | **3** | **4** |

(With the addon in both `config.addons` and the profile, it is activated twice and every count doubles.)

**CLI** (`node packages/compiler/bin/bin.js --addonsDir addons --addons gen -w`). The fixture is a `tsconfig.json`
with `include: ["src/a.ts"]` and an addon whose generator calls `ctx.addInputFile(<dir>/gen.ts)` for `a.ts`:

- after start, only `out/a.js` exists; a one-shot build writes `out/a.js` and `out/gen.js`;
- after two edits of `a.ts`, writing `export const g = ;` into `gen.ts` prints the syntax error **3 times**;
- `[INFO] Adding <path> to watch.` is printed once per rebuild of `a.ts`, and also by the **one-shot** build, which
  watches nothing.

**Why, read from the code:**

1. `CompilationContext.addInputFile` calls `this.watchCallback(filePath)` on every call (`:173-176`), even for a path
   that is already a root file. The constructor defaults the callback to a no-op (`:91`), so `if (this.watchCallback)`
   is always true. That is why the Info message also appears without `--watch`.
2. The callback is `filePath => this.registerWatch(filePath, selectedProfiles)` (`Compiler.ts:458`). `registerWatch`
   pushes a new watcher every time (`:924`), so each re-add adds one. Each watcher re-emits on a change, so every
   watcher reports the file's diagnostics again.
3. The context's `rootFiles` **is the same array** as `Compiler`'s root-file cache: `createCompilationContext` passes
   `this.getRootFiles()` (`:454`), which returns `rootFilesCache` (`:1607-1625`). `addInputFile` pushes into it
   (`:171`). `watch()` takes that array at `:226` and walks it with `forEach` (`:237`, `:243`). `forEach` stops at the
   length the array had when it started, so a file a generator appends during the walk is never emitted. In the
   profile branch, the second walk (`:241`) sees the longer array and registers the added file once more. `compile()`
   does not have this problem: `emitResult` walks the same array with `for … of` (`:739`), which visits appended
   entries.

### The work

The plan's Design → "Watch (item 9)" is the spec: `registerWatch` keys watchers on path plus sorted profile names and
keeps the `fileWatchers` array semantics, so a re-added file adds none, and the first watch build emits the files
generators added while it ran. Write the failing tests first (below), then:

1. **Deduplicate in `registerWatch`** (`Compiler.ts:916-950`). Keep a private `Set<string>` (or a `Map` to the
   watcher) of keys next to `fileWatchers` (`:101`). The key is `this.system.resolvePath(filePath)` plus the sorted
   profile names, e.g. `[resolved, ...[...(profileNames ?? [])].sort()].join("\0")`. If the key is known, return
   `this` without calling `watchFile`. Otherwise register as today, push to `fileWatchers`, and remember the key.
   `undefined` and `[]` profile names give the same key. That matters because `watch()` registers without profiles
   (`:245`) and the default context's callback passes `getSelectedProfiles(undefined)`.
   - Keep the "Watching is not supported" branch (`:917-920`) first, unchanged.
   - `closeAllWatchers` (`:255-258`) also clears the keys, so a later `watch()` registers again.
   - Do not route `registerPackageJsonWatches` (`:956-992`) through the keys. It watches `package.json`, not
     sources.
2. **Emit what generators add during the first build** (`watch()`, `:237-246`). Walk the root files so that entries
   appended during the walk are visited, as `emitResult` does (`for (const curFile of files)`). Do this in both
   branches:
   - **With profiles:** the outer walk over files (`:237-239`) becomes `for … of`. Keep the inner `profiles.forEach`
     and the separate registration walk (`:241`). Since step 1, that walk adds nothing for a file the callback already
     registered with the same profile set.
   - **Without profiles:** the combined emit-and-register walk (`:243-246`) becomes `for … of`.
   - The appended file then goes through `emitWatchedFile`. Its generators run as for any root file, and its
     diagnostics are reported once through `emitWatchedFile`'s existing path. Do not add a second emit pass after the
     loop.
   - Virtual files a generator adds with `addVirtualFile` (`CompilationContext.ts:214-228`) are appended to the same
     array and are therefore emitted on the first build too, as `compile()` already does. Pin that with one unit test;
     do not special-case it.
3. **Call the watch callback once per new path, and only in watch mode** (`CompilationContext.addInputFile`,
   `:159-178`).
   - Store the callback as passed (`watchCallback` may stay `undefined`; drop the no-op default at `:91`).
   - In `addInputFile`, call it, and report `Adding … to watch.`, only when a callback exists **and** the path was not
     a root file before this call. Today the push at `:170-172` already checks this; reuse the result.
   - `registerDependency` (`:495-510`) also tests `if (this.watchCallback)`. Its behaviour must not change: with the
     default gone, the test now means "in watch mode", which is what it did in effect, because the no-op did nothing.
     Run its existing specs.
   - This step is the plan's root cause in `CompilationContext.ts`. Step 1 is still needed: the context's check is per
     context, but contexts share the array (cause 3), and `watch()`'s own registration walk at `:241` adds a second
     watcher.

### Settled decisions — do not re-derive them

- **The key is path plus sorted profile names**, as the plan says, not path alone. One file watched for two
  different profile sets keeps two watchers, as today. Each emits its own profiles.
- **Keep the shared root-file array.** It is what makes step 2 work: the walk sees what the generator appended. Do not
  copy the array or refactor `getRootFiles`. Rely on it, and pin it with the first-build unit test, which fails if the
  array stops being shared. That the cache aliases `this.options.cliArgs.fileNames` (`:1615`) and is mutated by
  `addInputFile` is a separate wart. Name it in the PR; do not fix it.
- **Do not change `emitWatchedFile`, `reportedWatchDiagnostics` or `report()`.** Deduplicating watchers is the fix;
  deduplicating diagnostics would hide the leak. `bug/report-file-less-diagnostics` (not yet started) owns watch-mode
  options diagnostics.
- **The webpack loader is unaffected.** It never calls `watch()`, and its contexts get no `watchCallback` unless the
  resolved options carry `watch` (`:458`). Run `packages/webpack-test` anyway and state the result.

### Found while writing this brief — the plan did not settle these

- **Profile sets differ between `watch()` and the callback for a deep `depends` chain.** `watch()` uses the direct
  `depends` plus the profile (`:223-225`). The context's callback uses `getSelectedProfiles(profile)`, the full
  closure (`:419`, `:458`). For one level of `depends` both are the same set, so step 1 merges them. For a chain
  `c → b → a`, a generator-added file gets one watcher for `{b, c}` and one for `{a, b, c}`, and a change emits `b`
  and `c` twice. Recommended: leave it, and name it in the PR as a known limit. Aligning the two lists changes which
  profiles a watch rebuild emits, which is outside this item.
- **Release-notes section.** The other slices of this plan wrote `### Changed` entries because builds that passed may
  now fail. This one makes no build fail. Recommended: `### Fixed`.
- **The Info message in one-shot builds.** It is a side effect of cause 1 and goes away with step 3. Say so in the PR.

### Tests

Follow `docs/rules/testing.md`: assemble / act / assert, no part comments, `testObj` and `actual`, and no shared
`testObj` (`CompilationContext.spec.ts` has a legacy shared `testObj` in its `beforeEach` at `:53`; new tests create
their own instance).

**Unit, `packages/core/src/compiler/Compiler.spec.ts`**, in `describe("watch")` (`:2080`). Use the virtual system and
the `CompilerTestClass` setup of the existing cases (e.g. `:2185-2206`). For the generator, copy the local
`createAddons` helper (`:4118-4125`, inside the ESM describe) with `needsTypeInfo: false`. Spy `fileSystem.watchFile`
to count watchers per path. Close the watchers at the end of each test. Run each case for `{ profile: undefined }` and
`{ profile: "client" }` (`config: { profiles: { client: { addons: ["gen-addon"] } } }`). Put the addon only in the
profile, or only in `config.addons`, not in both: both activate it twice.

- **first build emits the added file**: after `watch()`, the output of `/src/added.ts` exists. Red today in both
  rows.
- **one watcher per path and profile set**: after `watch()` and two edits of `/src/target.ts` (each re-adds
  `added.ts`), `watchFile` was called exactly once for `/src/added.ts`. Red today: 3 without a profile, 4 with one.
- **reported once per change**: after those edits, write a syntax error into `/src/added.ts`. The reporter holds
  `Error: /src/added.ts (1,18): Expression expected.` exactly once. Red today: 3 and 4.
- **virtual file on the first build**: a generator calling `addVirtualFile("/src/virtual.ts", "export const v = 1;")`
  is emitted by `watch()`.
- **`closeAllWatchers` then `watch()` again** registers `/src/target.ts` again (one more `watchFile` call), proving
  the keys are cleared.
- The existing `watch` and `watch w/ esm profile` (`:2589`) cases stay green unchanged.

**Unit, `packages/core/src/compiler/compilation/CompilationContext.spec.ts`**, in `describe("addInputFile")`
(`:241`), each test with its own `CompilationContextTestClass`:

- with a `watchCallback` mock, `addInputFile("/src/added.ts")` twice calls it **once**, and the reporter shows
  `Adding /src/added.ts to watch.` once;
- with a `watchCallback` mock and `rootFiles: ["/src/a.ts"]`, `addInputFile("/src/a.ts")` does not call it;
- without a `watchCallback`, `addInputFile` reports no `Adding … to watch.`, and the file is still a root file and
  still marked as added by an addon (`:177`; see the existing case at `:338`).

**e2e, `packages/compiler/src/bin.test.ts`.** This is the first `--watch` case in the file (plan Open Point
"Watch e2e").

- Import `spawn` next to `spawnSync` (`:10`). Write the addon with the existing `createAddon` (`:1482-1486`). Its
  `addon.js` is `exports.activate = ctx => ctx.registerGenerator(f => { if (f.endsWith("a.ts")) ctx.addInputFile(
  require("path").join(require("path").dirname(f), "gen.ts")); });`. Use a `tsconfig.json` whose `include` lists only
  `src/a.ts`, so that `gen.ts` reaches the build only through the generator. `createTsConfig` (`:1708`) hard-codes
  `include: ["src/**/*"]`; write this `tsconfig.json` directly.
- Spawn `node bin/bin.js --addonsDir <addons> --addons gen --project <tsconfig> --watch` asynchronously and collect
  stdout and stderr. Poll with a small `waitFor(predicate, timeoutMs)` helper (check every 100 ms; fail with the
  collected output on timeout). Kill the child in a `finally`, so a failing assertion does not leak a process.
- **should emit generator-added file on first watch build**: wait until `gen.js` exists under the output directory.
  Red today.
- **should report a syntax error in a generator-added file once w/ rebuilds re-adding it**: after `gen.js` exists,
  edit `a.ts` twice, waiting each time until `a.js` holds the new value. Then write `export const g = ;` into
  `gen.ts`, wait until the output contains `Expression expected.`, wait one more second, and count. It must be
  exactly **1**. Red today: 3.
- Give each test a 60 s Jest timeout. If it proves flaky in CI, the plan's fallback applies: keep the unit tests, drop
  the e2e, and say so in the PR.

**Gates**, all green locally: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`.
Run `pnpm build` before the e2e: `bin.test.ts` runs `bin/bin.js`. State whether the advisory TS 6.0.3 cell is green.

### Release notes and docs

- **`Release-Notes.md`**, under `## [Unreleased]` / `### Fixed` (at the end of that list), from the plan's
  Changelog: "In watch mode, a file a generator adds with `addInputFile` is emitted on the first build and reported
  once per change instead of once per rebuild that re-added it." Add: "`Adding <file> to watch.` is printed once per
  file, and no longer by builds without `--watch`."
- **README:** none. No CLI flag, config key or addon API changes.

### Done when

- The unit tests and the e2e above are red on `develop` and green on the branch. Show the red run in the PR (or the
  counts from it).
- `watchFile` is called once per path and profile set, however often a generator re-adds the path.
- A generator-added file is written by the first watch build, with and without a profile.
- No change to what `compile()` emits or reports; the existing `compile` specs stay green unchanged.
- No new `fileWatchers` leak: `closeAllWatchers` closes everything it registered.
- The PR names the deep-`depends` limit and the `rootFilesCache` aliasing as findings.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`, then give it a descriptive title.
- Append `→ #<number>` to the `bug/watch-generator-added-files` line in the plan's `## Slices` (under "### Watch"),
  before its `<!-- builds: -->` comment, and commit that on this branch.
- Commits use Arlo's notation without a colon (`commit-notation` skill), e.g.
  `B Registers one watcher per generator-added file and profile set` and
  `B Emits generator-added files on the first watch build`.

### Repo facts

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (put it first on `PATH`). The Homebrew pnpm 11 fails with
  E401. Set `NX_DAEMON=false` in agent shells.
- Install with `pnpm install --frozen-lockfile --offline`. Never edit `~/.npmrc`. This branch needs no new package.
- New files carry the MIT header (`pnpm license:add`). Do not add them to the `license:check` list.
- Use `trash`, never `rm`.

### Scope guard

This branch owns:

- `packages/core/src/compiler/Compiler.ts`: `registerWatch` (`:916-950`), the walks in `watch()` (`:226-247`),
  `closeAllWatchers` (`:255-258`) and one new private field next to `fileWatchers` (`:101`). Nothing else.
- `packages/core/src/compiler/compilation/CompilationContext.ts`: the constructor's `watchCallback` default (`:91`)
  and `addInputFile` (`:159-178`).
- `Compiler.spec.ts` (`describe("watch")`), `CompilationContext.spec.ts` (`describe("addInputFile")`),
  `packages/compiler/src/bin.test.ts` (new watch cases and the `spawn` import), `Release-Notes.md` (`### Fixed`), and
  the `→ #<PR>` on this slice's plan line.

Do not touch:

- **the start of `compile()` (`:142-157`) and the first line of `watch()` (`:219-220`).**
  `bug/report-config-option-errors` adds its once-per-session report there. Keep your `watch()` diff below `:221`.
  Whoever merges second rebases, and the hunks are adjacent but separate;
- `report()` (`:670-693`), `emitWatchedFile` (`:844-858`), `reportedWatchDiagnostics`, the per-file declaration path
  and the 6046 filter (`:1436`). They belong to `bug/report-file-less-diagnostics`;
- `ResolvedCompilerOptions.ts`, `parsed-command-line.ts`, `ModuleCompiler.ts` (`bug/report-config-option-errors`,
  `bug/loader-unknown-profile-error`);
- `check-esm.ts`, `defaults.ts`, `AddonRegistry.ts`, `environment.ts` (`bug/typescript-6-own-compilations`);
- `packages/node/**` (`bug/node-tsc-ignore-config`), `packages/webpack/src`, `packages/vite`;
- `package.json` files, `pnpm-lock.yaml`, tsconfigs, `.github/`, snapshots.

**Real overlaps, all textual:**

- `Compiler.ts` `watch()` with `bug/report-config-option-errors` (one line at its start, above your hunk).
- `Compiler.spec.ts` `describe("watch")` and `bin.test.ts` with `bug/report-config-option-errors`, which adds cases
  to both. Both only add. Keep both when rebasing.
- `Release-Notes.md` with every branch in flight. It is append-only; keep all entries.

If you find something the plan did not anticipate beyond the items above, report it rather than improvising outside
scope.
