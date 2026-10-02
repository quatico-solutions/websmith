<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Dependency updates for the open Dependabot alerts

> Clear the critical and high Dependabot alerts on `develop`: add a Dependabot config first, upgrade nx to 22.x,
> remove the vulnerable runtime dependencies that `@quatico/websmith-core` ships to users, and refresh or override the
> remaining transitives, so that no critical or high alert is open once the last slice merges.

## Status

- **State:** Approved
- **Type:** bug
- **Review:** pr
- **Impl:** own branches
- **Rounds:** 1
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #133 merged
- **Started:** 2026-10-02, Jan Wloka, `infra/dependabot-config`
- **Started:** 2026-10-02, Jan Wloka, `infra/upgrade-nx`
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- `@quatico/websmith-core` no longer depends on `create-hash` and `path`; it hashes with `node:crypto`. Users no
  longer install `sha.js` and `cipher-base` (two critical advisories) through websmith.
- `@quatico/websmith-core` and `@quatico/websmith-node` require `lodash ^4.18.1` (was `^4.17.21`, which admits
  versions with a high advisory).
- Development dependencies updated (nx 22, vulnerable transitives); no change to the published packages' behaviour.

## Motivation

On 2026-10-02 (after the 0.10.0 release) GitHub reported 85 open Dependabot alerts on `develop`: 4 critical, 47 high,
29 medium and 5 low. 84 come from `pnpm-lock.yaml`, one from `package.json` (nx). 84 have `scope: development`; only
`braces` is `runtime`. The counts drift daily, so this plan targets a rule, not a number: **no open critical or high
alert on `develop` after the last slice merges.**

| Cause | Alerts | Packages | Reaches users? |
|---|---|---|---|
| nx 18.3.4 and the dead `@nrwl/nx-cloud` 18.0.1 | ~40 | axios (25), tar (8), form-data (2, one critical), tmp (2), follow-redirects, nx (2, first patched 22.7.2) | no |
| `create-hash@1.2.0`, an exact runtime dependency of `@quatico/websmith-core` | 2 | sha.js (critical), cipher-base (critical) | **yes**, every compiler and loader user |
| `concurrently` | 2 | shell-quote (2, one critical) | no |
| Transitives of the current lint, test and build toolchain (ESLint 9, typescript-eslint 8, jest, babel) | ~26 | js-yaml (10), minimatch (4), brace-expansion (4), flatted, glob, picomatch, braces, browserslist, @humanfs/node, @babel/* (2) | no |
| ajv and webpack tooling | 10 | fast-uri (8, Dependabot PR #139), serialize-javascript (2) | no |
| Direct dependencies | 5 | webpack (2, dev and peer `5.x`, PR #108), lodash (3, PR #110) | lodash: through the published `^4.17.21` floor |

Overrides and lockfile changes protect only this workspace and CI. Users resolve the published ranges in
`packages/*/package.json`, so the two criticals from `create-hash` and the lodash floor need a published-package change
and a release.

The backlog has a second cause besides the missing `.github/dependabot.yml`: the `claude-review` job fails on every
Dependabot PR (Dependabot-triggered workflows get no repository secrets, so `CLAUDE_CODE_OAUTH_TOKEN` is empty). It is
not a required check (`develop` protection has no required status checks and the repo has no rulesets; one approving
review is required), but a permanently red check makes the PRs look broken. #108 and #110 had been open for five and
seven months.

## Design

### Approach

- **Dependabot config first.** It is independent of the other slices and stops new alerts from piling up while the nx
  upgrade is in review. `.github/dependabot.yml`:
  - `npm` with `directories: ["/", "/packages/*"]` (the published ranges live in `packages/*/package.json`), weekly;
    `github-actions` for `/`, weekly.
  - Groups: `security` (`applies-to: security-updates`, all patterns) so security fixes arrive as one PR, not one per
    package; `production` and `development` (`dependency-type`) for version updates.
  - `cooldown: default-days: 7` for version updates (security updates are not delayed); defence against freshly
    published malicious versions, which matters because `release-and-publish.yml` holds `id-token: write`.
  - `ignore`: `typescript` with `update-types: ["version-update:semver-major"]`. TypeScript 6 support is plan #144
    (typescript-6-support); TypeScript 7 is out of scope. Minor and patch updates of `typescript` stay allowed.
  - `open-pull-requests-limit: 5`, `labels: ["dependencies"]`, `commit-message.prefix: "E"` (see Open Points).
  - `claude-code-review.yml`: skip the `claude-review` job when the PR author is `dependabot[bot]`.
- **nx to 22.x.** The nx alert's first patched version is 22.7.2; target the newest 22.x. nx is only a script runner
  here: no `project.json`, no `@nx/jest` executors, `nx.json` extends `nx/presets/npm.json`. The work is a lock-step
  bump of `nx` and `@nx/eslint-plugin` in the root and the nine `packages/*/package.json`, `nx migrate` for whatever
  it still finds, and a manual rewrite of the deprecated `nx.json` keys (`tasksRunnerOptions` with
  `cacheableOperations` → `targetDefaults.<target>.cache: true` and a top-level `cacheDirectory: ".nx-cache"`).
  `@nx/eslint-plugin` 22 accepts typescript-eslint 8; confirm its flat-config export still matches
  `eslint.config.js`. Remove `@nrwl/nx-cloud`: no `nxCloudId`, token or `NX_CLOUD` appears anywhere.
- **Published packages.** Replace `create-hash` in `packages/core/src/environment/browser-system.ts` with
  `node:crypto` `createHash("sha256")`: same hex digest, synchronous like `ts.System.createHash`, and the file already
  imports `node:path` (the "browser" system is the in-memory virtual system, run under Node by the compiler and
  `@quatico/websmith-testing`). Drop `path@0.12.7` from core (nothing imports the npm package; sources use
  `node:path`) and from the private `compiler-test`. Raise `lodash` to `^4.18.1` in core and node; this supersedes
  #110.
- **Remaining transitives, by the remediation ladder:**
  1. lockfile refresh (`pnpm update <pkg> -r`) where the parent's range already admits the patched version
     (shell-quote, sha.js leftovers, fast-uri, serialize-javascript, flatted, braces);
  2. parent bump where a newer parent fixes it (webpack to `^5.104.1` in the dev manifests, superseding #108);
  3. a `pnpm.overrides` entry last, only as a range-scoped selector (`"minimatch@3": "^3.1.3"`, `"js-yaml@3":
     "^3.15.2"`, `"axios@1": …` if nx 22 still pins an old axios), with a caret or `>=` target, never an exact pin
     and never across a major, and a comment naming the GHSA. `tar@6` is not overridden to 7; the nx upgrade drops
     it.
- **Lockfile discipline.** Regenerate the lockfile with pnpm 9 (`pnpm dlx pnpm@9 install`), as CI does
  (`pnpm/action-setup@v3`, `version: 9`); pnpm 10 may write a lockfile that fails `--frozen-lockfile` in CI. Every
  lockfile diff is reviewed for packages new to the tree that run lifecycle scripts or ship native binaries, and for
  `resolution` entries not from `registry.npmjs.org`. `onlyBuiltDependencies` and `ignoredBuiltDependencies` stay as
  they are unless the review justifies a change in the PR.
- **Dependabot PRs.** #139 (fast-uri, lock-only, `dist (22)` and `dist (24)` green) is merged before the transitive
  slice starts. #110 (lodash) is closed in favour of the published-package slice, which also carries the
  Release-Notes entry. #108 (webpack; `dist (24)` failed) is closed in favour of the transitive slice.
- **Verification per slice:** the Definition of Done (`pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`) and a
  dev-inclusive `pnpm audit --audit-level=high` before and after, recorded in the PR. `pnpm audit --prod` is not the
  metric: it sees only `braces`. GitHub re-scans only the default branch, so the alert count is re-checked after each
  merge, not on the PR.

### Open Points

- [x] **ESLint premise** — decided: dropped. `develop` already has ESLint 9 and typescript-eslint 8 (not 8 / 7); the
      minimatch, brace-expansion and js-yaml alerts are transitives of the current toolchain and go through the
      ladder; no lint toolchain upgrade in this plan, pending approval.
- [x] **nx target version** — decided: newest 22.x (22.7.12 on 2026-10-02), not 23. 22.7.2 is the first patched
      version; 23 adds a further major of risk for no alert, and the new Dependabot config will propose it, pending
      approval.
- [x] **nx-cloud** — decided: remove `@nrwl/nx-cloud`; the repo has no Nx Cloud configuration, and removal drops an
      old axios and the older form-data path, pending approval.
- [x] **Published packages** — decided: overrides do not reach users (they live in the workspace root and are not
      published); the user-facing fixes are a published-package slice with a Release-Notes entry, pending approval.
- [x] **Plan type** — decided: `bug`, not `infra`. Two critical advisories reach every user of
      `@quatico/websmith-core` through its exact `create-hash` dependency, and the lodash floor admits a high one; the
      fix changes published manifests and needs a release. Dev-only slices keep `infra/` branches, pending approval.
- [x] **`create-hash` replacement** — decided: `node:crypto`, not a pure-JS hash library. The virtual system runs
      under Node and already imports `node:path`; no new dependency, same digest, pending approval.
- [x] **`claude-review` on Dependabot PRs** — decided: skip the job for `dependabot[bot]`, not a Dependabot secret.
      The check is not required, so it does not block merging, but it can only fail without the secret; handing the
      OAuth token to Dependabot-triggered runs widens its exposure for no review value on lockfile bumps. The repo
      owner may still prefer the secret, pending approval.
- [x] **Dependabot commit prefix** — decided: `prefix: "E"`, accepting the colon Dependabot inserts (`E: Bump …`).
      The risk letter stays visible, no commit-msg hook rejects it, and the merge commit title can drop the colon,
      pending approval.
- [x] **Audit in CI** — decided: not in this plan. A blocking `pnpm audit` job would turn every new advisory into a
      red build on unrelated PRs; the grouped security PRs are the visibility mechanism, pending approval.
- [x] **SHA-pinned actions and pnpm `minimumReleaseAge`** — decided: follow-ups, not in this plan. Dependabot keeps
      the tags current; `minimumReleaseAge` needs pnpm 10 and CI runs pnpm 9, pending approval.

## Slices

### Dependabot config

- `infra/dependabot-config` — `.github/dependabot.yml` with `directories: ["/", "/packages/*"]`, a security group, dev and production version groups, cooldown, labels, PR limit, `E` prefix and `typescript` majors ignored; `claude-review` skipped for `dependabot[bot]`. Test: `pnpm lint` and the Definition of Done green; after merge, the Dependabot run log shows both directories parsed and no `typescript` major proposed → #146 <!-- builds: .github/dependabot.yml and the claude-review skip -->

### nx

- `infra/upgrade-nx` — `nx` and `@nx/eslint-plugin` to the newest 22.x in all ten manifests, `nx migrate`, `nx.json` legacy keys rewritten, `@nrwl/nx-cloud` removed, lockfile regenerated with pnpm 9 and its new install-script packages listed in the PR. Test: Definition of Done green; a second `pnpm test` run is served from the nx cache; `pnpm audit --audit-level=high` before and after shows nx, tar, form-data and the nx-driven axios gone → #159 <!-- builds: nx 22 upgrade and nx.json cache config -->

### Published packages

- `bug/trim-runtime-dependencies` — `create-hash` replaced by `node:crypto` in `browser-system.ts`, `path` dropped from core and compiler-test, `lodash ^4.18.1` in core and node, Release-Notes entry under `## [Unreleased]`, #110 closed. Test: unit tests in `browser-system.spec.ts` pin the sha256 hex digest of a known input (they would fail on a wrong algorithm); `pnpm pack` of core, compiler and node installed in a scratch directory shows `npm ls sha.js cipher-base create-hash` empty and lodash at 4.18.1 or later (fails before); Definition of Done green <!-- builds: create-hash and path removal, lodash floor -->

### Transitive packages

- `infra/fix-transitive-alerts` — the remediation ladder for every remaining critical and high alert after #139 merges: lockfile refresh, parent bumps (webpack `^5.104.1`, closing #108), range-scoped overrides with GHSA comments last; lockfile regenerated with pnpm 9. The PR lists each alert with its mechanism. Test: Definition of Done green; `pnpm audit --audit-level=high` reports no critical or high; after merge, the alert API shows no open critical or high on `develop` <!-- builds: lockfile refresh and range-scoped pnpm.overrides -->

## Notes

- Created 2026-10-01 after the `esm-output-check` delivery. Decided in-session: Type `infra`, plan PR review, three
  slices (nx, transitives, Dependabot config); a separate ESLint toolchain upgrade was left out.
- Alert data: `gh api --method GET repos/quatico-solutions/websmith/dependabot/alerts -f state=open --paginate`
  (without `--method GET`, `-f` turns the call into a POST), grouped by package and parent from `pnpm-lock.yaml`.
- Dependabot PRs #108 (webpack 5.104.1) and #110 (lodash 4.18.1) were asked to rebase on 2026-10-01.
- **Amended after the draft panel** (2026-10-02, `.plot/panels/2026-10-01-dependency-updates/`, unanimous amend):
  corrected the ESLint premise; pinned nx to 22.x, removed nx-cloud, named the `nx.json` legacy keys, a cache smoke
  check and the install-script review; added the published-package slice (`create-hash` → `node:crypto`, `path`
  dropped, lodash floor) with a Release-Notes entry, and changed Type to `bug` because of it; stated the remediation
  ladder, range-scoped overrides, pnpm 9 and #139; replaced `pnpm audit --prod` and the PR alert count with a
  dev-inclusive audit and a post-merge re-count; decided `claude-review` for Dependabot PRs; completed the Dependabot
  config and moved it first. Alert data refreshed after the 0.10.0 release: 85 open (4 / 47 / 29 / 5). The panel's
  contradiction on `create-hash` was settled in the security juror's favour: it is imported, so it is replaced, not
  dropped.
