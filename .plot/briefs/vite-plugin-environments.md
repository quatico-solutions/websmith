<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — vite-plugin (slice: environments)

- **Plan (canonical):** `docs/plans/2026-10-01-vite-plugin.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #132 merged
- **Branch:** `feature/vite-plugin-environments` (base: `develop`, at `c2622c3f` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is the plan's fifth slice. `## Slices` runs one branch per `###` heading, in heading order (plan
Notes: "headings run in order"), and no slice line carries a `<!-- waits: -->`. "Neutral module compiler" merged as
#174, "Tracer" as #182, "Diagnostics" as #193 and "Addon outputs and context" as #198 (`c2622c3f`). The next heading
is "Environments", so this branch is next. After it come "Dev server", "Dev invalidation" and "Release".

Line numbers below are from `develop` at `c2622c3f` (#198 merged). If they move, find the code by name.

### What changed on `develop` since the plan was approved

- **#198 (Addon outputs and context)** gave `packages/vite/src` its current shape. Everything this slice changes is
  in it:
  - `hooks.ts` holds the plugin's state in **one closure per `websmith()` call**: `resolved`, `filter`, `compiler`,
    `command` (`:88-91`), one `DiagnosticReporter` and one `AddonOutputs` (`:92-93`), `outputFiles` (`:95`),
    `raisedKeys` and `warnedKeys` (`:97-99`). Nothing in it knows about Vite environments.
  - `configResolved` (`:113-118`) overwrites `resolved`, `command` and the `AddonOutputs` `outDir` on every call.
  - `buildStart` (`:122-151`) creates the compiler once, and on later calls only refreshes it (`:126-133`).
  - `HookContext` (`hooks.ts:23`) is `Pick<Rollup.PluginContext, "error" | "warn" | "addWatchFile" | "emitFile" |
    "getModuleIds">`, so it has no `environment`.
  - `createModuleCompiler` (`:62-67`) wraps `ts.sys` in `createDeduplicatingSystem` (`write-record.ts:21-36`) for each
    compiler it creates.
  - `AddonOutputs` (`addon-outputs.ts:35-183`) keeps one `outDir` (`:39`, set by `configure` at `:47-50`) and
    per-module entries (`:41`).
  - `packages/vite/README.md` exists now. Its last line says that options, environments and the dev server "follow
    with the plugin's release".
  - `Release-Notes.md` `## [Unreleased]` → `### Added` holds one bullet, about the `AddonContext` docs.
- **The plan contradicts both Vite and `develop` in three places.** "Settled decisions" gives the resolution for each.
  1. **Plan lifecycle table: "`configResolved` | resolve options once per environment".** Vite does not call
     `configResolved` once per environment. It calls it once per resolved config:
     - `vite build --app` with a config file evaluates `vite.config.*` once per environment (three times for
       `client` + `ssr`), so each environment gets its own plugin object;
     - `createBuilder` with an inline config (`configFile: false`, the JS API and the e2e runners) calls it three
       times on **the same** plugin object: top level, `client`, `ssr`. The last call wins, so `outDir` is the
       server's while `client` builds;
     - `builder: { sharedConfigBuild: true, sharedPlugins: true }` calls it once, with the top-level
       `build.outDir`;
     - the dev server calls it once.

     Per-environment values therefore come from `this.environment.config`, which every build hook has (traced on
     Vite 6 and 7).
  2. **Plan lifecycle table, `vite dev` column: "`buildStart` | once per server start".** In the dev server,
     `buildStart` runs for the `client` environment only. The `ssr` environment transforms modules without its own
     `buildStart` (traced: `buildStart env=client`, then `transform env=ssr`). An environment's state must be created
     on its first `buildStart` **or** on its first `transform`.
  3. **Plan Options: "`profile` is `string | Record<string, string>`".** On `develop`, `WebsmithViteOptions.profile`
     is `string` (`options.ts:17`). `PASS_THROUGH_KEYS` (`options.ts:35`) passes a map through to the compiler
     unchanged, so the compiler looks for a profile named `[object Object]` (see "Current behaviour").
- **The `nodenext` follow-up that the #198 brief assigned here is unchanged.** `checkTargetModule`
  (`config-errors.ts:23-36`) still decides per profile. It treats every `module` value outside `NON_ESM_MODULE_KINDS`
  as ESM (`packages/core/src/compiler/esm/check-esm.ts:84-88`).
- **Core needs no change for this slice.** `ModuleCompiler` already takes one `profile` per instance
  (`ModuleCompiler.ts:206`, from `loaderOptions.profile`). The `createContext` factory (`:58`, `:217-219`) wraps that
  profile only.
- **Open PRs:** #200 (`bug/typescript-6-root-dir-once`) edits `packages/core/src/compiler/Compiler.ts` and core
  specs, and #185/#186/#195 (Dependabot) edit manifests and the lockfile. None of them touches `packages/vite*`.

### Current behaviour

These cases were reproduced on `c2622c3f` with real builds on Vite 7.3.7 and 6.4.4 under Node 22.17.0. Both majors
behave the same in every row.

The fixture lives under `packages/vite-test/test-output-env`:

- `tsconfig.json` sets `ES2022`/`ESNext`/`bundler`, `rootDir: ./src` and `outDir: ./tsc-out`.
- `websmith.config.json` has two profiles:
  - `client`: the addon `clientx`, whose processor replaces `MARK_IN` with `CLIENT_OUT`;
  - `server`: the addon `servergen`, whose generator writes `gen/<file>.txt`, and `serverrp`, a result processor.

  Each profile has its own `tsConfig.outDir`.
- `src/main.ts` (client entry) and `src/server.ts` (SSR entry) both import `src/shared.ts`.
- `createBuilder` builds `client` (`outDir: dist/client`, input `src/main.ts`) and `ssr` (`outDir: dist/server`,
  `build.ssr: src/server.ts`).
- Every addon logs its `activate`, with `ctx.constructor.name`, and each run. A wrapper logs each plugin hook with
  `this.environment.name`.

| Case | Result today | Plan wants |
|------|--------------|------------|
| `profile: { client: "client", ssr: "server" }`, inline config | **both environments fail**: `Profile '[object Object]' is not configured in '…/websmith.config.json'. Available profiles: client, server.` | `client` compiles with `client`, `ssr` with `server` |
| `profile: "client"`, inline config (one plugin object) | `configResolved` runs 3×, and the last call sets `outDir=dist/server`. Addons activate **once**, in `client`'s `buildStart`. `ssr`'s `buildStart` only refreshes that compiler, so both environments share one compiler, one reporter and one `AddonOutputs` | one compiler instance per environment, "never shared between `client` and `ssr`"; with a string, the same profile in each |
| The same with `vite build --app` and a `vite.config.mjs` | the config file is evaluated 3×, there are two plugin objects, and `activate` runs once per environment | the same (guard) |
| Inline config: the `client` generator calls `ctx.addVirtualFile(<root>/dist/client/abs.json, …)` | **`client` fails**: `addVirtualFile of addon "clientx" cannot place '…/dist/client/abs.json' in the bundle: it is outside build.outDir '…/dist/server'` | asset `abs.json` in `dist/client` |
| The same with `builder: { sharedConfigBuild: true, sharedPlugins: true }` | `configResolved` runs once, with `outDir=dist`. The asset is emitted as **`client/abs.json`**, i.e. `dist/client/client/abs.json` | asset `abs.json` in `dist/client` |
| The only workaround for two profiles today: two plugins, `websmith({ profile: "client" })` and `websmith({ profile: "server" })` | both run in **both** environments. The second ignores `code` and reads the file from disk, so `CLIENT_OUT` is lost and both bundles hold `MARK_IN`. `servergen` writes `gen/main.ts.txt` from the client graph, and `serverrp` runs in `client` | each addon runs only in its environment |
| Dev server (`createServer`, `profile: "client"`, `transformRequest` in `client` and `ssr`) | `buildStart` runs for `client` only. `activate` runs once, and `ssr`'s `server.ts` is compiled by `client`'s compiler | one instance per environment; dev specifics are Dev server's |
| `build()` with `lib` / with `build.ssr` (no builder) | `this.environment.name` is `client` / `ssr` | the map works for single-environment builds too |
| Profile `module`/`moduleResolution: "NodeNext"`, no `esm`, fixture with no `"type"` in its nearest `package.json` (`packages/vite-test/package.json`) | **builds without a diagnostic**. The chunk holds `Object.defineProperty(exports, "__esModule", …)` and `require("./shared.js")` | a configuration error: Vite cannot bundle CommonJS (plan, Pipeline position and output) |
| The same with a `package.json` `{"type":"module"}` in the fixture | ESM output, builds | the same (guard) |
| The same profile with `esm: { runtime: "bundler", check: "error" }` | fails with core's `ESM91032: file loaded as ES module whose output is CommonJS; …` | the same: one error, core's |

Three more cases reproduce #198's follow-ups (a profile `app` with `depends: ["dep"]`, where `dep` has the result
processor `serverrp`, and two `build()` calls on the same plugin object):

| Case | Result today |
|------|--------------|
| `dep`'s result processor | **twice per module, plus once in `buildEnd`**. It runs with `["main.ts"]` and `["shared.ts"]` from the dependent-profile loop (`ModuleCompiler.ts:435-439`). It also runs once in `buildEnd` with `app`'s output files, because `app` inherits `dep`'s addons (`Compiler.ts:404-412`; `activate serverrp` is logged for both a `CompilationContext` and a `ViteAddonContext`) |
| The host profile's own output | `tsc-app/{main,shared}.js(.map)` are written to disk during `vite build` (`ModuleCompiler.ts:453-455`, `emitSourceFile(…, true)` under "do not write the file") |
| `dep-out/shared.js` overwritten by another writer between the two builds, with the source unchanged | **stays overwritten**. The second build skips the write, because its last hash matches and the file exists (`write-record.ts:29`) |

Module entries that leave the graph are never pruned: `outputFiles` (`hooks.ts:95`) is only `set` (`:160-163`), and
`AddonOutputs.entries` (`addon-outputs.ts:41`) only loses a module in `startModule` (`:88-90`). This was verified by
reading the code. Both maps are read only for the ids in `this.getModuleIds()`, so they waste memory but do not
cause wrong output.

### What to build

All work is in `packages/vite` and `packages/vite-test`, plus the docs in item 6. No core change. Every module in
`packages/vite/src` except `plugin.ts` imports `vite` with `import type` only, so Jest can load it.

**1. `profile` per environment** (`options.ts`).

- `WebsmithViteOptions.profile?: string | Record<string, string>`. Its doc comment says that a string applies to
  every Vite environment, and a map selects the profile by environment name, e.g. `{ client: "client", ssr: "server"
  }`.
- Remove `"profile"` from `PASS_THROUGH_KEYS` (`:35`).
- Add an `environmentName: string` parameter to `resolveViteOptions(options, root, create)`. It sets
  `loaderOptions.profile` to the selected profile:
  - for a string, the string;
  - for a map, `map[environmentName]` when `Object.hasOwn` finds it.
- New `selectProfile(profile, environmentName): { profile?: string; error?: ts.Diagnostic }`. A map without the
  environment returns this `ErrorMessage`, keys in map order:

  ```
  The websmith plugin's 'profile' map names no profile for the Vite environment '<name>'. It names: client, server.
  ```
- An empty map is a map without any environment, and it names none.

**2. One state per environment** (`hooks.ts`). This is the core of the slice.

- Gather the per-instance state into `type EnvironmentState`:
  - `resolved` and `filter`;
  - `compiler`;
  - its own `DiagnosticReporter` and `AddonOutputs`;
  - `outputFiles`, `raisedKeys` and `warnedKeys`;
  - the profile selection error.

  `createWebsmithHooks` keeps `const environments = new Map<string, EnvironmentState>()`, keyed by
  `this.environment.name`.
- **`HookContext`** adds `environment: EnvironmentInfo`, where `type EnvironmentInfo = { name: string; config: {
  root: string; command: "build" | "serve"; build: { outDir: string } } }`.
  - Declare it as that narrow type; do not `Pick` it from `Rollup.PluginContext`. Vite's `Environment` is assignable
    to it, and the spec stubs stay small.
  - Every existing stub in `hooks.spec.ts` needs an `environment`. Add a helper that creates one.
- **`configResolved`** keeps only what all environments share: `root`, `command` and the module id filter of
  `include`/`exclude`. It no longer resolves the loader options or configures `outputs`.
- **`getEnvironmentState(context)`** returns the state of `context.environment.name`, creating it on first use:
  - resolve the options with item 1 against `environment.config.root`;
  - `outputs.configure({ outDir: path.resolve(environment.config.root, environment.config.build.outDir), command })`;
  - create the compiler through `createCompiler(loaderOptions, reporter, outputs)`, inside
    `outputs.runActivation(context, …)`, as `buildStart` does today.

  Do not create a compiler for an environment whose profile selection failed.
- **`buildStart`** works on `getEnvironmentState(this)`. The refresh path (`:126-133`) and the config-error raise
  (`:141-150`) stay, per environment.
  - In build mode, a profile selection error is raised with the configuration errors: `this.error` in that
    environment's `buildStart`, once. Another environment's build is unaffected.
  - In serve mode, nothing is raised in `buildStart`, as today.
- **`transformHandler`** calls `getEnvironmentState(this)`. This creates the state lazily for an environment without
  a `buildStart`, the dev server's `ssr` (point 2 above).
  - For an environment whose selection failed, `this.error` the selection error on its modules, in serve mode too.
    Never compile with another environment's profile. The logger output at server start stays the Dev server
    slice's.
  - Otherwise unchanged, with the state's compiler, reporter and outputs.
- **`buildEnd`** and **`generateBundle`** work on `getEnvironmentState(this)`. Result processors run once per
  environment, with that environment's `getModuleIds()`. That is the plan's "result processors once per
  environment" for real; #198 delivered it per plugin instance.
- **Do not set `sharedDuringBuild`** and do not use `applyToEnvironment`/`perEnvironmentPlugin`/`perEnvironmentState`
  (see Settled decisions).

**3. CommonJS from `node16`/`nodenext` is a per-module configuration error** (#193 follow-up, assigned here by the
#198 brief; `config-errors.ts`).

- New `checkModuleFormat(profile, fileName, tsConfig, hasEsm, system)`, returning `{ error?: ts.Diagnostic;
  packageJson?: string }`.
  - It returns nothing when `hasEsm` is set: core's ESM check then reports ESM91032 (reproduced), and the plugin must
    not report the case twice. This is the same rule as `checkTargetModule`.
  - It returns nothing unless the effective `module` is `ts.ModuleKind.Node16` … `ts.ModuleKind.NodeNext`. Compare
    the numeric range: TypeScript 5.8+ adds `Node18`/`Node20` inside it, and 5.7.3 has neither.
  - Otherwise it asks `ts.getImpliedNodeFormatForFile(fileName, cache, system, tsConfig)`. For
    `ts.ModuleKind.CommonJS`, it returns an `ErrorMessage` with the module's `file`:

    ```
    Profile '<name>' emits CommonJS for '<file>' ('tsConfig.module' is 'nodenext' and the nearest package.json '<path>' has no "type": "module"), which Vite cannot bundle as an ES module. Set "type": "module", use the .mts extension, or use "ESNext".
    ```

    For a `.cts` file, the cause is the extension, and the message says so. Use the default-profile wording of
    `checkTargetModule` (`:34`) when no profile is set.
  - `packageJson` is the nearest `package.json`, found by walking up with `system.fileExists`. A `.cts` file has
    none, and the message omits it.
- Keep one `PackageJsonInfoCache` per environment state, from
  `ts.createModuleResolutionCache(…).getPackageJsonInfoCache()`. `buildStart` clears it, so a watch rebuild sees an
  edited `"type"`.
- In `transformHandler`, run the check **before** `build`:
  - on an error, `this.addWatchFile(packageJson)` and `this.error(toRollupError([error]))`, without compiling, so no
    generator runs on output Vite rejects;
  - on no error with a `packageJson`, also `addWatchFile` it.

  Read `hasEsm` and `tsConfig` as `checkProfileModule` (`hooks.ts:70-76`) does.
- `checkTargetModule` stays as it is; it still rejects `commonjs`/`amd`/`umd`/`system` per profile.

**4. Prune modules that left the graph, in build mode** (#198 follow-up; these are the maps item 2 moves into the
state).

- New `AddonOutputs.retainModules(ids: ReadonlySet<string>)` drops the entries of module ids not in `ids`. It keeps
  `\0activation` and `\0build`.
- In `buildEnd`, for a build without `error` in build mode, drop the `outputFiles` and `outputs` entries of ids not in
  `this.getModuleIds()`. Do this after the result processors ran.
- A failed build prunes nothing, because its graph may be partial. Serve mode prunes nothing; that is Dev
  invalidation's (see Not in this slice).

**5. JSDoc of `websmith()`** (`plugin.ts:13-44`): add the environment rules (string or map, unnamed environment,
one instance per environment, `build.outDir` per environment, `node16`/`nodenext` per module).

**6. Docs.**

- **`packages/vite/README.md`:** add an "Environments" section before "Addon context":
  - `profile` as a string or a map, with the Magellan-shaped example `{ client: "client", ssr: "server" }` and a
    `builder`/`environments` config;
  - an environment the map does not name fails that environment's build and names it;
  - each environment has its own compiler. Addons activate once per environment, result processors run once per
    environment, and paths of `addVirtualFile`/`removeOutputFile` are relative to **that environment's**
    `build.outDir`;
  - a `node16`/`nodenext` profile needs `"type": "module"` or `.mts` for every module Vite bundles.

  In "Addon context", change "Result processors … run once per `vite build`" to "once per environment of a `vite
  build`". Keep the last line ("The options, … follow with the plugin's release"), minus "environments".
- **`Release-Notes.md`:** under `## [Unreleased]` → `### Added`, add one bullet after the existing one, e.g.
  "The Vite plugin (`@quatico/websmith-vite`, not yet published) selects a websmith profile per Vite environment:
  `profile` takes a profile name or a map from environment name to profile, e.g. `{ client: "client", ssr: "server"
  }`, and each environment compiles with its own compiler and addons." Release writes the package's own entry and may
  merge it. Keep yours to that one bullet.

### Done when

The slice line is the specification. It asks for:

- "one compiler instance per Vite environment";
- "`profile` as string or environment-name map";
- "unnamed environment as a configuration error";
- "unit tests for instance keying and profile selection";
- "e2e: a Magellan-shaped fixture (client transform profile, server generator profile) in a `vite build` with an SSR
  environment, each addon running only in its environment".

Plus items 3 and 4, folded in from the follow-ups.

Write each red first, and run each new e2e test on `c2622c3f` before the fix to prove it fails. Cases marked
**guard** already pass on `develop` (reproduced); keep them as guards and say so in the PR.

**E2E**, in a new `packages/vite-test/tests/vite-environments.test.ts`:

- In `tests/vite-project.ts`, add `runViteApp({ vite, pluginOptions, environments, builder?, extraPlugins? })`.
  - It runs `createBuilder({ root, configFile: false, logLevel: "warn", plugins: [plugin], builder, environments,
    build: { write: false, minify: false } })` with **one** plugin object, then `builder.build(env)` for each
    environment in order.
  - It returns, per environment name, `{ code, assets, error }`, as `runVite` does.
  - Keep `runVite`/`runViteWatch` and their callers unchanged.
- Name the tests "should …". Run every case on `vite` and `vite6` (`it.each(VITES)`).
- The fixture is the one under "Current behaviour":
  - `client` input `src/main.ts` with `preserveEntrySignatures: "strict"`, which keeps the client chunk from
    tree-shaking to empty;
  - `ssr` with `build.ssr: "src/server.ts"`;
  - the addons log to a file in the project, not through `console`.

Cases:

- **Magellan-shaped build** (red; today both environments fail with `[object Object]`).
  `profile: { client: "client", ssr: "server" }`. Expect:
  - the client chunk contains `CLIENT_OUT`, and the SSR chunk contains `MARK_IN` and not `CLIENT_OUT`;
  - `gen/server.ts.txt` and `gen/shared.ts.txt` exist, and `gen/main.ts.txt` does not;
  - the log shows `clientx` only for `main.ts`/`shared.ts`, `servergen` only for `server.ts`/`shared.ts`, and
    `serverrp` exactly once, with `server.js` among its files.
- **String profile, one instance per environment** (red; today 1 activation). `profile: "client"` compiles both
  environments with `client` (both chunks `CLIENT_OUT`), and `activate clientx` is logged exactly twice.
- **Unnamed environment** (red). `profile: { client: "client" }`. Expect:
  - `client` builds;
  - `ssr` fails, and the message contains `'ssr'` and `It names: client` and not `[object Object]`;
  - the message occurs once.
- **`build.outDir` per environment, inline config** (red; today `outside build.outDir '…/dist/server'`). A `client`
  generator adds `ctx.resolvePath("dist/client/abs.json")`, and `client`'s assets contain `abs.json`.
- **`build.outDir` per environment, shared builder** (red; today `client/abs.json`). The same with
  `builder: { sharedConfigBuild: true, sharedPlugins: true }`: the asset's `fileName` is `abs.json`.
- **Map in a single-environment build** (red). `runVite` (lib build, environment `client`) with
  `profile: { client: "app" }` bundles `MARK_OUT`.
- **`nodenext` without `"type": "module"`** (red; today it bundles `require`). `runVite`, a profile with
  `module`/`moduleResolution: "NodeNext"` and no `esm`. The build fails, and the message names `src/main.ts`,
  `CommonJS` and `"type": "module"`.
- **`nodenext` with a `.mts` entry** (guard). The same profile, `lib.entry: "src/main.mts"`, builds.
- **`nodenext` with `esm`** (guard). With `esm: { runtime: "bundler", check: "error" }`, the error contains
  `ESM91032` and not the plugin's own message.

Do not test `vite build --app` with a config file in e2e; it already gives one plugin object per environment
(reproduced).

**Flakiness:** run `vite-environments.test.ts` 5 times in a row (`pnpm --filter websmith-vite-test exec jest
tests/vite-environments.test.ts --runInBand`), and report "5/5 green, N tests each" in the PR.

**Unit**, in `packages/vite/src/*.spec.ts`, assemble / act / assert with one blank line between the parts and no
comments marking them. The object under test is `testObj`, its outcome `actual`. Every test creates its own `testObj`;
no `let testObj` with `beforeEach`.

- `options.spec.ts`:
  - `selectProfile` with a string, with a map that names the environment, with a map that does not (the error text),
    with an empty map, and with no profile;
  - `resolveViteOptions` puts the selected profile into `loaderOptions.profile` and never the map.
- `hooks.spec.ts`, with stub contexts for the environments `client` and `ssr`:
  - two environments get two compilers, with their own profiles (`createCompiler` called twice, with the profile of
    each);
  - a second `buildStart` of the same environment refreshes its compiler and does not create one;
  - a `transform` in an environment without `buildStart` creates its compiler;
  - an unnamed environment raises its error in `buildStart` in build mode, once, and the other environment builds;
  - an unnamed environment raises its error in `transform` in serve mode and does not call `createCompiler`;
  - `outputs` gets `outDir` from `environment.config`, not from `configResolved`;
  - `buildEnd` runs the result processors of that environment's compiler only;
  - `buildEnd` prunes the output files of ids no longer in `getModuleIds()`, and not after an error;
  - `transform` raises the `nodenext` error before `build`, and watches the `package.json`.
- `config-errors.spec.ts`, over the in-memory system from `createSystem` (`packages/core/src/environment`):
  `checkModuleFormat` for
  - `nodenext` with no `"type"` (error);
  - `"type": "module"` (none);
  - `.mts` (none);
  - `.cts` (error, extension cause);
  - `ESNext` (none);
  - `hasEsm` (none);
  - `node16` (error).
- `addon-outputs.spec.ts`: `retainModules` keeps the activation and build entries, and the given ids.

**Also:**

- **New files carry the MIT header** (`pnpm license:add`). Do not add them to the `license:check` list.
- **No `console`** anywhere in `packages/vite/src`. Everything goes through the reporter or `this.warn`/`this.error`.
- **`import type` only** for `vite` in every Jest-loaded module. `plugin.ts` is the only value import (`createFilter`).
- **No `@quatico/websmith-core` import in addon code.** The e2e addons are plain CommonJS `addon.js` files that use
  only the `ctx` they are given and `fs`/`path`. `packages/vite` itself is a host and imports core, as it does today.
- **Gates, all green:** `pnpm lint`, `pnpm build --skip-nx-cache`, `pnpm test --skip-nx-cache` and
  `pnpm test:e2e --skip-nx-cache`. The shared `.nx-cache` replays outputs from other worktrees, so skip it.
  - Run the Vite e2e once under Node 24 (`$HOME/.nvm/versions/node/v24.21.0/bin/node`) and say so in the PR.

### Settled decisions — do not re-derive them

- **Next slice is "Environments".** Plan `## Slices` order, #198 merged, no `waits:`.
- **The key is `this.environment.name`, in a `Map` inside `createWebsmithHooks`.** It works in all four shapes
  reproduced above: one object per environment, one object with inline config, a shared builder, and the dev server.
  - **Rejected: `perEnvironmentState` and `perEnvironmentPlugin`.** They are Vite value imports, so `hooks.ts` would
    no longer load in Jest. They also do not cover `configResolved`, and `hooks.ts` already holds state that needs
    no Vite helper.
  - **Rejected: `sharedDuringBuild: true`.** The map makes the plugin correct whether Vite shares the object or not,
    and setting the flag would change Vite's behaviour for users who do not share.
- **Per-environment values come from `this.environment.config`, never from `configResolved`.** This resolves the
  plan's "`configResolved` once per environment" (contradiction 1). `configResolved` keeps the shared `root`,
  `command` and filter.
- **The state is created on the first `buildStart` or `transform` of its environment.** This resolves contradiction
  2: the dev server runs no `buildStart` for `ssr`.
- **An environment the map does not name is a configuration error of that environment only.**
  - In build mode it is raised once, in its `buildStart`, and the other environments build.
  - In serve mode its modules fail in `transform`, because compiling with another profile would be silent.
  - The logger message at dev-server start is Dev server's.
- **Each environment has its own reporter, `AddonOutputs`, write record and `outputFiles`.** Nothing is shared
  between `client` and `ssr` (plan, Environments).
- **`node16`/`nodenext` CommonJS is reported per module by the host, before `build`, and only without `esm`.** The
  profile-level `checkTargetModule` stays. Core is not changed: core's ESM check already covers profiles with `esm`.
- **Pruning is build mode only, after a successful build.**

### Repo mechanics

- **Worktree setup.** pnpm 10.34.1 refuses frozen installs in this repo, so use the corepack-cached 10.8.0 through a
  shim:

  ```sh
  mkdir -p /tmp/pnpm-shim && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > /tmp/pnpm-shim/pnpm && chmod +x /tmp/pnpm-shim/pnpm
  export PATH=/tmp/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline && pnpm build --skip-nx-cache
  ```

  No dependency is added: `vite` 7.3.7 and `vite6` 6.4.4 are already in `packages/vite-test`, and both export
  `createBuilder`. Never edit `pnpm-lock.yaml`, `~/.npmrc` or the root `package.json`.
- **Merges:** use `git -c rerere.enabled=false merge …` if you need `develop` in your branch.
- **Reproducing by hand:** write a fixture under `packages/vite-test/test-output-<name>` (git-ignored; bare `vite`,
  `vite6` and `@quatico/websmith-vite` imports resolve from there), and remove it afterwards with `trash`.
  - Never leave a `package.json` in a fixture. A leftover one under `packages/**` joins the workspace, and the next
    `pnpm install` adds it to `pnpm-lock.yaml`. If that happens, `git checkout -- pnpm-lock.yaml`; never commit it.
  - For the `"type": "module"` guard, write the `package.json` inside the test's project dir and let
    `removeProject` delete it. Jest never runs `pnpm install`.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). A suggested split:
  - `F Selects the websmith profile per Vite environment` (options, `selectProfile`);
  - `F Keeps one websmith compiler per Vite environment` (state map, `outDir` per environment);
  - `B Rejects CommonJS output of node16 and nodenext modules in the Vite plugin`;
  - `r Drops output entries of modules that left the Vite graph`;
  - `d Documents Vite environments`;
  - `t Covers Vite environments end to end`.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Its title comes from the wave heading, "Environments".
- Append `→ #<number>` to the `feature/vite-plugin-environments` line in `docs/plans/2026-10-01-vite-plugin.md`
  `## Slices`, and commit that on this branch. Change nothing else in the plan; its three contradictions with Vite go
  into the PR body, under the heading "Plan vs. Vite".

### Scope guard

This branch owns:

- `packages/vite/**` and `packages/vite-test/**`;
- one bullet in `Release-Notes.md` `### Added`, and the `→ #<PR>` line in the plan.

Do not touch:

- `packages/core/**` (no core change is needed; #200 is editing `Compiler.ts`);
- `packages/api/**`: the `AddonContext` docs already describe the Vite host, and environments do not change a
  method;
- `packages/webpack/**`, `packages/webpack-test/**`, `packages/compiler/**`;
- `.github/**`, the root `README.md`, the root `package.json` and `pnpm-lock.yaml`.

Concurrent work, checked against `c2622c3f`:

- **#200 `bug/typescript-6-root-dir-once`** (open) edits `packages/core/src/compiler/Compiler.ts`, core specs and
  webpack tests. There is no overlap. If its new TS5011 surfaces in your e2e on TypeScript 6, your fixtures already set
  `rootDir: ./src`.
- **#185/#186/#195 (Dependabot, open)** edit manifests and the lockfile. If one merges first, rebase and take
  `develop`'s lockfile; never hand-merge it.

Not in this slice. Each item has an owner; mention any you trip over in the PR, but do not build them. Each one was
verified on `c2622c3f`:

- **The write record skips a write after another writer changed the file** (#198 follow-up, `write-record.ts:29`).
  - Reproduced: overwrite `dep-out/shared.js` between two builds of one plugin object, and the second build leaves
    it overwritten.
  - Owner: `feature/vite-plugin-dev-invalidation`. It owns the record's change-cycle reset, and the plan says it
    "extends it and does not replace it". The fix belongs with the reset, e.g. comparing the file's current text or
    mtime with the record.
- **Module entries are pruned only in build mode** (item 4). The dev server's module graph and its long sessions
  belong to `feature/vite-plugin-dev-invalidation`, which drops instances and owns invalidation.
- **The dev server's configuration errors** (the logger at `buildStart`, the overlay), including an unnamed
  environment's: `feature/vite-plugin-dev-server`. This slice raises the error in `transform` only.
- **A dependent profile's result processor runs per module, plus once more in the target's `buildEnd`** (#198
  follow-up; `ModuleCompiler.ts:435-439` under its `TODO`, and `Compiler.ts:404-412`, where a profile inherits its
  dependencies' addons).
  - Reproduced: `serverrp` ran with `["main.ts"]`, `["shared.ts"]` and once with `app`'s four output files, per
    build.
  - This is core behaviour shared with the webpack loader, so no slice of this plan may change it.
  - Owner: `docs/vite-plugin-release`, which lists it as a known limit in `packages/vite/README.md`. The fix is a
    separate loader+core issue; propose it in the PR.
- **The host profile writes its own output to disk** (#198 follow-up; `ModuleCompiler.ts:453-455`). Reproduced:
  `tsc-app/*.js(.map)` exist after `vite build`, and with two environments, each profile's `outDir` is written.
  - Shared with the loader.
  - Owner: `docs/vite-plugin-release`, as a documented known limit. The fix is the same separate issue.
- **Vite 7 on exactly Node 22.12.0 is untested** (#182 follow-up), although `packages/vite/package.json:9` sets
  `"node": ">=22.12"`. `~/.nvm/versions/node/` has 22.14.0 and 22.17.0, not 22.12.0. Owner: `docs/vite-plugin-release`,
  with the publish configuration. Do not install Node versions.
- **The context factory can wrap the old profile after a config edit under `--watch`** (#198 known limit:
  `updateLoaderConfig` recreates the contexts at `ModuleCompiler.ts:286`, before it reassigns `this.profile` at
  `:289`).
  - With this slice, the profile comes from the plugin's option per environment, not from the config. A config
    edit changes it only if `websmith.config.json` sets a top-level `profile`.
  - Owner: `feature/vite-plugin-dev-invalidation`, whose "instance dropped, options re-resolved" removes the reuse.
- **`vite dev` with `transpileOnly`, serving virtual files, result processors per transform:**
  `feature/vite-plugin-dev-server`.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside scope. Check:

- whether a custom `builder.buildApp` that builds environments with `Promise.all` interleaves two environments'
  `transform`s. The state map is safe as long as `build()` stays synchronous; say so in the PR if you see otherwise;
- whether Vite 6.3.0, the lowest version in the peer range, has `this.environment` in `buildEnd` and
  `generateBundle`. Only 6.4.4 and 7.3.7 were checked here; do not add a dependency to test it.
