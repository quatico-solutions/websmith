<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# TypeScript 5.7 to 6.0 compiler semantics

Judged: the plan, not the strategy choice (A + 7.1 spike, decided by Jan Wloka).

Executed: a scratch dir with `typescript` 5.7.3 and 6.0.3 side by side (npm aliases, clean npmrc), probing
`transpileModule`, `parseJsonConfigFileContent` and the `tsc` binaries on tiny projects. Not executed: the repo build,
`pnpm test`, `pnpm test:e2e` (the plan's counts are taken as given). Everything else below is code read on `origin/develop`.

## Findings that change the plan

1. **Slice 1 repo tsconfig fix is under-specified and, as worded, breaks 5.7.** The root `tsconfig.json` has
   `module: ESNEXT` (line 5) and `moduleResolution: "node"` (line 48); every package extends it and overrides only
   `module`. "node16 with module node16, or omitting it" does not work at the root: omitted with `module: esnext` is
   `classic` on 5.7. `bundler` is valid at the root on both, but is inherited by the CommonJS packages
   (`api`, `core`, `testing`, `compiler`, `node`, `webpack`) and 5.7.3 rejects it there (TS5095, executed).
   What I verified works on 5.7.3 and 6.0.3: root `bundler`; in each CommonJS package `"moduleResolution": null`
   (resets the inherited value; resolves to node10 on 5.7 and bundler on 6.0, no error either side; executed).
   Name this in the slice, because `node16` + `module: node16` would also change the module the package emits.
   Each package `tsconfig.json` also needs `rootDir: "./src"` (executed: 6.0.3 gives TS5011 without it; 5.7.3 is
   unaffected); all `include` only `src/**`, so that is safe.

2. **Row 14 is mis-stated, and the real hit is narrower.** 6.0 does not default `module` to `esnext` unconditionally.
   Executed: with `target` ES5 and `module` unset, 6.0.3 still emits CommonJS (as 5.7.3); with `target` unset it
   emits ESM (5.7.3: CommonJS, because its default target is ES5). So `getEmittedModuleKind`'s rule
   (`check-esm.ts:99-100`, ES2015+ means ES2015, else CommonJS) is still correct for an explicit target. The only wrong
   branch is the fallback `target ?? ES5`. The fix is one expression: fall back to
   `ts.getDefaultCompilerOptions().target` (5.7: ES5, 6.0: ES2025, so 5.7 behaviour is identical, no version branch).
   It matters only once #135 stops spreading `getDefaultCompilerOptions()` into `tsDefaults` (`defaults.ts:10`),
   which today hides the gap. Same expression fixes the `?? "ES5"` in the message at `Compiler.ts:802`.
   `SCRIPT_TARGETS` (`check-esm.ts:84-88`) is built from `Object.entries(ts.ScriptTarget)` and is fine on both.

3. **Missing: `ModuleKind.Node18` / `Node20` are not treated as node module formats.** `Compiler.ts:933` and `:1395`
   test only `Node16`/`NodeNext`. Executed on 6.0.3: `Node20` is 102, `Node18` is 101; `transpileModule` emits CommonJS
   for them without package.json awareness, the exact bug `transpileNodeModule` was written to avoid. Plan slice 2 adds
   these kinds only to the API option types. A 6.x user following the 6.0 advice (`module: node20`) gets silently wrong
   emit and no package.json watch in `transpileOnly`/loader mode. Add to slice 2: both sites accept
   `ModuleKind.Node18`/`Node20` when present (`ts.ModuleKind.Node20 !== undefined`, since 5.7 lacks them), plus a
   unit test and an e2e case under `packages/webpack-test` on the 6.x leg. `getImpliedNodeFormat` (`Compiler.ts:1482`)
   should be checked at the same time. On 5.7.3 `module: "node20"` is rejected by the option parser, so no 5.x change.

4. **Missing: the e2e fixtures use `target: ES5` widely, not only `Node10`.** `compile-websmith.test.ts` lines 117, 139,
   167, 176, 209, 230, 515; `compile-tsc.test.ts:60`; `webpack-tsc.test.ts:96,103,113,120`. ES5 is TS5107 on 6.0.3
   (executed). Row 11 lists only `Node10`; slice 2 says "fixtures off Node10". These cases compare against `tsc` output,
   so moving them off ES5 changes the expected downlevel output and cannot be a mechanical edit. Name `target: ES5` in
   row 11 and in slice 2, and decide: switch the fixtures to ES2015+ (then 5.7 expectations change too) or give them a
   per-major helper. Also the fixture tsconfigs with `outDir` and no `rootDir` will hit TS5011 on 6.x (websmith matches
   `tsc` there; the 6.0 default `rootDir` is the config directory, so output layout under `outDir` changes for users:
   add one e2e that asserts websmith's output paths equal `tsc` 6.0.3's for a project with `src/`).

5. **`--ignoreConfig` must be chosen from the `tsc` that is spawned, not from the imported `ts.version`.** Executed:
   5.7.3 rejects it (TS5023 unknown option); 6.0.3 requires it with file arguments next to a `tsconfig.json` (TS5112).
   `websmith-node` runs the binary `findTsc()` returns (`packages/node/src/websmith/Compiler.ts:55`), which can be a
   different install than the `typescript` the package imports. Keying on `ts.version` can pass `--ignoreConfig` to a
   5.x binary and fail. Read the found binary's version (its `package.json` or `tsc --version`). Slice 3 should say this
   and test the mixed case (6.x imported, 5.x binary, and the reverse).

6. **Missing: websmith-node's reverse enum lookup.** `packages/node/src/compiler-options.ts:31-33` renders `target` with
   `ts.ScriptTarget[value]`; on 6.0.3 `ts.ScriptTarget[12]` is `"LatestStandard"` (executed), which then reaches `tsc`
   as `--target LatestStandard`, an invalid value. Row 10 covers only `core/.../parsed-command-line.ts:155-174`.
   Add `12` here (only reachable when the user sets ES2025 explicitly, or after the default is no longer overridden).
   `Compiler.ts:802` has the same exposure (finding 2). One shared target-name helper for core and node is cleaner than
   three tables, but node must not import core (separate package), so duplicate the entries deliberately.

7. **`ignoreDeprecations` is version-valued.** Executed: `"6.0"` is TS5103 on 5.7.3; 5.7 only accepts `"5.0"`.
   The typed option in `packages/api` should be `"5.0" | "6.0"`, documented as per-major. The plan's decision not to use
   it in the repo or fixtures is right for exactly this reason; say so in the Changelog line, so nobody adds it to a
   shared fixture. (Users' own `ignoreDeprecations: "6.0"` flows through `parseJsonConfigFileContent` fine, executed.)

8. **Rows 6, 7, 9: a version switch is not needed.** Omitting `moduleResolution` under `module: CommonJS` gives node10 on
   5.7.3 and bundler on 6.0.3 with no diagnostic (executed). That is the plan's per-major pick without the branch, and
   without needing "verify" for bundler+CommonJS on 6.0 (verified: valid on 6.0.3, TS5095 on 5.7.3, so an explicit
   `Bundler` is only possible per major, omission is simpler). Recommend omission for all three sites. Row 7
   also changes `target: ES5` to something else (`ES2020`, as `AddonRegistry.ts:600` uses), which changes the addon
   emit in the testing environment on 5.x too; the unit tests there should assert behaviour, not ES5 output.

## Per-row check of what really hits websmith (verified by probe unless marked read)

| Hit | Real on 6.0.3 | Slice fix keeps 5.7 identical |
|---|---|---|
| TS5107 for `moduleResolution` node10/classic, `target` ES5, `esModuleInterop: false` | yes (executed, `transpileModule` reports 5107 for all) | yes if options are omitted, see finding 8 |
| TS5011 `rootDir` | yes, for tsconfigs with `outDir` and no `rootDir` (executed) | yes, `rootDir` is valid on 5.7 |
| default `target` 12 (ES2025) vs 1 | yes (executed) | yes if #135 removes the pin and tests compare with `getDefaultCompilerOptions()` |
| `module` default | only with `target` unset (finding 2) | yes with the one-expression fix |
| TS5112 | yes (executed) | yes if keyed on the spawned binary (finding 5) |
| `ScriptTarget[12]` = `LatestStandard` | yes (executed) | yes, add entry 12 |
| `strict` default true, `types: []` default | `strict` yes via `defaults.ts:20`; `types`: repo root sets `types` explicitly (`tsconfig.json:7`), so no repo hit | see below |
| `--outFile`, `ImportsNotUsedAsValues` | not blocking on 6.x, deferred to 7 | correct to leave |
| `downlevelIteration`, `baseUrl`, AMD/UMD/System | `downlevelIteration` yes (repo root); no `baseUrl` or AMD/UMD/System in repo or fixtures (grep) | n/a |

Two 6.0 defaults the plan does not discuss, both harmless to the repo but worth one sentence in Notes:
`types` defaults to `[]` (a user project relying on ambient `@types/*` through websmith gets what `tsc` 6 gives, no
websmith change; the testing environment sets `types: ["node"]` explicitly at `environment.ts:398`), and the default lib
becomes `lib.es2025.full.d.ts`, resolved from the installed `typescript` through `ts.getDefaultLibFilePath`
(`shared-host.ts:13-14`), so no websmith change.

## Other checks

- **Approach (7.x guard).** A 7.x `typescript` has no `main` (plan's own claim), so `import ts from "typescript"`
  throws before any `ts.version` check can run. The guard must wrap the first `require("typescript")` in try/catch (or
  read `typescript/package.json` first) at each entry point; the plan says "checks `ts.version`", which cannot work for
  7.x. Name this in slice 4.
- **CLI peer (open point 2).** The CLI marks `typescript` external (`packages/compiler/webpack.config.js:44-46`) so it
  resolves from the install location. With a global or `npx` install, npm resolves the peer to the highest match, 6.0.3,
  so users who never chose a version move to 6.0 defaults silently. Keep the recommendation but record that consequence
  under the Breaking entry, not only for users who already have a project `typescript`.
- **Lower bound (open point 4).** `Node18`/`Node20` and `ES2025` are 6.0-only (executed), 5.x union types should stay
  optional. Floor: recommend `>=5.7 <7`, the version CI actually runs; `5.x` promises 5.0-5.6, which nothing tests.
- **Slice order.** Slice 1 can go first as planned; slice 2 depends on #135 as stated; slice 3 is independent and can go
  in parallel with 1 (note: it needs 6.0.3 only in its e2e). Slice 2 is the largest (options, ESM default, Node18/20,
  fixtures, e2e); with findings 3 and 4 added it should be split: (a) websmith's own compilations plus ESM default,
  (b) Node18/Node20 plus API types plus CLI flag, (c) fixtures/e2e off ES5/Node10. Tests would fail before each change on
  the 6.x leg only; the override-based run in each slice's PR description is the evidence, since the matrix arrives in slice 4.
  Consider moving the CI matrix leg (without the pin move) before slice 2 so its tests are red-before-green in CI.
- **Overlap.** #135 owns rows 4, 5, 10 (as the plan states); finding 6 adds node's own target table, which #135 slice 3
  (`bug/option-enum-tables`) should also cover, otherwise this plan must. Nothing duplicates the ts7 story beyond the
  intended split.
- **Open points to decide before approval:** 1 (pin: recommend 6.0.3 pin in the last product slice, as written),
  2 (peer, with the global-install note), 3 (drop `strict: false`: yes; Breaking entry is already right), 4 (`>=5.7 <7`),
  5 (additive types: yes), 7 (confirm #135 covers `12` for core and node). Points 6, 8, 9 and 10 can be settled during
  their slices.

Verdict: amend
