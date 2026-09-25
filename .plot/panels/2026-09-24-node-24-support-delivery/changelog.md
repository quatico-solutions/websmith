<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# changelog

Lens: do the plan's `## Changelog` and the Release-Notes.md entry match what PR #114 actually changed? Nothing should be promised but unbuilt, and nothing user-visible should be left out.

## Deliverables

1. Changelog: "websmith is built and tested on Node 24." SUPPORTED. `.nvmrc` is `24`. `protect-stable.yml:23` and `release-and-publish.yml:21` both use `node-version: 24`. In `pull-request.yml`, lines 16 and 24 set up a `[22, 24]` matrix. `gh pr checks 114` shows `dist (24) pass` and `dist (22) pass`.
2. Changelog: "Published packages declare `engines.node: ">=22.12"`; Node 20 is no longer supported." SUPPORTED. Running `jq` on develop shows `{"node":">=22.12"}` in all seven published packages: api, compiler, core, example-addons, node, testing and webpack. The two private test packages have no engines field, which is correct. No other packages exist under `packages/`.
3. `.nvmrc` 20 → 24. SUPPORTED (diff hunk, and the file on develop reads `24`).
4. Node 24 in `protect-stable.yml` and `release-and-publish.yml`, with a `[22, 24]` matrix in `pull-request.yml`. SUPPORTED (diff hunks, plus grep on develop).
5. `@types/node` 20.19.9 → 24.x in root plus seven packages, with the lockfile refreshed. SUPPORTED. Root, compiler, core, example-addons, node, webpack, compiler-test and webpack-test are all at `24.13.6`. The lockfile diff changes only 8 specifier lines, 8 version lines and the `@types/node` and `undici-types` resolution lines, which I confirmed with an awk/grep filter.
6. `engines` in the seven published packages. SUPPORTED (same as item 2).
7. A breaking entry in `Release-Notes.md` under `[Unreleased]`. SUPPORTED. The `### Changed` section now opens with "**Breaking:** websmith requires Node.js 22.12 or newer … Development and CI use Node.js 24; pull requests are tested on Node.js 22 and 24." It replaced a `TBA` placeholder.
8. "Ships in 0.10.0." Neither supported nor refuted. This is a statement of release intent, not a changelog claim. Release-Notes.md keeps the entry under `[Unreleased]` and names no version, so it doesn't contradict the plan.
9. Settle pnpm 9 vs 10 through this PR's CI. SUPPORTED. The CI run on both Node versions passed.
10. Slice `feature/node-24-support` → #114. SUPPORTED. The PR is merged as d37839c, and its 19 changed files match the plan's scope.
11. "No source changes." SUPPORTED. The file list has no `packages/*/src` paths.

## Lens-specific checks

- Nothing claimed but unbuilt: every changelog line maps to a hunk in the diff.
- Nothing built but unmentioned: the diff touches only workflows, `.nvmrc`, manifests, the lockfile, Release-Notes, the plan, the brief and the `docs/plans/active` symlink. The only changes a user would see are the engines floor and the `@types/node` major version. The engines floor is announced. The `@types/node` bump is a devDependency and never reaches consumers, so leaving it out is acceptable.
- Plan vs Release-Notes wording: Release-Notes also mentions the PR matrix on Node 22 and 24, which the plan's changelog leaves out. That line is accurate, so the two only differ in how much detail they give. The plan's "Node 20 is no longer supported" matches the Release-Notes text.
- One small wording gap: the plan calls the Release-Notes entry "breaking". It is filed under `### Changed` with a "**Breaking:**" prefix rather than in a separate breaking section, but that matches how the file already marks breaking changes.

## Executed vs read

- Executed:
  - `gh pr view 114 --json …` and `gh pr diff 114`
  - `gh pr checks 114`: `claude-review`, `dist (22)`, `dist (24)` and `license/cla` all pass
  - `jq` over the 9 package manifests and the root `package.json`
  - `grep node-version` over the workflows and `cat .nvmrc` on develop
  - an awk/grep filter over the lockfile section of the diff
- Read: the plan file, Release-Notes.md `[Unreleased]`, the brief (inside the diff) and the PR body.
- Not executed: lint, test, build and e2e locally. For those I relied on the green CI jobs.

## Overall

Both changelogs match the merged diff exactly. Every promised change was built. The one user-visible change not in the plan's changelog, the Node 22/24 PR matrix, is covered in Release-Notes.md. I found no contradictions.

Position: supported
Evidence: executed
