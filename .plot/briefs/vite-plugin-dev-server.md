<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — vite-plugin (slice: dev server)

- **Plan (canonical):** `docs/plans/2026-10-01-vite-plugin.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #132 merged
- **Branch:** `feature/vite-plugin-dev-server` (base: `develop`, at `98b80558` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is the plan's sixth slice. `## Slices` runs one branch per `###` heading, in heading order (plan
Notes: "headings run in order"), and no slice line carries a `<!-- waits: -->`. "Neutral module compiler" merged as
#174, "Tracer" as #182, "Diagnostics" as #193, "Addon outputs and context" as #198 (`c2622c3f`) and "Environments"
as #202 (`61fedf42`). The next heading is "Dev server", so this branch is next. After it come "Dev invalidation" and
"Release".

Line numbers below are from `develop` at `98b80558` (#202 merged, then #204, a Plot delivery record that touches no
code). If they move, find the code by name.

### What changed on `develop` since the plan was approved

- **#202 (Environments)** gave `packages/vite/src/hooks.ts` its current shape. Everything this slice changes is in it:
  - `EnvironmentInfo` (`:26`) is `{ name; config: { root; build: { outDir } } }`, and `HookContext` (`:29-31`) adds
    it to the Rollup context. It has no `logger`.
  - `EnvironmentState` (`:97-115`) holds one environment's `resolved`, `compiler`, `profileModule`, `reporter`,
    `outputs`, `outputFiles`, `raisedKeys`, `warnedKeys`, `profileError` and `packageJsonCache`. States live in
    `environments` (`:134`, by name) and `instances` (`:136`, by environment object, for nested worker builds).
  - `createEnvironmentState` (`:158-180`) activates the addons inside `outputs.runActivation` (`:173-177`). What the
    addons report while activating, e.g. a throwing `activate`, stays in the state's `DiagnosticReporter` buffer.
  - `getEnvironmentState` (`:184-193`) creates a state on first use. `transformHandler` (`:262`) calls it, so the dev
    server's `ssr` gets its state on its first transform.
  - **`buildStart` raises nothing in serve mode** (`:236-238`). Its comment (`:212-215`) hands "reporting the
    configuration errors of the dev server" to this slice.
  - `transformHandler` (`:258-292`) raises `profileError` on every module (`:263-265`), runs `checkModuleFormat`
    before `build` (`:272-278`), adds `dependencies` with `addWatchFile` (`:282`) and raises the module's errors plus
    whatever is in the reporter buffer (`:287-290`).
  - `buildEnd` (`:300-328`) runs result processors and pruning in build mode only (`:316`). `generateBundle`
    (`:330-340`) returns in serve mode (`:332`), and so does `AddonOutputs.generateBundle` (`addon-outputs.ts:157-160`).
  - `createModuleCompiler` (`:70-75`) creates its `AddonRegistry` inline (`:72`) and keeps no reference to it.
- **`plugin.ts`** (`:57-69`) has no `configureServer`. Its JSDoc says "The dev server raises module diagnostics the
  same way; its configuration errors are not reported yet" (`:40`) and "The dev server keeps virtual files in memory
  and does not serve them yet" (`:50`).
- **Docs that promise this slice:**
  - `packages/vite/README.md:67-68` says the dev server keeps virtual files in memory. Its last line (`:84`) says "The
    options, the dev server and the remaining documentation follow with the plugin's release."
  - `packages/api/src/addons/AddonContext.ts:96-99` says the dev server "keeps the file in memory and does not serve
    it yet".
  - `Release-Notes.md` `## [Unreleased]` → `### Added` (`:15-23`) holds two bullets: the `AddonContext` docs, and
    Vite environments.
- **Core, read only for this slice:**
  - `ModuleCompiler.getConfigErrors()` (`ModuleCompiler.ts:253-260`) returns the option resolution's errors **and**
    the file-less TypeScript errors that builds returned since (`fileLessErrors`). Those exist only after a module was
    emitted.
  - `ModuleCompiler.build` returns as `dependencies` only the files of the package-type lookup and the ESM check
    (`:411-412`, `:424`, `:444`, `:479`). It does not return the files the module's Program reads.
  - Whether an addon needs type information is `CompilerAddon.needsTypeInfo !== false` (`Compiler.ts:742-752`, a
    private method). `AddonRegistry.getAvailableAddons(profile)` (`AddonRegistry.ts:160`) lists the profile's addons,
    with `getName()`, and reports missing addons as warnings each time it is called.
- **The plan contradicts Vite and `develop` in four places.** "Settled decisions" gives the resolution for each.
  1. **Plan lifecycle table: "`configResolved` | … same, once per server start".** Known from #202: `configResolved`
     is not per environment. Per-environment values come from `this.environment.config`.
  2. **Plan lifecycle table, `vite dev` column: "`buildStart` | once per server start: same, errors to the
     logger".** Known from #202 and reproduced again here: the dev server runs `buildStart` for `client` only, and
     `ssr` transforms without one. Also, `this.error` in `buildStart` makes `server.listen()` reject (reproduced
     below), which is why the plan sends the errors to the logger.
  3. **Plan Design, Neutral contract: "`dependencies`: files the module, its rules and its addons read", and Dev
     server and HMR: "dependencies register through `this.addWatchFile` in `transform`, so importers invalidate".**
     On `develop`, `dependencies` holds only package.json and ESM-check files; addon watch files go through
     `ViteAddonContext`. An edit to a type-only import (`import type { … } from "./types"`) reloads nothing
     (reproduced). Value imports reload through Vite's own module graph.
  4. **Plan "Dev with type information": "`buildStart` warns once and names the active addons".** `buildStart` does
     not run for `ssr`, and `HookCompiler` cannot list addons today (`createModuleCompiler` drops its registry).
- **Open PRs:**
  - #203 (`feature/typescript-6-module-kinds`, open, conflicting) edits `ModuleCompiler.ts`, `Compiler.ts`, the root
    `README.md` and `Release-Notes.md`.
  - #186 (Dependabot) bumps the `vite` devDependency of `packages/vite` and `packages/vite-test` to `^8.3.3`.
  - #185 and #195 (Dependabot) edit manifests and the lockfile.

  None of them touches `packages/vite/src` or `packages/vite-test/tests`.

### Current behaviour

These cases were reproduced on `98b80558` with a real dev server on Vite 7.3.7 and 6.4.4 under Node 22.17.0. Both
majors behave the same in every row; the only difference is noted in row 15. Rows 3 and 13 were also run under
Node 24.21.0, with the same result.

The harness:

- Each case ran `createServer({ root, configFile: false, customLogger, plugins: [websmith(options), trace] })` and
  `server.listen()`, with a `customLogger` that records every line. A WebSocket client on `ws://localhost:<port>/`
  with the protocol `vite-hmr` (Node's global `WebSocket`) recorded the HMR payloads. Requests used `fetch` and
  `server.environments.ssr.transformRequest`.
- The fixture lived under `packages/vite-test/test-output-dev` and used `tsconfig.json` `ES2022`/`ESNext`/`bundler`,
  `rootDir: ./src` and `outDir: ./tsc-out`.
- `websmith.config.json` has one profile, `app`, with three addons:
  - `replacer`, a processor that replaces `MARK_IN` with `MARK_OUT`;
  - `gen`, a generator that writes `gen/<file>.txt` and calls `ctx.addVirtualFile("virt/<file>.json", …)`;
  - `rp`, a result processor.

  Each addon logs its `activate`, with `ctx.constructor.name`, and each run to `addons.log`.
- `src/main.ts` and `src/server.ts` both import `src/shared.ts`.

| # | Case | Result today | Plan wants |
|---|------|--------------|------------|
| 1 | `GET /src/main.ts` | 200, `MARK_OUT`. Addons activate once in `client`. Vite pre-transforms `shared.ts`, so `gen` runs for both files | the same (**guard**) |
| 2 | `ssr.transformRequest("/src/server.ts")` | no `buildStart` for `ssr`; its state is created in `transform`, and the addons activate a second time | the same (**guard**) |
| 3 | `profile: "nope"` (not configured) | **the server starts and nothing is logged or sent**. `main.ts` is 200, compiled by Vite without any addon (`addons.log` is empty) | logger error at startup, overlay on every module, server keeps running |
| 4 | `configFile: "missing.json"` | the same as row 3 | the same as row 3 |
| 5 | `websmith.config.json` is `{ bad json` | the same as row 3 | the same as row 3 |
| 6 | profile `tsConfig.module: "commonjs"` | **CommonJS is served to the browser** (`"use strict"; Object.defineProperty(exports, "__esModule", …`) and nothing is logged. `vite build` fails with `Profile 'app' emits CommonJS ('tsConfig.module' is 'commonjs'), which Vite cannot bundle as an ES module.` | the same as row 3 |
| 7 | TS5053 option error (`jsxFactory` with `reactNamespace`; `vite-build.test.ts:9-10` uses it) | nothing is logged or sent, and both modules are 200. `vite build` fails in `buildEnd` | the same as row 3 |
| 8 | `rp`'s `activate` throws | the first `GET /src/main.ts` is 500, with the overlay `Error activating addon "rp": Error: ACTIVATE_BOOM`. **A second `GET` of the same module is 200** and `shared.ts` is 200: the first transform took the error out of the reporter buffer | the same as row 3, on every module |
| 9 | profile names a missing addon `ghost` | one logger warning, `Missing addons for profile "app": "ghost"` | the same (**guard**) |
| 10 | a processor throws | 500, overlay `Error in processor "replacer": Error: PROC_BOOM` | the same (**guard**) |
| 11 | `profile: { client: "app" }`, then `ssr.transformRequest` | `ssr` fails with `… names no profile for the Vite environment 'ssr'. It names: client.` **Nothing is logged** | the error on every `ssr` module (**guard**), plus one logger error |
| 12 | `transpileOnly: true`, legacy addons (`needsTypeInfo` unset) | **no warning** | one warning at startup naming the addons that lose type information |
| 13 | `GET /virt/main.ts.json` after `main.ts` was served | **404** | the virtual file, served from memory |
| 14 | `rp` in dev | **never runs**: `addons.log` has `activate rp` and nothing else | runs after each transform, with that module's files |
| 15 | edit `src/shared.ts` to `MARK_IN2` | `full-reload` (Vite 7 sends `path: "*"`, Vite 6 no `path`), `shared.ts` is transformed again, and `GET` gives `MARK_OUT2` | the same (**guard**) |
| 16 | edit `data.json`, which a processor watches with `addAssetDependency` and reads | `full-reload`, `main.ts` is transformed again, and the processor returns the new text. **The served module keeps the old text.** The same happens under `vite build --watch` | not this slice; see "Not in this slice" |
| 17 | edit `src/types.ts`, a type-only import of `main.ts` | no payload, no new transform | not this slice (contradiction 3) |
| 18 | edit `websmith.config.json` to drop `replacer` | `hotUpdate` in `client` and `ssr`, no payload, and `GET` still gives `MARK_OUT` | Dev invalidation |
| 19 | edit `websmith.config.json` to `{ broken` | nothing is logged or sent. After an edit of `shared.ts`, the module still compiles with the old options | Dev invalidation |
| 20 | edit `addons/replacer/addon.js` | nothing; the old addon keeps running | Dev invalidation |
| 21 | the writes of `gen` (`gen/*.txt`) and of the host profile (`tsc-out/*.js(.map)`) | each write fires `hotUpdate` in `client` **and** `ssr`. None reloads, because none is in the module graph | Dev invalidation (write-loop guard) |

Three more facts the design depends on, each traced on both majors:

- **`this.error` in `buildStart` stops the dev server:** a plugin that calls it makes `server.listen()` reject with
  that message.
- **`this.environment.logger.error`/`.warn`**, called in `client`'s `buildStart` and in `ssr`'s `transform`, reach
  `customLogger` without a prefix.
- **`server: { port: 0 }` does not pick a free port:** Vite starts on 5173. Read the port from
  `server.httpServer.address().port` after `listen()`.

### What to build

All work is in `packages/vite` and `packages/vite-test`, plus the docs in item 6 (including one doc comment in
`packages/api`). No core change. Every module in `packages/vite/src` except `plugin.ts` imports `vite` with
`import type` only, so Jest can load it.

**1. Configuration errors in serve mode** (`hooks.ts`). This is the core of the slice.

- Add `logger: { error(msg: string, options?: { timestamp?: boolean }): void; warn(msg: string, options?: {
  timestamp?: boolean }): void }` to `EnvironmentInfo`. Keep it a narrow structural type; do not import `Logger` as a
  value. It was traced in dev on both majors, and the plugin uses it in serve mode only. Every stub in `hooks.spec.ts` needs one; extend the existing
  environment helper.
- **Keep activation errors in the state.** After `runActivation` in `createEnvironmentState`, and after the refresh in
  `buildStart`, move the reporter's **errors** into `state.activationErrors`. Its warnings keep going through `report`
  once. Build mode keeps raising them in `buildStart` as today. The first transform must no longer be the only module
  that sees them (row 8).
- **`startServing(context, state)`** runs once per state in serve mode: from `buildStart` (`client`), or from
  `transformHandler` when the state was created there (`ssr`). Mark it with a flag on the state. It:
  - computes `state.profileModule` (`getProfileModule`, as build mode does);
  - collects the **serve errors**: `profileError`, or else `current.getConfigErrors()` (errors only),
    `checkProfileModule(state.profileModule)` and `state.activationErrors`;
  - logs each serve error once, with `context.environment.logger.error("[plugin websmith] " +
    formatDiagnostic(cur), { timestamp: true })`, and remembers its key in `state.loggedKeys`;
  - logs the `transpileOnly` warning of item 4.

  It never calls `this.error`, because that stops the server (see the facts below the table).
- **`transformHandler` in serve mode:**
  - Before `build`, raise the serve errors with `this.error(toRollupError(errors))` when there are any. Do not
    compile: as with `checkModuleFormat`, no generator should run under a broken configuration. Every module of the
    affected environment fails, on every request, so the overlay stays until the configuration is fixed.
  - After `build`, add `current.getConfigErrors()` to the module's errors. This is how a file-less TypeScript error,
    e.g. TS5053, which exists only after an emit, reaches the overlay (row 7). Log the ones whose key is not yet in
    `state.loggedKeys`, once.
  - `partitionDiagnostics` already deduplicates by key, so a module never shows an error twice.
- Build mode is unchanged: `buildStart` raises once, and `buildEnd` raises the file-less errors once.
- Do not `addWatchFile` the options files (`getOptionsFiles`) in serve mode. In `transform` they would become imports
  of the module, and reloading on a config edit is Dev invalidation's.

**2. `addVirtualFile` served from memory** (`addon-outputs.ts`, `hooks.ts`, `plugin.ts`).

- New `AddonOutputs.getVirtualFile(fileName: string): string | undefined`. It merges the entries the way
  `generateBundle` does (activation, then every module entry in insertion order, then build), without a module id
  filter. A removal of that name hides it.
- New hook `findVirtualFile(url: string, base: string): { fileName: string; content: string } | undefined` in
  `WebsmithHooks`. It strips the query and the hash, decodes the path, strips `base`, and looks the result up in the
  state of the environment named `client`. Browser requests are served by `client`.
- `plugin.ts` gets `configureServer(server)`. It registers a middleware **before** Vite's own middlewares, by not
  returning a function. The middleware answers `GET`/`HEAD` for a virtual file with 200, the content and a
  `Content-Type` from a small extension map (`.json`, `.js`/`.mjs`, `.css`, `.html`, `.txt`, `.svg`, else
  `application/octet-stream`). Otherwise it calls `next()`. Type `server` with `import type { ViteDevServer }`.
- A virtual file shadows a real file at the same URL. Say so in the README.

**3. Result processors after each transform in serve mode** (`hooks.ts`).

- After a module built without errors in serve mode, run `outputs.run(this, id, () =>
  current.runResultProcessors(fragment.files.map(cur => cur.name)))`. The module id keys any virtual files they add,
  so the module's next transform replaces them.
- Their errors join the module's errors (`this.error`). Build mode keeps running them once per environment in
  `buildEnd`.

**4. The `transpileOnly` warning** (`hooks.ts`).

- Extend `HookCompiler` with `getTypeInfoAddons(): string[]`. Implement it in `createModuleCompiler`: keep the
  `AddonRegistry` in a `const`, and return the compiler with that method attached. It returns
  `addons.getAvailableAddons(compiler.getProfile()).filter(cur => cur.needsTypeInfo !== false).map(cur =>
  cur.getName())`. Stubs in the spec add the method.
- In `startServing`, when `state.resolved.loaderOptions.transpileOnly` is set and the list is not empty, log once per
  environment with `logger.warn`:

  ```
  [plugin websmith] 'transpileOnly' drops type information in the Vite dev server for the addons of profile '<profile>' that need it: <a>, <b>. Remove 'transpileOnly', or set needsTypeInfo to false in an addon that needs none.
  ```

  For no profile, write "of the default profile". With no such addon, log nothing. Build mode logs nothing.
- `getAvailableAddons` reports missing addons each time it is called. `report`'s `warnedKeys` already deduplicates
  them; keep it that way.

**5. JSDoc of `websmith()`** (`plugin.ts:13-56`): replace `:40` and the last sentence of `:50` with the dev-server
rules:

- configuration errors go to the logger at startup and fail every module of that environment, without stopping the
  server;
- virtual files are served at `base` + their bundle path;
- result processors run after each transform with that module's files;
- `transpileOnly` warns.

**6. Docs.**

- **`packages/vite/README.md`:** add a "Dev server" section after "Environments":
  - configuration errors: logged once when the environment starts (`client` at server start, `ssr` on its first
    module), and the overlay on every module of that environment until the configuration is fixed. Fixing it
    currently needs a restart; Dev invalidation adds the reload;
  - module diagnostics as the overlay;
  - `addVirtualFile` served from memory at `base` + its bundle path, shadowing a real file;
  - result processors after each transform, with that module's files;
  - `vite dev` uses the build's profile, with no automatic `transpileOnly`, and an explicit `transpileOnly` warns;
  - an edit to a type-only import does not reload its importer (contradiction 3).

  In the table (`:67-68`), change "dev server: kept in memory" to "dev server: served from memory". Drop "the dev
  server" from the last line (`:84`).
- **`packages/api/src/addons/AddonContext.ts:98-99`:** replace "keeps the file in memory and does not serve it yet"
  with "serves the file from memory at the same path". The doc comment is the only change there.
- **`Release-Notes.md`:** add one bullet under `## [Unreleased]` → `### Added`, after the two existing ones, e.g.
  "The Vite plugin (`@quatico/websmith-vite`, not yet published) runs in the Vite dev server: configuration errors
  are logged at startup and shown as the error overlay on every module without stopping the server, `addVirtualFile`
  files are served from memory, result processors run after each transform, and `transpileOnly` warns which addons
  lose type information." Keep yours to that one bullet. Release writes the package's own entry.

### Done when

The slice line is the specification. It asks for:

- "modules compile through the plugin in `createServer`";
- "dependencies via `addWatchFile` from `transform`";
- "configuration errors to the logger plus per-module overlay";
- "`addVirtualFile` served from memory";
- "result processors after each transform";
- "a startup warning when `transpileOnly` drops type information";
- "per-request cost of a type-info addon measured and recorded in the PR";
- "unit tests";
- "e2e: dev server serves a transformed module, an edit to an imported file reloads its importer, a broken config
  shows the overlay without stopping the server".

Write each red first, and run each new e2e test on `98b80558` before the fix to prove it fails. Check out
`packages/vite/src` at `98b80558`, rebuild `packages/vite`, run, then restore. Cases marked **guard** already pass on
`develop` (reproduced); keep them as guards and say so in the PR.

**E2E**, in a new `packages/vite-test/tests/vite-dev-server.test.ts`:

- In `tests/vite-project.ts`, add `runViteDev({ vite, pluginOptions, viteOptions?, steps })`. It runs, like `runVite`,
  in a separate Node process (Vite is ESM only).
  - It calls `createServer({ root, configFile: false, logLevel: "info", clearScreen: false, customLogger, plugins:
    [plugin], server: { port: 5273, strictPort: false }, ...viteOptions })` and then `server.listen()`. It records a
    rejected `listen()` as `listenError`.
  - The `customLogger` is `vite.createLogger()` with `info`, `warn`, `warnOnce` and `error` replaced by recorders,
    with the ANSI codes stripped.
  - It reads the port from `server.httpServer.address().port`. It opens Node's global `WebSocket` on
    `ws://localhost:<port>/` with the protocol `vite-hmr`, records each message except `ping`, and waits for
    `connected` before the first step.
  - The steps are code strings run in order, as in `runViteWatch`, with these helpers in scope:
    - `get(url)` records `{ url, status, body }`;
    - `ssr(url)` records the `code` or the `error` of `server.environments.ssr.transformRequest(url)`;
    - `waitForMessage(predicate, ms = 10000)` polls the recorded messages every 25 ms, and records a timeout instead
      of throwing;
    - `edit(file, text, predicate)` writes the file, then **rewrites it every 250 ms** until a message matches or
      10 s pass. The watcher may not see a write made right after the first request; `runViteWatch` has the same
      race.
  - It closes the socket and the server, prints `{ listening, listenError, logs, messages, responses, timeouts }` as
    JSON, and exits. Use `spawnSync`'s `timeout` (60 s), as `runViteWatch` does.
- **No fixed sleeps anywhere:** every wait is a poll with a timeout. After a `GET` that fails, wait for the `error`
  message with `waitForMessage`, because the payload and the response race.
- Name the tests "should …". Run every case on `vite` and `vite6` (`it.each(VITES)`), with a 60 s Jest timeout.
- The fixture is the one under "Current behaviour". The addons log to a file in the project, not through `console`.
- Count the plugin's own log lines by their `[plugin websmith]` prefix. Vite also logs "Internal server error: …"
  for each failed request.

Cases:

- **Serves a transformed module** (guard, row 1): `GET /src/main.ts` is 200 and contains `MARK_OUT`.
- **An edit to an imported file reloads its importer** (guard, row 15). After `GET` of `main.ts` and `shared.ts`,
  `edit("src/shared.ts", …MARK_IN2…)` receives a `full-reload`. Do not assert its `path`; Vite 6 omits it. `GET
  /src/shared.ts` then contains `MARK_OUT2`.
- **A broken config shows the overlay without stopping the server** (red, rows 3-5), for each of `profile: "nope"`,
  `configFile: "missing.json"` and an invalid `websmith.config.json`. Expect:
  - `listening` is true;
  - exactly one `[plugin websmith]` error line with the message;
  - `GET /src/main.ts` and `GET /src/shared.ts` are both 500, each followed by an `error` message with it;
  - a second `GET /src/main.ts` is 500 again;
  - `addons.log` holds no `replacer` run.
- **CommonJS profile** (red, row 6): `tsConfig.module: "commonjs"` gives a 500 and the overlay `emits CommonJS`. The
  body never contains `__esModule`.
- **Throwing `activate`** (red, row 8): both `GET`s of `main.ts`, and `shared.ts`, are 500 with `ACTIVATE_BOOM`. It is
  logged once.
- **File-less option error** (red, row 7): TS5053 (`OPTION_ERROR` from `vite-build.test.ts`) is in the overlay of
  `main.ts`, and logged once.
- **Unnamed environment** (row 11): `profile: { client: "app" }`; `ssr("/src/server.ts")` fails with `'ssr'` (guard).
  One `[plugin websmith]` error names `'ssr'` (red), and `client` serves `MARK_OUT`.
- **Virtual file** (red, row 13): after `GET /src/main.ts`, `GET /virt/main.ts.json` is 200 with `{"v":1}`.
- **Result processor after each transform** (red, row 14): after `GET /src/main.ts`, `addons.log` has an `rp` line
  with `main.js`. After `edit` of `main.ts` and another `GET`, it has a second one.
- **`transpileOnly` warning** (red, row 12): `transpileOnly: true`, with `replacer` (`needsTypeInfo` unset) and
  `fast`, an addon with `exports.needsTypeInfo = false`. One `[plugin websmith]` warning names `replacer` and not
  `fast`.
- **No warning without `transpileOnly`** (guard).

**Flakiness:** run `vite-dev-server.test.ts` 5 times in a row (`pnpm --filter websmith-vite-test exec jest
tests/vite-dev-server.test.ts --runInBand`), and report "5/5 green, N tests each" in the PR.

**Measurement** (PR only, not a gate):

- Set up a fixture with 50 modules that import each other, and an addon with `needsTypeInfo: true` whose transformer
  calls the type checker.
- Time `server.environments.client.transformRequest` per module, after one warm-up pass, with `transpileOnly` unset
  and with it set, on Vite 7.
- Report the median and p95 per request and the first request, in a table under "Per-request cost". Only a measured
  problem reopens the plan's "no automatic `transpileOnly`" decision; do not change the default.

**Unit**, in `packages/vite/src/*.spec.ts`, assemble / act / assert with one blank line between the parts and no
comments marking them. The object under test is `testObj`, its outcome `actual`. Every test creates its own
`testObj`; no `let testObj` with `beforeEach`. No `expect` in the assemble or act parts; run a hook that is expected
to raise through the existing `attempt()` helper. Remove temp dirs in `afterEach`.

- `hooks.spec.ts`, serve mode:
  - `buildStart` logs each configuration error once and does not raise;
  - `transform` raises them on every module and does not call `build`;
  - activation errors reach a second module;
  - a lazily created state (no `buildStart`) logs its errors on its first transform, once;
  - a file-less error from `getConfigErrors` after `build` joins the module's errors and is logged once;
  - result processors run after a transform with that module's files, and not after a failed one;
  - the `transpileOnly` warning, with and without type-info addons, and never in build mode;
  - `findVirtualFile` with `base`, a query, an unknown path, and a non-`client` state.
- `hooks.spec.ts`, build mode: the existing tests stay green unchanged. Add one test that `buildStart` still raises
  the activation errors.
- `addon-outputs.spec.ts`: `getVirtualFile` from the activation, a module and the build entries; a later entry wins;
  a removal hides it.
- `plugin` has no spec today. If you test the middleware, put it in a Jest-loadable module that takes the hooks, not
  in `plugin.ts`.

**Also:**

- **New files carry the MIT header** (`pnpm license:add`). Do not add them to the `license:check` list.
- **No `console`** anywhere in `packages/vite/src`. Everything goes through the reporter, `this.warn`/`this.error` or
  `environment.logger`.
- **`import type` only** for `vite` in every Jest-loaded module. `plugin.ts` stays the only value import
  (`createFilter`).
- **No `@quatico/websmith-core` import in addon code.** The e2e addons are plain CommonJS `addon.js` files.
- **Gates, all green:** `pnpm lint`, `pnpm build --skip-nx-cache`, `pnpm test --skip-nx-cache` and
  `pnpm test:e2e --skip-nx-cache`. The shared `.nx-cache` replays outputs from other worktrees, so skip it.
  - Run the whole `packages/vite-test` suite under Node 22 (`$HOME/.nvm/versions/node/v22.17.0/bin`) and once under
    Node 24 (`$HOME/.nvm/versions/node/v24.21.0/bin`), and say so in the PR.

### Settled decisions — do not re-derive them

- **Next slice is "Dev server".** Plan `## Slices` order, #202 merged, no `waits:`.
- **Serve mode never calls `this.error` in `buildStart`.** It stops the server (reproduced). Configuration errors go
  to `this.environment.logger.error` once per environment and to `this.error` in every `transform` of that
  environment. This resolves contradiction 2 and is the plan's own open-point decision.
- **"Once per server start" means once per environment state.** `client` starts in `buildStart`, any other
  environment on its first `transform`. A worker's nested state starts on its own.
- **A module of an environment with configuration errors is not compiled.** Raising after a compile would run
  generators under a broken configuration.
- **File-less TypeScript errors join each module's errors after `build`, in serve mode.** They exist only after an
  emit, and the overlay is the only place a dev user sees them.
- **The logger is `this.environment.logger`**, declared as a narrow type on `EnvironmentInfo`, not `configResolved`'s
  `config.logger`. It is per environment, and Jest stubs stay small.
- **Virtual files are served by the `client` state only, before Vite's middlewares, at `base` + bundle path.** The
  plan says "served by a dev-server middleware at its output path".
- **Result processors in serve mode run per transform with that module's files**, as the plan says ("keeps generated
  indexes current"). Build mode is unchanged.
- **`getTypeInfoAddons` lives in the host**, through the registry `createModuleCompiler` creates. No core change.
  This resolves contradiction 4; the warning is per environment, not per server.
- **`dependencies` stay as core returns them.** A type-only import is not watched (contradiction 3). Fixing that is a
  core change shared with the loader and is not this plan's (see Not in this slice). Value imports reload through
  Vite's graph (guard).
- **Nothing reloads on a config, tsconfig or addon edit in this slice.** `hotUpdate` and dropping the instance are
  Dev invalidation's.

### Repo mechanics

- **Worktree setup.** pnpm 10.34.1 refuses frozen installs in this repo, so use the corepack-cached 10.8.0 through a
  shim:

  ```sh
  mkdir -p /tmp/pnpm-shim && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > /tmp/pnpm-shim/pnpm && chmod +x /tmp/pnpm-shim/pnpm
  export PATH=/tmp/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline && pnpm build --skip-nx-cache
  ```

  No dependency is added: `vite` 7.3.7 and `vite6` 6.4.4 are already in `packages/vite-test`, and both export
  `createServer` and `createLogger`. Node's global `WebSocket` exists on Node 22 and 24, so add no `ws` package.
  Never edit `pnpm-lock.yaml`, `~/.npmrc` or the root `package.json`.
- **Merges:** use `git -c rerere.enabled=false merge …` if you need `develop` in your branch.
- **Reproducing by hand:** write a fixture under `packages/vite-test/test-output-<name>`. It is git-ignored, and bare
  `vite`, `vite6` and `@quatico/websmith-vite` imports resolve from there. Remove it afterwards with `trash`.
  - Never leave a `package.json` in a fixture. A leftover one under `packages/**` joins the workspace, and the next
    `pnpm install` adds it to `pnpm-lock.yaml`. If that happens, `git checkout -- pnpm-lock.yaml`; never commit it.
  - Never assert a fixed port: with `strictPort: false`, Vite moves to the next free one.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). A suggested split:
  - `F Reports websmith configuration errors in the Vite dev server`;
  - `F Serves addVirtualFile files from the Vite dev server`;
  - `F Runs result processors after each transform in the Vite dev server`;
  - `F Warns when transpileOnly drops type information in the Vite dev server`;
  - `d Documents the Vite dev server`;
  - `t Covers the Vite dev server end to end`.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Its title comes from the wave heading, "Dev server".
- Append `→ #<number>` to the `feature/vite-plugin-dev-server` line in `docs/plans/2026-10-01-vite-plugin.md`
  `## Slices`, and commit that on this branch. Change nothing else in the plan. Its four contradictions go into the PR
  body, under the heading "Plan vs. Vite", and the measurement under "Per-request cost".

### Scope guard

This branch owns:

- `packages/vite/**` and `packages/vite-test/**`;
- the `addVirtualFile` doc comment in `packages/api/src/addons/AddonContext.ts:96-99`, and nothing else in
  `packages/api`;
- one bullet in `Release-Notes.md` `### Added`, and the `→ #<PR>` line in the plan.

Do not touch:

- `packages/core/**`: no core change is needed, and #203 is editing `ModuleCompiler.ts` and `Compiler.ts`;
- `packages/webpack/**`, `packages/webpack-test/**`, `packages/compiler/**`;
- `.github/**`, the root `README.md`, the root `package.json` and `pnpm-lock.yaml`.

Concurrent work, checked against `98b80558`:

- **#203 `feature/typescript-6-module-kinds`** (open) edits core, the root `README.md` and `Release-Notes.md`. If it
  merges first, rebase and keep both `Release-Notes.md` bullets.
- **#186 (Dependabot)** bumps `vite` to `^8.3.3` in `packages/vite` and `packages/vite-test`. If it merges first,
  rebase and take `develop`'s lockfile; never hand-merge it. Vite 8 is best-effort in the plan, so report a dev e2e
  that fails only on Vite 8 in the PR instead of fixing it here.
- **#185/#195 (Dependabot, open)** edit manifests and the lockfile. Same rule.

Not in this slice. Each item has an owner; mention any you trip over in the PR, but do not build them. Each one was
verified on `98b80558`:

- **A config, tsconfig or addon edit while serving** reloads nothing, and the server keeps the old options and addons
  (rows 18-20). The overlay that clears once the config is fixed belongs here too.
  - Owner: `feature/vite-plugin-dev-invalidation` (`hotUpdate`, instance dropped, options re-resolved, full reload).
- **The write-loop guard.** Every generator and host-profile write inside the root fires `hotUpdate` in every
  environment (row 21).
  - Owner: `feature/vite-plugin-dev-invalidation`.
- **The write record skips a write after another writer changed the file** (#198 follow-up; `write-record.ts:29`,
  unchanged). Verified by reading; reproduced in the #202 brief.
  - Owner: `feature/vite-plugin-dev-invalidation`, which owns the record's change-cycle reset.
- **Pruning in serve mode** (#198/#202 follow-up). `buildEnd` prunes in build mode only (`hooks.ts:316-323`), so a
  long dev session keeps the entries of deleted modules. The new `getVirtualFile` can then serve a virtual file of a
  deleted module; say so in the README.
  - Owner: `feature/vite-plugin-dev-invalidation`.
- **The context factory wraps the old profile after a config edit** (#198 known limit). `updateLoaderConfig`
  recreates the contexts at `ModuleCompiler.ts:297`, before it reassigns `this.profile` at `:299-300`. The dev server
  never refreshes options today (row 19), so it cannot hit this yet.
  - Owner: `feature/vite-plugin-dev-invalidation`.
- **The node16/nodenext `packageJsonCache` and the `findPackageJson` walk** (#202 reviews):
  - the cache is cleared only in `buildStart` (`hooks.ts:221`), which the dev server runs once;
  - the walk is uncached per module (`config-errors.ts:40-50`).
  - Owner: `feature/vite-plugin-dev-invalidation` ("per-build caches invalidated on `package.json` change").
- **An edit to an addon's non-source dependency serves the old output** (row 16). The processor runs again and
  returns the new text, but the module keeps the old one, in dev and under `vite build --watch`. The likely cause is
  `FileCache.updateSource` (`packages/core/src/compiler/cache/FileCache.ts:37-48`): it keeps the old snapshot unless
  the source file's mtime is newer. This was not confirmed.
  - Core behaviour shared with the loader, so no slice of this plan may change it. Propose a separate issue in the PR.
    The e2e must not depend on it.
- **A type-only import does not reload its importer** (row 17, contradiction 3). Core returns no Program files as
  `dependencies`.
  - Owner: a separate core+loader issue; `docs/vite-plugin-release` lists it as a known limit. This slice writes the
    README line.
- **A dependent profile's result processor runs per module, plus once more in the target's `buildEnd`**
  (`ModuleCompiler.ts:446-450`, `TODO`), and **the host profile writes its own output to disk** (`:466`; in dev on
  every transform, row 21).
  - Owner: `docs/vite-plugin-release`, as documented known limits. The fix is a separate loader+core issue.
- **Vite 7 on exactly Node 22.12.0, and Vite 6.3.0 (the peer floor)**, are untested. `~/.nvm` has neither, and no
  dependency may be added. Owner: `docs/vite-plugin-release`.
- **A non-string value in the `profile` map** goes into `loaderOptions.profile` unchecked (#202 review nit,
  `options.ts:57-58`). The plan names no owner; mention it in the PR.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside scope. Check:

- whether `server.middlewareMode`, a non-`/` `base` or a client environment not named `client` breaks the middleware.
  Test `base` in a unit test; report the others;
- whether `this.environment.logger` exists on Vite 6.3.0. Only 6.4.4 and 7.3.7 were checked here.
