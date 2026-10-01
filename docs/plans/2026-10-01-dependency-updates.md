<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Dependency updates for the open Dependabot alerts

> Clear the critical and high Dependabot alerts on `develop` by upgrading nx, updating or overriding vulnerable transitive packages, and adding a Dependabot config so alerts no longer pile up.

## Status

- **State:** Draft
- **Type:** infra
- **Review:** pr
- **Impl:** own branches
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- Development dependencies updated (nx and vulnerable transitive packages); no change to the published packages'
  behaviour.

## Motivation

On 2026-10-01 GitHub reported 83 open Dependabot alerts on `develop`: 4 critical, 47 high, 27 medium and 5 low. All
but three come from `pnpm-lock.yaml` transitives. They group by cause:

| Cause | Alerts | Packages |
|---|---|---|
| nx 18.3.4 and nx-cloud | ~40 | axios (23), tar (8), form-data (2, one critical), tmp (2), part of js-yaml, nx (2) |
| ESLint and typescript-eslint toolchain | ~14 | minimatch (4), brace-expansion (4), part of js-yaml (10) |
| ajv and other dev tooling | ~20 | fast-uri (8), shell-quote (2, one critical), serialize-javascript (2), sha.js (critical), cipher-base (critical), babel, glob, braces, picomatch, flatted, browserslist, follow-redirects, @humanfs/node |
| Direct dependencies | 5 | webpack (2, Dependabot PR #108), lodash (3, Dependabot PR #110) |

The repo has no `.github/dependabot.yml`, so Dependabot opens only security PRs one package at a time; #108 and #110
had been open for five and seven months.

## Design

### Approach

- **nx first.** Upgrade `nx` and `@nx/*` from 18.3.4 to the current major with `nx migrate`, applying its
  migrations, and upgrade or remove `nx-cloud` (the repo does not use Nx Cloud remote caching; confirm). This
  removes the largest group.
- **Then transitives.** For each remaining critical or high alert, update the parent that pulls it in; where no
  parent release fixes it, add a `pnpm.overrides` entry pinned to the first patched version, with a comment naming
  the alert. Medium and low alerts are fixed where the same change covers them.
- **Direct dependencies** go through Dependabot's own PRs #108 (webpack) and #110 (lodash), merged before this plan
  starts if their CI is green; otherwise the transitive slice takes them.
- **Dependabot config.** Add `.github/dependabot.yml`: weekly `npm` updates for the workspace and
  `github-actions`, grouped (dev dependencies in one group, production dependencies in another), with a PR limit.
- **Verification per slice:** the Definition of Done (`pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`),
  `pnpm audit --prod` unchanged or better, and the open alert count from
  `gh api repos/quatico-solutions/websmith/dependabot/alerts` before and after, recorded in the PR.

### Open Points

- [ ] **The ESLint-driven alerts** (minimatch, brace-expansion, js-yaml): the in-session decision left the lint
      toolchain upgrade out of this plan. The transitive slice overrides them where an override is compatible with
      ESLint 8 and typescript-eslint 7; whatever is left is recorded as a follow-up, not fixed by upgrading ESLint.
- [ ] **nx target version:** the newest major, or the newest that still supports the repo's Node 22.12 baseline and
      jest 29 executors.
- [ ] **nx-cloud:** remove or keep.
- [ ] **Published packages:** confirm that no override changes what `@quatico/websmith-*` packages resolve for their
      users (overrides apply only to this workspace's lockfile).

## Slices

### nx

- `infra/upgrade-nx` — `nx migrate` to the target version with its migrations, nx-cloud upgraded or removed, the Definition of Done green, alert count before and after in the PR <!-- builds: nx upgrade and migrations -->

### Transitive packages

- `infra/fix-transitive-alerts` — parent updates or `pnpm.overrides` for the remaining critical and high alerts, including the ESLint-driven ones where an override is compatible; target: no open critical or high alert <!-- builds: pnpm.overrides for vulnerable transitives -->

### Dependabot config

- `infra/dependabot-config` — `.github/dependabot.yml` with grouped weekly updates for npm and GitHub Actions <!-- builds: .github/dependabot.yml -->

## Notes

- Created 2026-10-01 after the `esm-output-check` delivery. Decided in-session: Type `infra`, plan PR review, three
  slices (nx, transitives, Dependabot config); a separate ESLint toolchain upgrade was left out.
- Alert data: `gh api repos/quatico-solutions/websmith/dependabot/alerts -f state=open`, grouped by package and
  parent from `pnpm-lock.yaml`.
- Dependabot PRs #108 (webpack 5.104.1) and #110 (lodash 4.18.1) were asked to rebase on 2026-10-01.
