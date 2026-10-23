<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — addon-rebuild-gaps (slice: Stale output)

- **Plan (canonical):** `docs/plans/2026-10-16-addon-rebuild-gaps.md` on `develop`
- **Approved:** 2026-10-20, Jan Wloka, plan-PR #213 merged
- **Branch:** `bug/file-cache-update-source` (base: `develop`, at `a1083322` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** The plan runs one slice per wave, in heading order: Stale output → noEmit in bundler hosts
(`bug/bundler-no-emit`) → Type-only imports (`bug/type-only-import-deps`) → Build watch
(`bug/vite-build-watch-reload`). This is the first slice. No earlier slice of this plan has merged, so you start
from `develop` as approved. The later slices start from `develop` after you merge. They edit the same
`Release-Notes.md` `## [Unreleased]` and the same `packages/vite/README.md` sections ("Dev server", "Known limits"),
so keep your edits to the lines named below.

Line numbers below are from `develop` at `a1083322`. If they moved, find the code by name.

### Current behaviour

**The cause (read).**

- `FileCache.updateSource` (`packages/core/src/compiler/cache/FileCache.ts:37-49`) replaces the cached entry only if
  `!file.snapshot || this.hasChanged(fileName)`.
- `hasChanged` (`:27-35`) is true only if a field is missing or the **source file's** mtime is newer than the cached
  `modifiedTime`. `updateSource` stamps that with `new Date()` (`:44`).
- So when only a file the addon reads changes, the source's mtime is older. The processors return new text, and
  `updateSource` drops it. The old `content`, `snapshot` and `version` stay.
- Caller: `Compiler.emitSourceFileOutput` calls `cache.updateSource(filePath, content)` once per emitted module, after
  the processors (`Compiler.ts:584`). `CompilationContext.addVirtualFile` calls it too (`CompilationContext.ts:226`).

**Who reads the stale snapshot (read, then confirmed by the runs below).** Only the language-service path does.

- The language-service host takes `getScriptVersion` and `getScriptSnapshot` from the cache
  (`CompilationContext.ts:457-485`). Same version → the language service reuses the old source file and emits the
  old text.
- The fast path (`Compiler.ts:1315`: `transpileOnly`, or `shouldUseTranspileModuleFastPath`, `:764`) and the
  per-file Program for declarations (Case 3, `:1388-1392`) compile the `content` argument, never the snapshot. They
  are not stale.
- A module takes the language-service path when `transpileOnly` is off and some active addon has `needsTypeInfo !==
  false` (`anyAddonNeedsTypeInfo`, `:743-753`). An addon without a `needsTypeInfo` export counts as needing it.
- `anyAddonNeedsTypeInfo` returns `false` when the compiler has no `AddonRegistry` (`:744`).
  - The **CLI** and the **Vite plugin** pass one (`packages/vite/src/hooks.ts:130-131`).
  - The **webpack loader** passes none: `TsCompiler`'s constructor (`packages/webpack/src/TsCompiler.ts:43-57`) gives
    `ModuleCompiler` no `addons`. Its addons run through `WebpackAddonService`. So **the loader always takes the fast
    path or the per-file Program, and is never stale.** See "Plan vs. develop".

**Where `addAssetDependency` is implemented, per host (read):**

| Host | Implementation | What an edit of the child triggers |
|---|---|---|
| CLI | `CompilationContext.addAssetDependency` (`CompilationContext.ts:196-212`) → `registerDependency` (`:495-523`) → `watchCallback` → `Compiler.registerWatch` (`Compiler.ts:1028-1066`) | `resolveDependency(child)` → `emitWatchedFile(parent, profile, true, true)` (`skipCache`), so the processors run again |
| webpack loader | `CompilationContext.addAssetDependency` → `registerDependencyCb`, which is the loader's `this.addDependency` (`packages/webpack/src/loader.ts:29-31`). `WebpackAddonContext.addAssetDependency` (`WebpackAddonContext.ts:124-146`) does the same through `loaderContext.addDependency`. | webpack rebuilds the module; `ModuleCompiler.emitSourceFile` always passes `skipCache` (`ModuleCompiler.ts:557-558`) |
| Vite plugin | `ViteAddonContext.addAssetDependency` (`packages/vite/src/vite-addon-context.ts:39-43`) → `AddonOutputs.addWatchFile` → `this.addWatchFile` in `transform` | dev server: `full-reload`, `main.ts` transformed again; build watch: Rollup rebuilds the module |

**Reproductions I ran** on a worktree of `a1083322`, Node 22.17.0, after `pnpm install --frozen-lockfile --offline`
and `pnpm build --skip-nx-cache`.

The fixture:

- `src/a.ts` (Vite: `src/main.ts`): `export const greeting: string = "DATA_IN";`
- `data.txt`: `DATA1`
- `addons/datap/addon.js`, a processor that calls `ctx.addAssetDependency(data, file)` and replaces `DATA_IN` with the
  text of `data.txt`. No `needsTypeInfo` export unless a row says otherwise.
- Steps: build; write `DATA2` into `data.txt`; then edit the source.

| # | Host | Setup | After the `data.txt` edit | After the source edit | Verdict |
|---|---|---|---|---|---|
| 1 | CLI `--watch` (`packages/compiler/bin/bin.js`) | addon without `needsTypeInfo` | `dist/a.js` keeps `"DATA1"` | `"DATA2" + 1` | **stale (red)** |
| 2 | CLI `--watch` | `exports.needsTypeInfo = false` | `"DATA2"` | `"DATA2" + 1` | correct (fast path) |
| 3 | CLI `--watch`, row 1 with `bin.js` patched to `!file.snapshot \|\| file.content !== content \|\| this.hasChanged(fileName)` | | `"DATA2"` | `"DATA2" + 1` | **fixed by the planned change** |
| 4 | webpack 5.111.1 `compiler.watch`, `transpileOnly: false` | addon without `needsTypeInfo` | `"DATA2"` | `"DATA2" + 1` | **correct on develop** |
| 5 | webpack, `transpileOnly: true` | same | `"DATA2"` | | correct |
| 6 | webpack, `transpileOnly: false`, `declaration: true`, `needsTypeInfo = true` | | `"DATA2"` | | correct |
| 7 | `vite build --watch`, Vite 7.3.7 | lib build, `generateBundle` probe | bundle keeps `"DATA1"` | `"DATA21"` (Rollup folds `"DATA2" + 1`) | **stale (red)** |
| 8 | `vite build --watch`, Vite 6.4.4 (`vite6`) | same | `"DATA1"` | `"DATA21"` | **stale (red)** |

In row 4 a trace in the built `FileCache.updateSource` showed the cache still keeping version 1 with the old content
after the `data.txt` edit (`snap=true changed=false same=false`). The loader just never reads it.

**Not run by me:** the Vite dev server. The dev-invalidation brief (`.plot/briefs/vite-plugin-dev-invalidation.md`,
row 13 and "Row 13's cause is confirmed") reproduced it on Vite 6.4.4 and 7.3.7: `full-reload` arrives, `datap` runs
with `DATA2`, and the served module keeps `DATA1`. The same planned patch made both the dev server and
`vite build --watch` serve `DATA2`. The dev-server brief row 16 shows the same with `data.json`.

The repro scripts are in the brief writer's scratchpad (`fc-repro/setup.sh`, `cli.sh`, `wp.cjs`). They are not needed.
The e2e cases below are the same steps.

### Plan vs. develop

1. **The plan says the loader keeps the old text (Motivation row 9 "Hosts: core: CLI watch, loader, Vite"; the
   Changelog "Before, the CLI's watch mode, the loader and the Vite plugin kept the previous text").** On `develop`
   the loader serves the new text (rows 4-6). It gives core no `AddonRegistry`, so it never takes the
   language-service path.
   - Resolution within the slice line: **write the loader e2e anyway, as a guard** that passes before and after the
     fix. Say so in the PR under "Plan vs. develop".
   - The Release-Notes entry names the CLI and the Vite plugin, not the loader.
   - The Changelog in the plan stays as is: the plan is frozen.
2. **Only the language-service path is stale** (rows 1-2). An e2e or unit test is red only if its fixture takes
   that path: no `transpileOnly`, and an addon whose `needsTypeInfo` is not `false`.
   - The Vite and CLI e2e fixtures below use plain `addon.js` files without `needsTypeInfo`, so they are red.
   - `createModuleCompiler` in `ModuleCompiler.spec.ts:24-40` sets `transpileOnly: true` and `needsTypeInfo: false`.
     A unit test built on it as is would pass before the fix. See "Done when".

### What to build

**1. Core** (`packages/core/src/compiler/cache/FileCache.ts`). Change the condition in `updateSource` to:

```ts
if (!file.snapshot || file.content !== content || this.hasChanged(fileName)) {
```

Nothing else changes in core. `hasChanged` keeps its meaning: `emitSourceFileOutput` uses it to return the cached
fragment when nothing changed (`Compiler.ts:517`, `:530`), and that must stay mtime-based.

- `content` is the processed text, so a processor whose output differs per run (e.g. a timestamp) bumps the version
  on every rebuild. That re-checks the file and its dependents on the language-service path. The plan accepts that
  cost.
- **Side effect, keep it:** `CompilationContext.addVirtualFile` (`:226`) goes through the same method. A generator
  that re-adds a virtual file with new content now updates it; before, the old snapshot stayed. Mention it in the PR
  under "Found, not built". It needs no test of its own here.

**2. Tests**, see "Done when".

**3. Docs.**

- `packages/vite/README.md`, section "Dev server", the bullet at `:195-197`. Keep its type-only sentences; the
  "Type-only imports" slice owns those. Replace its last sentence, "An edit of a file an addon reads through
  `addAssetDependency` reloads the module, but the served output can keep the old text.", with "An edit of a file
  an addon reads through `addAssetDependency` reloads the module with the addon's new output."
- `packages/vite/README.md`, "Known limits": delete the bullet at `:246-247` ("**An edit of a file an addon reads
  through `addAssetDependency`** reloads the module, but its output can keep the old text, …").
- No other user doc carries this limit: `README.md`, `packages/webpack/README.md`, `packages/compiler/README.md`,
  `docs/rules/*` and `packages/vite/src/plugin.ts`'s JSDoc were checked.
- Optional, one line: `docs/rules/architecture.md:156-157` says "the version increments when a source changes". You
  may make it "when a source or its processed text changes". Nothing more there.
- `Release-Notes.md`, `## [Unreleased]` → `### Fixed` (`:182`). Add one bullet at the end of that list, e.g.:
  "Under `websmith --watch`, an edit of a file an addon registered with `addAssetDependency` now emits the addon's
  new output when the addon needs type information (it does not set `needsTypeInfo: false`) and `transpileOnly` is
  off. Before, the output kept the old text until the source file itself changed. The Vite plugin's dev server and
  `vite build --watch` behave the same. The webpack loader was not affected."
  - The Vite package is unreleased. Its `### Added` bullet (`:17-27`) already points to its README's known limits,
    so do not edit that bullet.

### Done when

The slice line is the specification:

- "`FileCache.updateSource` replaces the snapshot when the content changed";
- "unit tests in `FileCache.spec.ts` (same mtime, new content → new version; same content → same version)";
- "e2e: a processor reading a data file through `addAssetDependency` serves the new text after the data edit in the
  Vite dev server, in `vite build --watch`, in the loader's watch mode and in the CLI's watch mode";
- "README known-limit lines removed; Release-Notes entry".

The plan's Design adds two more:

- a unit test that two rebuilds with a processor that returns different text bump the version twice;
- the bench check below.

Write each test red first and run it against the unfixed `FileCache.ts` to prove it fails. Cases marked **guard**
pass on `develop`; keep them as guards and say so in the PR.

**Unit tests.** Follow `docs/rules/testing.md`: assemble / act / assert with one blank line between the parts, no
comments marking them. Name the object under test `testObj` and its outcome `actual`. Every test creates its own
`testObj`; no `let testObj` with `beforeEach`.

`packages/core/src/compiler/cache/FileCache.spec.ts`, new `describe("updateSource", …)`. Use `createBrowserSystem()`
as the existing tests do (`:11-44`). Write the file once, so its mtime does not change.

- **red:** "should yield new version w/ new content and unchanged modification time".
  `new FileCache(system).updateSource(f, "first").updateOutput(f, [])`, then `updateSource(f, "second")`.
  `getVersion(f)` is `2`.
- **red:** "should yield snapshot of new content w/ new content and unchanged modification time". Same steps; the
  snapshot's text (`getText(0, getLength())`) is `"second"`.
- **guard:** "should keep version w/ same content and unchanged modification time". Same steps with `"first"` twice;
  `getVersion(f)` stays `1`.
- **red:** "should yield new version per update w/ different content in each update". `"first"`, then `"second"`, then
  `"third"`, each followed by `updateOutput`; the version is `3`. This is the cost the plan wants visible.
- **guard:** "should yield new version w/ newer modification time and same content". Keep the mtime path covered.

`packages/core/src/compiler/ModuleCompiler.spec.ts`: the same bug through a real compile on the language-service path.

- Extend `createAddons`/`createModuleCompiler` (`:17-40`) with an opt-in, e.g. `{ typeInfo: true }`. It gives the
  addons `needsTypeInfo: true` and the loader options `transpileOnly: false`. Existing callers stay unchanged.
- **red:** "yields fragment w/ new processor output after edit of asset dependency w/ type info".
  - A processor reads `/data.txt` from the system and replaces `DATA_IN` with it.
  - `build("/src/a.ts")`, then `system.writeFile("/data.txt", "DATA2")`, then `build` again.
  - The second fragment's `.js` contains `DATA2`.
- **red:** "yields version bumped twice w/ two rebuilds of processor returning different text w/ type info". A
  processor appends a counter that increments per call. Three builds of the same file: the third fragment's
  `version` is the first's plus 2.
- **guard:** "yields same version w/ rebuild of unchanged module w/ type info". A deterministic processor; two builds;
  equal `version`.
- **guard:** "yields fragment w/ new processor output after edit of asset dependency w/o type info". Use the existing
  helper (fast path). It passes on `develop`.

**E2E.** Each case writes a processor addon that reads a data file through `addAssetDependency`, edits the data file,
and asserts the new text. Use plain CommonJS `addon.js` files **without** a `needsTypeInfo` export and without
`transpileOnly`, so the fixture takes the stale path.

- **CLI watch (red)**, `packages/compiler/src/bin.test.ts`, run by `pnpm --filter @quatico/websmith-compiler test:e2e`
  (`jest --testRegex=".*\.test\.ts$"`).
  - Add a sibling of `describe("w/ --watch and generator adding an input file", …)` (`:1608-1709`), e.g.
    `describe("w/ --watch and processor reading an asset dependency", …)`.
  - Its helpers `waitFor`, `editUntil` and `stopChild` (`:1609-1643`) are local to that describe. Move them one level
    up, unchanged, so both describes share them. Copy the spawn of `startWatchCompiler` (`:1645-1676`).
  - Case: "should emit new processor output w/ edit of asset dependency". Wait for `dist/a.js` with `DATA1`. Then
    `editUntil(() => write data.txt "DATA2", () => dist/a.js includes "DATA2", 10000, …)`. Assert `dist/a.js`
    contains `DATA2`. Always `stopChild` in `finally`.
  - On `develop` it times out with `DATA1` (row 1).
- **webpack loader watch (guard)**, `packages/webpack-test/tests/webpack-loader-resolve-once.test.ts`, inside
  `describe("webpack w/ websmith-loader under watch", …)` (`:44`).
  - Reuse its `runWebpack({ config, outputs, steps })` (`:307-…`), which waits for a rebuild whose
    `compiler.modifiedFiles` contains the stepped file, and `singleRule` (`:241-258`).
  - Pass `singleRule({ profile: "target", transpileOnly: false })`; `singleRule` defaults to `transpileOnly: true`.
  - Write `websmith.config.json` with `{ addonsDir: "./addons", profiles: { target: { addons: ["datap"] } } }`.
  - `steps: [{ "data.txt": "DATA2" }]`. Expect the `dist/main.js` reports to map to `[DATA1, DATA2]`.
  - Name it, e.g., "emits new processor output of edited asset dependency".
  - It passes on `develop` (row 4). Do not touch the known-flaky "emits output of edited tsconfig.json" (`:45`) in
    the same file.
  - If you prefer a new file, copy that harness rather than extracting it. Extracting it is out of scope.
- **`vite build --watch` (red)**, `packages/vite-test/tests/vite-addon-outputs.test.ts`, next to "should rebuild w/
  edit of asset dependency under watch" (`:73-85`). That test only counts `START`s.
  - `runViteWatch` (`tests/vite-project.ts:260-310`) returns events only.
  - Extend it in a backward-compatible way: add a probe plugin that records the chunk code in `generateBundle`, and
    attach it to each `BUNDLE_END` event as an optional field, e.g. `bundle?: string` on `ViteWatchEvent`. Existing
    callers keep working.
  - Case: `it.each(VITES)` "should bundle new processor output w/ edit of asset dependency under watch w/ %s". The
    bundles of the two `BUNDLE_END`s contain `DATA1` and then `DATA2`.
  - Rows 7-8: on `develop` the second bundle keeps `DATA1`. Do not assert on `"DATA2" + 1`: Rollup folds it.
- **Vite dev server (red)**, `packages/vite-test/tests/vite-dev-invalidation.test.ts`. Its `beforeEach` (`:100-116`)
  gives you the project.
  - Write a `datap` addon with the file's `writeLoggingAddon` (`:29-42`), with
    `ctx.registerProcessor((file, content) => (ctx.addAssetDependency(ctx.resolvePath("data.txt"), file),
    content.replaceAll("DATA_IN", fs.readFileSync(ctx.resolvePath("data.txt"), "utf-8"))))`.
  - Use `writeProfiles({ app: { addons: ["datap"] } })` and put `DATA_IN` in `src/shared.ts`.
  - Steps: `await get("/src/shared.ts");` and
    `await edit("data.txt", "DATA2", ${reloadOf("data.txt")});` (`reloadOf`, `:76-78`), then
    `await get("/src/shared.ts");`.
  - Assert `timeouts` is `[]`, the first response body contains `DATA1`, and the last contains `DATA2`.
  - `it.each(VITES)`, 60 s timeout. Name it "should serve new processor output w/ edit of asset dependency w/ %s".
  - On `develop` the last body keeps `DATA1` (dev-invalidation brief row 13; not run by me).

**Flakiness.** Run each changed e2e file 5 times in a row and report "5/5 green, N tests each" in the PR:

- `vite-addon-outputs.test.ts`, `vite-dev-invalidation.test.ts`:
  `pnpm --filter websmith-vite-test exec jest <file> --runInBand`;
- `bin.test.ts` with `-t "asset dependency"`;
- the new case in `webpack-loader-resolve-once.test.ts` with `-t "asset dependency"`.

**Bench.** The plan wants the string comparison checked with `packages/webpack-test/perf/esm-watch-bench.cjs`. Its
header (`:7-45`) is the manual.

- Build both trees: a worktree of `develop` at the branch's merge base, and your branch.
- In both, 3 times, from `packages/webpack-test`: `pnpm perf:esm --modules 1000 --processes 5`.
- On each side take the median of the 3 "Initial build" medians of variant A, and the same for the edit medians.
- Put both numbers and the command in the PR.
- The plan sets no threshold for this slice. If the branch is slower by more than the spread of develop's 3 runs,
  say so in the PR and ask the maintainer.
- The bench runs the loader, which takes the fast path. The comparison runs once per emitted module, before the
  transpile, on every path. So the bench measures it. It does not measure the extra re-checks a non-deterministic
  processor causes on the language-service path; the unit test above makes those visible.

**Also:**

- New files carry the MIT header (`pnpm license:add`). Do not add them to the `license:check` list.
- No `console` in production code.
- Gates, all green: `pnpm lint`, `pnpm build --skip-nx-cache`, `pnpm test --skip-nx-cache` and
  `pnpm test:e2e --skip-nx-cache`, on Node 22 (`$HOME/.nvm/versions/node/v22.17.0/bin`).
  - Run `packages/vite-test` and the changed e2e files once more on Node 24.21.0 and say so in the PR.
  - CI also has a `dist (24, typescript 5.7.3)` cell. `develop` pins TypeScript 6.0.3 and the peers are
    `>=5.7 <7`. Nothing here is version-specific, but watch that cell.

### Settled decisions — do not re-derive them

- **Compare content in `updateSource`; keep the mtime check.** Both conditions replace the snapshot (plan Design,
  "Stale output").
- **A processor whose output differs per run bumps the version on every rebuild.** Correct output wins over the
  extra check. Do not cache or hash around it.
- **Rejected: bump only when the edited file is one of the module's `addAssetDependency` files.** It needs the changed
  path passed down into the cache, for a saving only such processors would see.
- **The CLI's watch mode gets the same behaviour.** It runs the processors on each rebuild (`registerWatch`,
  `skipCache`), so the one core change fixes it.
- **The loader e2e is a guard** (Plan vs. develop 1). Do not change the loader to make it "red".
- **The comparison's cost is checked with the bench**, not gated by it.

### Repo mechanics

- **Worktree setup.** pnpm 10.34 refuses frozen installs here. Use the corepack-cached 10.8.0 through a shim:

  ```sh
  mkdir -p /tmp/pnpm-shim && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > /tmp/pnpm-shim/pnpm && chmod +x /tmp/pnpm-shim/pnpm
  export PATH=/tmp/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline && pnpm build --skip-nx-cache
  ```

- **Never edit** `pnpm-lock.yaml`, `~/.npmrc` or the root `package.json`. No dependency is added.
- **`test-output-*` dirs.** Leftover `packages/**/test-output-*` directories with a `package.json` join the
  workspace, and the next install pollutes the lockfile. If it happens, `git checkout -- pnpm-lock.yaml`.
- **The CLI e2e runs `packages/compiler/bin/bin.js`.** It bundles core, so rebuild (`pnpm build`) after the core
  change before you run it. To show red, check out `FileCache.ts` at `a1083322`, rebuild, run, then restore.
- **Merges:** `git -c rerere.enabled=false merge …`.
- **Deleting files:** `trash`, never `rm`.
- **Known flaky e2e, not yours:** webpack-loader-resolve-once "emits output of edited tsconfig.json", and
  webpack-esm-check "rebuilds exactly the edited leaf module". Re-run; if one fails twice, report it in the PR.
- **Node 24 segfault:** a full in-band `webpack-test` run can segfault locally on Node 24. Run its files one by one
  there.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). A suggested split:
  - `B Replaces the cached snapshot when the processed text changed` (FileCache + its unit tests + ModuleCompiler
    tests);
  - `t Covers new processor output after an asset dependency edit in every watch host` (the four e2e cases and the
    `runViteWatch` extension);
  - `d Removes the stale asset dependency output from the Vite known limits` (README, optional architecture line);
  - `d Notes the stale asset dependency output fix in the release notes`;
  - the plan link as its own `d` commit (see Bookkeeping).

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Its title comes from the slice heading, "Stale output".
- Append ` → #<PR>` to the line `### Stale output (Branch: bug/file-cache-update-source)` in
  `docs/plans/2026-10-16-addon-rebuild-gaps.md` (`:128`), and commit it on this branch. Change nothing else in the
  plan.
- PR body:
  - what changed;
  - "Plan vs. develop": the loader was never stale (rows 4-6), so its e2e is a guard; the stale path is the
    language-service path only;
  - "How it was verified": each red test failing on `a1083322` (name the failure), the guards, the 5× runs, the
    bench numbers, Node 22 and 24;
  - "Found, not built": the `addVirtualFile` side effect, and anything from "Not in this slice" you tripped over.

### Scope guard

This branch owns:

- `packages/core/src/compiler/cache/FileCache.ts` and `FileCache.spec.ts`;
- `packages/core/src/compiler/ModuleCompiler.spec.ts` (new tests and the opt-in helper parameter);
- `packages/compiler/src/bin.test.ts`;
- `packages/webpack-test/tests/webpack-loader-resolve-once.test.ts` (one new case only);
- `packages/vite-test/tests/vite-addon-outputs.test.ts`, `vite-dev-invalidation.test.ts`, `vite-project.ts`
  (`runViteWatch` only);
- `packages/vite/README.md` (the two lines above), optionally `docs/rules/architecture.md:156-157`;
- one bullet in `Release-Notes.md` `### Fixed`, and the `→ #<PR>` in the plan.

Do not touch:

- any other `packages/core/src` file, including `Compiler.ts` and `hasChanged`;
- `packages/webpack/src`, `packages/vite/src`, `packages/api`;
- `.github/**`, the root `package.json`, `pnpm-lock.yaml`.

Concurrent work, checked against `a1083322`:

- **#211, #207, #195 (Dependabot)** edit manifests and the lockfile only; #211 touches `packages/vite` and
  `packages/vite-test` `package.json`. If one merges first, take `develop`'s lockfile and manifests.
- No open PR touches the files you edit.

### Not in this slice

Each has an owner. Mention any you trip over in the PR, but do not build them.

- **Type-only import edits rebuild nothing** (plan row 8). Owner: "Type-only imports", `bug/type-only-import-deps`.
  Leave the README's type-only sentences and its Known-limits bullet as they are.
- **`noEmit: true` drops addon output** in the bundler hosts (row 11). Owner: "noEmit in bundler hosts",
  `bug/bundler-no-emit`. If a Vite fixture of yours needs emit, keep `writeTsConfig`'s defaults (`outDir: ./tsc-out`,
  no `noEmit`).
- **`vite build --watch` ignores addon and config edits** (row 10). Owner: "Build watch",
  `bug/vite-build-watch-reload`. Your build-watch case edits a data file only, which Rollup already watches
  (`addAssetDependency` → `this.addWatchFile`), so it does not depend on that slice.
- **The loader's `WebpackAddonService` path never gives core an `AddonRegistry`**, so `needsTypeInfo` has no effect
  in the loader. That is why it is not stale. It is existing behaviour. Do not change it here; mention it in the PR
  if you think it needs an owner.
