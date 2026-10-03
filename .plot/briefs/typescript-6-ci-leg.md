<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — typescript-6-support (slice: CI leg)

- **Plan (canonical):** `docs/plans/2026-10-02-typescript-6-support.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #144 merged
- **Branch:** `infra/typescript-6-ci-leg` (base: `develop`, at `f7cc3606` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH); the implementer never merges it
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

**Ordering.** This is the second of the plan's eight slices. It waits on `infra/typescript-6-toolchain`, which merged
as #166, so it can start now. Every later slice of this plan waits on it in practice: their PRs are meant to show
their 6.0.3 result in CI, and that cell only exists once this slice is merged. No slice carries a `waits:` on this
branch. The plan's slice order is the dependency. `feature/typescript-6-peer-range` (the last slice) later flips this
matrix, removes `continue-on-error`, and makes the override cell required.

### What to build

Today `.github/workflows/pull-request.yml` has one job, `dist`, with one matrix axis `node-version: [22, 24]`. It
runs `pnpm install --frozen-lockfile`, then lint, test, build and `test:e2e`. That gives two checks, `dist (22)` and
`dist (24)`, both on the lockfile's `typescript@5.7.3`. Nothing in CI runs TypeScript 6. So every later slice's
"red before on 6.0.3, green after" can only be checked in a local scratch copy.

This slice adds a third, advisory cell: **Node 24, `typescript` overridden to 6.0.3**. It changes no product code,
no `package.json` and no lockfile.

Current state on 6.0.3 (measured in #166's PR body, with `develop` at the toolchain merge plus the override):

- `pnpm build` passes (exit 0, 9 projects).
- `pnpm lint` passes (exit 0, 0 errors / 458 warnings).
- `pnpm test` fails: **41**. testing 8/32, loader 5/161, node 5/57, core 14/1054, compiler 9/108; api passes.
- `pnpm test:e2e` fails: **149**. core 3/8, loader 15/38, examples 7/11, compiler-test 37/54, webpack-test 46/89,
  compiler 41/75.

All of these failures belong to later slices and to #135 (TS5107 rows 6/7/11, TS5011 row 11, TS5112 row 8, rows 4/5).
**The new cell is expected to go red on `test` and `test:e2e` in this PR. That is correct, and fixing it is out of
scope.** The cell must be green on install, the version assertion, `lint` and `build`.

Concretely, in `pull-request.yml`:

- **Matrix as an explicit `include` list of three cells,** each with `node-version`, `typescript`, a job `name`, and
  a flag for the override/advisory cell. For example:

  | name | node-version | typescript | override / advisory |
  |---|---|---|---|
  | `dist (22)` | 22 | 5.7.3 | false |
  | `dist (24)` | 24 | 5.7.3 | false |
  | `dist (24, typescript 6.0.3)` | 24 | 6.0.3 | true |

- **`name: ${{ matrix.name }}` on the job.** When a job sets `name:`, GitHub uses that string as the check name and
  does not append the matrix values. Without it, adding a `typescript` key renames the checks to `dist (22, 5.7.3)`.
- **`continue-on-error: ${{ matrix.advisory }}` at job level,** not on steps (see decisions).
- **Override cell only, after checkout and pnpm setup, before install:**
  `pnpm pkg set pnpm.overrides.typescript=${{ matrix.typescript }}`, then `pnpm install --no-frozen-lockfile`.
  The lockfile cells keep `pnpm install --frozen-lockfile` exactly as today. Use `if:` on the matrix flag for both
  install variants. Never commit or upload the rewritten `package.json` or `pnpm-lock.yaml`.
- **First step after install, every cell: assert the installed version.** Print `pnpm --version` and the
  `typescript` version that the root and every workspace package resolve:
  `node -p "require('typescript/package.json').version"` at the root, and
  `pnpm -r exec node -p "require('typescript/package.json').version"`. Fail the step with an `::error::` line naming
  the expected and found versions unless every line equals `matrix.typescript`. Also fail if there are fewer lines
  than root + workspace packages (see Done when).
- **Gates after the assertion run independently of each other** in every cell:
  `if: ${{ !cancelled() && steps.<assert-id>.outcome == 'success' }}` on lint, test, build and E2E. The job still
  fails if any of them fails. This is not in the plan. Without it the 6.0.3 cell stops at `test` and never runs
  `build` or `test:e2e`, so the later slices that fix e2e failures (fixtures, websmith-node, own compilations)
  would see nothing in CI. Keep the step order lint, test, build, E2E, because `test:e2e` needs the build.
- **Keep the GitHub Actions versions that are in use now** (#154): `actions/checkout@v7`, `actions/setup-node@v7`,
  `pnpm/action-setup@v6` with `version: 9`. The plan text still says `pnpm/action-setup@v3`, which is stale. Do not
  bump or downgrade any action. Dependabot (`.github/dependabot.yml`, from #133/#146) groups all actions into one
  weekly `actions` PR with a 7-day cooldown, so this slice should not chase versions. Keep the existing comment on
  the Node versions and extend it with one line on the TypeScript cells.

### The decisions the plan settles — do not re-derive them

- **3 cells: 5.7.3 on Node 22 and 24 from the lockfile, 6.0.3 on Node 24 through the override** (open point 8).
  - *Rejected: 4 cells (6.0.3 on 22 as well).* It doubles the slow e2e cost. A fourth cell is added only if a
    failure shows a Node-dependent TypeScript difference.
  - *Rejected: the draft's 5.7.3 on Node 22 only.* It drops "5.x on Node 24", the cell 0.10.0 released as
    supported. This was the ci-and-spike juror's finding, adopted in the plan.
- **Explicit job names that keep `dist (22)` / `dist (24)`.** The new cell is `dist (24, typescript 6.0.3)`, the
  plan's `dist (24, typescript <version>)`. The plan's reason is branch protection. I checked on 2026-10-03:
  `develop` has **no** required status checks today (`.../protection/required_status_checks` gives
  `contexts: []`, and the repo has no rulesets). So nothing breaks right now if a name changes. The names still
  stay stable, because the peer-range slice adds required checks by these names and PR history compares them.
  Adding them to branch protection is not this slice's job.
- **Override wiring: `pnpm pkg set` + `pnpm install --no-frozen-lockfile`, override cell only.**
  - *Rejected: `pnpm add -D -w typescript@6.0.3`.* It sets the root only. The plan's probe saw the packages keep
    their own 5.7.3, so it needed a root `pnpm.overrides` anyway.
  - *Rejected: a second committed lockfile or workspace `.npmrc`.* That is more state to keep in sync, for no gain.
  - *Rejected: `--frozen-lockfile` with the override.* pnpm records `overrides` in the lockfile, so a frozen install
    fails on the mismatch.
  - The whole tree re-resolves under the unfrozen install. So **a red override cell is triaged against the 5.7.3
    cells first**. Toolchain drift is not a websmith bug.
  - I executed this on pnpm **9.15.5** (corepack cache) on a copy of the root `package.json`:
    `pnpm pkg set pnpm.overrides.typescript=6.0.3` exits 0 and merges into the existing `pnpm` object
    (`peerDependencyRules`, `ignoredBuiltDependencies`, `onlyBuiltDependencies` kept, `overrides` added). The
    unfrozen install on pnpm 9 is **not** verified locally. The plan requires the PR's own CI run to prove it.
- **Version assertion as the first step after install, in every cell, lockfile cells included.** An ignored
  override is the classic failure of this design: the cell would go green on 5.7.3 and claim 6.x support (panel,
  ci-and-spike finding 2). On the lockfile cells, the same check catches a hoisting or lockfile drift.
- **Advisory = job-level `continue-on-error: true`, until `feature/typescript-6-peer-range` removes it.** Job-level
  keeps the cell's own check red when a gate fails, while the workflow run stays green. It also stops the default
  `fail-fast` from cancelling the 5.7.3 cells. Step-level `continue-on-error` is rejected: it paints every step green
  and hides the 6.x result the slice exists to show.
- **CI stays on pnpm 9.** `pnpm/action-setup@v6`, `version: 9`. The confirmation runs on pnpm 9 in this PR's CI, not
  on the local pnpm 10 (plan, Design, CI matrix). Moving CI to pnpm 10 is out of scope.
- **#133's workflow changes are checked first** (slice line). Done when this brief was written: #133's
  `infra/dependabot-config` merged as #146, and the actions bump as #154. `infra/upgrade-nx` (#159) and
  `bug/trim-runtime-dependencies` (#164) are merged and did not change `pull-request.yml`. #133's remaining slice,
  `infra/fix-transitive-alerts`, adds range-scoped `pnpm.overrides` to the root `package.json` and has no branch
  yet. `pnpm pkg set` merges with those keys. If it ever adds a `typescript` override, the two collide. Re-check
  `git log develop -- .github/workflows/pull-request.yml package.json` before you open the PR.

### Done when

The plan's slice line is the specification: the PR's own run shows three cells on pnpm 9. The assertion step reports
5.7.3 / 5.7.3 / 6.0.3. A deliberately wrong override value in a throwaway commit fails the assertion, and that commit
is then reverted. The Definition of Done is green on the 5.7.3 cells.

A naive implementation would pass without these:

- **The check names are exactly `dist (22)`, `dist (24)` and `dist (24, typescript 6.0.3)`.** Paste
  `gh pr checks <PR>` into the PR body.
- **The assertion cannot pass on empty or partial output.** `pnpm -r exec` skips the root, and a grep for "any line
  not equal to X" passes on zero lines. Count the lines against root + the workspace packages. #166 counted 9
  packages. Derive the count from the workspace, for example `pnpm -r ls --depth -1 --json`, rather than hard-code
  it. If `pnpm -r exec` prefixes its output with package names, strip the prefix or use `--reporter-hide-prefix`.
  Check that the flag exists on pnpm 9 before you rely on it.
- **The throwaway commit makes the override and the expected value diverge.** If you only change
  `matrix.typescript`, both sides change, the assertion still passes, and the commit proves nothing. Change the
  `pnpm pkg set` value by hand (for example to `6.0.2`), or drop the `pnpm pkg set` step, which simulates an ignored
  override. Leave the matrix value at 6.0.3. Expected: the 6.0.3 cell fails at the assertion step, its later steps
  are skipped, and the 5.7.3 cells are unaffected. Revert the commit with `git revert` (no force-push), and link
  both runs in the PR.
- **The 6.0.3 cell runs all four gates.** Expected now: lint and build green, test and E2E red. The pass/fail counts
  per project should match #166's 41 / 149 within noise. Report them in the PR. A different count is a finding:
  triage it against the 5.7.3 cells, then report it. Do not fix it.
- **The workflow run's overall conclusion is success, and the 6.0.3 check is red** (not cancelled, not skipped).
  The 5.7.3 cells did not get cancelled by `fail-fast`.
- **The lockfile cells still install with `--frozen-lockfile`**, and the assertion reports 5.7.3 there.
- **No committed change outside the owned files** (below). In particular `git diff develop -- package.json
  pnpm-lock.yaml` is empty.

Gates: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache` and `pnpm test:e2e --skip-nx-cache` locally on 5.7.3.
They are unchanged by a workflow-only diff, but they are the Definition of Done. CI: `dist (22)` and `dist (24)`
green.

You can lint the workflow locally if `actionlint` is installed. Otherwise the PR run is the check.

**No `Release-Notes.md` entry and no README change.** CI only. The plan's Changelog has no line for this slice, and
nothing users install changes. **One doc line to fix:** `docs/rules/workflow.md:16` says CI runs "(Node 20, pnpm 9)",
which is already stale. Change it to Node 22 and 24 on pnpm 9, plus an advisory TypeScript 6.0.3 cell on Node 24.

**How to reproduce the cell locally** (optional; CI is the proof). Same recipe as #166. Commit first; the copy is
taken from `HEAD`.

```bash
export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"   # pnpm 10
S=$(mktemp -d /private/tmp/claude-501/ts6-scratch.XXXX)
git archive HEAD | tar -x -C "$S" && cd "$S"
pnpm install --frozen-lockfile --offline
pnpm pkg set pnpm.overrides.typescript=6.0.3
: > "$S/.empty-npmrc"
NPM_CONFIG_USERCONFIG="$S/.empty-npmrc" pnpm install --no-frozen-lockfile \
  --config.registry=https://registry.npmjs.org/
node -p "require('typescript/package.json').version"                 # 6.0.3
pnpm -r exec node -p "require('typescript/package.json').version"     # every line 6.0.3
cd - && trash "$S"
```

You can run the assertion script from the workflow in this scratch copy before you push it.

### Repo facts for the implementer

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (put it first on `PATH`). The Homebrew pnpm 11 fails
  with E401. CI is pnpm 9. A pnpm 9 binary is in the corepack cache:
  `node ~/.cache/node/corepack/v1/pnpm/9.15.5/bin/pnpm.cjs`.
- Installs on the branch use `--offline`. The Artifactory login in `~/.npmrc` is expired; **never edit
  `~/.npmrc`**. For registry packages, use an empty `NPM_CONFIG_USERCONFIG` file plus
  `--config.registry=https://registry.npmjs.org/`. The CI runner has no `~/.npmrc` issue. The repo `.npmrc` only
  maps `@quatico` to registry.npmjs.org.
- Node 24 for runtime checks is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`.
- Write commits in Arlo's notation without a colon, for example `E Adds an advisory TypeScript 6.0.3 cell to the PR
  workflow`. The throwaway and its revert are also `E` commits (see the `commit-notation` skill).
- Use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists. The PR's CI run is the slice's main evidence.
- Open the PR with `plot-open-pr.sh`. Do not use `gh pr create`.
- Append `→ #<PR>` to the `infra/typescript-6-ci-leg` line in the plan's `## Slices`
  (`docs/plans/2026-10-02-typescript-6-support.md`), and commit that on this branch.

### Scope guard

This branch owns:
- `.github/workflows/pull-request.yml`;
- line 16 of `docs/rules/workflow.md` (the CI description);
- the `→ #<PR>` suffix on its own line in the plan.

Do not touch:
- `package.json`, `pnpm-lock.yaml` and any `packages/*/package.json`. The override exists only inside the CI run.
- the other workflows (`claude-code-review.yml`, `claude.yml`, `protect-stable.yml`, `release-and-publish.yml`) and
  `.github/dependabot.yml`;
- action versions and the pnpm version;
- branch protection or required-check settings (maintainer, peer-range slice);
- any product, test or fixture file. If the 6.0.3 cell shows something the plan did not expect, report it in the PR.

The branches starting at the same time, checked against their plans on `develop`:
- `bug/depends-closure-core` (`docs/plans/2026-10-02-loader-options-once.md`): one `depends` closure in core, used
  by `getUsedProfiles`, `getDependentProfiles`, `WebpackAddonService` and `AddonRegistry`, with spec files. No
  `Release-Notes.md` entry (no behaviour change). No overlap.
- `bug/esm-check-package-subpaths` (`docs/plans/2026-10-02-esm-check-precision.md`): `packages/core/src/compiler/esm/*`,
  `cjs-names.spec.ts`, `import-rules.spec.ts`, `bin.test.ts`, the README and `Release-Notes.md`. No overlap.
- `bug/emit-skipped-rule` (`docs/plans/2026-10-02-cli-error-exit-gaps.md`): `Compiler.ts`, `Compiler.spec.ts`,
  `bin.test.ts` or `packages/compiler-test`, and `Release-Notes.md`. No overlap.

There is no real file collision. This branch touches neither `Release-Notes.md` nor any manifest. One interaction is
not a file collision. The three sibling PRs are opened before this one merges, so they run on the old two-cell
workflow. A PR that rebases after this merge gets the 6.0.3 cell, and its counts there may differ from #166's.
That is expected. Not your concern here.
