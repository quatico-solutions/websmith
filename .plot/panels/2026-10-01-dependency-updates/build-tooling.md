<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# build-tooling

Executed: fetched origin, read the plan, `package.json`, `nx.json`, `eslint.config.js`, the workflows, `pnpm-lock.yaml` entries
and the two Dependabot PRs (`gh api`: #108 and #110 are both open, mergeable_state `blocked`). No build was run;
the claims below are answerable from file contents. `npm view nx` failed (E401), so the current nx version and its
Node floor are unverified here.

## Findings that change the plan

1. **The plan's ESLint premise is wrong.** Open Point 1 says the override must be "compatible with ESLint 8 and
   typescript-eslint 7". On develop, `package.json` already has `eslint ^9.19.0`, `@eslint/js ^9.19.0`,
   `typescript-eslint ^8.22.0` and a flat `eslint.config.js`. The minimatch, brace-expansion and js-yaml alerts come
   from ESLint 9 and typescript-eslint 8 transitives. Overrides must be checked against those, and the "upgrade left
   out" decision rests on a stale version. Correct the text before approval.

2. **nx is only a script runner here, so the migration is small, not a "migrate executors" job.** No `project.json`
   exists; `nx.json` extends `nx/presets/npm.json` and each package's `package.json` scripts are the targets
   (`packages/core/package.json:25-37`). Jest runs through `jest` scripts, not `@nx/jest` executors. The only
   `@nx/*` usage is `@nx/eslint-plugin` (`eslint.config.js:13`), declared in the root and in all nine packages
   (`^18.3.4`). `nx migrate` will find almost nothing. The real work is: bump `nx` and `@nx/eslint-plugin` in 10
   `package.json` files in lock-step, then confirm the plugin's flat-config export still matches `eslint.config.js`.
   The Open Point "newest that supports jest 29 executors" is moot; replace it with "newest that supports Node
   22.12 and ESLint 9 / typescript-eslint 8".

3. **`nx.json` legacy keys are the likely breakage.** `tasksRunnerOptions` with `runner: nx/tasks-runners/default`
   and `cacheableOperations` is deprecated in later majors (replaced by per-target `cache: true` in `targetDefaults`
   and a top-level `cacheDirectory`). It needs a manual edit if the target skips several majors. Also
   `ignoredBuiltDependencies: ["nx"]` in `package.json` may need revisiting if newer nx ships a postinstall or native
   binary. Name these in the slice so the reviewer knows what to look at. Cache behaviour changing silently is the
   main risk: `pnpm test` could stop being cached or re-run everything.

4. **nx-cloud can be answered now: remove it.** No `nxCloudId`, access token or `nx-cloud` call appears in `nx.json`,
   scripts or workflows. Only `@nrwl/nx-cloud 18.0.1` (the deprecated package name) sits in root devDependencies
   (`package.json:42`). Removing it also drops its axios/tar/form-data subtree. Close this open point as "remove".

5. **CI uses pnpm 9, the verification brief and the developer toolchain use pnpm 10.** `pull-request.yml` and
   `release-and-publish.yml` pin `pnpm/action-setup@v3` with `version: 9`; the lockfile is v9.0. Overrides behave the
   same in both, but a lockfile rewritten by pnpm 10 will fail `--frozen-lockfile` in CI if the format or
   `pnpm.overrides` hashing differs. State in the transitive slice which pnpm regenerates the lockfile (use 9, as CI
   does), or add an explicit pnpm bump slice. Also note that `pnpm.overrides`/`onlyBuiltDependencies` currently live in
   `package.json` and CI's `actions/*@v3/v4` versions are themselves Dependabot targets once config lands.

## Approach

Sound ordering (nx first removes about half of the alerts, per the plan's table). Risks the plan understates:

- Overrides patch only the workspace lockfile, which is correct for the published packages (Open Point 4). Verify
  once and close it: `packages/*/package.json` dependency ranges are untouched by `pnpm.overrides`, so users resolve
  their own. Cheap to confirm with `pnpm pack` diff.
- Overrides pinned to a first patched version can cross a major (minimatch 3 to 9, glob 7 to 10). Use scoped
  overrides (`parent>pkg`) rather than global ones where the consumer needs the old API. Say so in the plan.
- The 4 critical alerts (form-data, shell-quote, sha.js, cipher-base) are listed in the "ajv and dev tooling" and nx
  rows. Which slice clears each critical should be stated, since the target "no open critical or high" depends on
  order.
- `dependabot.yml` alone does not fix alert pile-up without a merge habit; grouping plus a PR limit is fine. Add
  `ignore` or `versions-strategy` only if noise appears; do not over-design.

## Slices

- `infra/upgrade-nx`: one PR, small (about 10 manifests, `nx.json`, lockfile). Reviewable. The "tests that fail
  before" criterion does not apply to tooling; the check is the Definition of Done plus the alert delta. Add
  "`nx run-many --target=test` served from cache on a second run" as a smoke check for item 3.
- `infra/fix-transitive-alerts`: potentially large and unbounded ("every remaining critical and high"). Split by
  cause if the diff exceeds one reviewable lockfile change: (a) merge or rebase #108/#110, (b) overrides. At minimum,
  require the PR to list each alert and its fixing mechanism.
- `infra/dependabot-config`: tiny, independent. It can be ordered first or run in parallel; there is no reason to
  wait for the other two, and landing it earlier stops new PR pile-up. Be aware that enabling grouped updates right
  after the upgrades may immediately open PRs for the ESLint toolchain, which this plan explicitly excludes.

## Overlap

- TypeScript 7 story (`docs/stories/ts7-rearchitecture`): no direct overlap. A dependency freeze or TS pin
  (`typescript 5.7.3`, pinned exact in `package.json`) interacts with Dependabot: the config should ignore or
  separately group `typescript` so Dependabot does not propose TS 6 and 7 against the story's own timeline.
- Other five plans: none touch the build tooling.

## Open points to decide before approval

1. Fix the ESLint 8 / typescript-eslint 7 statement (finding 1).
2. nx target: newest major, provided it supports Node 22.12 (confirm on the registry). Recommended; `nx migrate` is
   cheap because no executors are used.
3. nx-cloud: remove (finding 4).
4. Which pnpm regenerates the lockfile (finding 5).
5. Whether `typescript` is excluded from Dependabot (overlap above).

Verdict: amend
