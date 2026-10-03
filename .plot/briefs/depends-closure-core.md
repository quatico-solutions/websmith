<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — loader-options-once (depends closure: depends-closure-core)

- **Plan (canonical):** `docs/plans/2026-10-02-loader-options-once.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #134 merged
- **Branch:** `bug/depends-closure-core` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This slice waits on nothing. The plan gives it no `waits:` marker. `infra/esm-bench-watchdog` (#153) and
`bug/loader-resolve-options-once` (#165) have merged, and neither touches the four closure copies. One slice waits on
this one: `bug/loader-unknown-profile-error` (`<!-- waits: bug/depends-closure-core -->`). Its validation "walks the
unified closure, so a missing `depends` target is the same error". So the function you write must hand missing
targets back to its caller rather than drop them silently. No other #134 slice waits on this one. #136's diagnostic
slices (`bug/report-config-option-errors`, `bug/report-file-less-diagnostics`) do **not** wait on it. They wait on
#134's errors-once slice (`bug/loader-option-errors-once`) and #135's defaults slice
(`docs/plans/2026-10-02-cli-error-exit-gaps.md`, "Order"). #136 hands the closure copies to this plan and changes none
of them (its Notes, "Not taken here").

Line numbers are from `develop` at `f7cc3606`. Re-find code by name if they move.

### What to build

**The failure.** The `depends` closure of a profile is computed four times, by four different walks:

| Caller | Where | Walk | Order it yields | Cycle | Missing target |
|---|---|---|---|---|---|
| `getUsedProfiles` | `packages/core/src/compiler/config/resolve-compiler-config.ts:138`, used at `:186` | shared `Set`, pre-order | irrelevant (only `.has`) | stops | skipped |
| `getDependentProfiles` | `packages/core/src/compiler/options/ResolvedCompilerOptions.ts:328`, used by `getSelectedProfiles` (`:320`) and `getTsConfig` (`:357`) | `depends` walked backwards, `Set`, then `.reverse()` | see below; it decides the `tsConfig` merge order (later wins) and the profile order of `Compiler.ts:144`, `:364`, `:414`, `:722` | **`RangeError: Maximum call stack size exceeded`** | skipped (filtered by `existingProfiles`) |
| `AddonRegistry.getExpectedAddonsWithDependencies` | `packages/core/src/compiler/addons/AddonRegistry.ts:194`, used at `:168` | `visited` copied per path, then deduplicated | base addons, then dependencies' addons, then the profile's addons (dependencies first) | stops | skipped; an unknown *target* returns `[]` without base addons |
| `WebpackAddonService.getAddonsWithDependencies` | `packages/webpack/src/WebpackAddonService.ts:530`, used by `getActiveAddons` (`:503`) | shared `visited` | base addons (prepended at `:504`), then the profile's addons, then its dependencies' addons (profile first) | stops | skipped; an unknown target still gets base addons |

The cycle crash is real on `develop`. With `{"profiles":{"a":{"depends":["b"]},"b":{"depends":["a"]}}}`,
`websmith -p tsconfig.json --configFile ./websmith.config.json --profile a` dies with
`RangeError: Maximum call stack size exceeded` and exit 1. `resolveCompilationConfig` accepts the cycle, and the
existing spec at `resolve-compiler-config.spec.ts:435` even builds one. A self-dependency (`a` depends on `a`) crashes
the same way.

**What the four orders really are.** These were checked while writing this brief: 20 000 random profile graphs with
cycles, missing targets and diamonds, each copy compared with a plain visited-once depth-first walk.

- `getUsedProfiles` **is** the pre-order walk. It matched in every case.
- `WebpackAddonService`'s addon list **is** base addons followed by the pre-order profiles' addons. It matched in every
  case.
- `AddonRegistry`'s addon list **is** base addons followed by the post-order profiles' addons, deduplicated. It matched
  in every case: copying `visited` per path re-expands profiles, but the deduplication hides every repeat.
- `getDependentProfiles` **is not** a post-order walk once a chain is three or more levels deep or two profiles share a
  dependency:

  | Graph (target `a`) | `getDependentProfiles` | post-order (dependencies first) |
  |---|---|---|
  | `a→b` | `b, a` | `b, a` |
  | `a→[b,c]`, `b→d` | `d, b, c, a` | `d, b, c, a` |
  | `a→b→c→d` | **`c, d, b, a`** | `d, c, b, a` |
  | `a→[b,c]`, `b→d`, `c→d` | **`b, d, c, a`** | `d, b, c, a` |
  | `a→b→a` | **`RangeError`** | `b, a` |

  It differed in about a third of the random acyclic graphs, and in most of those it puts a profile's dependency
  *after* the profile. Because the merge takes the last value, the dependency's `tsConfig` then overrides the profile
  that depends on it. Every existing e2e fixture uses one level of `depends` (`webpack-websmith.test.ts:326`, `:385`,
  `:451`, `:484`, `:537`, `webpack-profile-config.test.ts:32`), where both orders agree. So **the e2e suites cannot
  see an order change. The characterisation tests are the only guard.**

**The work** (the plan's Design → Approach, "`depends` closure in core", is the spec):

1. **Characterisation tests first, on each caller, on unchanged code.** Cover order, a cycle, a self-dependency, a
   missing `depends` target, an unknown target profile, no profile, a diamond, a three-level chain, and an addon name
   shared by two profiles. Use the graphs in the table above. `getDependentProfiles` is module-private, so pin it
   through `getSelectedProfiles` and through the merged `tsConfig` of `getOptions(profile)` (a key two profiles set
   differently). Pin the two private addon walks the way their specs already do (`// @ts-expect-error` at
   `AddonRegistry.spec.ts:155-222`, `WebpackAddonService.spec.ts:368`). Commit these first, green on `develop`. For
   the `getDependentProfiles` cycle, assert the `RangeError`. It records today's behaviour, and it is the one test
   meant to flip.
2. **One core function.** For example `packages/core/src/compiler/config/profile-closure.ts`, exported through
   `config/index.ts`, which makes it part of `@quatico/websmith-core` (`packages/webpack` already depends on core,
   `packages/webpack/package.json:38`). One visited-once depth-first walk over `config.profiles`:
   - returns the configured profiles of the closure, each once, in a requested order: dependencies first
     (post-order, the target last) or dependents first (pre-order, the target first). Those two orders reproduce
     three callers exactly, as shown above, so do not invent a third;
   - returns the `depends` targets that are not configured, in walk order, instead of dropping them. The caller in
     this slice ignores them. `bug/loader-unknown-profile-error` turns them into config errors;
   - stops on a cycle without error. This slice does not report cycles: no slice of the plan names a cycle error, so
     do not invent one;
   - leaves base addons, addon lists and the "unknown target" behaviour to the callers. These differ per caller (see
     the table) and stay as they are.
3. **Switch the three exact matches** (`getUsedProfiles`, `getExpectedAddonsWithDependencies`,
   `getAddonsWithDependencies`) to the function. Their characterisation tests must stay green, unchanged. Delete the
   private walks rather than keep them as wrappers. Callers that need a method keep a one-line delegate only where a
   spec reaches it. `WebpackAddonService.ts:519-520` claims "dependencies first" while the code puts the profile first.
   Correct the comment, not the code.
4. **Switch `getDependentProfiles` in its own commit.** See "Found while writing this brief". That commit changes the
   characterisation tests for the cycle (from `RangeError` to `b, a`) and for the three-level and diamond graphs, and
   nothing else.
5. **Unit tests of the new function** (red first: it does not exist yet). Both orders, a cycle, a self-dependency, a
   missing target, an unknown target, no profile, a diamond.

No `packages/*/src` change outside the four callers, the new module and its export.

The plan is canonical. This brief is orientation.

### Settled decisions — do not re-derive them

- **Its own branch, before the unknown-profile error.** The draft bundled the unification with the loader's
  unknown-profile validation. The config and downstream jurors split it out (panel "Where the jurors converge", and item 7 of "What the plan needs before approval").
  `getDependentProfiles` returns an ordered array that decides the `tsConfig` merge order, while `getUsedProfiles`
  returns a `Set`. A closure that changes the order is a behaviour change for CLI users, and in a refactor PR it can
  be reviewed as one (loader-config verdict, finding 5). Do not add the profile validation here.
- **Four copies, not three.** The draft listed three. The panel amendment found
  `AddonRegistry.getExpectedAddonsWithDependencies` (plan Notes, "Dropped as already fixed"). All four move.
- **Characterisation before refactor.** The plan's slice line requires "characterisation tests written first on each
  caller for order, cycles and missing targets", because no e2e fixture goes deeper than one `depends` level.
- **The closure lives in core.** `packages/webpack` already imports runtime values from `@quatico/websmith-core`
  (`WebpackAddonService.ts:9`). Core rule 10 (`AGENTS.md`) bans core imports in **addon** code, not in the loader
  package.
- **Missing targets are returned, not reported.** `resolveCompilationConfig` already reports
  `Unknown profile 'x' in 'depends'` for profiles in use (`resolve-compiler-config.ts:191-197`), and the e2e at
  `webpack-profile-config.test.ts:59`/`:75` counts it. A second report from the closure would double it. Validation
  moves into core option resolution in `bug/loader-unknown-profile-error`, not here.
- **`hasInvalidProfile` is gone** (removed by #130). Do not look for it. #136 lists its "wrong warning for a missing
  `depends`" among the items it hands over, but the function no longer exists.

### Found while writing this brief — the plan did not settle it

The plan calls this slice "no behaviour change" and asks each caller to "keep their observable order".
`getDependentProfiles` cannot keep its order without a walk of its own. Its order is an artifact of
"insert into a `Set` backwards, then reverse". It is not a dependency order, and it crashes on a cycle. Proceed this
way, and say so at the top of the PR:

- Steps 1–3 are behaviour-neutral, as planned.
- Step 4 switches `getDependentProfiles` to the dependencies-first order **in one revertable commit**. It ends the
  `RangeError` and makes a dependency's `tsConfig` merge before the profiles that depend on it. Name the affected
  shapes in the PR (chains of three or more levels, shared dependencies, cycles), with the before and after from the
  table. Configs with one level of `depends`, which covers every fixture and qs-magellan's starter, do not change.
- If the maintainer rejects step 4 at review, revert that commit. `getDependentProfiles` then keeps its own walk, and
  the PR says why four copies became two. Do not make the core function emulate the old order.
- Add one e2e in `packages/compiler-test` or `bin.test.ts`: a `depends` cycle compiles instead of crashing, red on
  `develop`. That is the user-visible half of step 4.

### Done when

The plan's slice line is the specification. These are the assertions a naive implementation would pass without:

- **Characterisation tests come before the refactor in the history**, green on unchanged code. A refactor whose tests
  were written against the new function proves nothing about the old behaviour.
- **A three-level chain and a diamond** on every caller. One-level cases pass whichever order the function picks.
- **A shared addon name in two profiles** on both addon walks. It shows the deduplication keeps the first occurrence
  in each caller's own order.
- **An unknown target profile** on both addon walks. The core walk returns `[]` without base addons, and the webpack
  walk returns the base addons. A function that "helpfully" unifies that changes `getAvailableAddons` (RULE 1 at
  `AddonRegistry.ts:162-176`).
- **A cycle and a self-dependency** on every caller. Three of them stop today, and `getDependentProfiles` crashes.
- **The e2e for the cycle** (red on `develop`), and the existing e2e suites green, unchanged.

Also:

- **Gates, all green:** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`.
- **`Release-Notes.md`**, under `## [Unreleased]` → `### Fixed`: "A `depends` cycle in `websmith.config.json` no
  longer crashes with `Maximum call stack size exceeded`; with deeper `depends` chains a dependency's `tsConfig` is
  merged before the profiles that depend on it." This is step 4's line, and it is reverted with step 4. Steps 1–3 need
  no entry.
- **Tests follow `docs/rules/testing.md`:** assemble / act / assert with no part comments, `testObj` and `actual`,
  no shared `testObj`.
- **New files carry the MIT license header** (`pnpm license:add`). Do not add them to the `license:check` list.

### Repo mechanics

- **pnpm 10** from `$HOME/.nvm/versions/node/v22.17.0/bin`: put it first on `PATH`. The Homebrew pnpm 11 fails with
  E401.
- **Installs:** `pnpm install --offline`. The Artifactory login in `~/.npmrc` is expired. **Never edit `~/.npmrc`.**
  If a registry package is unavoidable, use an empty file as `NPM_CONFIG_USERCONFIG` plus
  `--config.registry=https://registry.npmjs.org/`. This branch needs no new package.
- **Node 24** is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`, for runtime checks.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). For example,
  `t Pins the depends closure order of each caller` for the characterisation tests,
  `r Extracts one depends closure into core` for steps 2–3, and
  `B Merges depends profiles in dependency order and stops on cycles` for step 4.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit (the characterisation tests) as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Then give it a descriptive title: the wave heading alone
  reads "depends closure".
- Append `→ #<number>` to the `bug/depends-closure-core` line in the plan's `## Slices` and commit that on this branch.

### Scope guard

This branch owns:

- the new closure module and its spec in `packages/core/src/compiler/config/`, and its line in `config/index.ts`;
- `getUsedProfiles` in `resolve-compiler-config.ts`, `getDependentProfiles` in `options/ResolvedCompilerOptions.ts`,
  `getExpectedAddonsWithDependencies` in `addons/AddonRegistry.ts`, `getAddonsWithDependencies` and the order comment
  in `packages/webpack/src/WebpackAddonService.ts`, plus the specs of all four;
- one cycle e2e in `packages/compiler-test` or `packages/compiler/src/bin.test.ts`;
- `Release-Notes.md` (the step-4 line) and the `→ #<PR>` line in `docs/plans/2026-10-02-loader-options-once.md`.

Do not touch:

- `Compiler.ts`. Its four `getSelectedProfiles` calls keep their signature;
- `resolve-profile.ts`, `getFragmentProfile`, the `Unknown profile … in 'depends'` report and the
  `reportMissingAddons` warnings (`bug/loader-unknown-profile-error`);
- `convertEnumOptions` (`bug/loader-tsconfig-enum-options`);
- `packages/webpack/src/TsCompiler.ts`, `compiler-instances.ts`, `webpack-hooks.ts`, `loader.ts`;
- `package.json` files, `pnpm-lock.yaml`, tsconfigs, `.github/`, webpack-test snapshots.

Branches starting at the same time, checked against their plans on `develop`:

- `infra/typescript-6-ci-leg` (`docs/plans/2026-10-02-typescript-6-support.md`, #144). It edits
  `.github/workflows/pull-request.yml` only. Its `pnpm.overrides` and `--no-frozen-lockfile` run inside the 6.0.3
  CI cell and are not committed. **No file collision.** If it merges first, your PR shows a third, advisory cell
  (`continue-on-error: true`). A red 6.0.3 cell does not block the PR, but say in the PR whether it was red before
  your change.
- `bug/esm-check-package-subpaths` (`docs/plans/2026-10-02-esm-check-precision.md`, #137). It edits core
  `compiler/esm/` (`IMPORT_RULES`, `import-rules.ts`, `cjs-names`), their specs, `packages/compiler/src/bin.test.ts`,
  `packages/compiler/README.md` and `Release-Notes.md` (its "builds that passed may now fail" entry).
  **Collisions:** `Release-Notes.md` (append-only, rebase and keep both). `bin.test.ts` only if you put the cycle e2e
  there; prefer `packages/compiler-test`. Its esm exports in `compiler/index.ts` do not meet yours in
  `config/index.ts`.
- `bug/emit-skipped-rule` (`docs/plans/2026-10-02-cli-error-exit-gaps.md`, #136). It edits `Compiler.ts`
  (`:1201-1203`, `:1256-1258`, `:1414`), `Compiler.spec.ts`, `bin.test.ts` or `packages/compiler-test`, and
  `Release-Notes.md`. **Collisions:** `Release-Notes.md` (append-only). No `Compiler.ts` collision as long as you
  stay out of `Compiler.ts`, which this slice has no reason to touch. If both of you add a compiler-test case, use
  your own fixture directory.

The later #134 slices also edit `ResolvedCompilerOptions.ts` (`bug/loader-tsconfig-enum-options` near `getTsConfig`,
`bug/loader-unknown-profile-error` in option resolution). None of them is in flight, but keep your diff in that file
to `getDependentProfiles` and its call sites so they rebase cleanly.

If you find something the plan did not anticipate beyond the order question above, report it rather than improvising
outside scope.
