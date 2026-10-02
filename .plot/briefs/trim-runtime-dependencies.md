<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — dependency-updates (slice: Published packages)

- **Plan (canonical):** `docs/plans/2026-10-01-dependency-updates.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #133 merged
- **Branch:** `bug/trim-runtime-dependencies` (base: `develop`, at `21823f79` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH); the implementer never merges it
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

**Ordering.** The plan's `## Slices` has four waves (`### ` headings): Dependabot config, nx, Published packages,
Transitive packages. This is wave 3. It waits on wave 1 (`infra/dependabot-config`, merged as #146) and wave 2
(`infra/upgrade-nx`, merged as #159), so it can start now. Wave 4 (`infra/fix-transitive-alerts`) waits for this
branch to merge, because it builds on the lockfile this branch produces.

### What to build

Two critical advisories and one high reach every user of websmith through the published manifests. Workspace
overrides cannot fix this, because users resolve the ranges in `packages/*/package.json`, not our lockfile.

- **`create-hash@1.2.0`** is an exact runtime dependency of `@quatico/websmith-core`
  (`packages/core/package.json:42`). It installs `sha.js@2.4.11` and `cipher-base@1.0.4` (both critical), plus
  `md5.js`, `ripemd160` and `hash-base`, for every user of `websmith-core`, `websmith-compiler` and `websmith-loader`.
  The only import is `packages/core/src/environment/browser-system.ts:9`, used on line 47:
  `createHash: (data: string): string => createHashFn("sha256").update(data).digest("hex")`. `createBrowserSystem` is
  public API: `packages/compiler/src/index.ts:8` re-exports it.
- **`path@0.12.7`** is an exact runtime dependency of core (`packages/core/package.json:45`) and a devDependency of
  the private `compiler-test` (`:44`). No source imports the npm package. Every `"path"` import resolves to the Node
  built-in. The package only installs `process`, `util@0.10.4` and `inherits@2.0.3` for users.
- **`lodash ^4.17.21`** in core (`:44`) and node (`packages/node/package.json:38`) admits versions with a high
  advisory (`<=4.17.23`). Core imports `lodash/merge` (`compile-service.ts:8`). Node imports `isArray` and `split`.

Make these changes:

1. **`browser-system.ts`.** Replace the `create-hash` import, and its `// @ts-expect-error no type declarations`
   line, with `import { createHash } from "node:crypto";`. Line 47 becomes
   `createHash("sha256").update(data).digest("hex")`. Leave the rest of the file alone, including the
   `/* eslint-disable no-console */` on line 1.
2. **`browser-system.spec.ts`.** The existing `describe("createHash")` (line 840) only checks that two calls agree, so
   it passes with any algorithm. Add tests that pin the sha256 hex digest (assemble/act/assert, `testObj`, `actual`):
   - `"hello"` → `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824`;
   - `""` → `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
   - `"€"` → `c4cc90ed3d26f12d4b08a75140970a7904035c31cbb4515a83f19b9003c00d1d`. This pins UTF-8 encoding of the string
     input.

   Computed with `printf '<input>' | shasum -a 256`. Write these tests first: they pass on `develop` (the digest does
   not change) and must still pass after the swap.
3. **Manifests.**
   - `packages/core/package.json`: delete `create-hash` and `path` from `dependencies`, and set `lodash` to `^4.18.1`.
   - `packages/node/package.json`: set `lodash` to `^4.18.1`.
   - `packages/compiler-test/package.json`: delete `path` from `devDependencies`.
   - Root `package.json`: delete `create-hash` (line 52) and `path` (line 69) from `devDependencies` (see the
     decisions below).
   - Leave `@types/lodash` alone.
4. **Lockfile.** Regenerate `pnpm-lock.yaml` with the repo's pnpm 10, offline (see "Done when" and "Repo facts").
5. **`Release-Notes.md`.** Add one entry under `## [Unreleased]` (see the decisions below).

### The decisions the plan settles — do not re-derive them

- **`node:crypto`, not a pure-JS hash library, and not a lockfile refresh.** The "browser" system is the in-memory
  virtual system. The compiler and `@quatico/websmith-testing` run it under Node, and the file already imports
  `node:path`. The plan's Open Point "`create-hash` replacement" chose `node:crypto`: no new dependency, the same
  digest, and synchronous like `ts.System.createHash`. Proof that the digest is identical: `create-hash`'s Node entry
  is `module.exports = require("crypto").createHash`, as the bundled `packages/compiler/bin/bin.js` shows (module
  535). Under Node, `sha.js` was installed but never executed. Rejected: refreshing `sha.js` to 2.4.12 inside
  `create-hash`'s `^2.4.0` range. That fixes only our lockfile, while the exact `create-hash 1.2.0` pin keeps the
  subtree in every user's install.
- **Replace `create-hash`, do not just drop it.** The panel was split on this. The consumer juror called it unused,
  because its `git grep createHash` found only `ts.sys.createHash`. The security juror found the import, and the
  moderator confirmed it is on the production path (`.plot/panels/2026-10-01-dependency-updates/panel.md`,
  "Where they differ", 1). Dropping the manifest line alone breaks `pnpm build`.
- **Drop `path`; the panel's "check before dropping" is done.** On `develop`, `git grep` finds no import of the npm
  package. `packages/compiler/webpack.config.js:9` and `cjs-names.spec.ts:228` use `"path"`, which is the built-in.
- **`lodash ^4.18.1` reproduces #110, which is closed.** The plan closes #110 in favour of this slice. It is already
  closed (state `CLOSED` on 2026-10-02), so there is nothing to close.
- **Brief-level decision: also drop the root `create-hash` and `path` devDependencies.** The plan names only core and
  compiler-test. But the root `package.json` declares both as well, and nothing at the root uses them (no script, no
  config). If they stay, `sha.js@2.4.11` and `cipher-base@1.0.4` stay in `pnpm-lock.yaml` and their two critical
  Dependabot alerts stay open as `development`. That defeats the plan's rule, "no open critical or high alert after
  the last slice". Name this extension in the PR body.
- **The Release-Notes entry belongs to this slice.** The plan's Changelog gives the wording:
  - "`@quatico/websmith-core` no longer depends on `create-hash` and `path`; it hashes with `node:crypto`. Users no
    longer install `sha.js` and `cipher-base` (two critical advisories) through websmith."
  - "`@quatico/websmith-core` and `@quatico/websmith-node` require `lodash ^4.18.1` (was `^4.17.21`, which admits
    versions with a high advisory)."

  Put both under a new `### Security` heading at the end of `## [Unreleased]`, after `### Removed` (Keep a Changelog
  defines that section). Do not use `### Changed` or `### Fixed`: #160, #161 and `bug/cli-config-parse-and-addons-dir`
  all write there, and a separate section keeps the merge conflict to a trivial one. Leave `### Removed - TBA` as it
  is. No README change: no CLI flag, config key or addon API changes.
- **The success metrics are a published-tree check and a dev-inclusive audit, not `pnpm audit --prod`.** GitHub
  re-scans only the default branch, so the alert count is re-checked after merge.

### Done when

These are the assertions a naive implementation would pass without. Record the evidence in the PR body.

- **Digest pinned.** The three digest tests above exist in `browser-system.spec.ts`. To show they bite, temporarily
  change `"sha256"` to `"sha1"` and confirm they fail, then revert. The existing "same hash for multiple calls" test
  passes either way, which is why it is not enough.
- **No trace in source or manifests.**
  - `git grep -n "create-hash" -- ':!pnpm-lock.yaml' ':!docs' ':!.plot' ':!Release-Notes.md'` is empty.
  - `git grep -n '"path": "0.12.7"' -- '*package.json'` is empty.
  - `git grep -n '"lodash"' -- 'packages/*/package.json'` shows exactly two lines (core, node), both `^4.18.1`.
- **Lockfile.**
  - None of `create-hash@`, `sha.js@`, `cipher-base@`, `md5.js@`, `ripemd160@`, `hash-base@`, `path@0.12.7` or
    `lodash@4.17.21` remains.
  - `lodash@4.18.1` is the only lodash.
  - The header still says `lockfileVersion: '9.0'`.
  - `grep -c 'tarball:' pnpm-lock.yaml` is 0.
  - `pnpm install --frozen-lockfile --offline` passes with pnpm 10, and
    `node $HOME/.cache/node/corepack/v1/pnpm/9.15.5/bin/pnpm.cjs install --frozen-lockfile --offline --lockfile-only`
    passes with pnpm 9.15.5 (CI's major).
  - The diff is small. A dry run on `21823f79` gave about 117 lines, 17 added and 100 deleted. Besides the removals
    and lodash, pnpm 10 adds 8 `libc: [glibc]` / `libc: [musl]` lines on Linux native-binary entries such as
    `@nx/nx-linux-*-gnu` / `-musl`. That is pnpm 10's lockfile format, and pnpm 9.15.5 accepted it frozen in the dry
    run. Name the lines in the PR.
  - No package new to the tree runs install scripts or ships a native binary. This slice only removes packages, so
    the before/after install-script scan should show no addition. Say so in the PR.
- **Published-tree check (fails on `develop`, passes on the branch).** Run it on both and paste both outputs.
  1. `pnpm build`.
  2. `pnpm pack --pack-destination <scratch>` in `packages/api`, `packages/core`, `packages/compiler` and
     `packages/node`. All four are needed: pack turns `workspace:*` into `0.10.0`, and without the local api and core
     tarballs npm would fetch 0.10.0 from the registry, which still carries `create-hash`.
  3. In a fresh scratch directory: `npm init -y`, then
     `NPM_CONFIG_USERCONFIG=<empty file> npm install --registry=https://registry.npmjs.org/ <scratch>/*.tgz`.
  4. `npm ls sha.js cipher-base create-hash path` must print `(empty)` for all of them.
  5. Also print the packed manifests' ranges:
     `tar -xOf <scratch>/quatico-websmith-core-0.10.0.tgz package/package.json | node -e 'const j=JSON.parse(require("fs").readFileSync(0));console.log(j.dependencies)'`
     (and the same for node). They must show `"lodash": "^4.18.1"` and no `create-hash` or `path`.

  **Trap:** `npm ls lodash` alone proves nothing. A fresh install of `develop`'s `^4.17.21` already resolves 4.18.1
  today. The fix is the published floor, so assert the packed range, not the installed version.
- **Bundle check.** After `pnpm build`, `grep -c "create_hash\|create-hash" packages/compiler/bin/bin.js` is 0 (non-zero
  on `develop`). The bundle's `crypto` stays an external `require("crypto")`, because `target: "node"`.
- **Audit before and after.** Run
  `NPM_CONFIG_USERCONFIG=<empty file> pnpm audit --audit-level=high --config.registry=https://registry.npmjs.org/`
  on `develop` and on the branch, and put both summary lines in the PR. The after-run shows no advisory for
  `sha.js`, `cipher-base` or `lodash`. Other residue belongs to `infra/fix-transitive-alerts`. List it, do not fix it.
- **No stray changes.** No source file changes other than `browser-system.ts` and `browser-system.spec.ts`. No
  `pnpm.overrides`, `onlyBuiltDependencies` or `ignoredBuiltDependencies` change. No other dependency version moves.
- **Gates.** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache` and `pnpm test:e2e --skip-nx-cache` are green.
  Spot-check under Node 24 that `$HOME/.nvm/versions/node/v24.21.0/bin/node packages/compiler/bin/bin.js --version`
  runs.
- **After merge** (record it on the PR as a follow-up; you cannot check it on the branch): re-pull the alerts with
  `gh api --method GET repos/quatico-solutions/websmith/dependabot/alerts -f state=open --paginate`. The `sha.js`,
  `cipher-base` and `lodash` alerts must be closed. Users get the published fix only with the next release.

### Repo facts for the implementer

- **pnpm 10:** put `$HOME/.nvm/versions/node/v22.17.0/bin` first on `PATH` and confirm that `pnpm --version` prints
  10.x (10.34.1). The Homebrew pnpm 11 fails with E401.
- **Offline works for this slice.** `lodash@4.18.1` is already in the pnpm 10 store (`~/Library/pnpm/store/v10`), and
  the change otherwise only removes packages. Run `pnpm install --offline`. The dry run did this successfully.
- **pnpm 9.15.5** is only needed for the frozen check: `node $HOME/.cache/node/corepack/v1/pnpm/9.15.5/bin/pnpm.cjs`.
  Its store (`store/v3`) lacks lodash 4.18.1, so use `--lockfile-only` with it offline. A full pnpm 9 install offline
  fails with `ERR_PNPM_NO_OFFLINE_TARBALL`.
- **Registry access.** The Artifactory login in `~/.npmrc` is expired; **never edit `~/.npmrc`**. If offline ever
  fails, and for `pnpm audit` and the scratch `npm install`:
  - create an empty file and `export NPM_CONFIG_USERCONFIG=<that file>`;
  - pass `--config.registry=https://registry.npmjs.org/` to pnpm, or `--registry=https://registry.npmjs.org/` to npm;
  - verify the lockfile with `--offline` afterwards.
- Node 24 for runtime checks is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`.
- Write commits in Arlo's notation without a colon (see the `commit-notation` skill). For example:
  - `t Pins the sha256 digest of the browser system`;
  - `R Hashes with node:crypto instead of create-hash`;
  - `B Drops create-hash and path and raises the lodash floor`;
  - `d Adds the release note for the trimmed runtime dependencies`.

  The manifest change alters what users install, so it is not `E`.
- Use `trash`, never `rm`. Scratch directories go outside the repo.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, then give it a descriptive title.
- Append ` → #<PR>` to the `bug/trim-runtime-dependencies` line in the plan's `## Slices`
  (`docs/plans/2026-10-01-dependency-updates.md`), placed before its `<!-- builds: … -->` comment as on the other two
  lines, and commit that on this branch.

### Scope guard

This branch owns:
- `packages/core/src/environment/browser-system.ts` and `browser-system.spec.ts`;
- the `create-hash`, `path` and `lodash` lines in `package.json`, `packages/core/package.json`,
  `packages/node/package.json` and `packages/compiler-test/package.json`;
- `pnpm-lock.yaml`;
- the `### Security` section under `## [Unreleased]` in `Release-Notes.md`;
- the `→ #<PR>` suffix on its own line in the plan.

It touches no README, no tsconfig, no workflow, no `nx.json`, no `pnpm.overrides` and no other source file.

The branches in flight or starting now, checked against their plans and branches:
- **`infra/typescript-6-toolchain` (#144, in progress): real collision.**
  - Its branch already changes all ten manifests (typescript-eslint and `@typescript-eslint/*` to `8.58.0`, ts-jest
    `^29.4.7`, ts-loader `^9.6.2`), about 2,000 lines of `pnpm-lock.yaml`, and the tsconfigs.
  - Manifest hunks will meet: in the root, your `path` deletion (line 69) sits three lines above its `ts-jest`
    hunk (line 72); in `compiler-test`, `path` (line 44) is inside its `@@ -44,8` hunk. In core and node your lines
    are 10 or more lines away from its hunks.
  - The lockfile conflicts whoever merges second. Never hand-merge `pnpm-lock.yaml`. Rebase on `develop`, keep both
    manifest edits, and regenerate the lockfile offline (pnpm 10), then run the frozen checks again.
- **`bug/esm-check-import-misses` (#160) and `bug/tsc-default-target-interop` (#161), merging soon.** Both edit
  `Release-Notes.md` `## [Unreleased]` (`### Changed` / `### Fixed`) and core sources (`compiler/esm/*`,
  `Compiler.ts`, `config/effective-options.ts`, `system.ts`, `system.spec.ts`). Only the Release-Notes file
  overlaps, and your separate `### Security` section keeps it to a context conflict at most. Neither touches
  `browser-system.ts`, a manifest or the lockfile.
- **`bug/loader-resolve-options-once`** (docs/plans/2026-10-02-loader-options-once.md, starting now): the webpack
  loader in `packages/webpack/src` and core option resolution, `compiler-instances.spec.ts`, webpack-test e2e, and
  possibly the README and AddonContext docs. No overlap, unless it adds a dependency. If it does, the lockfile rule
  above applies.
- **`bug/cli-config-parse-and-addons-dir`** (docs/plans/2026-10-02-cli-error-exit-gaps.md, starting now):
  `resolve-compiler-config`, `command`, `AddonRegistry`, `bin.test.ts` and a `Release-Notes.md` entry. Only
  `Release-Notes.md` overlaps, as above.
- **Dependabot PRs, all on hold: do not merge, rebase or close them.**
  - #156 (production group) also raises lodash to `^4.18.1` in core and node, and bumps `typescript` to 5.9.3 and
    `comment-json` to 5.
  - #158 (development group, 35 updates).
  - #162 (security group, opened 2026-10-02) raises lodash to `^4.18.1` in core and node, and moves the root `nx` to
    `^23.2.1`.
  - All three touch the same manifests and `pnpm-lock.yaml`. Say in the PR body that it supersedes the lodash part of
    #156 and #162. The maintainer decides what happens to them.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside this scope.
Examples: a test or e2e fixture that depends on the `create-hash` module, a consumer of `createBrowserSystem` that
runs outside Node, or a pnpm 10 lockfile that pnpm 9 refuses as frozen.
