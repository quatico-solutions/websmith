<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Downstream webpack user

Executed: nothing was built or run. Read only: the plan (`origin/idea/loader-options-once`), `origin/develop` sources
(`compiler-instances.ts`, `webpack-hooks.ts`, `loader.ts`, `TsCompiler.ts`, `Compiler.ts`, `loader-options.ts`) and the
qs-magellan starter `node/packages/starter/templates/react-typescript-webpack` (`webpack.config.mjs`,
`websmith.config.json`, `tsconfig.json`). The reference user: `websmith-loader` 0.9.0 for `src/services` and
`magellan-client` only, options `debug`, `tsConfigFile`, `configFile`, `profile: "client"`, run beside `ts-loader` under
webpack-dev-server with `watchFiles: ["src/**/*", "static/**/*"]`, and a `server` profile that no profile `depends` on.

## Findings that would change the plan

1. **The `tsconfig.json` re-resolve trigger does not fire for this user.** Slice 1 re-resolves on a `tsconfig.json` in
   `compiler.modifiedFiles`. `modifiedFiles` holds only files webpack watches. On develop the loader never registers
   `tsconfig.json` as a file dependency (no hit in `packages/webpack/src` outside option plumbing), and the starter's
   `watchFiles` globs do not cover it. Today an edit to `tsconfig.json` is picked up at the next module build, because
   every module re-resolves (`compiler-instances.ts:44`). After the change it is never picked up until the dev server is
   restarted. That is a regression for the dev-server flow, and the plan lists it as a trigger without saying who watches
   the file. Required: slice 1 registers `tsConfigFile` (and, per the open point, its `extends` chain) as a file or missing
   dependency in `afterCompile`, as it already does for the config file (`webpack-hooks.ts:122-125`), and an e2e case edits
   `tsconfig.json` in watch mode.
2. **The per-module `setOptions` also clears the baseline emit and transpile caches** (`Compiler.ts:318-321`:
   `baselineTranspileCache`, `baselineEmitCache`, `baselineEmitCacheFileTimes`, `reportedWatchDiagnostics`,
   `rootFilesCacheInvalidated`), not only `packageJsonInfoCache`. The plan names only the latter as "masked stale state".
   Once options resolve once, those caches live across modules and across dev-server rebuilds; a stale baseline emit would
   serve old output for a changed module or a changed dependency. The plan must list each cache `setOptions` clears, say
   whether it is keyed safely (mtime, text) or must move to the per-compilation reset, and add an e2e case: edit a
   dependency of a transformed module under watch and assert the output changes.
3. **The addon registry is refreshed per module today** (`.refresh()` at `Compiler.ts:333-338`, then
   `setupWebpackAddonService`). Magellan's `client-function-transform` and the generator addons run inside that registry.
   Anything an addon keeps in module-level or instance state was reset per module and will now live for the whole build or
   dev-server session. The plan treats this as pure overhead. Required: state in the slice that addon instances are now
   reused across modules and rebuilds, and say in `packages/api` docs/README that addons must not rely on per-module
   re-activation. Check qs-magellan's `magellan-addons` for such state before approval.
4. **Slice 4 changes dev-server error output for users with a typo'd profile.** Today the build fails with a raw
   `Module build failed` per module; after it, one config error. That is an improvement, but the message must name the
   `websmith.config.json` and the available profiles, because the starter passes `profile: "client"` from `webpack.config.mjs`
   and the error appears in the browser overlay.
5. **Slice 5 (dependent-profile diagnostics) newly fails builds that pass today.** A project whose dependent profile has a
   declaration-emit error compiles clean today and will fail after. The plan lists it under Changelog but not as a
   behaviour break to call out in `Release-Notes.md` (0.10.0 already made errors fail builds; this is a second tightening).
   qs-magellan itself is unaffected (no `depends` in the starter), but Magellan projects that add one would see it.
6. **Slice 7 (cached builds)** matters to the CLI bundle, not the dev-server, and is correctly gated on a reproduction.

## Approach (downstream lens)

- The cost claim is real on develop: `getCompilerInstance` calls `updateLoaderConfig` per module (`compiler-instances.ts:44`)
  and the `NormalModule` `loader` tap re-reads and re-parses the config file per module (`webpack-hooks.ts:163-182`). A
  starter-sized project (tens of modules) gains little; the 150-300 ms per module bites in the Magellan CLI bundle and large
  apps. Say so in the changelog instead of "about 150-300 ms per module" without a baseline.
- The `loader` tap also silently tolerated an invalid config (`console.warn`, return). After removal, an edit that breaks
  `websmith.config.json` under watch must still produce a visible error and recover on the next fix. Add that e2e case
  (break, assert error, fix, assert clean) to slice 1; the plan only tests "edit and see the change".
- Dev-server (`webpack-dev-server`) calls `watchRun` through `compiler.watch`; `modifiedFiles` is set there, so the
  config-file trigger works. Thread-loader users have no such hook; the mtime fallback is acceptable but the `extends`
  gap should be accepted and documented rather than left open.

## Slices

- Order is sound: slice 1 is the root and unblocks 3 to 5. Slice 1 is the largest and highest-risk (cache semantics,
  re-resolve triggers, benchmark fix); consider splitting the benchmark watchdog fix into its own preceding PR so the
  gate numbers exist before the change.
- Slices 2 to 5 are each one reviewable PR. Slice 4 bundles the `depends` closure unification with the validation; that
  refactor of three copies is a separable, behaviour-neutral PR and would review faster.
- Slice 6 changes when downstream modules rebuild; its e2e (flip `"type"` rebuilds, `"version"` edit does not) would fail
  before the change, which is good. It must also assert that a project WITHOUT node16/nodenext sees no new dependency.
- E2E coverage: the existing watch harness (`webpack-esm-check.test.ts:157`) runs the loader alone. No existing test
  runs the loader next to `ts-loader` with a `tsConfigFile` option and an addon profile as the starter does. One e2e that
  mirrors the starter (loader scoped by `include`, `ts-loader` for the rest, edit a file under watch) would catch findings
  1 to 3; the per-slice cases as written would not.

## Overlap

No duplicate of the other five plans found by reading the plan. Slice 3 and 4 touch config error reporting and share
the #131 format with `cli-error-exit-gaps`; ensure that plan does not also change `reportedConfigErrors`
(`webpack-hooks.ts:19`). No overlap with the TypeScript 7 story that I could identify; the `Compiler.ts` cache fields
touched in slice 1 are ones a TS 7 rearchitecture would also rework, so land slice 1 first.

## Open points

- `extends` chain: accept for thread-loader only; for the compiler path, register the chain as dependencies.
- Gate: the proposed 80% drop on 1000 modules is fine; add that a 20-module starter-shaped build is not slower.
- `convertEnumOptions`: move into `resolveCompilerOptions` so the CLI and loader share it.
- `needBuild`: decide by a spike before approval; the fallback stamp file should be the documented default if the hook
  cannot invalidate a valid snapshot.
- Item 8 mechanism: prefer the loader-independent plugin only if it is auto-registered; a plugin users must add breaks
  the "just a loader" contract of the starter.

Verdict: amend
