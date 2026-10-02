<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — dependency-updates (slice: nx)

- **Plan (canonical):** `docs/plans/2026-10-01-dependency-updates.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #133 merged
- **Branch:** `infra/upgrade-nx` (base: `develop`, at `c13f65f3` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH); the implementer never merges it
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

**Ordering.** The plan's `## Slices` has four waves (`### ` headings): Dependabot config, nx, Published packages,
Transitive packages. This is wave 2. It waits on wave 1, `infra/dependabot-config`, which merged as #146, so it can
start now. Waves 3 (`bug/trim-runtime-dependencies`) and 4 (`infra/fix-transitive-alerts`) wait for this branch to
merge. Wave 4 also builds on the lockfile this branch produces: it decides whether an `axios@1` override is needed
from what nx 22 leaves behind (see "Done when").

### What to build

nx 18.3.4 and the dead `@nrwl/nx-cloud` 18.0.1 bring about half of `develop`'s Dependabot alerts. Counts on
2026-10-02 (`gh api --method GET repos/quatico-solutions/websmith/dependabot/alerts -f state=open --paginate`):

- **All open alerts:** 85. Of these, 84 are `development` (4 critical, 46 high, 29 medium, 5 low) and 1 is `runtime`
  (`braces`, high).
- **Alerts in the nx subtree:** 40, made up of 1 critical, 19 high, 18 medium and 2 low.
  - critical: `form-data` (1);
  - high: `axios` 11, `tar` 6, `form-data` 1, `tmp` 1;
  - medium: `axios` 13, `tar` 2, `nx` 2 (alert numbers 146 and 147, not PRs; first patched 22.7.2), `follow-redirects` 1;
  - low: `axios` 1, `tmp` 1.
- **Where they come from in `pnpm-lock.yaml`:**
  - `nx@18.3.4` brings `axios@1.6.8` and `tmp@0.2.3`;
  - `@nrwl/nx-cloud` → `nx-cloud@18.0.1` brings `axios@1.1.3` and `tar@6.2.1`, its only `tar` parent;
  - both axios versions bring `form-data@4.0.0` and `follow-redirects@1.15.6`;
  - `@nx/devkit@18.3.4` brings `tmp@0.2.3`.
- **Dev-inclusive audit baseline on `develop` `c13f65f3`:** `pnpm audit --audit-level=high` reports
  `165 vulnerabilities found`, `Severity: 12 low | 59 moderate | 89 high | 5 critical`. Re-run it yourself. The
  number counts advisory paths and does not match the alert count.

Make these changes:

1. **Manifests.** Bump `@nx/eslint-plugin` from `^18.3.4` to the newest 22.x in all ten manifests: the root
   `package.json` and the nine `packages/*/package.json`. Bump `nx` (`^18.3.4`) in the root only, since no package
   declares it. Do not add `nx` to the packages. Use the same spec for both, keeping the caret style
   (`^22.7.12`, or a newer 22.x if one appears: check with `npm view nx@22 version | tail -1`). Delete
   `"@nrwl/nx-cloud": "18.0.1"` from the root `devDependencies`.
2. **`nx migrate`.** Run `pnpm exec nx migrate <version>`. If it writes `migrations.json`, install, run
   `pnpm exec nx migrate --run-migrations`, then `trash migrations.json`. Never commit it. It will find little. nx is
   only a script runner here: no `project.json`, no `@nx/*` executors, and `nx.json` extends `nx/presets/npm.json`
   (the preset still exists in 22.7.12). Run from 18.3.4, the 22.6 and 22.7 migrations append `.claude/worktrees`,
   `.nx/polygraph` and `.nx/self-healing` to `.gitignore`. Revert those lines. `.nx` (line 25) already covers the
   two `.nx` entries, and `.claude/*` ignore rules are not this plan's business.
3. **Rewrite `nx.json` by hand** to:
   - remove `tasksRunnerOptions` completely;
   - add a top-level `"cacheDirectory": ".nx-cache"`. The path stays the same, and `.gitignore` and
     `license-config.json` already name it;
   - add `"cache": true` to `targetDefaults` for exactly the five former `cacheableOperations`: `dist`, `test`,
     `lint`, `build` and `test:e2e`. Merge it into the existing `dist`, `build` and `lint` entries, keeping their
     `dependsOn` and `outputs`. Add new `test` and `test:e2e` entries. `typecheck` stays uncached, as it is today;
   - replace the deprecated `"affected": { "defaultBase": "develop" }` with a top-level
     `"defaultBase": "develop"`. nx 22's `nx-json.d.ts` marks `affected` `@deprecated`, use `defaultBase`.
4. **Lockfile.** Regenerate `pnpm-lock.yaml` with pnpm 9, the version CI runs, and review the diff (see "Done when").
5. **ESLint.** Confirm `eslint.config.js` still works with `@nx/eslint-plugin` 22. It only does
   `require("@nx/eslint-plugin")` and registers the result as `plugins: { "@nx": nxPlugin }`. No `@nx/*` rule is
   configured. 22.7.12 declares peers `@typescript-eslint/parser ^6.13.2 || ^7 || ^8` and
   `eslint-config-prettier ^10` (optional), so the repo's typescript-eslint 8.22 and eslint-config-prettier 10
   fit. Do not edit `eslint.config.js` unless lint fails, and if it does, report why in the PR.

### The decisions the plan settles — do not re-derive them

- **Newest 22.x, not 23.** `latest` on the registry is 23.2.1, and 22.7.12 is the last 22.x on 2026-10-02. The nx
  advisory's first patched version is 22.7.2. A move to 23 adds a further major of risk and clears no extra alert.
  The new Dependabot config will propose 23 on its own timeline. (Plan, Open Points: "nx target version"; panel
  security juror.)
- **Remove `@nrwl/nx-cloud`, do not upgrade it.** No `nxCloudId`, access token or `NX_CLOUD` appears anywhere in
  `nx.json`, the scripts or the workflows (all three jurors confirmed this; `git grep` on `develop` agrees). It is the
  only parent of `tar@6.2.1` and of `axios@1.1.3`. Rejected: overriding `tar@6` to 7. The plan says the nx upgrade
  drops it.
- **Rewrite the legacy `nx.json` keys by hand. Do not trust `nx migrate`, and do not leave them in place.** Two
  reasons make this the main trap:
  - nx 22 **still honours** `tasksRunnerOptions.default.options.cacheableOperations` and its `cacheDirectory`
    (`dist/src/tasks-runner/utils.js` and `dist/src/utils/cache-directory.js` in the 22.7.12 tarball). A
    version-only bump therefore passes every gate.
  - `nx migrate` from 18.3.4 does not rewrite them. The migration that moved `cacheableOperations` into
    `targetDefaults` is a 17.0.0 migration, so it is skipped. The 21.0.0 `remove-custom-tasks-runner` migration
    deletes only custom runners, and `nx/tasks-runners/default` is exempt.

  The plan names the target shape: `targetDefaults.<target>.cache: true` plus a top-level `cacheDirectory`. The
  build-tooling juror warned that "cache behaviour changing silently is the main risk".
- **Lock-step versions, ten manifests, no `nx` in packages.** The build-tooling juror counted `@nx/eslint-plugin` in
  the root and all nine packages. Mixed `nx` / `@nx/*` versions make nx warn and are what `nx migrate` exists to
  prevent.
- **pnpm 9 writes the lockfile, not pnpm 10.** CI runs `pnpm/action-setup@v3` with `version: 9`
  (`pull-request.yml`, `release-and-publish.yml`). The panel and the plan agree that a pnpm-10-written lockfile risks
  failing `--frozen-lockfile` there. Dependabot PR #152 (action-setup 3 → 6) keeps `version: 9`. If something
  changes the CI pnpm major before you finish, use what CI then uses and say so in the PR.
- **`onlyBuiltDependencies: ["@swc/core"]` and `ignoredBuiltDependencies: ["nx"]` stay as they are**, unless the
  lockfile review justifies a change in the PR. nx 22.7.12 still ships a `postinstall` (`dist/bin/post-install`),
  and it stays ignored.
- **The success metric is a dev-inclusive audit, not `pnpm audit --prod`.** `--prod` sees only `braces`. GitHub
  re-scans only the default branch, so the alert count is re-checked after merge, not on the PR.
- **No Release-Notes entry and no README change.** The plan's Changelog lists this as "Development dependencies
  updated … no change to the published packages' behaviour". The plan gives the Release-Notes entry to
  `bug/trim-runtime-dependencies`. `@nx/eslint-plugin` is a devDependency in every published package, so no
  published range changes.

### Done when

These are the assertions a naive implementation would pass without. Record the evidence in the PR body.

- **Manifests.** `git grep -n -E '"(nx|@nx/[a-z-]+|@nrwl/[a-z-]+)"' -- '*package.json'` shows:
  - exactly ten `@nx/eslint-plugin` lines and one `nx` line (root), all with the same 22.x spec;
  - no `@nrwl/*`.

  In `pnpm-lock.yaml`, `nx@` and `@nx/eslint-plugin@` (with `@nx/js`, `@nx/devkit` and `@nx/workspace`) resolve to
  one and the same 22.x version, and no `@nx/*@18` remains.
- **`nx.json`.** It contains no `tasksRunnerOptions`, `cacheableOperations`, `runner` or `affected`. It has
  top-level `"cacheDirectory": ".nx-cache"` and `"defaultBase": "develop"`, and `"cache": true` on exactly `dist`,
  `test`, `lint`, `build` and `test:e2e`, with the existing `dependsOn` and `outputs` unchanged.
- **Cache smoke check.**
  1. `trash .nx-cache .nx` if present.
  2. Run `pnpm test` once.
  3. Run `pnpm test` again.

  The second run must print that Nx read the output from the cache for **6 out of 6** tasks (`test` exists in api,
  compiler, core, node, testing and webpack). `.nx-cache` must have been (re)created, and `.nx/cache` must not have
  been. That proves the top-level `cacheDirectory` is honoured, not a default. Paste both summary lines and
  `ls .nx-cache | head`. A config that dropped `tasksRunnerOptions` without adding `cacheDirectory` would still pass
  the 6/6 check, which is why the directory is checked as well.
- **nx subtree gone from the lockfile.** None of these strings remain: `nx-cloud@`, `tar@6`, `axios@1.1.3`,
  `axios@1.6.8`, `form-data@4.0.0`, `follow-redirects@1.15.6`, `tmp@0.2.3`. 22.7.12 pins `axios 1.18.1`,
  `form-data 4.0.6`, `follow-redirects 1.16.0` and `tmp 0.2.7` exactly.
- **Audit before and after.** Run the same command on `develop` and on the branch, and put both summary lines in the
  PR:
  `NPM_CONFIG_USERCONFIG=<empty file> pnpm audit --audit-level=high --config.registry=https://registry.npmjs.org/`

  The after-run shows no advisory for `nx`, `tar`, `form-data`, `tmp` or `follow-redirects`, and no critical or high
  for `axios`. **Expected residue, not a failure:** two *medium* axios advisories fixed only in 1.20.0
  (GHSA-j8rh-479h-cp32, GHSA-9fr6-4gfg-395g) stay, because nx 22.7.12 pins axios 1.18.1 exactly. Name them in the PR
  as input for `infra/fix-transitive-alerts`, whose plan line foresees an `axios@1` override for this case. Do not
  add an override here. List, in the PR, any critical or high whose path still runs through `nx` or `@nx/*` after the
  upgrade (for example babel or minimatch through `@nx/js`), with the slice that owns it.
- **Lockfile written by pnpm 9 and reviewed.**
  - The header still says `lockfileVersion: '9.0'`.
  - `pnpm install --frozen-lockfile --offline` passes with pnpm 9 (the CI check) **and** with pnpm 10.
  - `grep -c 'tarball:' pnpm-lock.yaml` is still 0. A non-npmjs resolution would show up there, because the
    expired Artifactory registry in `~/.npmrc` must never leak in.
  - The PR lists packages that are new to the tree and run install scripts or ship native binaries. Run this scan
    from a scratch file, never committed, before and after the install, and diff the two outputs.

    ```js
    const fs = require("fs"), p = require("path"), root = "node_modules/.pnpm", out = new Set();
    for (const d of fs.readdirSync(root)) { const nm = p.join(root, d, "node_modules"); if (!fs.existsSync(nm)) continue;
      for (const e of fs.readdirSync(nm)) for (const n of e.startsWith("@") ? fs.readdirSync(p.join(nm, e)).map(x => p.join(e, x)) : [e]) {
        const dir = p.join(nm, n); try { const j = JSON.parse(fs.readFileSync(p.join(dir, "package.json"))), s = j.scripts || {};
          const t = ["preinstall", "install", "postinstall"].filter(k => s[k]).concat(fs.existsSync(p.join(dir, "binding.gyp")) ? ["gyp"] : []);
          if (t.length) out.add(`${j.name}@${j.version} ${t}`); } catch {} } }
    console.log([...out].sort().join("\n"));
    ```

    Also diff `find node_modules/.pnpm -name '*.node' | sed 's|.*/.pnpm/||' | sort`.

    The baseline on `develop` is `@swc/core@1.5.0 postinstall` and `nx@18.3.4 postinstall`, plus the prebuilt
    `@nx/nx-<platform>` and `@swc/core-<platform>` binaries. nx 22 declares an optional peer `@swc/core ^1.15.8`.
    If pnpm pulls a newer `@swc/core` for it, that is a new allowed build (`onlyBuiltDependencies`) and must be
    named and justified. Do not bump `@swc/core` deliberately.
- **No stray files.** No `migrations.json`. `.gitignore` is unchanged. No source file under `packages/*/src` or
  `packages/*/test` changes.
- **Gates.** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache` and `pnpm test:e2e --skip-nx-cache` are green.
  The cache check above is the only cached run. Spot-check under Node 24 that
  `$HOME/.nvm/versions/node/v24.21.0/bin/node node_modules/nx/bin/nx.js --version` reports 22.x (the native binary
  loads). CI's `dist (22)` and `dist (24)` cover the rest.
- **After merge** (record it on the PR as a follow-up; you cannot check it on the branch): re-pull the alert list
  with the `gh api` call above. The 38 non-axios-medium alerts of the nx subtree are closed, and no critical or high
  for `axios`, `tar`, `form-data`, `tmp`, `follow-redirects` or `nx` is open.

### Repo facts for the implementer

- **pnpm 10 for normal work:** put `$HOME/.nvm/versions/node/v22.17.0/bin` first on `PATH` and confirm that
  `pnpm --version` prints 10.x. The Homebrew pnpm 11 fails with E401.
- **pnpm 9 for the lockfile.** Two ways to get it:
  - *Offline:* run the cached binary with node:
    `node $HOME/.cache/node/corepack/v1/pnpm/9.15.5/bin/pnpm.cjs` (also at
    `$HOME/Library/pnpm/.tools/pnpm/9.15.5/node_modules/pnpm/bin/pnpm.cjs`).
  - *From the registry:* `pnpm dlx pnpm@9 install`, which needs the public-registry setup below.

  CI takes the newest 9.x, and 9.15.5 writes the same `lockfileVersion: '9.0'`.
- **Registry access.** The Artifactory login in `~/.npmrc` is expired; **never edit `~/.npmrc`**. nx 22 is not in
  the local store, so this slice needs the public registry for `nx migrate`, the install and `pnpm audit`.
  - Create an empty file and `export NPM_CONFIG_USERCONFIG=<that file>` for the whole session. Otherwise the root
    `preinstall` (`npx only-allow pnpm`) and `nx migrate` also hit Artifactory.
  - Pass `--config.registry=https://registry.npmjs.org/` to pnpm, and set
    `NPM_CONFIG_REGISTRY=https://registry.npmjs.org/` for `nx migrate` and `npm view`.
  - After the lockfile exists, verify with `--offline`.
- Node 24 for runtime checks is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`.
- Write commits in Arlo's notation without a colon, for example `E Upgrades nx to 22 and removes nx-cloud` and
  `R Moves nx cache settings to targetDefaults` (see the `commit-notation` skill). A dependency bump that changes no
  behaviour is `E`.
- Use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, then give it a descriptive title.
- Append ` → #<PR>` to the `infra/upgrade-nx` line in the plan's `## Slices`
  (`docs/plans/2026-10-01-dependency-updates.md`), placed before its `<!-- builds: … -->` comment as on the
  `infra/dependabot-config` line, and commit that on this branch.

### Scope guard

This branch owns:
- the `nx`, `@nx/eslint-plugin` and `@nrwl/nx-cloud` lines in `package.json` and the nine `packages/*/package.json`;
- `nx.json`;
- `pnpm-lock.yaml`;
- the `→ #<PR>` suffix on its own line in the plan.

It touches no `Release-Notes.md`, no README, no tsconfig, no `eslint.config.js` (unless lint forces it, with the
reason in the PR), no `.gitignore`, no workflow, no `pnpm.overrides` and no source or test file.

The branches in flight now, checked against their plans on `develop`:
- **`infra/typescript-6-toolchain` (#144): real collision.** It bumps ts-loader, ts-jest and typescript-eslint /
  `@typescript-eslint/*` in the same ten manifests and regenerates `pnpm-lock.yaml`.
  - In every manifest its lines sit one to four lines below `@nx/eslint-plugin` (in `packages/api`:
    `@nx/eslint-plugin` on line 43, `@typescript-eslint/eslint-plugin` on line 45).
  - The lockfile will conflict whoever merges second. Never hand-merge `pnpm-lock.yaml`. Rebase on `develop`, keep
    both manifest edits, and regenerate the lockfile with pnpm 9.
  - Peers stay compatible as long as #144 keeps typescript-eslint on 8.x, which its plan does.
    `@nx/eslint-plugin` 22 needs `@typescript-eslint/parser ^8` and `@typescript-eslint/utils ^8`.
- `infra/esm-bench-watchdog` (#134): `packages/webpack-test/perf/esm-watch-bench.cjs` and its scheduler. No overlap.
- `bug/tsc-default-target-interop` (#135): core `tsDefaults`, `config/effective-options.ts`, `Compiler.ts`,
  `system.ts`, compiler-test and webpack-test fixtures, `Release-Notes.md`. No overlap.
- `bug/cli-project-directory` (#136, PR #147 open): `parsed-command-line`, `ResolvedCompilerOptions`, `command`,
  `bin.test.ts`, `Release-Notes.md`, README. No overlap.
- `bug/esm-check-import-misses` (#137): `packages/core/src/compiler/esm/*` (`import-rules`, `check-esm-imports`),
  `bin.test.ts`, `webpack-esm-check.test.ts`, the README and `Release-Notes.md`. No overlap.
- Already merged: #145 (`bug/esm-check-false-positives`) and #146 (`infra/dependabot-config`). Your base contains
  both.
- Open Dependabot PRs that touch your files: #139 (fast-uri) is lockfile-only. The plan merges it before wave 4,
  possibly while this PR is open. If it lands first, rebase and regenerate the lockfile. #108 and #110 will be
  closed by later slices, so do not merge or rebase them.

The `Release-Notes.md` `## [Unreleased]` contention among #135, #136 and #137 does not involve this branch.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside this scope.
Examples: nx 22 rejecting `extends: "nx/presets/npm.json"`, `@nx/eslint-plugin` 22 changing its export shape, or a
pnpm 9 lockfile that pnpm 10 refuses as frozen.
