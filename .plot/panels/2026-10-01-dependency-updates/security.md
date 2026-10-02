<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Supply-chain security

Executed: `gh api` against the live alerts (via query string; `-f state=open` turns the call into a POST and returns
404), `gh pr view/diff` for #108, #110 and #139, and reads of `origin/develop` (package.json files, `pnpm-lock.yaml`,
`nx.json`, workflows). Not executed: no build and no install; every claim about what a bump resolves to is reasoned
from lockfile ranges, not reproduced.

## Findings that change the plan

1. **The plan's ESLint premise is wrong.** Open point 1 says overrides must stay "compatible with ESLint 8 and
   typescript-eslint 7". develop already has `eslint ^9.19.0` (lock: `eslint@9.19.0`) and `typescript-eslint ^8.22.0`
   (package.json:44-61, lock lines 3194 and 4943). The point is moot; the real constraint is that the lint toolchain
   is already current, so the minimatch, brace-expansion, js-yaml and flatted alerts come from transitives of current
   packages and from nx 18 / jest / babel, not from an old ESLint. Rewrite the point and the "ESLint and
   typescript-eslint toolchain" row of the Motivation table.
2. **Alerts today: 85 open (4 critical, 47 high, 29 medium, 5 low), not 83.** 84 are in `pnpm-lock.yaml`, 1 in
   `package.json` (nx, medium, first patched 22.7.2). That patched version also answers open point 2: the target is
   the nx 22.x line, not "newest that supports ...". Record the nx patched floor in the plan.
3. **The four criticals are not nx-driven, so "nx first" does not clear them.** Parents in the lockfile:
   shell-quote 1.8.2 comes from `concurrently@9.1.2` (lock 7360), sha.js 2.4.11 and cipher-base 1.0.4 from
   `create-hash@1.2.0` (lock 7407), form-data 4.0.0 from axios 1.1.3 / 1.6.8 (nx-cloud and nx 18; this one the nx slice
   does remove). Three of four criticals therefore depend entirely on the second slice.
4. **Most alerts clear with a lockfile refresh, not an override.** shell-quote (`^1.8.1`), sha.js (`^2.4.0`),
   cipher-base (`^1.0.1`), fast-uri, serialize-javascript, flatted, braces (micromatch `^3.0.3`) and lodash (`^4.17.x`)
   are all in range of their parents, so `pnpm update <pkg> -r` or deleting the lock entries and re-resolving fixes them
   without a permanent pin. Dependabot PR #139 (fast-uri 3.0.6 to 3.1.8, lock-only, dist 22/24 green) is exactly this
   and covers all 9 fast-uri alerts (max patched 3.1.7). State the ladder explicitly: lockfile refresh, then parent
   bump, then override last. Overrides rot: they stay after the parent is fixed and block later patches.
5. **Overrides are only safe as range-scoped selectors.** The lockfile carries several majors of the same package, and
   the alerts name patched versions per major: minimatch 3.1.3 / 5.1.8 / 9.0.7 / 10.2.3, js-yaml 3.15.x and 4.3.x,
   brace-expansion 1.1.16 and 2.1.2, tar 7.5.x. A flat `"minimatch": ">=10.2.3"` would force minimatch 3 consumers
   (CJS function export, brace-expansion 1.x) onto an incompatible API and silently break eslint, glob 7 or jest
   globbing. The plan must require selector form (`"minimatch@3": "^3.1.3"`, `"js-yaml@3": "^3.15.2"` ...), a `>=`
   or caret target rather than an exact pin, and a comment naming the GHSA. `tar` is a special case: the lock has only
   `tar@6.2.1` (parent `@nx/*` 18) while every alert is for 7.x patched lines, so do not override 6 to 7; let the nx
   upgrade drop it and verify it is gone.
6. **The plan's success metric measures the wrong thing.** "`pnpm audit --prod` unchanged or better" covers runtime
   dependencies only. 83 of the 85 alerts have `scope: development` (only braces is `runtime`), so `--prod` is nearly
   blind to the target. Use `pnpm audit --audit-level=high` including dev dependencies, or run `osv-scanner` on the
   lockfile in the PR. Also, GitHub re-scans only the default branch, so the "alert count before and after, recorded
   in the PR" cannot show an after value on a PR; the after value is the local audit plus a re-count after merge.
7. **Published packages are not protected by workspace overrides, and the real exposure is the declared ranges.**
   `pnpm.overrides` in the root apply to this lockfile only (answers open point 4: confirmed, no effect on consumers).
   Consumers resolve from `packages/core` and `packages/node` ranges: `lodash ^4.17.21` in both, `create-hash 1.2.0`
   (exact) in core. Lodash `<=4.17.23` is a high alert, and the in-range floor still admits vulnerable 4.17.21. Dependabot
   PR #110 does the right thing (raises both published ranges to `^4.18.1`, verified in its diff); it must be merged
   or its package.json change reproduced, and a Release-Notes entry is needed because the published dependency floor
   changes (AGENTS.md Definition of Done). `create-hash` is imported only in
   `packages/core/src/environment/browser-system.ts:9` and drags in sha.js, cipher-base, md5.js and ripemd160 for a
   hash `node:crypto` provides; replacing it removes two criticals' source for good. Offer that as a decision rather
   than assume it (the "browser-system" name suggests a browser target; check before removing).
8. **#108 and #110 are not "green if CI is green" candidates as the plan frames them.** #110: `dist (22)` and
   `dist (24)` pass, `claude-review` fails. #108: `dist (24)` fails and `dist (22)` was cancelled. `claude-review`
   fails on all three Dependabot PRs; Dependabot-triggered workflows cannot read repository secrets
   (`CLAUDE_CODE_OAUTH_TOKEN`; the repo has 0 Dependabot secrets), which is the likely cause (inferred, not
   reproduced). Decide whether `claude-review` is a required check; if it is, no Dependabot PR can ever merge, which
   alone explains the 5 and 7 month backlog more than the missing config does. Fix by skipping that job for
   `github.actor == 'dependabot[bot]'` or adding the secret as a Dependabot secret. #108 also edits five package.json
   files and must be re-run after rebase before anyone relies on it.

## Dependabot config review

The proposed config is directionally right and lacks the settings that make it work for this repo:

- **`directories`**: this is a pnpm workspace (`packages/**`). A root-only `directory: "/"` updates root manifests and
  the lockfile but may miss `packages/*/package.json` where the published ranges live (the lodash case above). Use
  `directories: ["/", "/packages/*"]` (Dependabot supports globs) and test it.
- **Security grouping**: `groups` apply to version updates only unless `applies-to: security-updates` is set. Without
  it the 47 high alerts keep producing one PR each, the exact problem the plan names. Define a security group and
  separate dev / production version groups.
- **`cooldown`** (e.g. `default-days: 7`, shorter or zero for security updates): the main defence against freshly
  published malicious versions. This repo publishes with npm trusted publishing and provenance, so a compromised
  dev dependency executing in `release-and-publish.yml` (which holds `id-token: write`) is the highest-value
  target; a delay on version updates is cheap insurance. Pair it with pnpm `minimumReleaseAge` in `.npmrc` or
  workspace config if CI pnpm supports it (CI pins `pnpm/action-setup@v3` with `version: 9`, local is pnpm 10; check
  support per major).
- **`github-actions` ecosystem**: all actions are pinned by mutable tags (`checkout@v4`, `pnpm/action-setup@v3`,
  `ffurrer2/extract-release-notes@v2`, `softprops/action-gh-release@v2`, `anthropics/claude-code-action@v1`), and the
  release workflow publishes with OIDC. Dependabot will bump tags, but pinning to SHA with Dependabot maintaining the
  comment is the stronger setup for the release workflow; at least decide it.
- **Commit style**: the repo uses Arlo's notation without colon. Dependabot adds a colon after an alphanumeric prefix,
  so `commit-message.prefix` will yield `E: Bump ...`. There is no commit-msg hook (only `.husky/pre-commit`), so it is
  not blocked, but say which way it goes; do not leave it to default.
- **`open-pull-requests-limit`** and **labels** (`dependencies`) should be set; the plan only says "a PR limit".
- Order: the config is independent of the other slices and cheap. Land it first, or in parallel, so alerts stop
  accumulating while the nx upgrade is in review. It also needs no Definition of Done beyond lint.

## Other supply-chain points the plan omits

- **nx upgrade and install scripts.** `package.json` has `ignoredBuiltDependencies: ["nx"]` and
  `onlyBuiltDependencies: ["@swc/core"]`. A major upgrade changes the package set (`@nx/*` native binaries, new
  transitives); the slice must diff the lockfile for newly introduced packages with lifecycle scripts, and keep the
  allow-list as is. State this as a review step.
- **nx-cloud (open point 3) is decided by the repo**: `nx.json` uses `nx/tasks-runners/default`; grep finds no
  `nxCloudAccessToken`, `nxCloudId` or `NX_CLOUD` anywhere outside the lockfile and package.json. `@nrwl/nx-cloud
  18.0.1` is a dead dev dependency that pins `nx-cloud` and axios 1.1.3. Recommend removal; it needs no confirmation
  beyond a CI run. That alone removes one axios version and the form-data critical's older path.
- **axios**: 23 alerts, patched lines up to 1.16.0 (high) and 1.20.0 (medium). The nx 22 slice should land the
  newest axios in range; if nx 22 still pins an older axios, that is an override candidate (selector `axios@1`),
  and the plan should name it rather than discover it.
- **Lockfile regeneration discipline**: CI runs `pnpm install --frozen-lockfile` with pnpm 9; regenerate the lockfile
  with the same major, or the frozen check may fail on the `overrides:` block. Also review the resulting
  `pnpm-lock.yaml` diff for unexpected new registries or `resolution` entries that are not from registry.npmjs.org
  (integrity hashes only), since a lockfile PR is where tampering would hide.

## Plan questions in the rubric order

1. **Problem.** Real. Alerts reproduced from the live API (counts above). The ESLint 8 claim is false.
2. **Approach.** Sound order of ideas, but the override and audit mechanics are underspecified (findings 4-6) and the
   Dependabot config incomplete (section above).
3. **Slices.** Three branches, each reviewable. Slice 2 is the large one (about 40 packages after nx) and
   "no open critical or high alert" is the right target but must be tied to a measurable local check (finding 6).
   Slice 3 should not be last. A missing item: the published-range change for lodash (and a `create-hash` decision) in
   `packages/core` and `packages/node`, with a Release-Notes entry; fold it into slice 2 or a fourth branch.
4. **Overlap.** No duplicate of the other plans. Dependabot PRs #108, #110, #139 overlap slice 2 directly; the plan
   names #108 and #110 but not #139 (fast-uri). TypeScript 7 story: no overlap, though nx target-version choice
   should not constrain TypeScript 7 migration (TS is pinned `5.7.3` in package.json).
5. **Open points to decide before approval.** (a) Correct the ESLint premise and drop that point. (b) Pin the nx
   target to the 22.x line (patched 22.7.2) and remove `@nrwl/nx-cloud`. (c) Decide the `claude-review` required-check
   question, because it determines whether any Dependabot PR can merge. (d) Mandate selector-scoped overrides with
   `>=`/caret targets and a rule that overrides are the last resort. (e) Replace the `--prod` metric with a dev-inclusive
   audit. (f) Decide `create-hash` removal versus lockfile refresh, and the published-range bump for lodash.

Verdict: amend
