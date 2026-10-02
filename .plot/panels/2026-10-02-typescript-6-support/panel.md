<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Panel: typescript-6-support

- **Subject:** `docs/plans/2026-10-02-typescript-6-support.md` (Draft, branch `idea/typescript-6-support`, PR #144)
- **Date:** 2026-10-02
- **Commitment:** `Verdict: proceed | amend | reject`
- **Jurors:** addon authors and downstream projects, CI matrix and the 7.1 spike as an experiment, TypeScript 5.7 to
  6.0 compiler semantics
- **Gate:** `plot-panel.mjs check` — all three committed; `reconcile` → **unanimous: amend**

## Process notes

- The jurors ran on Sonnet and wrote their own verdict files (`addon-downstream.md`, `ci-and-spike.md`,
  `ts6-semantics.md`); the moderator saved nothing on their behalf and changed nothing in them. All three files pass
  the gate.
- The moderator re-ran `check` and `reconcile` on the files as committed: unanimous `amend`.
- The strategy (A plus a 7.1 spike, Jan Wloka, 2026-10-02) was not under review; all three jurors say so and judge
  the plan only.
- **What each juror looked at:**
  - **addon-downstream** only **read**: the plan, the package manifests and `defaults.ts` on `origin/develop`, the
    CLI's webpack config, and qs-magellan's manifests and tsconfigs. It built and ran nothing and took the plan's
    probe numbers as given. One of its claims is phrased as a question (whether `Node18`/`Node20` exist in 5.7.3);
    ts6-semantics settled it by execution (6.0-only).
  - **ci-and-spike** only **read**: the plan, `pull-request.yml`, the root `package.json`, the lockfile header,
    `Compiler.ts`, `esm-watch-bench.cjs` and the ts7 story. Its spike thresholds are a proposal, labelled "to be
    adjusted by the owner".
  - **ts6-semantics** **executed**: a scratch directory with `typescript` 5.7.3 and 6.0.3 side by side, probing
    `transpileModule`, `parseJsonConfigFileContent` and both `tsc` binaries on small projects. Its findings 1, 2, 3,
    5, 6, 7 and 8 rest on those runs; the repo build and test suites were not run. It is the only juror whose
    positions on TypeScript behaviour are measured rather than read.
- The moderator verified four load-bearing reads on `origin/develop`: `packages/compiler/webpack.config.js:47` keeps
  `typescript` external (`commonjs typescript`), `packages/compiler/package.json:49` pins `typescript` 5.7.3 as a
  dependency, `compile-websmith.test.ts` uses `target: ts.ScriptTarget.ES5` at lines 117, 139, 167, 176, 209, 230 and
  515, and `Compiler.ts:933` and `:1395` test only `Node16`/`NodeNext`. It also read the sibling plans: #135
  `bug/option-enum-tables` covers 12/99/100 for core's `scriptTargetToString`, and #135 leaves
  `packages/node/src/compiler-options.ts` to the node wrapper; #133's `infra/dependabot-config` ignores `typescript`
  majors.

## Where the jurors converge

| Finding | Jurors | Evidence |
|---------|--------|----------|
| The TypeScript 7 guard cannot read `ts.version`: a 7.x `typescript` has no `main`, so the `require` throws first; detect from `typescript/package.json` and also report "not found" | addon-downstream, ts6-semantics | `packages/compiler/webpack.config.js:47` (bare `require` at start-up); the plan's own "no `main`" claim |
| Peer floor `>=5.7 <7`, not `5.x`: CI proves 5.7.3 only, `Node18`/`Node20`/`ES2025` are newer | all three | ts6-semantics executed: `module: "node20"` rejected by 5.7.3's parser |
| The 6.0.3 CI leg must exist before the product slices, or their "fails before, passes after" tests never run in CI | ci-and-spike (finding 1), ts6-semantics (slice order) | `pull-request.yml` has one axis (`node-version: [22, 24]`) |
| The CLI's `typescript` moving from dependency to peer is a breaking install change: `npx`, global and `--legacy-peer-deps` installs lose TypeScript | addon-downstream, ts6-semantics | `packages/compiler/package.json:49`; ts6-semantics adds that npm resolves the peer to the highest match (6.0.3), so users who never chose a version move to 6.0 defaults |
| Drop the `strict: false` pin, with a Breaking entry and the one-line opt-out | addon-downstream, ts6-semantics | `defaults.ts:20`; addon-downstream: combines with 0.10.0's fail-on-error |
| Additive option values in `packages/api` count as "addon API unchanged", if the release notes list them | addon-downstream, ts6-semantics | — |
| `moduleResolution` in websmith's own addon compilations: omit it, no per-major branch | ts6-semantics (executed); the plan already drops it at the CLI site | omitted under `module: CommonJS`: node10 on 5.7.3, bundler on 6.0.3, no diagnostic on either |

## Where they differ — named, not averaged

1. **Row 14 (ESM check).** The plan says 6.0 defaults `module` to `esnext`. Only ts6-semantics tested it: with an
   explicit `target` ES5, 6.0.3 still emits CommonJS; only an unset `target` changes. The fix narrows to the
   `target ?? ES5` fallback (`check-esm.ts:100`) and the `?? "ES5"` at `Compiler.ts:802`. The other jurors did not
   examine it. Measured beats read: the plan's row is wrong as written.
2. **Matrix shape.** The plan proposes 3 jobs with 5.7.3 on Node 22 only. ci-and-spike proposes the opposite 3-job
   shape: 5.7.3 on 22 and 24 (today's checks, unchanged), 6.0.3 on 24. Its reason: 5.x on Node 24 is what 0.10.0 just
   released as supported, and branch protection keys on the job names. Nobody else weighed it.
3. **How much to split.** Each juror splits a different slice: addon-downstream the CLI peer out of slice 4,
   ts6-semantics slice 2 into three, ci-and-spike the spike into harness and report. Each split is argued on its own
   slice; together they double the slice count. Nobody weighs that review cost against the size gain.
4. **Where the spike goes.** ci-and-spike wants it parallel with slice 1, because its result informs open points 2
   and 10. Plot waves within a plan are sequential, so "parallel" is not available; the choice is a position in the
   wave order, which no juror names.
5. **Points raised by one juror, undisputed.** addon-downstream alone: no slice proves "addon API unchanged" with an
   addon that calls `ts.*` on both majors; addons observe 6.x option defaults (`target` 12, `ScriptTarget[12]` =
   `"LatestStandard"`); the CLI peer removes the second `typescript` instance addons can see today.
   ci-and-spike alone: the override leg re-resolves the whole tree, so the leg must assert the installed
   `typescript` version, CI runs pnpm 9, required-check names change with the matrix, and the spike needs a watch
   rebuild and concurrency workload, the IPC encoding and payload size, interleaved runs, a seeded corpus and a
   functional `before`-transformer probe. ts6-semantics alone (all executed): `Node18`/`Node20` are not treated as
   node module kinds at `Compiler.ts:933`/`:1395`; the e2e fixtures use `target: ES5`; `--ignoreConfig` must follow
   the spawned `tsc`, not the imported `ts`; websmith-node renders `--target LatestStandard`; `ignoreDeprecations`
   is `"5.0"` on 5.7.3 and `"6.0"` on 6.0.3.

## Shared blind spot

All three lenses treat **"both legs green"** as the proof of `>=5.7 <7`. But an override leg rebuilds every package
with the leg's TypeScript. Once the dev pin moves to 6.0.3, the published `.d.ts` files of `@quatico/websmith-api`,
`-core` and `-testing` are emitted by 6.0.3 and no leg type-checks them against a 5.7.3 consumer. The packages a 5.x
user installs would never have been compiled against by 5.x in CI. A packed-artifact check is missing: build on the
pin, pack, and type-check a consumer fixture with the other major.

A second: every juror reads the peer list (`api`, `core`, `node`, `testing`, `example-addons`), and addon-downstream
read every manifest, yet nobody noticed that **`websmith-loader` declares no `typescript` peer**
(`packages/webpack/package.json`: dependencies `api`, `core`, `comment-json`; peer `webpack` only) while it imports
`typescript` in `TsCompiler.ts`, `WebpackAddonService.ts` and `WebpackAddonContext.ts`. The plan's "as the loader
already does" relies on hoisting. The loader is also an entry point the 7.x guard must cover.

## Cross-plan conflicts

- **#135 `tsc-option-parity`** owns the `esModuleInterop` and `target` defaults (`bug/tsc-default-target-interop`)
  and the target tables (`bug/option-enum-tables`, with explicit 12/99/100 for core). This plan's own-options slice
  depends on it; its `getEffectiveTarget` already falls back to `ts.getDefaultCompilerOptions().target`, which is the
  row 14 fix. #135 does not cover `packages/node/src/compiler-options.ts`, so websmith-node's target names stay
  here. One release-notes story: #135 carries the "defaults follow `tsc`" entry for `target`/`esModuleInterop`;
  this plan's `strict` entry points to it.
- **#133 `dependency-updates`**: its `infra/dependabot-config` ignores `typescript` majors, which matches this plan
  (the pin moves by hand). Both plans touch `pnpm-lock.yaml`; #133's nx upgrade and transitive fixes may also touch
  `pull-request.yml`. Whichever lands second rebases; the CI-leg slice confirms #133's workflow state first.
- **ts7-rearchitecture story**: the spike answers its two open questions (3C phase, IPC cost); the report updates
  those lines and adds one dated Decisions row.

## What the plan needs before approval

1. **Guard by package.json, not `ts.version`:** resolve `typescript/package.json` before the first
   `require("typescript")` at every entry point (CLI, loader, websmith-node, testing), report "not found" and "found
   7.x" with install instructions; unit tests for both cases; e2e with a stubbed 7.x package.
2. **CLI peer as its own slice** with a Breaking release note (no bundled TypeScript; `npx`/global installs resolve
   6.x) and an e2e installing the packed CLI into a project without `typescript`.
3. **Move the 6.0.3 CI leg ahead of the product slices**, advisory until the peer-range slice makes it required;
   specify the override (`pnpm pkg set`, unfrozen install, lockfile not committed), assert the installed version,
   decide the matrix shape and required-check names, confirm on pnpm 9.
4. **Correct the slice-1 `moduleResolution` wording:** root `bundler`, `"moduleResolution": null` in each CommonJS
   package, `rootDir: "./src"` per package; confirm the new typescript-eslint supports 5.7.3.
5. **Correct row 14** and fix it through #135's `getEffectiveTarget` fallback.
6. **Add `Node18`/`Node20`** to the node-module-kind checks (`Compiler.ts:933`, `:1395`, `getImpliedNodeFormat`).
7. **Add the e2e `target: ES5` fixtures** to row 11 and decide how they move.
8. **websmith-node:** choose `--ignoreConfig` from the spawned `tsc`'s version; add entry 12 to its target names.
9. **`ignoreDeprecations` typed `"5.0" | "6.0"`**, documented per major, never in shared fixtures.
10. **Split the own-options slice** (own compilations, module kinds and option types, fixtures).
11. **One e2e addon calling `ts.*`** on both legs; Changelog: addons observe the installed TypeScript's defaults.
12. **Spike as an experiment:** decision rule with thresholds fixed in advance, workloads (e) watch rebuild and
    concurrency, IPC encoding and payload, interleaved runs, seeded corpus, isolated nightly with integrity hash, a
    functional transformer probe; harness and report as separate branches; done is a recorded Decisions row.
13. **Close the open points** 1-10 with recommendations; name the release carrying the Breaking entries.
14. **Blind spots:** a `typescript` peer for `websmith-loader`, and a packed-artifact check that types the pinned
    build's `.d.ts` with the other major.

Nothing here is acted on by the panel. The plan author amends; `/challenge-the-plan` or `/plot-approve` follows.
