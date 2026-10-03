<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — dependency-updates (slice: Transitive packages)

- **Plan (canonical):** `docs/plans/2026-10-01-dependency-updates.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #133 merged
- **Branch:** `infra/fix-transitive-alerts` (base: `develop`, at `accb3235` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH); the implementer never merges it
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

**Ordering.** The plan's `## Slices` has four waves: Dependabot config, nx, Published packages, Transitive packages.
This is wave 4, the last. Its predecessors have merged: `infra/dependabot-config` (#146), `infra/upgrade-nx` (#159),
`bug/trim-runtime-dependencies` (#164), and the plan's precondition #139 (fast-uri, merged 2026-10-02). #166
(`infra/typescript-6-toolchain`, another plan) has also merged. It moved ts-loader, ts-jest and typescript-eslint and
regenerated the lockfile. Nothing waits on this branch. When it merges, the plan can be delivered.

### What to build

On 2026-10-03 GitHub lists 43 open Dependabot alerts on `develop`: 1 critical, 24 high, 15 medium and 3 low. All are in
`pnpm-lock.yaml` and all are `development` scope, except the two `braces` alerts, which GitHub labels `runtime`. The
plan's rule is **no open critical or high alert after this slice merges**. Fix every critical and high alert with the
remediation ladder, in this order:

1. **Lockfile refresh.** Use it when the parent's range already admits the patched version.
2. **Parent bump.** Use it when a newer parent fixes the alert.
3. **Range-scoped override in `pnpm.overrides`.** Use it last.

The PR lists every alert with its mechanism. The table below is the starting point. Re-pull the list before you start
with `gh api --method GET repos/quatico-solutions/websmith/dependabot/alerts -f state=open --paginate`. Without
`--method GET`, `-f` turns the call into a POST. Parents and ranges below come from the lockfile's `snapshots:` and
from `npm view`. Do not use `pnpm why`: the checkout's `node_modules` was stale and still showed nx 18.

**Critical and high (must be closed):**

| Alert | Sev | Package (locked) | Patched | Parent and range | Rung |
|---|---|---|---|---|---|
| 122 | critical | shell-quote 1.8.2 | 1.8.4 | `concurrently@9.1.2` `^1.8.1` | 1, refresh to 1.12.0. This also closes 143 |
| 190 | high | braces 3.0.3 | **none** | `micromatch@4.0.8` `^3.0.3` (jest, fast-glob) | **no rung**, see the decisions below |
| 26 | high | braces 3.0.2 | 3.0.3 | `chokidar@3.6.0` ← `fork-ts-checker-webpack-plugin@9.0.2` (webpack-test) | 1 |
| 188, 186, 182, 181 | high | axios 1.18.1 | 1.20.0 | **exact pin** in `nx@22.7.12` (and in `nx@23.2.1`) | 3: `"axios@1": "^1.20.0"`. This also closes mediums 189, 187, 185, 174, 173 |
| 176 | high | smol-toml 1.6.1 | 1.7.1 | **exact pin** in `nx@22.7.12` | 3: `"smol-toml@1": "^1.7.1"` |
| 163, 152, 139 | high | js-yaml 3.14.1 | 3.15.2 | `@istanbuljs/load-nyc-config@1.1.0` `^3.13.1` | 1. This also closes mediums 128 and 48 |
| 162, 153, 138 | high | js-yaml 4.1.0 | 4.3.2 | `@eslint/eslintrc@3.2.0` and `cosmiconfig@8.3.6`, both `^4.1.0` | 1. This also closes mediums 127 and 47 |
| 161 | high | browserslist 4.24.4 | 4.28.7 | babel helpers, `core-js-compat`, webpack (5.104.1 needs `^4.28.1`) | 1, together with the webpack bump |
| 143 | high | shell-quote 1.8.2 | 1.9.0 | as 122 | 1 |
| 140 | high | brace-expansion 1.1.11 | 1.1.16 | `minimatch@3.1.2` | 1, to 1.1.21. This also closes medium 171 |
| 134 | high | brace-expansion 2.0.1 | 2.1.2 | `minimatch@9.0.5`, `minimatch@10.0.1` | 1, to 2.1.7. This also closes medium 170 |
| 110 | high | @babel/plugin-transform-modules-systemjs 7.24.1 | 7.29.4 | `@babel/preset-env@7.24.5` ← `@nx/js@22.7.12` `^7.23.2` | 1: refresh preset-env and its plugins |
| 83 | high | flatted 3.3.2 | 3.4.2 | `flat-cache@4.0.1` `^3.2.9` | 1 |
| 79 | high | serialize-javascript 6.0.2 | 7.0.3 | `terser-webpack-plugin@5.3.11` `^6.0.2`, which cannot reach 7 | 2: webpack `^5.104.1` needs `terser-webpack-plugin ^5.3.16`, and 5.6.1 has no serialize-javascript dependency. This also closes medium 113 |
| 77 | high | minimatch 3.1.2 | 3.1.3 | eslint, `@eslint/*`, `glob@7`, `test-exclude`, fork-ts-checker | 1, to 3.1.5. Fall back to `"minimatch@3": "^3.1.3"` only if a parent blocks it |
| 74 | high | minimatch 9.0.5 | 9.0.7 | `@typescript-eslint/typescript-estree@8.22.0`, left over through `@nx/eslint-plugin@22.7.12` → `type-utils@8.22.0` | 1: refresh to 9.0.9, or collapse type-utils onto 8.58.0 |
| 73 | high | minimatch 10.0.1 | 10.2.3 | `glob@11.0.1` `^10.0.0` | 1 |
| 50 | high | glob 11.0.1 | 11.1.0 | `rimraf@6.0.1` `^11.0.0` | 1 |

**Medium and low (fix them only when a mechanism above already covers them):** 179 brace-expansion 5.0.8 is an exact
pin in nx, and the fix would be an override. Do not add an override for a medium alone. List it as residue. Also 157
`@humanfs/node` 0.16.6 (rung 1, `eslint` `^0.16.6`), 85 picomatch 2.3.1 (rung 1), 125 `@babel/core` 7.24.5 (low,
rung 1), and 59 and 58 webpack 5.97.1 (low, rung 2, closed by the webpack bump).

Make these changes:

1. **webpack (rung 2, supersedes the closed #108).** Change the devDependency `"webpack": "^5.97.1"` to `"^5.104.1"`
   in the root `package.json` (line 76), `packages/compiler/package.json` (line 80), `packages/node/package.json`
   (line 83), `packages/webpack/package.json` (line 70) and `packages/webpack-test/package.json` (line 53). Leave the
   `"webpack": "5.x"` peer ranges in node (line 47) and webpack (line 42) alone. The caret resolves to the newest 5.x
   (5.111.1 on 2026-10-03). The webpack-test e2e suite and `packages/compiler`'s `build:binary` (a webpack build) are
   the guards.
2. **Lockfile refresh (rung 1).** Run `pnpm update -r --depth Infinity <names>` for the rung-1 packages, then check in
   the lockfile that each one moved. If pnpm keeps an old resolution, do this: remove only that package's stale
   entries from `packages:` and `snapshots:`, plus the parents' edges to it, and run `pnpm install` again. pnpm then
   resolves them again inside the parents' ranges. This is the same technique #164 used for lodash. Never delete the
   whole lockfile.
3. **Overrides (rung 3), in the root `package.json` under `"pnpm": { "overrides": { … } }`.** Add exactly two
   entries: `"axios@1": "^1.20.0"` and `"smol-toml@1": "^1.7.1"`. Add more only if rung 1 provably fails for a
   high-severity package, and give the evidence in the PR.
4. **`Release-Notes.md`.** Add the plan's third Changelog bullet under the existing `### Security` heading in
   `## [Unreleased]`, after the two entries from #164: "Development dependencies updated (nx 22, vulnerable
   transitives); no change to the published packages' behaviour."

### The decisions the plan settles — do not re-derive them

- **The ladder order is fixed, and an override comes last.** The panel required that overrides be range-scoped
  selectors (`axios@1`, not `axios`), with a caret or `>=` target, never an exact pin and never across a major
  (`.plot/panels/2026-10-01-dependency-updates/panel.md`, row "Overrides must be range-scoped selectors"). Rejected:
  flat overrides such as `"minimatch": "^10"`. The lockfile holds minimatch 3, 9 and 10 side by side, and a flat
  override would force eslint and `glob@7` across a major.
- **axios and smol-toml need overrides, because nx pins them exactly.** `nx@22.7.12` declares `axios: "1.18.1"` and
  `smol-toml: "1.6.1"`. The newest nx, 23.2.1, pins the same versions, so a parent bump cannot help. The plan also
  keeps nx on 22.x, and the Dependabot config proposes 23 separately. The plan foresaw `"axios@1": …` "if nx 22 still
  pins an old axios", and it does.
- **The plan's suggested `js-yaml@3` and `minimatch@3` overrides are not needed.** The parents' carets (`^3.13.1`,
  `^3.1.2`) already admit 3.15.2 and 3.1.5, so rung 1 applies. The plan gave these as examples of the selector form,
  not as entries it requires.
- **`tar@6` is not overridden.** The nx upgrade dropped it, and no `tar` alert is open.
- **The GHSA ids go in the PR's alert table and the commit body, not in `package.json`.** The plan asks for "a comment
  naming the GHSA" on each override. `package.json` cannot hold comments. `pnpm-workspace.yaml` (which allows YAML
  comments) accepts `overrides` only from pnpm 10, and CI runs pnpm 9 (`pnpm/action-setup@v6`, `version: 9`). This is
  a brief-level decision: name it in the PR. Use axios GHSA-3pq3-5fj3-cg6v, GHSA-x97p-jq2g-jp4f, GHSA-r4gj-5m52-g5wh
  and GHSA-m8m8-qj5v-23w3, and smol-toml GHSA-7w5x-hrqm-74c2.
- **braces alert 190 (GHSA-vfj7-8cjw-p6xm) has no fix.** Its `first_patched_version` is null, its range is
  `<= 3.0.3`, and 3.0.3 is the newest braces. `micromatch@4.0.8`, the newest 4.x, requires `^3.0.3`. No rung applies,
  and an override has nothing to point at. Do not swap out jest or fast-glob to escape it. List it in the PR as the one
  known residue. Whether to dismiss the alert after merge, and with which reason, is the maintainer's call. The plan's
  rule cannot be met by code for this alert, and the PR must say so plainly.
- **Write the lockfile with pnpm 10, then check it frozen with pnpm 9.15.5.** This deviates from the plan's literal
  "regenerate with pnpm 9" and follows #164. `develop`'s lockfile already carries 8 pnpm 10 `libc:` lines, which pnpm
  9.15.5 accepts frozen. The plan's purpose, a lockfile that CI's pnpm 9 accepts with `--frozen-lockfile`, is proven
  by the check. Writing with pnpm 9 would only churn those lines. If pnpm 9.15.5 refuses the result, regenerate with
  it (`node $HOME/.cache/node/corepack/v1/pnpm/9.15.5/bin/pnpm.cjs install` against the registry) and report this.
- **The `concurrently` → `lodash@4.18.1` edge from #164 must survive.** `concurrently@9.1.2` declares
  `lodash ^4.17.21`. #164 had to hand-edit its snapshot to point at 4.18.1, because pnpm kept the old 4.17.21
  resolution. Refreshing shell-quote touches `concurrently`'s snapshot, so check afterwards that `lodash@4.18.1` is
  still the only lodash. If `lodash@4.17.21` comes back, apply the same edit again.
- **The success metric is a dev-inclusive audit plus the post-merge alert count, not `pnpm audit --prod`.**
  `--prod` sees only braces. GitHub re-scans only the default branch, so the alerts close after merge, not on the PR.

### Done when

These are the assertions a naive implementation would pass without. Record the evidence in the PR body.

- **Alert table in the PR.** Give every alert number from the table above, with its GHSA, the locked version before
  and after, and the rung used. Add any alert opened since 2026-10-03 to the table.
- **Lockfile, version by version.** `grep -nE "^  '?<pkg>@" pnpm-lock.yaml` shows no vulnerable version for these:
  - shell-quote (≥ 1.9.0);
  - braces (only 3.0.3);
  - axios (≥ 1.20.0);
  - smol-toml (≥ 1.7.1);
  - js-yaml (3.x ≥ 3.15.2, 4.x ≥ 4.3.2);
  - browserslist (≥ 4.28.7);
  - brace-expansion (1.x ≥ 1.1.16, 2.x ≥ 2.1.2);
  - `@babel/plugin-transform-modules-systemjs` (≥ 7.29.4);
  - flatted (≥ 3.4.2);
  - serialize-javascript (absent or ≥ 7.0.3);
  - minimatch (3.x ≥ 3.1.3, 9.x ≥ 9.0.7, 10.x ≥ 10.2.3);
  - glob 11.x (≥ 11.1.0);
  - webpack (≥ 5.104.1).

  Paste the before and after lines.
- **The overrides take effect.** The lockfile header has an `overrides:` block with exactly the two selectors.
  `nx@22.7.12`'s snapshot points at the overridden axios and smol-toml.
- **lodash.** `lodash@4.18.1` is the only lodash in the lockfile, and `concurrently@9.1.2`'s snapshot says
  `lodash: 4.18.1`.
- **Lockfile hygiene.**
  - The header says `lockfileVersion: '9.0'`, and `grep -c 'tarball:' pnpm-lock.yaml` is 0.
  - No `resolution` points outside `registry.npmjs.org`.
  - `pnpm install --frozen-lockfile --offline` passes with pnpm 10, and
    `node $HOME/.cache/node/corepack/v1/pnpm/9.15.5/bin/pnpm.cjs install --frozen-lockfile --offline --lockfile-only`
    passes with pnpm 9.15.5.
- **Install scripts and native binaries.** Diff the package set before and after. List every package that is new to
  the tree and that declares `preinstall`, `install` or `postinstall`, or ships a native binary. Expect none. Leave
  `onlyBuiltDependencies` and `ignoredBuiltDependencies` unchanged.
- **Audit before and after.** Run
  `NPM_CONFIG_USERCONFIG=<empty file> pnpm audit --audit-level=high --config.registry=https://registry.npmjs.org/`
  on `develop` and on the branch, and put both summary lines in the PR. After: no critical, and the only high is
  braces GHSA-vfj7-8cjw-p6xm. #164's audit also listed `cross-spawn`, which has no Dependabot alert. If it is still
  high, fix it by the same ladder and add it to the table.
- **No stray changes.** No source file changes. The only manifest edits are the five webpack lines and the root
  `pnpm.overrides`. No other direct dependency moves. Put a `git diff develop -- '*package.json'` excerpt in the PR.
- **Gates.** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache` and `pnpm test:e2e --skip-nx-cache` are green.
  Spot-check under Node 24 that `$HOME/.nvm/versions/node/v24.21.0/bin/node packages/compiler/bin/bin.js --version`
  runs, because the bundle is rebuilt by the new webpack.
- **README.** No README change is needed: no CLI flag, config key or addon API changes.
- **After merge** (record it on the PR as a follow-up; you cannot check it on the branch): re-pull the open alerts.
  No critical, and no high except braces 190, may remain.

### Repo facts for the implementer

- **pnpm 10:** put `$HOME/.nvm/versions/node/v22.17.0/bin` first on `PATH` and confirm that `pnpm --version` prints
  10.34.1. The Homebrew pnpm 11 fails with E401. The checkout's `node_modules` is stale, so run an install first.
- **This slice needs the registry.** The patched versions (axios 1.20.0, js-yaml 3.15.2 and others) are not in the
  local store. The Artifactory login in `~/.npmrc` is expired; **never edit `~/.npmrc`**. Instead:
  - create an empty file and `export NPM_CONFIG_USERCONFIG=<that file>`;
  - pass `--config.registry=https://registry.npmjs.org/` to every resolving pnpm command;
  - afterwards, verify the lockfile with `--offline` (the frozen checks above).
- **pnpm 9.15.5** is only needed for the frozen check: `node $HOME/.cache/node/corepack/v1/pnpm/9.15.5/bin/pnpm.cjs`.
  Use `--lockfile-only` with it offline, because its store lacks the new tarballs.
- Node 24 for runtime checks is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`.
- Write commits in Arlo's notation without a colon (see the `commit-notation` skill). These are dev-only changes, so
  `E` fits. For example:
  - `E Raises the webpack devDependency to ^5.104.1`;
  - `E Refreshes vulnerable transitives within their parents' ranges`;
  - `E Overrides the axios and smol-toml versions nx pins`;
  - `d Adds the release note for the development dependency updates`.

  Put the GHSA ids in the override commit's body.
- Use `trash`, never `rm`. Scratch directories go outside the repo.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, then give it a descriptive title.
- Append ` → #<PR>` to the `infra/fix-transitive-alerts` line in the plan's `## Slices`
  (`docs/plans/2026-10-01-dependency-updates.md`), placed before its `<!-- builds: … -->` comment as on the other
  three lines, and commit that on this branch.

### Scope guard

This branch owns:
- `pnpm-lock.yaml`;
- the `webpack` devDependency line in the root, `packages/compiler`, `packages/node`, `packages/webpack` and
  `packages/webpack-test` manifests;
- `pnpm.overrides` in the root `package.json`;
- one bullet under `### Security` in `Release-Notes.md`;
- the `→ #<PR>` suffix on its own line in the plan.

It touches no source file, no README, no tsconfig, no workflow and no `nx.json`.

The branches in flight or starting now, checked against their PRs and plans:
- **#170 `bug/emit-skipped-rule`, #172 `bug/depends-closure-core`, #173 `bug/esm-check-package-subpaths`.** They
  change core and webpack sources, tests and READMEs, and each adds a `Release-Notes.md` entry under `### Changed` or
  `### Fixed`. Only `Release-Notes.md` overlaps. Your bullet goes in `### Security`, so expect a context conflict at
  most. None of them touches a manifest or the lockfile.
- **#171 `infra/typescript-6-ci-leg`.** It changes `.github/workflows/pull-request.yml` (adds a TypeScript 6 CI leg),
  `docs/rules/workflow.md` and its plan. There is no file overlap. If it merges first, its new CI leg also runs on your
  PR, so the lockfile must also install cleanly there.
- **`feature/neutral-module-compiler`** (docs/plans/2026-10-01-vite-plugin.md, starting now). Its slice is a
  bundler-neutral `ModuleCompiler` in core and `TsCompiler` reduced to a webpack host of it. It touches no
  `packages/vite`; that is a later slice. It overlaps with you only if it adds a dependency: then `package.json` and
  `pnpm-lock.yaml` collide. Never hand-merge `pnpm-lock.yaml`. Whoever merges second rebases on `develop`, keeps both
  manifest edits, regenerates the lockfile (pnpm 10, against the registry as above), re-checks the lodash edge and
  the version list above, and runs the frozen checks again.
- **Open Dependabot PRs: do not merge, rebase or close them.**
  - **#169 (security group, opened 2026-10-03)** bumps webpack to 5.104.1 in the root, compiler, node, webpack and
    webpack-test manifests. It also bumps `@babel/plugin-transform-modules-systemjs`, `@humanfs/node`,
    brace-expansion 1.x, browserslist, flatted and shell-quote in the lockfile. **This slice supersedes all of #169.**
    Say so in the PR body. The maintainer closes it after merge.
  - **#156 (production group)** moves commander to 15, comment-json to 5, typescript to 5.9.3, resolve.exports and
    memfs. It also raises lodash, which #164 already settled. This slice supersedes none of #156 beyond that lodash part,
    which is already done. Say that #156 is not superseded and stays the maintainer's decision.
  - #162 (the old security group) is already closed, so there is nothing to do.
  - Both open PRs touch the same manifests and `pnpm-lock.yaml`, so they will conflict once this branch merges.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside this scope.
Examples: a rung-1 refresh that moves a direct dependency, an override that nx rejects at runtime (run `pnpm build`,
which goes through nx), a webpack 5.11x change that breaks a webpack-test e2e case, or a new high alert whose only fix
crosses a major.
