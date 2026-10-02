<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — typescript-6-support (slice: Toolchain)

- **Plan (canonical):** `docs/plans/2026-10-02-typescript-6-support.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #144 merged
- **Branch:** `infra/typescript-6-toolchain` (base: `develop`, at `06e086b5` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH); the implementer never merges it
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

**Ordering.** This is the first of the plan's eight slices. It waits on nothing. Every later slice needs the repo
to build on 6.0.3, so all of them follow it. The next one is `infra/typescript-6-ci-leg`, which adds the advisory
6.0.3 CI cell. That cell can only go green on `pnpm build` once this slice is merged. No slice in this plan carries
a `waits:` on this branch. The plan's slice order is the dependency.

### What to build

With `typescript` overridden to 6.0.3, `develop` does not build. The plan's probe (Notes, "Probe", at `cfb284cc`)
hit three walls in this order:

1. **Repo tsconfigs (row 1).** `pnpm build` fails in the first project, `websmith-api`. The causes:
   `moduleResolution: "node"` gives TS5107 (deprecated; root `tsconfig.json:48`, `packages/api/tsconfig.json:6`,
   `packages/core/tsconfig.json:8`, `packages/testing/tsconfig.json:6`). `downlevelIteration` gives TS5101
   (`tsconfig.json:19`). An `outDir` with no `rootDir` gives TS5011, because 6.0 changed the `rootDir` default. Every
   package `tsconfig.json` has an `outDir`.
2. **The CLI bundle (row 2).** `packages/compiler/webpack.config.js:33-40` runs ts-loader 9.5.2 with
   `transpileOnly`. That version passes `rootDir: undefined` to `transpileModule`, so every bundled file reports
   TS5011: 81 errors. ts-loader 9.6.2 respects `rootDir`. The `rootDir` must then also cover `../core/src`, because
   the alias at `:27` bundles core from source. Otherwise you get TS6059.
3. **One type error (row 3).** `packages/testing/src/fusion-fs.ts:182`: `actualFs.watchFile(...)` returns Node's
   `StatWatcher`, and the function is typed with memfs's `StatWatcher` (imported at `:20`), so you get TS2740.

The probe got past wall 1 with an `ignoreDeprecations: "6.0"` stand-in. That stand-in is not the fix (see below).
After all three walls were fixed, `pnpm build` was green and `pnpm lint` exited 0 on 6.0.3. Lint passed only
because typescript-eslint 8.22 does not refuse a TypeScript outside its range (`<5.8.0`). ts-jest 29.2.5 declares
`typescript <6`.

This slice makes the repo itself valid on both 5.7.3 and 6.0.3. It changes the tsconfigs, the CLI's webpack
config, one cast, and the dev toolchain versions. It changes no product behaviour. `pnpm test` and `pnpm test:e2e`
stay red on 6.0.3 (65 and 124+ failures, rows 4-8 and 11). Those failures belong to later slices and #135. The plan
is canonical. This brief is orientation.

Concretely:

- **Root `tsconfig.json`:** delete the `downlevelIteration` line (`:19`). Set `"moduleResolution": "bundler"` at
  `:48`.
- **Every CommonJS package `tsconfig.json`:** set `"moduleResolution": null`. In `api`, `core` and `testing`,
  replace their own `"node"` with `null`. Add the line to `compiler`, `node` and `webpack`. **Also add it to
  `example-addons`** (`module: "CommonJS"` at its `tsconfig.json`). The plan's Design list of six omits it, but the
  slice line says "every CommonJS package", and without the line it inherits `bundler`. I executed this on 5.7.3
  (the repo's `node_modules/typescript`): a config that extends `module: esnext` + `bundler` and sets
  `module: commonjs` gives TS5095. The same config with `"moduleResolution": null` added exits 0.
- **`"rootDir": "./src"` next to every `outDir`:** all nine `packages/*/tsconfig.json` and
  `packages/example-addons/tsconfig.execute.json` (used by its `execute` script). Every one of these includes only
  `src/**`, and no `src` file imports outside `src`, so the emitted layout does not change.
- **Every `packages/*/tsconfig.test.json`:** set `"rootDir": "."`, and do the same in the `tsconfig.lint.json`
  files. This is not in the plan. A naive change breaks without it (see Done when).
- **`packages/compiler/webpack.config.js`:** add `compilerOptions: { rootDir: path.resolve(__dirname, "..") }`
  (that is `packages/`) to the ts-loader options. Keep `transpileOnly`, the aliases and the `typescript` external.
- **`packages/testing/src/fusion-fs.ts:182`:** cast the `actualFs.watchFile(...)` branch the way its neighbours
  already are (`as any`; `no-explicit-any` is off in `eslint.config.js:125`). Change nothing else.
- **Dev toolchain, in the root and in all nine `package.json` files where each one appears:**
  - ts-loader `^9.6.2` (devDependency in `compiler`, `node` and `webpack-test`, so the lockfile keeps one ts-loader);
  - ts-jest `^29.4` (29.4.14 is the newest 29.x and declares `typescript >=4.3 <7`);
  - `typescript-eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` and
    `@typescript-eslint/utils`, all at one release `>=8.58.0`. I checked the registry on 2026-10-02: 8.58.0 is the
    first release that declares `typescript >=4.8.4 <6.1.0`, and 8.71.0 is `latest` with the same range. State the
    chosen version and its peer range in the PR.

### The decisions the plan settles — do not re-derive them

- **Root `bundler` + `"moduleResolution": null` per CommonJS package.** Each alternative was killed by an execution:
  - *`node16` + `module: node16`* changes what the packages emit (plan, rejected in Notes).
  - *Omitting `moduleResolution` at the root* resolves to `classic` on 5.7.3 under the root's `module: ESNEXT`.
  - *`bundler` inherited by the CommonJS packages* is TS5095 on 5.7.3. The ts6-semantics juror executed this, and I
    re-executed it.
  - *An explicit per-major value* has no version-free spelling.

  `null` resets the inherited value to each major's default: node10 on 5.7.3 (identical to today's `"node"`) and
  bundler on 6.0.3. Neither major gives a diagnostic (panel, executed). Do not write `"node10"`: it is TS5107 on
  6.0.3.
- **`rootDir: "./src"`, not `rootDir` removal or `"."`.** 6.0.3 gives TS5011 without it, and 5.7.3 ignores it
  because its computed common root is already `src`. With `"."` the output would move to `lib/src/...` and every
  `main`/`types` path would break.
- **ts-loader `rootDir` = `packages/`, not `packages/compiler/src`.** The `@quatico/websmith-core` alias pulls
  `../core/src` into the bundle, so a compiler-only root gives TS6059 with 9.6.2 (probe). Staying on 9.5.2 is not an
  option, because it drops `rootDir` in `transpileOnly` (81 × TS5011).
- **No `ignoreDeprecations` anywhere. This is settled.** `"6.0"` is TS5103 on 5.7.3 (only `"5.0"` is valid there).
  It silences 6.x only and fails on 7.0 tooling. The plan requires the repo to build clean on 6.x. The probe used
  it only as a stand-in to reach walls 2 and 3. Do not add it to any tsconfig, fixture or test.
- **The dev pin stays 5.7.3 in this slice. This is settled.** Every `"typescript": "5.7.3"` devDependency, every
  `5.x` peer, the CLI's `typescript` dependency (`packages/compiler/package.json:49`) and the lockfile's
  `typescript@5.7.3` stay as they are. The pin moves to 6.0.3 in `feature/typescript-6-peer-range`, after the
  6.0.3 cell has been green. A `pnpm.overrides` entry is never committed.
- **Toolchain floors come from the peer ranges, not from preference.** ts-jest 29.2.5 says `<6`.
  typescript-eslint 8.22 says `<5.8.0`, which is already outside today's 5.7.3 + 6.0.3 pair. Both new floors
  include 5.7.3, so the 5.7.3 cells keep a supported toolchain. #133 (`dependency-updates`) leaves the lint
  toolchain out, so this slice owns these bumps. Do not move jest, eslint or nx majors here.
- **Rule carried over: a 6.0.3 failure is triaged against 5.7.3 first.** The override re-resolves the whole tree,
  so toolchain drift is not a websmith bug.

### Done when

The plan's slice line is the specification: the Definition of Done is green on 5.7.3, and `pnpm build` and
`pnpm lint` are green on 6.0.3 through the override in a scratch copy, with the commands and output in the PR.
A naive implementation would pass without the following assertions:

- **`pnpm typecheck` gets no worse than on `develop`.** It is not in CI, but it breaks first. Six
  `tsconfig.test.json` files (`compiler`, `core`, `node`, `compiler-test`, `webpack-test`, `example-addons`)
  include `test`/`tests` next to `src`, and they inherit `rootDir: "./src"`. I executed this on 5.7.3: an
  inherited `rootDir` plus `noEmit` plus an included `test/` dir gives **TS6059** and exit 2. `pnpm build` and
  `pnpm test` (ts-jest `isolatedModules`, `diagnostics: false`) would never show it. Run `pnpm typecheck
  --skip-nx-cache` on `develop` and on the branch, and put both results in the PR. The local tree's
  `node_modules` is currently stale (`resolve.exports` is missing in core), so run `pnpm install --offline` first.
- **No TS5095 on 5.7.3**, including `example-addons`. `pnpm build` on 5.7.3 is the check, and it fails if the
  `null` reset is missing from any CommonJS package.
- **The emitted output is unchanged on 5.7.3.** Build `develop` and the branch, then compare each package's `lib/`
  (`diff -r`, ignoring `*.tsbuildinfo`). The only difference allowed is none. A changed `moduleResolution` or a
  wrong `rootDir` (`lib/src/...`) shows up here and nowhere else. For `packages/compiler/bin/bin.js`, report the
  diff. Expect at most ts-loader-version noise, and no module-format change.
- **6.0.3 is really installed in the scratch run.** Assert it, don't assume it (see the recipe). An override that
  pnpm ignored would let 5.7.3 go green.
- **Red before, green after on 6.0.3.** Run the same recipe on `develop`: `pnpm build` fails in `websmith-api` with
  TS5107. On the branch, `pnpm build` is green, `pnpm lint` exits 0, and there is no typescript-eslint "unsupported
  TypeScript version" warning. The scratch install shows no `typescript` peer warning from ts-jest, ts-loader or
  typescript-eslint. Record the `pnpm test` / `pnpm test:e2e` counts on 6.0.3 for information only. They are
  expected red, and fixing them is out of scope.
- **`pnpm-lock.yaml` changes only for ts-loader, ts-jest, typescript-eslint / `@typescript-eslint/*` and their
  transitive dependencies.** `typescript` stays `5.7.3`, and no `package.json` carries `pnpm.overrides`.
- **No `ignoreDeprecations`** anywhere in the diff: `git grep ignoreDeprecations` returns nothing new.

**How to verify 6.0.3 without committing the override.** Commit first; the copy is taken from `HEAD`.

```bash
export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"   # pnpm 10
S=$(mktemp -d /private/tmp/claude-501/ts6-scratch.XXXX)      # or your scratchpad
git archive HEAD | tar -x -C "$S" && cd "$S"
pnpm install --frozen-lockfile --offline                     # 5.7.3 tree from the store
pnpm pkg set pnpm.overrides.typescript=6.0.3                 # scratch copy only
: > "$S/.empty-npmrc"
NPM_CONFIG_USERCONFIG="$S/.empty-npmrc" pnpm install --no-frozen-lockfile \
  --config.registry=https://registry.npmjs.org/
node -p "require('typescript/package.json').version"         # root: 6.0.3
pnpm -r exec node -p "require('typescript/package.json').version"   # every line: 6.0.3
pnpm build && pnpm lint
cd - && trash "$S"
```

For the red-before run, use `git archive origin/develop` instead of `HEAD`. Paste the version lines, the
build/lint tail and the red-before TS5107 line into the PR. CI runs pnpm 9. Confirming the override on pnpm 9 is
`infra/typescript-6-ci-leg`'s job, not this slice's.

Plus the repo gates on 5.7.3: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`,
`pnpm test:e2e --skip-nx-cache`. CI (`pull-request.yml`, Node 22 and 24) must be green.

**No `Release-Notes.md` entry and no README change.** Only dev tooling and repo configs change. The plan's
Changelog has no line for this slice, and the published peers and the CLI's `typescript` are untouched.

If ts-jest 29.4 prints a deprecation warning about the `isolatedModules` option in `jest-base.config.ts`, note it
in the PR and leave the transform as it is, unless the warning fails the run.

### Repo facts for the implementer

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (put it first on `PATH`). The Homebrew pnpm 11 fails
  with E401.
- Installs on the branch use `--offline`. The Artifactory login in `~/.npmrc` is expired; **never edit
  `~/.npmrc`**. To fetch the new toolchain versions, use an empty file as `NPM_CONFIG_USERCONFIG` plus
  `--config.registry=https://registry.npmjs.org/`, for example
  `NPM_CONFIG_USERCONFIG=<empty> pnpm -r up ts-jest@^29.4 --config.registry=https://registry.npmjs.org/`.
  Check that the lockfile keeps `lockfileVersion: '9.0'`.
- Node 24 for runtime checks is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`.
- Write commits in Arlo's notation without a colon, for example `E Makes the repo tsconfigs valid on TypeScript 5.7
  and 6.0` (see the `commit-notation` skill).
- Use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`. Do not use `gh pr create`.
- Append `→ #<PR>` to the `infra/typescript-6-toolchain` line in the plan's `## Slices`
  (`docs/plans/2026-10-02-typescript-6-support.md`), and commit that on this branch.

### Scope guard

This branch owns:
- the root `tsconfig.json`;
- `packages/*/tsconfig.json`, `tsconfig.test.json`, `tsconfig.lint.json` and
  `packages/example-addons/tsconfig.execute.json`;
- `packages/compiler/webpack.config.js`;
- `packages/testing/src/fusion-fs.ts` (the one cast);
- the ts-loader / ts-jest / typescript-eslint / `@typescript-eslint/*` devDependency lines in the root and the
  `packages/*/package.json` files;
- `pnpm-lock.yaml`;
- the `→ #<PR>` suffix on its own line in the plan.

Do not touch:
- `"typescript"` versions or peers, including node's `ts-loader: 9.x` peer;
- `.github/workflows/*` (that is `infra/typescript-6-ci-leg`);
- the fixture tsconfigs under `packages/compiler-test/test-data/projects/` (that is
  `bug/typescript-6-test-fixtures`);
- any `packages/*/src` file other than `fusion-fs.ts`;
- `Release-Notes.md`, READMEs, `jest-base.config.ts`, `eslint.config.js`.

The branches starting at the same time, checked against their plans and briefs on `develop`:
- `infra/dependabot-config` (#133): `.github/dependabot.yml` and `claude-code-review.yml`. No overlap. Its
  `typescript`-major ignore leaves this plan's pin alone. Dependabot may later propose ts-jest / typescript-eslint
  minors on top of this slice, which is harmless.
- `infra/esm-bench-watchdog` (#134): `packages/webpack-test/perf/esm-watch-bench.cjs`, a scheduler module, a new
  test in `packages/webpack-test/tests/` and possibly `packages/webpack-test/jest.config.ts`. No file overlap. Its
  new test sits under `tests/`, which `webpack-test/tsconfig.test.json` includes. That is one more reason for
  `"rootDir": "."` there.
- `bug/tsc-default-target-interop` (#135): `defaults.ts`, `config/effective-options.ts`, `Compiler.ts`,
  `system.ts`, compiler-test and webpack-test fixtures and snapshots, and `Release-Notes.md`. No file overlap.
- `bug/esm-check-false-positives` (#137): `packages/core/src/compiler/esm/*`, `bin.test.ts`,
  `webpack-esm-check.test.ts` and `Release-Notes.md`. No overlap.
- `bug/cli-project-directory` (#136): `parsed-command-line`, `ResolvedCompilerOptions`, `command.ts`,
  `bin.test.ts`, `Release-Notes.md` and the README. No overlap.

There is no real file collision. This is the only branch in the wave that touches `package.json` files,
`pnpm-lock.yaml` or tsconfigs. If one of the others has to add a dependency after all, the second to merge rebases
the lockfile.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside this scope.
Examples: a package whose `src` imports outside `src`, a typescript-eslint rule that changes behaviour across the
version jump, or an override that pnpm ignores.
