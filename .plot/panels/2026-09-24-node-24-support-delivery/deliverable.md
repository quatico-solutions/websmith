<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# deliverable

Plan: docs/plans/2026-09-24-node-24-support.md. Evidence: merged PR #114 (merge commit d37839cc, which develop 6f40f73 contains) and the worktree at .worktrees/feature-node-24-support (HEAD 7e63677).

## Deliverables and verdicts

1. `.nvmrc` changes from 20 to 24. SUPPORTED. The diff hunk for `.nvmrc` is `-20 +24`, and `cat .nvmrc` in the worktree prints `24`.
2. `protect-stable.yml` changes from `node-version: 20` to 24. SUPPORTED. The hunk at line 23 shows the change, and grep shows `protect-stable.yml:23: node-version: 24`.
3. `release-and-publish.yml` changes from `node-version: 20` to 24. SUPPORTED. The hunk at line 21 shows the change, and grep confirms it.
4. `pull-request.yml` gets a matrix `node-version: [22, 24]`. SUPPORTED. The hunk adds `strategy.matrix.node-version: [22, 24]` and `node-version: ${{ matrix.node-version }}`. Running `gh pr checks 114` showed `dist (22) pass` and `dist (24) pass`.
5. `@types/node` goes from 20.19.9 to 24.x in root plus compiler, core, example-addons, node, webpack, compiler-test and webpack-test. SUPPORTED. The diff has all 8 package.json hunks, each `20.19.9 -> 24.13.6`. Grep in the worktree finds exactly those 8 files, all at 24.13.6.
6. `pnpm-lock.yaml` is refreshed. SUPPORTED. The diff shows +116 -116. In the worktree the lockfile has 0 matches for `@types/node@20` and 71 for `@types/node@24.13.6`. `pnpm install --frozen-lockfile --lockfile-only --offline` finished with no lockfile mismatch, and `git status` showed no tracked changes afterwards.
7. `engines.node ">=22.12"` is added to api, compiler, core, example-addons, node, testing and webpack. SUPPORTED. There are 7 `+"engines"` hunks in the diff. A node script over `packages/*/package.json` found `{"node":">=22.12"}` on every non-private package. The two private test packages have none, which the plan allows because it scopes the field to published packages.
8. `Release-Notes.md` gets a breaking entry under `[Unreleased]`. SUPPORTED. The hunk replaces `- TBA` under `[Unreleased]` / `### Changed` with "**Breaking:** websmith requires Node.js 22.12 or newer ...".
   - The plan says the change "ships in 0.10.0". That is a release-time decision, and the plan asks for no version bump in this PR, so it is not a missing deliverable.
9. PR CI on pnpm 9 with Node 22 and 24 settles the pnpm question. SUPPORTED. Both `dist` jobs passed on the PR. The workflows still pin pnpm `version: 9`, which is unchanged context in the hunks.
10. Configuration only, no source changes. SUPPORTED. `gh pr view 114 --json files` lists only workflows, `.nvmrc`, package.json files, the lockfile, `Release-Notes.md` and plan/brief docs. No `src/` files appear.
11. Slice `feature/node-24-support` maps to #114. SUPPORTED. The PR is MERGED, and worktree HEAD is `plot: link node-24-support slice to #114`.
12. Changelog "built and tested on Node 24". SUPPORTED by items 1–4 and 9: `.nvmrc` and every workflow use 24, and the Node 24 CI job passed.
13. Changelog "published packages declare >=22.12; Node 20 no longer supported". SUPPORTED by items 7 and 8, and no workflow still references Node 20.

I found nothing missing, partial or contradictory in any of the 13 deliverables.

## Executed vs read

- **Executed:**
  - `gh pr view 114 --json title,files,state,mergeCommit`
  - `gh pr diff 114`, filtered to exclude the lockfile and docs
  - `gh pr checks 114`
  - in the worktree: `grep node-version`, `cat .nvmrc`, `grep @types/node`, counts on `pnpm-lock.yaml`, and a node script printing the `engines` field of each package
  - `pnpm install --frozen-lockfile --lockfile-only --offline`, followed by `git status` (no tracked changes)
  - `git merge-base --is-ancestor d37839cc 6f40f73` (true)
- **Read only:** the plan file, the diff hunks and the head of `Release-Notes.md`.
- **Not executed:** I did not run the Definition of Done commands (lint, test, build, test:e2e) locally, because the local Node is v20.19.4. For those I rely on the passing CI results for `dist (22)` and `dist (24)`.

Position: supported
Evidence: executed
