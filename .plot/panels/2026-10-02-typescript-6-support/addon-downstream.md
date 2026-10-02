<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Addon authors and downstream projects

Read only: the plan (`origin/idea/typescript-6-support`), `origin/develop` package manifests, `defaults.ts`, the CLI
webpack config, and qs-magellan (`node/package.json`, `node/tsconfig.json`, `node/packages/*/package.json`).
Nothing was built or run. The plan's own probe numbers were not re-measured.

## Findings that change the plan

1. **The TypeScript 7 guard may never run.** The plan says websmith "checks `ts.version` at its entry points" because
   a 7.x `typescript` has no `main`. If there is no `main`, `import ts from "typescript"` throws before any
   `ts.version` read, in `core`, `api` and the CLI bundle alike (`packages/compiler/webpack.config.js:47` keeps
   `typescript` as `commonjs typescript`, so the CLI does a bare `require` at start-up). The guard must wrap the
   require (try/catch, then resolve and read `typescript/package.json`), and the unit test in slice 4 must cover
   "module cannot be resolved" and "7.x present", not only a faked `ts.version`. The same guard must also say
   "typescript not found, install typescript 5.x or 6.x" once the CLI's dependency becomes a peer (point 2).
2. **CLI `typescript` dependency to peer changes the install contract, not just the version.**
   `packages/compiler/package.json:49` pins 5.7.3 as a dependency, so `npx`, global installs and npm with
   `--legacy-peer-deps` work with no project TypeScript today. As a peer they fail with module-not-found. The README
   (`packages/compiler/README.md:23`) already tells users to add `typescript`, which supports the change, but the
   release notes must state it as a breaking install change for 0.x users, and the guard in point 1 must make the
   failure readable. The upside is real for addon authors: today the CLI runs its own 5.7.3 while compiled addons
   resolve `typescript` from the project (README line 69), so two `typescript` instances can coexist and addon
   `ts.*` nodes may come from a different copy than the one that produced the AST. One peer removes that. Say so in
   the plan; it is the main downstream benefit and nobody has noticed it.
3. **"Addon API unchanged" holds for `AddonContext`, but not for the sentence as written in the Changelog.**
   Addons see `ts.*` types from the project's `typescript`; `AddonContext` and the addon interfaces are untouched.
   The runtime caveat is missing: on 6.x the `ts.CompilerOptions` an addon reads through the context changes
   (default `target` 12 instead of 1, `esModuleInterop`, `strict`, `rootDir`), and `ts.ScriptTarget[12]` is
   `"LatestStandard"`. Addons that branch on `options.target` or `ScriptTarget[...]` names will see new values.
   The Changelog line should say "no API change; on 6.x addons observe 6.x compiler option defaults".
4. **The `strict: false` pin (open point 3) is a breaking default for downstream projects and is mis-scoped as
   "6.x users only".** `defaults.ts:20` pins it today for every user. Dropping it on 5.x is a no-op (5.x defaults to
   off), so the claim in the Changelog is right; on 6.x it turns on for projects that never set `strict`. qs-magellan
   is unaffected (`node/tsconfig.json:26` sets `strict: true`; `packages/starter/tsconfig.json:6` too), so projects
   that already set it see nothing. The affected population is projects with no `strict` in tsconfig, and they get
   new type errors that fail the build (0.10.0 made errors fail builds). Recommendation: accept the drop (matches
   `tsc`, which is the product promise), but say in the release notes that it combines with the 0.10.0 fail-on-error
   behaviour, and give the one-line opt-out.
5. **Peer range `5.x || 6.x` with CI on 5.7.3 and 6.0.3 only (open point 4).** Magellan pins 5.7.3 exactly, so it
   is covered, but other 5.x users (5.0-5.6) are claimed and untested, while the plan itself notes
   `Node18`/`Node20` module kinds exist only in newer 5.x. Recommend `>=5.7 <7` (or `^5.7.3 || ^6.0.3`). Declaring
   what CI proves is the honest range; it also keeps the 7.x error message accurate.
6. **New api option types: additive, but not purely for consumers.** Adding `ES2025`, `Node18`, `Node20`,
   `Preserve` and `ignoreDeprecations` to unions in `TsConfigOptions` / `TscArguments` / `CompilerArguments` does not
   break assignment. It can break exhaustive `switch`/`Record<Union, X>` code in downstream tooling, and those
   values do not exist in `ts.ModuleKind` on 5.7 (`Node18`/`Node20` are newer than 5.7.3 `ModuleKind`?). The plan must
   check that the api package still compiles its own types against 5.7.3 and that a value valid only on 6.x produces a
   websmith diagnostic on 5.x, not a silent drop. Open point 5: yes, additive counts as unchanged, provided the
   release notes list the new values.

## Approach

- Strategy and range are sound from a downstream view; the tsconfig and toolchain slice is repo-internal and invisible
  to addon authors.
- Row 4/5 (esModuleInterop and default target) are owned by #135. For downstream the visible effect is the same
  as point 3: effective defaults follow the installed TypeScript. The release notes of the two plans must tell one
  story; the plan should say which release notes carries the combined "defaults follow tsc" entry.
- Magellan's addons depend on `@quatico/websmith-core` (`node/packages/addons/package.json:36`, peer `0.9.x`)
  against the repo rule that addons use the api only. Not this plan's problem, but it means magellan's real
  surface is `core`, so "addon API unchanged" is only true if `core` peer range and exported helpers also keep
  working. Confirm that the `core` changes (effective-options helper, `defaults.ts`) leave the exported names
  addons import alone.
- Missing from the Changelog and slice 4: what the user does on TypeScript 7 beyond "keep typescript@6". The README
  guidance should state the exact install (`typescript@6` as project dependency, `tsgo`/7.x via its own binary) and
  the error text; that is the sentence downstream users will search for.

## Slices

- Order is right: toolchain, own options, node wrapper, peer range plus CI, spike. Each is one PR.
- Slice 4 bundles five user-visible changes (peer range, CLI peer, dev pin move, version guard, CI matrix, README,
  release notes). The CLI dependency-to-peer move is the riskiest for downstream and deserves its own branch with its
  own release-note entry and its own e2e (install the packed CLI into a project without `typescript` and assert the
  readable error). Split it.
- Slice 4 test for the guard needs the missing-module case (finding 1); an e2e with a stubbed 7.x package in
  `node_modules` is cheap and fails before the change.
- No slice tests an addon written against 5.7 `ts.*` types loading and running on 6.x through the CLI and loader, other
  than "a generator addon loaded" in the probe. Add one e2e addon case using a `ts.*` call (visitor or
  `ts.factory`) on both legs; this is the only direct proof of "addon API unchanged".

## Overlap

- #135 slices 2 and 3 (esModuleInterop, target, `scriptTargetToString` for 12): declared in the plan. Its release
  notes entries overlap with finding 4 and point above.
- TypeScript 7 story: the guard (finding 1) and README text sit on the story's "users on 7" question; keep the
  decision recorded in one place.
- #133 dependency-updates: lockfile contention only, as stated.

## Open points to decide before approval

- 2 (CLI peer): recommend peer, with the guard and a separate slice (findings 1, 2).
- 3 (`strict`): recommend drop, with explicit release-note text (finding 4).
- 4 (lower bound): recommend `>=5.7 <7`, not `5.x` (finding 5).
- 5 (additive types): recommend yes, listing new values in release notes (finding 6).
- 10 (TypeScript 7 users): recommend the guard plus README only; leave aliasing to the spike.
- Add one open point: which release carries the breaking notes for the CLI peer and the `strict` default (0.11.0, with
  an explicit "Breaking" heading in `Release-Notes.md`).

## Release notes that must be written

Breaking: CLI no longer ships `typescript` (add it to your project). Breaking on 6.x: `strict` no longer forced
off. Supported range and 7.x error text. New api option values. Addons: no API change, compiler option defaults
follow the installed TypeScript (target, `esModuleInterop`, `strict`); one `typescript` instance now serves CLI and
addons.

Verdict: amend
