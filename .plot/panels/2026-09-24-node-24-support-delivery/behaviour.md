<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# behaviour

I found no deliverable missing. I ran the build, the unit tests and an engines check myself. I also read the actual logs of the PR's CI run: run 36112088636, jobs dist (22) and dist (24), both passing. The worktree is at 7e63677, which is the PR head.

## Deliverables

1. `.nvmrc` 20 → 24: **SUPPORTED.** `cat .nvmrc` prints `24`.
2. `protect-stable.yml:23` and `release-and-publish.yml:21` set to Node 24: **SUPPORTED.** grep shows `node-version: 24` at both lines. I only read these, because neither workflow runs on a PR.
3. `pull-request.yml` runs a `[22, 24]` matrix: **SUPPORTED, from the CI log.** Line 16 is `node-version: [22, 24]`. The CI log shows both jobs set up real runtimes:
   - dist (22): `Found in cache @ .../node/22.23.2`, then `node: v22.23.2`
   - dist (24): `Found in cache @ .../node/24.21.0`, then `node: v24.21.0`
4. `@types/node` 20.19.9 → 24.x in the root and the 7 listed packages, plus a refreshed lockfile: **SUPPORTED.**
   - The root, compiler, core, example-addons, node, webpack, compiler-test and webpack-test all show `24.13.6`.
   - `grep -c @types/node@20 pnpm-lock.yaml` returns 0.
   - The lockfile has entries only for `@types/node@24.13.6`.
5. `engines.node ">=22.12"` in the 7 published packages: **SUPPORTED, and it takes effect.**
   - api, compiler, core, example-addons, node, testing and webpack each have `{"node":">=22.12"}`. The private packages compiler-test and webpack-test have none, as the plan intends.
   - On Node 20.19.4 I ran `npm pack` on the api package, then installed the tarball. With `--engine-strict` npm printed `npm error code EBADENGINE ... Required: {"node":">=22.12"} Actual: {"npm":"10.8.2","node":"v20.19.4"}`. Without the flag it printed `npm warn EBADENGINE Unsupported engine`.
6. Breaking entry in `Release-Notes.md` under `[Unreleased]`, shipping in 0.10.0: **SUPPORTED as text.** The entry reads `**Breaking:** websmith requires Node.js 22.12 or newer ...`. It does not name 0.10.0, but the plan only says the change ships in that release. The version bump is release work and not part of this PR.
7. The lockfile works with pnpm 9 in CI: **SUPPORTED, from the CI log.** Both jobs ran `pnpm install --frozen-lockfile`. Both printed `Lockfile is up to date, resolution step is skipped` and then `Done in 4.8s using pnpm v9.15.9` (4.7s on the Node 24 job).
8. Slice `feature/node-24-support` → #114: **SUPPORTED.** The PR is merged with merge commit d37839c, and all its checks pass: claude-review, dist (22), dist (24) and license/cla.
9. Changelog item "built and tested on Node 24": **SUPPORTED.**
   - CI dist (24) shows lint, `Successfully ran target build for 9 projects`, unit tests of 21+32+472+83+57+92 = 757 passing, and `Successfully ran target test:e2e for 6 projects` with 1 skipped (the thread-loader test).
   - Locally on v24.21.0, `pnpm build && pnpm test` printed the same 757 passing and `Successfully ran target test for 6 projects`.
10. Changelog item "`engines >=22.12`; Node 20 no longer supported": **SUPPORTED.** This is the evidence from items 5 and 6.
11. The declared floor is tested on Node 22: **SUPPORTED.**
    - CI dist (22) shows the same lint, build, 757 unit tests and e2e run passing, with 1 skipped.
    - Locally on v22.17.0, `pnpm build && pnpm test` passed: `Successfully ran target build for 9 projects`, the same six test totals, `Successfully ran target test for 6 projects`, exit 0.

## What I executed and what I only read

Executed:
- `gh pr checks 114`, `gh pr view 114` and `gh run view 36112088636 --log`, filtering the log for node, pnpm and test lines.
- On Node 22.17.0: `pnpm build && pnpm test`, exit 0.
- On Node 24.21.0: `pnpm build && pnpm test`, all passing. My pipe hid the exit code. This run came after the Node 22 run, so some results may have come from the nx cache. The CI dist (24) job is independent evidence for Node 24.
- On Node 20.19.4: `npm pack` of the api package, then `npm install` of the tarball with and without `--engine-strict`.
- grep and `node -e` checks on `.nvmrc`, the workflows, every `package.json` and `pnpm-lock.yaml`.

Read only:
- `protect-stable.yml` and `release-and-publish.yml`. They don't run on a PR, so I could not execute them.
- The Release-Notes wording.
- Local e2e tests. I did not run `pnpm test:e2e`; that evidence comes from the CI logs.

## Caveats

- CI tested Node 22.23.2, not exactly 22.12. The floor version itself was never run.
- Both CI jobs warn that actions/checkout@v4, setup-node@v4 and pnpm/action-setup@v3 target Node 20 and were forced to run on Node 24. That is outside this plan's scope.

Position: supported
Evidence: executed
