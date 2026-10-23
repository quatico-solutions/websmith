<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — addon-rebuild-gaps (slice: Build watch)

- **Plan (canonical):** `docs/plans/2026-10-16-addon-rebuild-gaps.md` on `develop`
- **Approved:** 2026-10-20, Jan Wloka, plan-PR #213 merged
- **Branch:** `bug/vite-build-watch-reload` (base: `develop`, at `a1083322` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is the plan's fourth and last slice. `## Slices` runs one branch per `###` heading, in heading
order: "Stale output" (`bug/file-cache-update-source`) → "noEmit in bundler hosts" (`bug/bundler-no-emit`) →
"Type-only imports" (`bug/type-only-import-deps`) → "Build watch" (this branch). The slice line also carries
`<!-- waits: bug/type-only-import-deps -->`: both slices add watch files in `transformHandler` of `packages/vite`.
**Start only after all three earlier slices merged**, from the `develop` that holds them. None of them was written
when this brief was, so line numbers below are from `develop` at `a1083322`; find the code by name if it moved.

### What the earlier slices leave for you

Read each merged PR before you start. What to look for:

- **Type-only imports (`bug/type-only-import-deps`) — the integration point.** By its plan contract it forwards the
  type-check dependencies that core now returns in `ModuleBuildResult.dependencies.files` through `this.addWatchFile`
  in `transformHandler`, and records them as the plugin's own watch files (the `watchFiles` set, `hooks.ts:247`,
  filled by the `addWatchFile` helper, `:254-259`, in serve mode only), so the dev write guard still holds. Read
  what it merged:
  - where `transformHandler` now adds watch files (today `:518`) and whether the helper changed;
  - whether `watchFiles` is still filled in serve mode only.

  Add the build-watch inputs **beside** its watch files, in the same place in `transformHandler`, not in a second
  loop elsewhere. They are added in build mode only, so they never enter the serve-mode set. Do not change how it
  forwards its own files.
- **Stale output (`bug/file-cache-update-source`).** It adds a `vite build --watch` e2e for an
  `addAssetDependency` data edit. Check whether it extended `runViteWatch` (`tests/vite-project.ts:254-310`) to
  return the bundle text per build. If it did, reuse that. If not, extend it as described under "Done when". It
  also removes README known-limit lines (`packages/vite/README.md:193-195`, `:246-247`) and adds a Release-Notes
  entry.
- **noEmit in bundler hosts (`bug/bundler-no-emit`).** It changes option resolution in `packages/vite` and the
  README "Configuration" section, and may add a tsconfig helper to `vite-project.ts`. No overlap with this slice's
  logic. Expect neighbouring edits in the README "Known limits" list and in `Release-Notes.md`.
- **Release-Notes and README conflicts** are likely with all three. Keep every entry; take `develop`'s lockfile.

### Current behaviour

**Run**, not only read: reproduced on `a1083322` in a scratch worktree, Node 22.17.0, Vite 7.3.7 and 6.4.4
(Rollup 4.64.6), with `build({ root, configFile: false, plugins: [websmith({ profile: "app" }), trace], build: { lib:
{ entry: "src/main.ts", formats: ["es"], fileName: "main" }, watch: {} } })`. `trace` recorded `buildStart` (and
whether `this.environment` was the same object as before), `transform` of `.ts` ids, and `watchChange` (id, event,
`this.environment`). After each `END`, the script wrote the step's files every 250 ms until a `START`, giving up after
4 s; after each `BUNDLE_END` it read the `MARK…` strings from `dist/main.mjs`.

Fixture: `tsconfig.json` as `writeTsConfig({})`; config `{ addonsDir: "./addons", profiles: { app: { addons:
["replacer"] } } }`; `addons/replacer/addon.js` replaces `MARK_IN` with a string it requires from
`./lib/helper.js` (`MARK_OUT`); `src/main.ts` imports `./b`; each holds a `MARK_IN_<name>` string.

Both majors behave the same in every row.

| # | Step | Result on `a1083322` | Prototype (see below) |
|---|------|----------------------|-----------------------|
| 1 | edit `addons/replacer/addon.js` to `MARK_NEW` | **no rebuild** within 4 s; no `watchChange`. Then an edit of `src/b.ts` rebuilds, transforms `b.ts` only, bundle `MARK_OUT_b2 MARK_OUT_main`: the old addon still runs | `watchChange` of the addon file, rebuild, both modules transformed, `MARK_NEW_b MARK_NEW_main` |
| 2 | config drops `replacer` | `watchChange` of the config, `buildStart`, **no transform**; bundle keeps `MARK_OUT_b MARK_OUT_main` | both modules transformed, `MARK_IN_b MARK_IN_main` |
| 3 | config → `{ broken`, then fixed without `replacer` | `ERROR` in hook `buildStart` ("Invalid JSON in configuration file …"), the watcher keeps running; the fix rebuilds with `BUNDLE_END` but **no transform**: `MARK_OUT_b MARK_OUT_main` | `ERROR` once, then `BUNDLE_END` with `MARK_IN_b MARK_IN_main` |
| 4 | `tsconfig.json` edit (`removeComments`) | `watchChange`, rebuild, **no transform** | both modules transformed |
| 5 | edit `addons/replacer/lib/helper.js` (a module the addon requires, inside `addonsDir`) | no rebuild | rebuild, both modules transformed, but **`MARK_OUT` stays**: only the addon's entry file is loaded again (`AddonRegistry.ts:868` deletes only it from `require.cache`) |

Facts the design depends on, each observed on both majors:

- **`buildStart` runs on every rebuild**, with the same `this.environment` object as the first build.
- **`watchChange` runs in build mode with `this.environment` set**, the same object as in `buildStart`. Vite wraps
  every Rollup hook with the environment in build (`injectEnvironmentToHooks`, Vite 7.3.7 `config.js:33934-33952`;
  `watchChange` is in `ROLLUP_HOOKS`). It fires for watch files added in `buildStart` (config, tsconfig) and in
  `transform`.
- **A watch file added in `transform` makes Rollup transform that module again.** Rollup's `Task.invalidate`
  (`rollup/dist/es/shared/watch.js:9863-9873`) clears `originalCode` of every cached module whose
  `transformDependencies` include the changed id. A file added only in `buildStart` triggers a rebuild but leaves the
  cached modules alone: rows 2-4 on `develop`.
- **`this.error` in `buildStart` under watch fails that rebuild and keeps the watcher.** Rollup emits `ERROR`, then
  `END`, and keeps the cache of the last successful build, whose modules still carry the transform watch files. So the
  fixing edit re-transforms them (row 3, prototype). The existing guard
  `vite-diagnostics.test.ts:238-253` ("should report broken config and pass w/ watch rebuilds after config changes")
  passes on `develop` because it asserts only events, not output.
- **Rollup announces changes between runs only.** `Watcher.invalidate` (`watch.js:9726-9751`) sets `rerun` while a
  build runs, and `announceChangesAndRebuild` (`:9772-9782`) emits `change` (which calls `watchChange`) just before the
  next `run()`. So no `transform` of a running build sees a state that `watchChange` dropped.
- **`this.meta.watchMode` is true under `build.watch`.** The prototype gated on it.

Where the code is today (`develop` at `a1083322`):

- `packages/vite/src/hooks.ts`
  - `HookContext` (`:41-43`) picks `error | warn | addWatchFile | emitFile | getModuleIds`; no `meta`.
  - `getOptionsInputs` (`:202-206`): `files`, `missing` and the `addonsDir` **directory**, for the dev watcher.
  - `isOptionsInput` (`:210-222`): the predicate dev's `hotUpdate` uses — one of `getOptionsFiles()` `files` or
    `missing` (compared with `toFileKey(path.resolve(…))`), or a file under `getOptions().config?.addonsDir` outside
    any `node_modules`. **Reuse it unchanged for `watchChange`.**
  - `forgetEnvironment` (`:391-394`): `environments.delete(name)` and `instances.delete(environment)`. `hotUpdate`
    calls it for an options input (`:620-630`).
  - `buildStart`, build mode (`:440-481`): for an existing state it calls `refreshOptions`, `refreshAddons` and
    `resetCompilationCaches` (`:446-455`). `refreshAddons` is a no-op for the Vite host (it acts only after
    `markAddonsLoaded`, which only `TsCompiler` calls); the comment at `:448-449` ("loads changed addons again") is
    false. It adds `files` and `missing` as watch files (`:469-470`), not the addon files.
  - `transformHandler` (`:488-535`) adds `dependencies` through `addWatchFile` (`:518`).
- `packages/vite/src/plugin.ts`: no `watchChange` (`:74-93`). JSDoc `:39-40` ("A `vite build --watch` resolves the
  options again when `websmith.config.json` or `tsconfig.json` changes") and `:53-55` (the known limit).
- `packages/vite/README.md`: "Addon context" known limit `:221-224`; "Known limits" bullet `:248-249`.
- `.plot/briefs/vite-plugin-dev-invalidation.md` rows 15-16 (`:142-143`) recorded rows 1-2 above first.

### What to build

All code is in `packages/vite/src`; tests in `packages/vite/src/hooks.spec.ts` and `packages/vite-test`. No core
change. Every module in `packages/vite/src` except `plugin.ts` imports `vite` with `import type` only, so Jest can
load it.

**1. Build-watch inputs per build** (`hooks.ts`, `buildStart`, build mode).

- Add `"meta"` to the `Pick` in `HookContext`.
- When `this.meta.watchMode` is true and the state has a compiler, compute the inputs once per `buildStart` and keep
  them on the state (e.g. `buildWatchInputs: string[]`):
  - `getOptionsFiles()` `files` and `missing` (the config file, the `tsconfig.json` and its `extends` chain, also
    when missing);
  - **every file** under `getOptions().config?.addonsDir`, recursively, skipping any path with a `node_modules`
    segment. List files, not the directory: Rollup matches the changed file's id against `transformDependencies`, so a
    directory entry never invalidates a module.
  - No duplicates: Rollup keeps `transformDependencies` as an **array** per module (`node-entry.js:22252`, `:22312`,
    a `push` per call), not a set.
- A missing or unreadable `addonsDir` gives no addon files and no error; core reports the configuration error.
- Without watch mode, compute nothing (a plain `vite build` pays nothing).

**2. Add them in `transform`** (`transformHandler`, next to the dependencies at `:518` as the type-only slice left it).

- Build mode only (`command === "build"`) and `this.meta.watchMode` only: `this.addWatchFile(cur)` for each input,
  for every compiled module, including one that then fails with an error, so a fixing edit re-transforms it.
- **Never in serve mode.** In the dev server a watch file added in `transform` becomes an import of the module
  (dev-invalidation brief, item 3); dev watches the inputs in `buildStart` and handles them in `hotUpdate`.
- Do not record them in the serve-mode `watchFiles` set.

**3. `watchChange`** (`hooks.ts`, new hook; `plugin.ts`, `watchChange: hooks.watchChange`).

- Signature: `watchChange(this: Pick<HookContext, "environment">, id: string) => void`. The second argument
  (`{ event }`) is not needed.
- Serve mode: return at once. Vite calls `watchChange` in the dev server for `client` on every file change; `hotUpdate`
  owns that.
- Build mode: find the state as `hotUpdate` does (`instances.get(this.environment) ?? environments.get(name)`). When
  it has a compiler and `isOptionsInput(state.compiler, id)` is true, call `forgetEnvironment(this.environment)`.
- The next `buildStart` then finds no state and takes the create path (`startEnvironmentState` →
  `createEnvironmentState`): options resolved again, a new `AddonRegistry` (entry files loaded again), activation with
  the `buildStart` context, configuration errors raised by `this.error`. The refresh path (`:446-455`) still runs for
  rebuilds without an input change; leave it, but correct the false comment at `:448-449`.
- A state without a compiler (a profile error) has no inputs; ignore it.
- While the config is broken, `addonsDir` is `undefined`, so only the config, tsconfig and missing files are
  inputs. That is enough: the fixing edit is a config edit.

**4. JSDoc of `websmith()`** (`plugin.ts`).

- `:39-40`: under `vite build --watch`, an edit of `websmith.config.json`, the `tsconfig.json` (and a file it
  `extends`) or a file in `addonsDir` rebuilds every module with the new configuration and activates the addons again.
- `:53-55`: replace the known limit with the limits below (item 5).

**5. Docs.**

- **`packages/vite/README.md`, "Addon context" (`:221-224`):** replace the known limit. Say what holds: under
  `vite build --watch`, an edit of `websmith.config.json`, the `tsconfig.json` (and a file it `extends`) or any file in
  `addonsDir` rebuilds, activates the addons again and transforms every module with the new configuration. A
  configuration error fails that rebuild only; the watcher keeps running and the fixing edit rebuilds. State the
  limits, the same as in the dev server:
  - an addon's own dependencies outside `addonsDir` are not watched;
  - only an addon's entry file is loaded again; modules it requires keep Node's cache, also inside `addonsDir`
    (row 5);
  - a file created in `addonsDir` without another edit starts no rebuild; it is watched from the next rebuild.
- **"Known limits" (`:248-249`):** replace the bullet with one line pointing to those limits, or drop it if the
  "Addon context" text covers them. Do not leave the old limit anywhere.
- **`Release-Notes.md`:** one entry under `## [Unreleased]`. The Vite plugin is not released yet, so add a sub-bullet
  to the `@quatico/websmith-vite` bullet in `### Added` (`:17-28` at `a1083322`), after the dev-server sub-bullet, e.g.:
  "`vite build --watch` rebuilds when `websmith.config.json`, the `tsconfig.json` or a file in `addonsDir` changes,
  activates the addons again and transforms every module with the new configuration." If the three earlier slices put
  their Vite entries elsewhere, follow them and say so in the PR.

### Done when

The slice line is the specification. It asks for:

- "In `vite build --watch`, the config file, the `tsconfig.json` chain and the addon files are watch files of every
  compiled module, and a change of one drops the compiler instance";
- "unit tests in `hooks.spec.ts`";
- "e2e in `vite-test`: an addon edit rebuilds with the new addon, a config edit that drops an addon removes its
  output from every module, a broken config fails one rebuild and the fixing edit rebuilds clean";
- "README 'Addon context' known limit removed; Release-Notes entry".

Write each test red first. For the e2e, run each new case on the merged `develop` before the fix (check out
`packages/vite/src` from `develop`, rebuild `packages/vite`, run, restore) and keep the output for the PR. Cases
marked **guard** pass before the fix; keep them and say so in the PR.

**E2E**, in a new `packages/vite-test/tests/vite-build-watch.test.ts`:

- **Extend `runViteWatch`** (`vite-project.ts:254-310`) unless the Stale output slice already did: on each
  `BUNDLE_END`, record the text of the bundle (read the files in `dist/` after the event; Rollup writes before it
  emits `BUNDLE_END`) as `bundle` on that event. Keep existing callers unchanged. Today the lib build has no
  `fileName`; read every `.js`/`.mjs` in `dist`, or pass a `fileName` only in your new cases.
- Fixture: `writeTsConfig({})`, `writeProfiles({ app: { addons: ["replacer"] } })`, `addons/replacer/addon.js`
  (`MARK_IN` → `MARK_OUT`), `src/main.ts` importing `./b`, each module with its own marker (`MARK_IN_main`,
  `MARK_IN_b`), so "every module" is visible in the bundle.
- `it.each(VITES)` with `VITES = ["vite", "vite6"]` (Vite 6 runs this suite too; it is cheap), 60-90 s Jest timeout,
  `removeProject()` in `afterEach`. Name tests "should … w/ …".
- Cases:
  - **should rebuild with edited addon w/ edit of addon file under watch** (red, row 1). Step: rewrite
    `addons/replacer/addon.js` to `MARK_NEW`. Assert two `START`s, last event `BUNDLE_END`, last bundle contains
    `MARK_NEW_main` and `MARK_NEW_b` and no `MARK_OUT`. On `develop` the runner never sees a second `START` and the
    runner script times out (45 s): accept that as the red evidence, or add a step timeout to `runViteWatch` that ends
    the run, and report which.
  - **should drop output of removed addon from every module w/ config edit under watch** (red, row 2). Step: config
    with `addons: []`. Last bundle contains `MARK_IN_main` and `MARK_IN_b`, no `MARK_OUT`.
  - **should fail one rebuild and rebuild clean w/ broken config fixed under watch** (red, row 3). Steps:
    `websmith.config.json` → `{ broken`, then a valid config with `addons: []`. Assert exactly one `ERROR`, with hook
    `buildStart` and a message containing `Invalid JSON`, then `BUNDLE_END` as the last event, and the last bundle
    contains `MARK_IN_main` and `MARK_IN_b`, no `MARK_OUT`. The events-only part passes on `develop`; the bundle
    assertion is the red part.
  - **should rebuild only edited module w/ source edit under watch** (**guard**). Step: edit `src/b.ts`. The bundle has
    the new `b` text; the plugin did not make an unrelated edit re-transform everything. Assert on the bundle only;
    the plugin has no transform log to observe.
- Keep `vite-diagnostics.test.ts:238-253` as is (guard).

**Flakiness:** run `vite-build-watch.test.ts` 5 times in a row on each Vite major (the `it.each` covers both)
(`pnpm --filter websmith-vite-test exec jest tests/vite-build-watch.test.ts --runInBand`), under Node 22, and once
under Node 24.21.0. Report "5/5 green, N tests each" in the PR. Run `vite-addon-outputs.test.ts` and
`vite-diagnostics.test.ts` 3 times as well if you changed `runViteWatch`. Determinism rules:

- no fixed sleeps in the test: `runViteWatch` already repeats a step every 250 ms until the next `START` (Rollup
  registers watch files asynchronously after `END`);
- a step runs after `END`, which Rollup also emits after an `ERROR`;
- never assert a fixed number of transforms or a timing.

**Unit**, in `packages/vite/src/hooks.spec.ts`, assemble / act / assert with one blank line between the parts and no
comments marking them. The object under test is `testObj`, its outcome `actual`, an observed collaborator `target`.
Every test creates its own `testObj`; no `let testObj` with `beforeEach`. No `expect` in the assemble or act parts;
run a hook expected to raise through `attempt()` (`:116-122`).

- **Spec helpers.** `createContext` (`:91-100`) needs `meta`; add `meta: { rollupVersion: "whatever", watchMode }`
  with a `watchMode = false` parameter, so every existing test keeps its behaviour. With the prototype, every
  existing test that calls a hook failed until `meta` existed. For addon files, create a real temp `addonsDir`
  (like `createNodeProject`, `:125-139`, removed in the same `afterEach`) with `a/addon.js`, `a/lib/helper.js` and
  `node_modules/x/index.js`; point `createOptions(…, addonsDir)` at it.
- `describe("transformHandler")`:
  - should add config file, tsconfig chain, missing file and addon files as watch files w/ build watch mode (red);
  - should add them for every module w/ two modules in build watch mode (red);
  - should add no file under node_modules of addonsDir w/ build watch mode (red);
  - should add each input once per module w/ build watch mode;
  - should add options inputs w/ module that fails with error in build watch mode (red);
  - should not add options inputs w/ build mode without watch (**guard**);
  - should not add options inputs in transform w/ serve mode (**guard**; `buildStart` still adds them, `:511-519`).
- `describe("buildStart")`:
  - should list addon files again w/ rebuild after new file in addonsDir (red);
  - existing rebuild tests (`:597-673`) stay green unchanged.
- `describe("watchChange")`, new:
  - should create compiler again on next buildStart w/ change of config file (red; `createCompiler` called twice);
  - the same for a tsconfig `extends` file, a `missing` file and a file in `addonsDir` (red; `it.each`);
  - should activate addons with buildStart context w/ rebuild after change of addon file (red; an activation
    `addWatchFile` reaches the second `buildStart`'s context);
  - should raise configuration error of new compiler w/ rebuild after config change (red);
  - should keep compiler w/ change of unrelated file (**guard**-style: passes once the hook exists);
  - should keep compiler w/ change of node_modules file under addonsDir;
  - should keep compiler w/ change of config file in serve mode;
  - should do nothing w/ environment without state, and w/ state with profile error.

**Also:**

- **No `console`** in `packages/vite/src`. **`import type` only** for `vite` outside `plugin.ts`.
- **New files carry the MIT header** (`pnpm license:add`); do not add them to the `license:check` list.
- **Gates, all green:** `pnpm lint`, `pnpm build --skip-nx-cache`, `pnpm test --skip-nx-cache`,
  `pnpm test:e2e --skip-nx-cache` under Node 22 (`$HOME/.nvm/versions/node/v22.17.0/bin`); the whole
  `packages/vite-test` suite once more under Node 24.21.0. CI also runs a `dist (24, typescript 5.7.3)` cell; `develop`
  pins TypeScript 6.0.3, peers `>=5.7 <7`. Nothing here is TypeScript-version specific.
- **Known flaky e2e, not yours:** `webpack-loader-resolve-once` "emits output of edited tsconfig.json" and
  `webpack-esm-check` "rebuilds exactly the edited leaf module". Re-run; if one fails twice, report it in the PR. Do
  not touch them. Node 24 can segfault in a full in-band `webpack-test` run locally: run its files one by one.

### Settled decisions — do not re-derive them

From the plan's Design (`vite build --watch` bullet) and Notes:

- **Watch files go in `transform`, not only in `buildStart`.** A `buildStart` watch file rebuilds but leaves cached
  modules untransformed (rows 2-4). Keep the existing `buildStart` watch files as they are.
- **Inputs = config file + `tsconfig.json` and its `extends` chain (+ missing ones) + every file under `addonsDir`.**
  The `addonsDir` tree is the dev server's rule (`isOptionsInput`), so dev and build watch agree. Rejected in the
  plan: tracking the files the registry loaded (core has no require tracking).
- **An input change drops the compiler instance; the next `buildStart` creates it.** Do this in `watchChange` with
  `forgetEnvironment`, as `hotUpdate` does. Rollup announces changes between runs only, so this is safe. The
  prototype also tried marking the state and dropping it in `buildStart`; both gave the same results on both majors.
  Use the plain drop.
- **A configuration error on such a rebuild fails that rebuild and keeps the watcher**; the fixing edit rebuilds
  clean. Rollup already behaves so; the slice only makes the fixed rebuild use the new output.
- **An addon's own dependencies outside `addonsDir` are not watched.** Document it; do not build it.
- **Every compiled module carries the inputs.** An input edit re-transforms every compiled module; that is what a
  config edit needs. The cost is one `addWatchFile` per input per module, only under watch.

#### Plan vs. develop

- **"Rollup keeps a module's watch files in a set"** is not exact. In Rollup 4.64.6, `transformDependencies` is an
  array per module (a `push` per `addWatchFile` call); `graph.watchFiles`, across modules, is keyed by id. The design
  holds. Resolution: add each input once per transform (item 1), and say so in the PR.
- **"An addon edit rebuilds with the new addon"** holds for the addon's entry file only. A module the addon requires,
  even inside `addonsDir`, is watched and rebuilds, but keeps Node's `require` cache (row 5), as in the dev server.
  Resolution: the e2e edits the entry file; the README states the limit (item 5). Clearing more of `require.cache` is
  a core change and out of this slice. The maintainer decided on 2026-10-21 to keep it a documented limit.

### Repo mechanics

- **Worktree setup.** pnpm 10.34 refuses frozen installs in this repo, so use the corepack-cached 10.8.0 through a
  shim:

  ```sh
  mkdir -p /tmp/pnpm-shim && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > /tmp/pnpm-shim/pnpm && chmod +x /tmp/pnpm-shim/pnpm
  export PATH=/tmp/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline && pnpm build --skip-nx-cache
  ```

  No dependency is added: `vite` 7.3.7 and `vite6` 6.4.4 are in `packages/vite-test`. Never edit `pnpm-lock.yaml`,
  `~/.npmrc` or the root `package.json`.
- **Rebuilding the plugin only:** `pnpm --filter @quatico/websmith-vite build` (plain `tsc`, output in
  `packages/vite/lib`).
- **Reproducing by hand:** write a fixture under `packages/vite-test/test-output-<name>`; it is git-ignored, and bare
  `vite`, `vite6` and `@quatico/websmith-vite` imports resolve there. A leftover `package.json` under `packages/**`
  joins the workspace and the next `pnpm install` adds it to the lockfile; if that happens,
  `git checkout -- pnpm-lock.yaml`. Remove fixtures with `trash`, never `rm`.
- **Merges:** `git -c rerere.enabled=false merge …` if you need `develop` in your branch.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). A suggested split:
  - `t Covers vite build --watch after addon and config edits`;
  - `B Rebuilds every module under vite build --watch when the config, tsconfig or an addon changes`;
  - `d Documents vite build --watch reloading and its limits`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Its title comes from the heading, "Build watch".
- Append ` → #<PR>` to the `### Build watch (Branch: bug/vite-build-watch-reload) …` heading line in
  `docs/plans/2026-10-16-addon-rebuild-gaps.md` and commit it on this branch. Change nothing else in the plan.
- PR body sections:
  - what changed;
  - "Plan vs. develop": the two points above;
  - "How it was verified": red-first evidence per e2e case on the pre-fix `develop`, guards named, the 5× runs on both
    majors, Node 24 run;
  - "Found, not built": the items below you confirmed or tripped over.

### Scope guard

This branch owns:

- `packages/vite/src/**` (`hooks.ts`, `plugin.ts`, `hooks.spec.ts`), `packages/vite/README.md`;
- `packages/vite-test/tests/vite-build-watch.test.ts` and, if needed, `runViteWatch` in `vite-project.ts`;
- one Release-Notes entry, and the ` → #<PR>` on the plan heading.

Do not touch:

- `packages/core/**`, `packages/api/**`, `packages/webpack/**`, `packages/webpack-test/**`, `packages/compiler/**`;
- the type-only slice's forwarding of its own watch files, beyond placing yours beside it;
- `.github/**`, the root `README.md`, the root `package.json`, `pnpm-lock.yaml`.

### Not in this slice

Mention any you trip over in the PR; do not build them.

- **Modules an addon requires keep Node's cache** after an edit (row 5), in dev and build watch. Core
  (`AddonRegistry`) owner; none yet.
- **A new file in `addonsDir`** starts no rebuild by itself; it is watched from the next rebuild.
- **`builder` / `buildApp` with several environments under watch, and workers bundled with the same plugin object
  under watch,** were not reproduced. `watchChange` is wrapped per environment, so it should hold; say "not checked"
  in the PR unless you run it.
- **Vite 8 (Rolldown)** is outside the peer range; its watcher may differ. Not checked.
- **The refresh path in `buildStart`** (`refreshOptions`/`refreshAddons` on every rebuild) stays; `refreshAddons` is a
  no-op for the Vite host. Removing it is a cleanup for later, not this slice.
