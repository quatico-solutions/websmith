<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — dependency-updates (slice: Dependabot config)

- **Plan (canonical):** `docs/plans/2026-10-01-dependency-updates.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #133 merged
- **Branch:** `infra/dependabot-config` (base: `develop`, at `06e086b5` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH); the implementer never merges it
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

**Ordering.** This slice is first in the plan's `## Slices` and carries no `waits:` marker: it waits on nothing.
No branch formally waits on it either (`infra/upgrade-nx`, `bug/trim-runtime-dependencies` and
`infra/fix-transitive-alerts` have no `waits:`). The plan orders it first so new alerts stop piling up while the nx
upgrade is in review. #144's `infra/typescript-6-ci-leg` (not starting now) relies on this slice's `typescript` ignore.

### What to build

On 2026-10-02 `develop` had 85 open Dependabot alerts (4 critical, 47 high, 29 medium, 5 low). Two causes on the
CI side keep the backlog growing, and this slice fixes both:

- **There is no `.github/dependabot.yml`.** Only the default security updates run, one PR per package and root
  directory only. The published ranges live in `packages/*/package.json` (the lodash `^4.17.21` floor in core and
  node is the example), and those never get version updates.
- **`claude-review` fails on every Dependabot PR.** Dependabot-triggered workflows get no repository secrets, so
  `secrets.CLAUDE_CODE_OAUTH_TOKEN` is empty in `.github/workflows/claude-code-review.yml` (the repo has 0
  Dependabot secrets). The security juror saw the job red on #108, #110 and #139. It is not a required check
  (`develop` protection has no required status checks, no rulesets, one approving review), but a permanently red
  check makes the PRs look broken: #108 and #110 sat open for five and seven months.

Two files change:

1. **Create `.github/dependabot.yml`** (`version: 2`) with two `updates` entries:
   - **`npm`**, `directories: ["/", "/packages/*"]`, `schedule.interval: weekly`.
     - `groups`:
       - `security`: `applies-to: security-updates`, `patterns: ["*"]`;
       - `production`: `dependency-type: production`;
       - `development`: `dependency-type: development`.
       Version-update groups default to `applies-to: version-updates`; adding `patterns: ["*"]` to the two
       dependency-type groups is harmless.
     - `cooldown: { default-days: 7 }`. Dependabot applies cooldown to version updates only; security updates are
       not delayed. Do not try to exempt them by other means.
     - `ignore`: `dependency-name: "typescript"`, `update-types: ["version-update:semver-major"]`. Nothing else
       is ignored.
     - `open-pull-requests-limit: 5`, `labels: ["dependencies"]`, `commit-message: { prefix: "E" }`.
   - **`github-actions`**, `directory: "/"`, `schedule.interval: weekly`, with the same `labels`,
     `open-pull-requests-limit` and `commit-message.prefix`. Do not add groups, cooldown or ignore rules here; the
     plan does not ask for them.
   - Dependabot rejects `directory` and `directories` in the same entry. Use `directories` for npm and `directory`
     for actions.
   - YAML is excluded from the license header (`license-config.json` ignores everything except
     ts/js/scss/md/mdx), and none of the existing workflows carries one. Add no header. A short leading `#` comment
     that points to the plan is fine.
2. **Edit `.github/workflows/claude-code-review.yml`.** Give the `claude-review` job a job-level
   `if: github.event.pull_request.user.login != 'dependabot[bot]'`. It sits in place of the commented-out
   "Filter by PR author" block, which you can drop or leave. Change no step, permission or trigger.

Facts already checked on `develop`:
- the nine packages sit one level deep, so `/packages/*` covers every manifest (`pnpm-workspace.yaml` says
  `packages/**`, but no nested manifest exists outside build output);
- the `dependencies` label exists in the repo (Dependabot's PR #139 carries it);
- `typescript` is pinned exact `5.7.3` in the root and in eight packages' devDependencies, and is a `5.x` peer in
  api, core, node, testing and example-addons.

### The decisions the plan settles — do not re-derive them

- **`directories: ["/", "/packages/*"]`, not `directory: "/"`.** A root-only entry updates root manifests and the
  lockfile and misses `packages/*/package.json`, where the published ranges users resolve live. Panel finding
  (security juror), adopted in the plan's Design.
- **One grouped `security` PR (`applies-to: security-updates`), not ungrouped security updates.** Groups apply only
  to version updates unless `applies-to: security-updates` is set. Without it, the 47 high alerts keep producing one
  PR each, which is the problem the plan describes. The `production`/`development` split by `dependency-type` keeps
  the user-facing ranges in their own PR.
- **`cooldown` 7 days on version updates.** The cooldown defends against freshly published malicious versions.
  This matters here because `release-and-publish.yml` holds `id-token: write` for npm trusted publishing, so a
  compromised dev dependency that runs there is the most valuable target. Rejected for this plan: pnpm
  `minimumReleaseAge` (it needs pnpm 10, and CI runs pnpm 9) and SHA-pinned actions. Both are follow-ups, not part
  of this slice.
- **Ignore `typescript` majors only.** Rejected: ignoring `typescript` entirely, because minor and patch updates
  stay allowed (plan, Design). Also rejected: letting majors through. TypeScript 6 support is plan #144, which moves
  the pin by hand, and TypeScript 7 is out of scope. A Dependabot major PR would fight both.
- **`commit-message.prefix: "E"`, accepting `E: Bump …`.** Dependabot inserts a colon after an alphanumeric prefix.
  The plan accepts this: the risk letter stays visible, no commit-msg hook rejects it (only `.husky/pre-commit`
  exists), and the merge-commit title can drop the colon. Rejected: the default unprefixed message.
- **Skip `claude-review` for `dependabot[bot]`, not a Dependabot secret.** Handing the OAuth token to
  Dependabot-triggered runs widens its exposure for no review value on lockfile bumps. The check is not required,
  so skipping it does not block merges, and a skipped job reports as neutral, not red. The plan conditions on the
  **PR author** (`github.event.pull_request.user.login`), not on `github.actor`, which the security juror
  suggested. If a human pushes to a Dependabot branch, the actor changes but the PR is still Dependabot's, so the
  author condition skips it consistently.
- **No CI audit job, and no other workflow changes.** A blocking `pnpm audit` would turn every new advisory into a
  red build on unrelated PRs. The grouped security PRs are the visibility mechanism (plan, Open Points).
  `claude.yml`, `pull-request.yml` and `release-and-publish.yml` stay untouched.

### Done when

Assertions a naive implementation would pass without:

- `.github/dependabot.yml` parses as YAML and shows the intended structure. Dump it and check the result in the PR,
  for example:
  `node -e 'console.log(JSON.stringify(require("./node_modules/.pnpm/js-yaml@4.1.0/node_modules/js-yaml").load(require("fs").readFileSync(".github/dependabot.yml","utf8")),null,2))'`.
  Check the dump for:
  - the npm entry has `directories` with both `/` and `/packages/*`, and no `directory`. A root-only config would
    pass lint.
  - the `security` group has `applies-to: security-updates`. Without it the group is a silent no-op for security
    PRs.
  - the `typescript` ignore carries `update-types: ["version-update:semver-major"]`. A bare `dependency-name`
    would also block 5.x minor and patch updates.
  - `cooldown` sits on the npm entry, the github-actions entry exists, and `labels`, the limit and the prefix are
    set on both entries.
- Optionally validate against SchemaStore's `dependabot-2.0.json`, if it is reachable. Say in the PR whether you
  could.
- `claude-code-review.yml` still parses. The job's `if:` names `github.event.pull_request.user.login` and
  `'dependabot[bot]'`, with the `[bot]` suffix (a bare `dependabot` never matches). This PR's own run, opened by a
  human, still runs `claude-review` and does not skip it.
- Repo gates are green, even though no source changes: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`,
  `pnpm test:e2e --skip-nx-cache`.
- No `Release-Notes.md` entry and no README change: nothing user-visible changes, and the plan's Changelog covers
  development dependencies only.
- **After merge** (record it on the PR as a follow-up; you cannot check it on the branch):
  - Insights → Dependency graph → Dependabot shows the npm entry parsed for `/` and every `packages/*` directory;
  - no `typescript` major PR is opened;
  - the next Dependabot PR shows `claude-review` as skipped.

### Repo facts for the implementer

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (put it first on `PATH`). The Homebrew pnpm 11 fails
  with E401.
- Install with `pnpm install --offline`. The Artifactory login in `~/.npmrc` is expired; **never edit `~/.npmrc`**.
  For anything from the registry, use an empty file as `NPM_CONFIG_USERCONFIG` plus
  `--config.registry=https://registry.npmjs.org/`. This slice should need no install beyond the offline one.
- Node 24 for runtime checks is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`.
- Write commits in Arlo's notation without a colon, for example `E Adds a Dependabot config for the workspace and
  actions` (see the `commit-notation` skill).
- Use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, then give it a descriptive title.
- Append `→ #<PR>` to the `infra/dependabot-config` line in the plan's `## Slices`
  (`docs/plans/2026-10-01-dependency-updates.md`), and commit that on this branch.

### Scope guard

This branch owns:
- `.github/dependabot.yml` (new);
- the `claude-review` job's `if:` in `.github/workflows/claude-code-review.yml`;
- the `→ #<PR>` suffix on its own line in `docs/plans/2026-10-01-dependency-updates.md`.

It touches no `package.json`, no `pnpm-lock.yaml`, no tsconfig and no `Release-Notes.md`.

The branches starting at the same time, checked against their plans on `develop`:
- `infra/esm-bench-watchdog` (#134): `packages/webpack-test/perf/esm-watch-bench.cjs` and its scheduler. No overlap.
- `bug/tsc-default-target-interop` (#135): core `tsDefaults`, `config/effective-options.ts`, `Compiler.ts`,
  `system.ts`, compiler-test and webpack-test fixtures, and `Release-Notes.md`. No overlap.
- `bug/esm-check-false-positives` (#137): `packages/core/src/compiler/esm/*`, `bin.test.ts`,
  `webpack-esm-check.test.ts`, `Release-Notes.md` and the compiler README. No overlap.
- `bug/cli-project-directory` (#136): `parsed-command-line`, `ResolvedCompilerOptions`, `command`, `bin.test.ts`,
  `Release-Notes.md` and the README. No overlap.
- `infra/typescript-6-toolchain` (#144): repo tsconfigs, ts-loader, ts-jest and typescript-eslint versions in the
  `package.json` files and `pnpm-lock.yaml`. No overlap. Its sibling `infra/typescript-6-ci-leg` (not starting now)
  edits `pull-request.yml` and "checks #133's workflow changes first". That is why this slice must touch no
  workflow except `claude-code-review.yml`.

There is no real file collision. The `Release-Notes.md` `## [Unreleased]` contention among #134 to #137 does not
involve this branch.

If you find something the plan did not anticipate, for example Dependabot rejecting a key, or a package
directory the glob misses, report it in the PR rather than improvising outside this scope.
