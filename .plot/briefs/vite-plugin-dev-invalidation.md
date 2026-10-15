<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — vite-plugin (slice: dev invalidation)

- **Plan (canonical):** `docs/plans/2026-10-01-vite-plugin.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #132 merged
- **Branch:** `feature/vite-plugin-dev-invalidation` (base: `develop`, at `4c713396` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is the plan's seventh slice. `## Slices` runs one branch per `###` heading, in heading order (plan
Notes: "headings run in order"), and no slice line carries a `<!-- waits: -->`. "Neutral module compiler" merged as
#174, "Tracer" as #182, "Diagnostics" as #193, "Addon outputs and context" as #198 (`c2622c3f`), "Environments" as
#202 (`61fedf42`) and "Dev server" as #205 (`4c713396`). The next heading is "Dev invalidation", so this branch is
next. After it comes "Release" (`docs/vite-plugin-release`).

Line numbers below are from `develop` at `4c713396` (#205 merged). If they move, find the code by name.

### What changed on `develop` since the plan was approved

- **#205 (Dev server)** gave `packages/vite/src/hooks.ts` its current shape. Everything this slice changes is in it:
  - `EnvironmentLogger` (`:23-26`) has `error` and `warn`, no `info`. `EnvironmentInfo` (`:33-37`) is
    `{ name; config: { root; build: { outDir } }; logger }`.
  - `HookDependencies.createCompiler` (`:81-84`) takes `(loaderOptions, reporter, outputs)`.
    `createModuleCompiler` (`:94-113`) wraps `ts.sys` in `createDeduplicatingSystem` per compiler (`:99`), so each
    environment state has its own write record.
  - `EnvironmentState` (`:135-161`) holds `serving`, `serveErrors`, `loggedKeys`, `activationErrors` and
    `packageJsonCache`. States live in `environments` (`:180`, by name) and `instances` (`:182`, a `WeakMap` by
    environment object).
  - `startServing` (`:233-252`) logs the configuration errors once per state. A state is created in `buildStart`
    (`client`) or lazily in `transformHandler` (`ssr`) by `getEnvironmentState` (`:294-303`).
  - `buildStart` (`:330-382`), for an existing state, refreshes options and addons (`:337-346`), clears
    `packageJsonCache` (`:335`) and, in serve mode, calls `forgetOtherEnvironments` (`:351-353`, defined `:307-308`):
    this is #205's fix for `ssr` after `server.restart()`.
  - `transformHandler` (`:388-435`) adds `dependencies` and the `package.json` of `checkModuleFormat` with
    `this.addWatchFile` (`:409-411`, `:418`). In the dev server a watch file added in `transform` becomes a module node
    imported by that module, so editing it reloads the module.
  - `buildEnd` (`:443-471`) prunes `outputFiles` and `outputs.retainModules` in build mode only (`:459-466`).
  - `findVirtualFile` (`:486-504`) serves from `environments.get("client")`.
  - **There is no `hotUpdate` hook.** `plugin.ts:68-84` wires `configResolved`, `configureServer`, `buildStart`,
    `transform`, `buildEnd` and `generateBundle`.
- **`write-record.ts:21-36`**: `createDeduplicatingSystem` skips a write when *its own* last write to that path had
  the same hash and the file exists (`:29`). It never reads the file on disk.
- **`addon-outputs.ts`**: `startModule(id)` (`:88-90`) drops a module's entries; `retainModules` (`:93-97`);
  `getVirtualFile` (`:186-193`) merges all module entries, so a deleted module's virtual file stays served.
- **`config-errors.ts:40-50`**: `findPackageJson` walks up with `fileExists` on every module, uncached.
- **Core, read only for this slice:**
  - `ModuleCompiler.getOptionsFiles()` (`ModuleCompiler.ts:305-307`) returns `{ files, missing }`: the config file,
    the `tsconfig.json` and its `extends`. A broken or missing config file is still listed (checked: `{ broken` →
    `files: [config, tsconfig]`; `missing.json` → `missing: [missing.json]`).
  - `getOptions().config?.addonsDir` is absolute after resolution, and `undefined` while the config is broken.
  - `refreshAddons()` (`:338-343`) is a no-op unless `markAddonsLoaded()` (`:546-548`) ran, and only
    `TsCompiler.ts:123` calls it. **For the Vite host, `refreshAddons` never reloads anything.**
  - A new `ModuleCompiler` with a new `AddonRegistry` loads each addon's entry file again:
    `AddonRegistry.ts:868` deletes it from `require.cache` first. Modules the addon itself requires stay cached.
  - `updateLoaderConfig` (`:294-302`) recreates the contexts before it reassigns `this.profile` (#198 known limit).
    `ResolvedCompilerOptions.ts:188` takes the profile from `loaderOptions.profile`, which the Vite plugin fixes per
    environment from its own options, so the name cannot change on a config edit.
  - `FileCache.updateSource` (`cache/FileCache.ts:37-48`), called at `Compiler.ts:584`, keeps the old snapshot unless
    the source file's mtime is newer, even when the processors returned new text.
- **Docs that this slice must correct:**
  - `packages/vite/README.md:62-65` says configuration errors stay "until the configuration is fixed. Fixing it
    currently needs a restart of the server."
  - `README.md:72-73` says "A virtual file stays until its module is transformed again, also after the module was
    deleted."
  - `README.md:100-101` and `plugin.ts:58-59` say "A rebuild by the same plugin instance does not rewrite a file whose
    text did not change".
  - `README.md:102-104` and `plugin.ts:48-49` say that under `vite build --watch` addons "activate again only after an
    edit of their files". **That is false** (row 15 below).
  - `Release-Notes.md` `## [Unreleased]` → `### Added` (`:15-33`) ends with the dev-server bullet (`:30-33`).
- **The plan contradicts Vite and `develop` in six places.** "Settled decisions" gives the resolution for each.
  1. **Plan Dev server and HMR: "a change drops the environment's compiler instance, re-resolves options,
     re-reports configuration errors and sends a full reload".**
     - Vite itself already full-reloads on a `tsconfig.json` edit (`reloadOnTsconfigChange`, "changed tsconfig file
       detected …"). It invalidates every module and sends `full-reload` *before* any plugin's `hotUpdate` runs (rows
       5 and 15 below; Vite 7.3.7 `config.js:6311-6325`, 6.4.4 the same).
     - `hotUpdate`'s context has `this.environment` (with `logger`, `moduleGraph`, `hot`), but no `addWatchFile`,
       which addon activation needs (`AddonOutputs.runActivation`). So the new compiler cannot be created inside
       `hotUpdate`.
  2. **Plan: "returns no modules from `hotUpdate` for its own writes".** If a generator writes a module that the page
     imports (e.g. `src/gen/index.ts`), returning `[]` sends no update for it. The page may then keep the module it
     loaded before the write (row 18).
  3. **Plan: "skips writes with identical content".** On `develop` the record compares with its own last write, not
     with the disk. So a first write after server start always rewrites, and a write after another writer changed the
     file is skipped (row 10).
  4. **Plan: "per-build caches invalidated on `package.json` change".** The dev server has no per-build boundary.
     `client` runs `buildStart` once and `ssr` never, so the caches live for the whole session (row 8).
  5. **Plan: "records the paths and content hashes it wrote in the current change cycle".** The dev server has no
     change cycle; one disk write fires `hotUpdate` once per environment (`client`, then `ssr`).
  6. **Plan lifecycle table: `hotUpdate` | `vite build`: "—".** `vite build --watch` has invalidation gaps of its own
     (rows 15-16). That is not this slice's (see "Not in this slice").
- **Open PRs**, checked against `4c713396`:
  - #206 (`feature/cli-typescript-peer`) edits `packages/core/src/check-typescript.ts`, the root `README.md`,
    `Release-Notes.md` and `pnpm-lock.yaml`.
  - #186 and #185 (Dependabot) edit `packages/vite/package.json`, `packages/vite-test/package.json`,
    `packages/core/package.json` and the lockfile; #186 bumps `vite` to `^8.3.3`.
  - #195 (Dependabot) edits the lockfile.

  None of them touches `packages/vite/src` or `packages/vite-test/tests`.

### Current behaviour

These cases were reproduced on `4c713396` with a real dev server on Vite 7.3.7 and 6.4.4 under Node 22.17.0. Both
majors behave the same in every row. Two differences: Vite 6 sends `full-reload` without `path`, and it reports a file
created in a watched directory as `update`.

The harness:

- Each case ran `createServer({ root, configFile: false, customLogger, plugins: [websmith({ profile: "app" }), trace] })`
  and `server.listen()`. `trace` was a `pre` plugin that recorded `transform` and `hotUpdate` (environment, type, file,
  `modules.length`).
- A `vite-hmr` WebSocket client recorded the payloads. Requests used `fetch` and
  `server.environments.<env>.transformRequest`.
- The fixture was the dev-server fixture under `packages/vite-test/test-output-*`:
  - `tsconfig.json` with `rootDir: ./src` and `outDir: ./tsc-out`;
  - profile `app` with `replacer` (`MARK_IN` → `MARK_OUT`), `gen` (writes `gen/<file>.txt` and adds
    `virt/<file>.json`) and `rp`;
  - plus `datap`, a processor that calls `addAssetDependency(data.txt)` and replaces `DATA_IN` with its text;
  - `src/main.ts` imports `./shared` and `import type { T } from "./types"`.

| # | Case | Result on `4c713396` | Plan wants |
|---|------|----------------------|------------|
| 1 | edit `src/shared.ts` (a value import) | `full-reload` (Vite 7 `path: "*"`); next `GET` gives `MARK_OUT2` | the same (**guard**) |
| 2 | `websmith.config.json` edit drops `replacer` | `hotUpdate` in `client` and `ssr`, `modules` 0, **no payload**. After an edit of `shared.ts`, `GET` gives `MARK_OUT2`: `replacer` still runs | full reload; the next transform runs without `replacer` (`MARK_IN2`) |
| 3 | `websmith.config.json` → `{ broken` | nothing logged or sent; modules are 200 with the old options | one `[plugin websmith]` error; every module 500 with the overlay |
| 4 | start with `profile: "app2"` (not configured), then add `app2` to the config | 500 before and **500 after** the fix | full reload; 200 |
| 5 | `tsconfig.json` → `module: "commonjs"` | Vite's own `full-reload` and re-transform, **with the old options**: 200, ESM | `emits CommonJS` on every module |
| 6 | edit `addons/replacer/addon.js` (`MARK_OUT` → `MARK_NEW`) | `hotUpdate`, `modules` 0, no payload; the old addon keeps running | full reload; `MARK_NEW2` |
| 7 | addon edit, then `server.restart()` with the same plugin object | `client` keeps the **old** addon (`MARK_OUT`) and does not activate again. `ssr` activates again and uses the new one (`MARK_NEW`, read on Vite 7; on Vite 6 the activation log shows the same) | both environments use the new addon |
| 8 | profile `module: nodenext`, `src/package.json` `{"type":"module"}` → `{}` | `full-reload` (the `package.json` is a watch file); `main.ts` **200**. After an edit of `shared.ts`, it is **served as CommonJS** (`"use strict"; Object.defineProperty(exports, "__esModule", …`) with 200 | 500 `emits CommonJS for …` |
| 9 | a generator writes `gen/<file>.txt` with the module's text, and a processor watches it (`addAssetDependency`); one edit of `shared.ts` | **two** `full-reload` payloads, `triggeredBy` `src/shared.ts` and `gen/shared.ts.txt`, plus one more at startup (`create gen/shared.ts.txt`, `modules` 1) | one payload per edit, none at startup |
| 10 | another writer sets `gen/main.ts.txt` to `OTHER`; then `main.ts` is transformed again | `gen` runs, but **the file stays `OTHER`** | `GEN` |
| 11 | `GET /virt/server.ts.json` after `src/server.ts` was deleted | 200 `{"v":1}` (`hotUpdate` type `delete`, `modules` 1) | 404 |
| 12 | each transform's writes (`gen/*.txt`, `tsc-out/*.js(.map)`) | `hotUpdate` in `client` and `ssr`, `modules` 0, no payload | the same, as own writes (**guard**) |
| 13 | edit `data.txt`, which `datap` watches and reads | `full-reload`; `datap` runs with `DATA2`; **the served module keeps `DATA1`**. The same under `vite build --watch` | not this slice; see "Not in this slice" |
| 14 | edit `src/types.ts`, a type-only import | `hotUpdate`, `modules` 0, no payload | not this slice (Dev server contradiction 3) |
| 15 | `vite build --watch`: edit `addons/replacer/addon.js` | **no rebuild** (the addon file is not watched). With a source edit as well: a rebuild, no activation, old addon (`MARK_OUT2`) | not this slice; docs corrected here |
| 16 | `vite build --watch`: config edit drops `replacer` | rebuild, addons activate again without `replacer`, but **the bundle keeps `MARK_OUT`**: Rollup's cache does not transform the unchanged modules again | not this slice |
| 17 | `tsconfig.json` with `noEmit: true` | dev and `vite build` (Vite 7) **silently drop every processor's output** (`MARK_IN`, `DATA_IN` in the bundle); no diagnostic | not this slice; report it |
| 18 | a generator writes `src/gen/index.ts`, which `main.ts` imports, with the list of modules it saw | startup: one extra `full-reload` triggered by the generated file. An edit that does not change the list: one payload; the write is skipped | keep Vite's update for it (contradiction 2) |

Facts the design depends on, each traced on both majors:

- **`hotUpdate` runs once per environment, `client` first,** with `this.environment` (`name`, `logger`,
  `moduleGraph.invalidateAll()`, `hot.send()`). Its `modules` are already invalidated: Vite calls
  `moduleGraph.onFileChange(file)` before it (Vite 7 `config.js:25826-25831`).
- **`watchChange` is called for `client` only** in the dev server (observed on both majors). Do not use it to reach
  `ssr`.
- **A drop-the-instance prototype works.** A wrapper plugin replaced the inner `websmith()` object on a `hotUpdate` of
  `websmith.config.json`, `tsconfig.json` or `addons/**`, then called `moduleGraph.invalidateAll()`, sent
  `{ type: "full-reload", path: "*" }` and returned `[]`. On both majors this gave the wanted result for rows 2, 3, 4,
  5 and 6. Row 3 logged the error on the next transform, not at the edit.
- **`this.addWatchFile(dir)` in `client`'s `buildStart`** makes Vite watch a directory outside `root`. `hotUpdate` then
  fires in `client` and `ssr` for an edit and for a new file in it.
- **Vite's module reloads carry `triggeredBy`** (the absolute file) on the wire, on both majors. The field is
  `@internal` in `FullReloadPayload`, so use it in e2e assertions only, never in the plugin. Vite's own tsconfig reload
  has no `triggeredBy`.
- **A watch file and an import differ only in Vite internals** (`staticImportedUrls`, marked internal in 6.4.4). The
  plugin must track the watch files it added itself.
- **Row 13's cause is confirmed.** In the built core, changing `FileCache.updateSource`'s condition to
  `!file.snapshot || file.content !== content || this.hasChanged(fileName)` made the dev server and
  `vite build --watch` serve `DATA2`, on both majors. The change was reverted. It is a core change; see "Not in this
  slice".

### What to build

All work is in `packages/vite` and `packages/vite-test`, plus the docs in item 8. No core change. Every module in
`packages/vite/src` except `plugin.ts` imports `vite` with `import type` only, so Jest can load it.

**1. The write record** (`write-record.ts`). This replaces the hash-of-own-last-write rule.

- New `WriteRecord` with:
  - `record(filePath, text)`;
  - `has(filePath)`;
  - `isOwnWrite(filePath, text): boolean`, which returns true when the last recorded text for `filePath` hashes the
    same. When it does not, it forgets the entry and returns false, so a later foreign write of the same text is not
    taken for the plugin's own.
- `createDeduplicatingSystem(system, record)`. Its `writeFile`:
  - **skips** the write when the file exists and `system.readFile(filePath) === text`;
  - otherwise writes and calls `record.record(...)`;
  - never skips a write with `writeByteOrderMark` (`ts.sys.readFile` strips a BOM, so the texts do not compare).

  This makes identical content skip also the first write after server start, and makes a write after another
  writer's change happen (rows 9, 10).
- **One record per plugin instance**, created in `createWebsmithHooks` and shared by every environment state.
  - A write of `ssr`'s compiler fires `hotUpdate` in `client` too.
  - `HookDependencies.createCompiler` and `createModuleCompiler` take it as a fourth parameter. Spec stubs ignore it.
- It also applies in build mode, which is fine: the dependent-profile dedup of #198 still holds.

**2. `hotUpdate`** (`hooks.ts`, `plugin.ts`). New hook in `WebsmithHooks`:
`hotUpdate(this: HotUpdateContext, options: HotUpdateInput<M>): Promise<M[] | undefined>`.

- Narrow structural types, no value import of `vite`:
  - `HotUpdateContext = { environment: { name: string; config: { root: string }; logger: EnvironmentLogger;
    moduleGraph: { invalidateAll(): void }; hot: { send(payload: { type: "full-reload"; path: string }): void } } }`;
  - `HotUpdateInput<M extends { file: string | null }> = { type: "create" | "update" | "delete"; file: string;
    timestamp: number; modules: M[]; read(): string | Promise<string> }`.
- Add `info` to `EnvironmentLogger`, and to every stub (`hooks.spec.ts:72-76`).
- In `plugin.ts`, add `hotUpdate: hooks.hotUpdate`. Vite calls it in the dev server only.
- It handles the file in this order, against the state of `this.environment.name`. Decide everything that drops or
  clears state **before** the first `await`.
  1. **An input of the state:** one of `compiler.getOptionsFiles()` `files` or `missing`, or a file under
     `getOptions().config?.addonsDir` that is not under a `node_modules` directory.
     - Drop the state: `environments.delete(name)`, and `instances.delete(this.environment)`. The `WeakMap` is found
       first in `getEnvironmentState`, so a stale entry there would survive the drop.
     - Log once per change, keyed by `timestamp` across environments: `logger.info("[plugin websmith] <path relative
       to root> changed: websmith compiles with the new configuration", { timestamp: true })`.
     - Call `this.environment.moduleGraph.invalidateAll()`, send `{ type: "full-reload", path: "*" }`, and return
       `[]`.
     - The next transform of that environment creates a new state: new options, new `AddonRegistry` (addon entries
       loaded again), activation, `startServing` logging its errors. That is how errors are re-reported and how the
       overlay clears once the config is fixed (rows 2-6).
  2. **A file named `package.json`:**
     - clear `state.packageJsonCache` and the `findPackageJson` memo of item 4;
     - call `state.compiler?.resetCompilationCaches()`, because the ESM check's package-type memos are kept per
       compilation and the dev server never ends one;
     - return `undefined`, so Vite reloads the modules that watch it (row 8).
  3. **`type === "delete"` of a compiled module id:** `state.outputs.startModule(file)` and
     `state.outputFiles.delete(file)`. Return `undefined` (row 11).
  4. **An own write:** `record.has(file)` and `record.isOwnWrite(file, await options.read())`. Return `modules` without
     the nodes whose `file` is a watch file the plugin added (rows 9, 12). A generated module the page imports keeps
     Vite's update (row 18).
  5. Otherwise return `undefined`.
- **Watch files the plugin added:** keep a set in the hooks closure of every file the plugin passes to
  `this.addWatchFile` in serve mode:
  - `dependencies` (`:418`);
  - the `package.json` (`:410`);
  - the addon outputs (`AddonOutputs.addWatchFile` and the activation watch files).

  Record them where they are added, e.g. with a recording context or a callback on `AddonOutputs`; do not read Vite's
  module graph for it.
- A state without a compiler (an environment the profile map does not name) has no inputs. Its error comes from the
  plugin options, which no file edit changes.

**3. Restart and watched inputs in serve mode** (`hooks.ts`, `buildStart`).

- **A restart starts every environment again.** For an existing state in serve mode, which only `server.restart()`
  with the same plugin object produces, do not refresh it:
  - drop every state (`environments.clear()`, and the `instances` entry of the old `client`);
  - create `client`'s state anew, as on a first start.

  This replaces `forgetOtherEnvironments` and the serve-mode path through `refreshOptions`/`refreshAddons`
  (`:337-353`), which keeps `client`'s old addons (row 7). Build mode keeps the refresh path unchanged.
- **Watch the inputs** in serve mode in `buildStart`, not in `transform`: `this.addWatchFile` for each of
  `getOptionsFiles()` `files` and for `addonsDir`. Vite watches only files under `root`, and adds one outside it only
  through `addWatchFile` (traced above, including a directory). In `transform` these files would become imports of
  the module.

**4. `findPackageJson` memo** (`config-errors.ts`).

- Give `checkModuleFormat` a per-state `Map<string, string | undefined>` from directory to nearest `package.json`, next
  to `packageJsonCache`. Clear both together: in build mode in `buildStart` (as today), in serve mode on a
  `package.json` `hotUpdate` (item 2.2).
- A new `package.json` is created between a module and an existing one: Vite reports `create`, so the same path clears
  the memo.

**5. Pruning in serve mode.** Item 2.3. A module that is no longer imported but still exists keeps its entries; Vite
keeps it in its module graph too. Say so in the README.

**6. Not changed:**

- build mode's `buildStart` refresh;
- `buildEnd`'s pruning in build mode;
- `transform`'s handling of `dependencies`;
- `transpileOnly` and the virtual-file middleware.

**7. JSDoc of `websmith()`** (`plugin.ts:15-67`).

- Add the dev-server reload rules:
  - a config, tsconfig or addon edit reloads with the new configuration;
  - a `package.json` edit re-checks module formats;
  - the plugin does not rewrite a file whose text is unchanged on disk, and its own writes to files it watches
    trigger no reload.
- Correct `:48-49` and `:58-59` to what holds (see item 8).

**8. Docs.**

- **`packages/vite/README.md`, "Dev server":**
  - Replace the restart sentence (`:65`): an edit of `websmith.config.json`, the `tsconfig.json` (and its `extends`) or
    a file in `addonsDir` reloads the page. Its environment's compiler starts again with the new configuration, and
    its errors are logged again and replace the overlay, or clear it.
  - Only an addon's entry file is loaded again; modules it requires keep Node's cache.
  - On a `tsconfig.json` edit, Vite reloads as well.
  - A `package.json` edit re-checks the module format of the modules below it.
  - The plugin does not rewrite a file whose text on disk is unchanged. A file it writes and watches (e.g. a
    generator's output that an addon reads through `addAssetDependency`) does not trigger a second reload. A module
    a generator writes and the page imports reloads as usual.
  - `:72-73`: a virtual file is dropped when its module's file is deleted.
  - Keep the type-only import line (`:77-78`). Add: an edit of a file an addon reads through `addAssetDependency`
    reloads the module, but the served output can keep the old text (row 13; core issue).
- **"Addon context":**
  - `:100-101`: "a file whose text on disk is unchanged is not rewritten".
  - `:102-104`: under `vite build --watch`, addons do not activate again after an edit of their files, and a config
    edit leaves the modules Rollup does not transform again with their old output; restart the build. State it as a
    known limit (rows 15-16).
- **`Release-Notes.md`:** one bullet under `## [Unreleased]` → `### Added`, after the dev-server bullet (`:30-33`),
  e.g.: "The Vite plugin (`@quatico/websmith-vite`, not yet published) reloads the Vite dev server when
  `websmith.config.json`, `tsconfig.json`, an addon or a `package.json` changes, compiles with the new configuration
  without a restart, and does not reload or rewrite for its own unchanged writes." Keep yours to that one bullet.

### Done when

The slice line is the specification. It asks for:

- "`hotUpdate` for `websmith.config.json`, `tsconfig.json` and the addons directory (instance dropped, options
  re-resolved, full reload)";
- "per-build caches invalidated on `package.json` change";
- "write-loop guard (identical content skipped, own writes ignored in `hotUpdate`)";
- "unit tests for the guard";
- "e2e: a config edit reloads and clears the overlay once fixed, an HMR edit with a generator produces exactly one
  rewrite and one HMR update".

Write each red first, and run each new e2e test on `4c713396` before the fix to prove it fails. Check out
`packages/vite/src` at `4c713396`, rebuild `packages/vite`, run, then restore. Cases marked **guard** pass on
`develop`; keep them as guards and say so in the PR.

**E2E**, in a new `packages/vite-test/tests/vite-dev-invalidation.test.ts`:

- **Extend `runViteDev`** in `tests/vite-project.ts:345-479`; keep existing callers unchanged.
  - `watcherEvents`: record `server.watcher.on("all", (event, file) => …)` as `{ event, file }`, with `file` relative to
    `root`.
  - `waitForLog(predicate, ms = 10000)`: like `waitForMessage`, over the logger lines.
  - `edit(file, text, predicate)`: let `predicate` also be `{ log: fn }`, so a step can stop on a logger line.
  - **Check before each rewrite.** Today it sleeps, rewrites, then checks (`:452-453`), so it rewrites once after the
    payload arrived. That gave a second `full-reload` in every repro run.
  - `transform(env, url)`: records the code or error of `server.environments[env].transformRequest(url)`. Use it after
    `server.restart()`, since `get` holds the old port.
- **Determinism:**
  - No fixed sleeps: every wait polls with a timeout.
  - Ports come from the server (`strictPort: false`).
  - **Wait for the plugin's `changed:` info line, not for the first `full-reload`, after a config or tsconfig edit.**
    Vite's own tsconfig reload arrives before the plugin dropped the state.
  - A negative assertion ("no reload from the own write") needs an end marker. After the write happened (it happens
    synchronously inside the `GET` that transforms the module), edit a **sentinel** module that `main.ts` imports.
    Wait for its payload, then assert on everything before it. Vite delivers watcher events in write order.
- Name the tests "should …". Run every case on `vite` and `vite6` (`it.each(VITES)`), with a 60 s Jest timeout. Remove
  the project in `afterEach`. The addons are plain CommonJS `addon.js` files that log to a file in the project.

Cases (rows of "Current behaviour"):

- **A config edit reloads with the new configuration** (red, row 2). `GET` `main.ts` and `shared.ts`. Edit the config
  to drop `replacer` and wait for the `changed:` line. A `full-reload` was received, and `GET /src/shared.ts` contains
  `MARK_IN`, not `MARK_OUT`.
- **A broken config edit shows the overlay** (red, row 3). Exactly one `[plugin websmith]` error with `Invalid JSON`
  after the next `GET`. `main.ts` and `shared.ts` are 500, each followed by an `error` payload.
- **A fixed config clears the overlay** (red, row 4). Start with `profile: "app2"`; `GET /src/main.ts` is 500. Add
  `app2` to the config and wait for `changed:`. `GET /src/main.ts` is 200 with `MARK_OUT`, and the startup error was
  logged once.
- **A tsconfig edit recompiles with it** (red, row 5). `module: "commonjs"`; after `changed:`, `GET /src/main.ts` is 500
  with `emits CommonJS`.
- **An addon edit loads the addon again** (red, row 6). After `changed:`, `GET /src/shared.ts` contains `MARK_NEW`.
- **A restart with the same plugin object uses the edited addon in every environment** (red, row 7). `GET` and `ssr`;
  edit the addon; `await server.restart()`; `transform("client", "/src/shared.ts")` and
  `transform("ssr", "/src/shared.ts")` both contain `MARK_NEW`.
- **A `package.json` edit re-checks the module format** (red, row 8). The profile `tsConfig` is
  `{ module: "nodenext", moduleResolution: "nodenext" }`, with `src/package.json` `{"type":"module"}` and imports with
  `.js`. `edit("src/package.json", "{}", full-reload)`; `GET /src/main.ts` is 500 with `emits CommonJS for`, and the
  body never contains `__esModule`.
  - The `package.json` lives under `packages/**`: remove the project in `afterEach`, and never run `pnpm install` while
    one exists.
- **An HMR edit with a generator produces exactly one rewrite and one HMR update** (red, row 9).
  - Fixture: addon `genw`, whose generator writes `gen/<file>.txt` with the module's text, and whose processor calls
    `addAssetDependency` on it. Also `src/sentinel.ts`, which `main.ts` imports.
  - Steps: `GET` `main.ts` and `shared.ts`, then the sentinel edit, as the end marker of startup. `edit` `shared.ts`
    until a payload; `GET /src/shared.ts`; edit the sentinel until its payload.
  - Assert:
    - between the edit and the sentinel, `watcherEvents` holds exactly one `change` of `gen/shared.ts.txt`;
    - no payload has a `triggeredBy` that ends in `gen/shared.ts.txt`, neither at startup nor after the edit.
- **Identical content is not rewritten** (red; by reading `write-record.ts:29`, not run). Write `gen/main.ts.txt` with
  `GEN` before the server starts and set its mtime into the past (`fs.utimesSync`). After `GET /src/main.ts` the mtime
  is unchanged.
- **Another writer's change is overwritten** (red, row 10). After `GET /src/main.ts`, write `OTHER` into
  `gen/main.ts.txt`. Edit `main.ts` until a payload, then `GET /src/main.ts`; the file holds `GEN`.
- **A deleted module's virtual file is gone** (red, row 11). `GET /src/server.ts`; `GET /virt/server.ts.json` is 200.
  Delete `src/server.ts` and wait until `watcherEvents` has its `unlink`. `GET /virt/server.ts.json` is 404.
- **An edit to an imported file still reloads its importer**: it stays in `vite-dev-server.test.ts` as the guard
  (row 1). Do not copy it.

**Flakiness:** run `vite-dev-invalidation.test.ts` 5 times in a row
(`pnpm --filter websmith-vite-test exec jest tests/vite-dev-invalidation.test.ts --runInBand`), and report "5/5
green, N tests each" in the PR. Run `vite-dev-server.test.ts` 5 times too, since its `edit` helper changes.

**Unit**, in `packages/vite/src/*.spec.ts`, assemble / act / assert with one blank line between the parts and no
comments marking them. The object under test is `testObj`, its outcome `actual`. Every test creates its own
`testObj`; no `let testObj` with `beforeEach`. No `expect` in the assemble or act parts; run a hook that is expected
to raise through the existing `attempt()` helper. Remove temp dirs in `afterEach`.

- `write-record.spec.ts`, the guard:
  - skips a write whose text equals the file on disk, also the first one;
  - writes when another writer changed the file, then skips the next identical write;
  - never skips a BOM write;
  - `isOwnWrite` is true for the recorded text, false for other text, and false afterwards for the old text too;
  - two systems on one record see each other's writes.
- `hooks.spec.ts`, `hotUpdate`:
  - for a config file, a `missing` file, a tsconfig `extends` file, and a file in `addonsDir`:
    - the next transform creates a new compiler (`createCompiler` called twice);
    - `invalidateAll` and one `full-reload` are sent;
    - the result is `[]`;
    - the `changed:` line is logged once across `client` and `ssr` for one `timestamp`.
  - an unrelated file returns `undefined` and keeps the state.
  - a `node_modules` file under `addonsDir` is no input.
  - `package.json`: `resetCompilationCaches` is called, and a module checked again sees the new `"type"`. Use
    `createNodeProject` (`hooks.spec.ts:115-122`).
  - `delete` of a compiled id: `findVirtualFile` of its virtual file is `undefined`.
  - an own write returns `modules` without the plugin's watch files, and keeps a module that is not one.
  - a foreign write of a recorded path returns `undefined`.
  - a hook with an environment that has no state returns `undefined`.
- `hooks.spec.ts`, `buildStart` in serve mode:
  - a second `buildStart` (a restart) creates new compilers for `client` and, on its next transform, for `ssr`;
  - it adds the options files and `addonsDir` as watch files;
  - it adds them in build mode as today (existing tests unchanged).
- `config-errors.spec.ts`: the `findPackageJson` memo answers a second module in the same directory without
  `fileExists`, and is empty after clearing.

**Also:**

- **New files carry the MIT header** (`pnpm license:add`). Do not add them to the `license:check` list.
- **No `console`** anywhere in `packages/vite/src`.
- **`import type` only** for `vite` in every Jest-loaded module. `plugin.ts` stays the only value import
  (`createFilter`).
- **No `@quatico/websmith-core` import in addon code.**
- **Gates, all green:** `pnpm lint`, `pnpm build --skip-nx-cache`, `pnpm test --skip-nx-cache` and
  `pnpm test:e2e --skip-nx-cache`. The shared `.nx-cache` replays outputs from other worktrees, so skip it.
  - Run the whole `packages/vite-test` suite under Node 22 (`$HOME/.nvm/versions/node/v22.17.0/bin`) and once under
    Node 24 (`$HOME/.nvm/versions/node/v24.21.0/bin`), and say so in the PR.
- **Known flaky test, not yours:** `packages/webpack-test/tests/webpack-loader-resolve-once.test.ts`, "emits output
  of edited tsconfig.json" (`:45`), fails at times under `pnpm test:e2e`. Re-run it. If it fails twice, report it in
  the PR. Do not change it, the loader or core in this slice.

### Settled decisions — do not re-derive them

- **Next slice is "Dev invalidation".** Plan `## Slices` order, #205 merged, no `waits:`.
- **An input change drops the state; the next transform creates it.** `hotUpdate` cannot activate addons (no
  `addWatchFile`), and the full reload brings the transform right away. Errors are therefore logged on the next
  module, not at the edit. This resolves contradiction 1. Do not call `refreshOptions`/`refreshAddons` in the dev
  server: `refreshAddons` is a no-op for the Vite host.
- **Vite's own tsconfig reload stays.** The plugin reloads again after dropping the state, so a page ends on the new
  options. The `changed:` info line exists so users and the e2e can see the plugin's reload.
- **Own writes return `modules` minus the plugin's own watch files**, not `[]`. A module the page imports keeps Vite's
  update; otherwise the page could keep the module it fetched before the write. The loop ends anyway, because the
  next write has identical text and is skipped. This resolves contradiction 2.
- **Identical means identical to the disk.** It covers the first write after start and fixes the #198 follow-up.
  This resolves contradiction 3.
- **`package.json` clears the caches of the state, in serve mode, on its `hotUpdate`.** Build mode keeps clearing in
  `buildStart`. This resolves contradiction 4.
- **The record is per plugin instance; an entry is forgotten when `hotUpdate` sees other text.** There is no change
  cycle in the dev server, and both environments must recognise one write. This resolves contradiction 5.
- **A restart in serve mode drops every state.** This is the rest of the `ssr` restart follow-up (#205): `client`
  kept its old addons.
- **The profile swap in `updateLoaderConfig` (#198 known limit) needs no work here.** The profile name is fixed by the
  plugin options, and the dev server no longer calls `updateLoaderConfig` at all. Say so in the PR; no core change.
- **`vite build --watch` is not this slice.** It only corrects the docs (contradiction 6).

### Repo mechanics

- **Worktree setup.** pnpm 10.34.1 refuses frozen installs in this repo, so use the corepack-cached 10.8.0 through a
  shim:

  ```sh
  mkdir -p /tmp/pnpm-shim && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > /tmp/pnpm-shim/pnpm && chmod +x /tmp/pnpm-shim/pnpm
  export PATH=/tmp/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline && pnpm build --skip-nx-cache
  ```

  No dependency is added: `vite` 7.3.7 and `vite6` 6.4.4 are in `packages/vite-test`. Never edit `pnpm-lock.yaml`,
  `~/.npmrc` or the root `package.json`.
- **Merges:** use `git -c rerere.enabled=false merge …` if you need `develop` in your branch.
- **Reproducing by hand:** write a fixture under `packages/vite-test/test-output-<name>`. It is git-ignored, and bare
  `vite`, `vite6` and `@quatico/websmith-vite` imports resolve from there. Remove it afterwards with `trash`.
  - `pnpm-workspace.yaml` globs `packages/**`. A leftover `package.json` (row 8 needs one) joins the workspace, and the
    next `pnpm install` adds it to `pnpm-lock.yaml`. If that happens, `git checkout -- pnpm-lock.yaml`; never commit
    it.
  - Never assert a fixed port.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). A suggested split:
  - `B Skips a write only when the file on disk has the same text`;
  - `F Reloads the Vite dev server when the websmith config, tsconfig or an addon changes`;
  - `F Sends no reload for the plugin's own writes to its watch files`;
  - `B Clears the package.json caches when a package.json changes in the Vite dev server`;
  - `B Drops the outputs of a deleted module in the Vite dev server`;
  - `B Starts every environment again after a restart of the Vite dev server`;
  - `d Documents reloading in the Vite dev server`;
  - `t Covers dev server invalidation end to end`.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Its title comes from the wave heading, "Dev invalidation".
- Append `→ #<number>` to the `feature/vite-plugin-dev-invalidation` line in `docs/plans/2026-10-01-vite-plugin.md`
  `## Slices`, and commit that on this branch. Change nothing else in the plan.
- PR body sections:
  - the six contradictions, under "Plan vs. Vite";
  - the red/guard evidence and the 5× runs, under "How it was verified";
  - the items of "Not in this slice" you confirmed or tripped over, under "Found, not built".

### Scope guard

This branch owns:

- `packages/vite/**` and `packages/vite-test/**`;
- one bullet in `Release-Notes.md` `### Added`, and the `→ #<PR>` line in the plan.

Do not touch:

- `packages/core/**`, `packages/api/**`: no core or API change is needed;
- `packages/webpack/**`, `packages/webpack-test/**` (including the flaky test above), `packages/compiler/**`;
- `.github/**`, the root `README.md`, the root `package.json` and `pnpm-lock.yaml`.

Concurrent work, checked against `4c713396`:

- **#206 `feature/cli-typescript-peer`** edits core, the root `README.md`, `Release-Notes.md` and the lockfile. If it
  merges first, rebase, keep both `Release-Notes.md` bullets, and take `develop`'s lockfile.
- **#185/#186/#195 (Dependabot)** edit manifests and the lockfile; #186 bumps `vite` to `^8.3.3`. Same rule. Vite 8 is
  best-effort in the plan: report a dev e2e that fails only on Vite 8 in the PR instead of fixing it here.

Not in this slice. Each item has an owner or needs one; mention any you trip over in the PR, but do not build them.
Each was verified on `4c713396`:

- **A type-only import does not reload its importer** (row 14).
  - It needs core to return the files the target's Program read as `dependencies`. The webpack loader has the same
    gap.
  - Its output changes only for addons that use type information.
  - Owner: a separate core+loader bug slice. The README line stays.
- **An addon's data file edit serves the old output** (row 13), in dev and under `vite build --watch`, on both majors.
  - Cause confirmed: `FileCache.updateSource` keeps the old snapshot when only the processors' text changed. Comparing
    `file.content !== content` fixed both modes in a patched build.
  - It is shared core behaviour (CLI watch and the webpack loader use the same cache), so it needs core unit tests and
    a webpack e2e as well.
  - Owner: a separate core bug slice. Propose it in the PR. The e2e of this slice must not depend on it.
- **`vite build --watch` invalidation** (rows 15-16):
  - addon files are not watched, and `refreshAddons` never reloads registry addons;
  - after a config edit, Rollup's cache keeps the old output of unchanged modules. A `shouldTransformCachedModule`
    keyed on an options generation would fix that.
  - Owner: a separate `packages/vite` bug slice. This slice only corrects the docs.
- **`noEmit: true` in `tsconfig.json` silently drops every addon's output** (row 17), in dev and in `vite build`.
  Owner: none yet; report it in the PR as a found defect. A typical Vite `tsconfig.json` sets `noEmit`.
- **The host profile writes its own output to disk** (row 12; without `outDir`, `src/main.js` next to `src/main.ts`)
  and **a dependent profile's result processor runs per module**.
  - Owner: `docs/vite-plugin-release`, as known limits (#198).
  - Not checked: whether, after a restart, Vite resolves `./shared` to the written `src/shared.js` (its extension
    order puts `.js` before `.ts`).
- **Vite 7 on exactly Node 22.12.0, and Vite 6.3.0 (the peer floor)**, are untested: `hotUpdate`'s
  `this.environment`, `moduleGraph.invalidateAll` and `environment.logger.info` were checked on 6.4.4 and 7.3.7 only.
  Owner: `docs/vite-plugin-release`.
- **A non-string value in the `profile` map** goes into `loaderOptions.profile` unchecked (#202 review nit). The plan
  names no owner; mention it in the PR.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside scope. Check:

- whether `server.middlewareMode` changes `hotUpdate` or the watcher;
- whether an `addonsDir` outside `root` reloads end to end (the watch was traced; the reload was not);
- whether an addon written in TypeScript is compiled again after an edit (only `addon.js` was traced).
