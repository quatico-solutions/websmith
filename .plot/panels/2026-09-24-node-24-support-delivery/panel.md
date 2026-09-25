<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Delivery panel: node-24-support

- **Subject:** `docs/plans/2026-09-24-node-24-support.md` · evidence: PR #114 (merged `d37839c`)
- **Date:** 2026-09-25 · **Lenses:** deliverable, behaviour, changelog
- **Gate:** `Position` → unanimous `supported`; `Evidence` → unanimous `executed`

## What each juror looked at

- **deliverable:** read the plan against `gh pr diff 114`; ran `gh`/`jq`/`grep` checks on manifests, workflows and lockfile. All 13 deliverables found.
- **behaviour:** ran `pnpm build && pnpm test` on Node 22.17.0 (exit 0) and 24.21.0 (passing; possibly partly from the nx cache — CI `dist (24)` is the independent evidence); packed `@quatico/websmith-api` and installed it on Node 20.19.4 with and without `--engine-strict`; read the CI log of run 36112088636. Did not run `test:e2e` locally (CI did).
- **changelog:** mapped every changelog line to a diff hunk; confirmed nothing user-visible is unmentioned (the `@types/node` bump is a devDependency).

## Findings, none blocking

- **Shared blind spot — the declared floor is untested.** `engines` promises `>=22.12`, but CI ran Node 22.23.2 and the juror 22.17.0; nobody ran 22.12 itself. Pin `22.12` in the PR matrix if the floor is meant literally.
- **GitHub Actions deprecation warnings:** `actions/checkout@v4`, `actions/setup-node@v4` and `pnpm/action-setup@v3` target Node 20 and are forced onto Node 24 by the runner. Outside this plan; a follow-up upgrade.
- "Ships in 0.10.0" is release intent; the entry sits under `[Unreleased]` without a version, as intended.

## Verdict

Delivered as planned. No deliverable partial or missing.
