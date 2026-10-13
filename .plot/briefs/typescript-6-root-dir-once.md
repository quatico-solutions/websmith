<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — typescript-6-support (slice: root-dir-once)

- **Plan (canonical):** `docs/plans/2026-10-02-typescript-6-support.md` on `develop` (slice line after
  `bug/typescript-6-own-compilations`; added 2026-10-13)
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #144 merged; slice split out of `own-compilations` on 2026-10-13, Jan
  Wloka, because it changes exit codes
- **Branch:** `bug/typescript-6-root-dir-once` (base: `develop`, after `bug/typescript-6-own-compilations` merged)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH); the implementer never merges it
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

**Ordering.** This slice waits on `bug/typescript-6-own-compilations`. Re-verify everything below against `develop`
after that merge: the fixture fallout of item 2 was measured with a prototype on `fa114cbe`, before own-compilations
rewrote the `rootDir` fixtures in core, loader and compiler specs, so the set of fixtures that turn red may be smaller
or different. Line numbers are from `fa114cbe` and moved; locate every site by name. Nothing else waits on this
branch.

**Why it is its own slice.** websmith reports TS5011 ("The common source directory of 'tsconfig.json' is './src'. The
'rootDir' setting must be explicitly set …") three times differently from `tsc`, and with `declaration: true` not at
all. Reporting it once, as `tsc` does, makes websmith exit 1 where it exits 0 today, so it changes exit codes and
needs its own review, release note and rollback.

### The failure, measured

**Evidence.** CI job 115299468771, `dist (24, typescript 6.0.3)` of PR #183's run (develop + #183 = `a24984de`), and
the local reproduction in a detached worktree of `a24984de` with the CI override recipe below (Node 24.21.0, pnpm 10).
#182's 6.0.3 cell (job 115303299973, on `fa114cbe`'s content) agrees. #183's PR body recorded the triple TS5011.

**The triple TS5011, measured on 6.0.3** with the built CLI and #183's fixture (`src/a.ts`, `src/sub/b.ts`, `outDir`,
no `rootDir`):

| Path | websmith | `tsc -p` |
|---|---|---|
| fast path (no type-info addon, no `declaration`) | TS5011 **twice**, `'./src'` and `'./src/sub'`, exit 1; through websmith-node `compile()` the reporter output carries 4 lines | TS5011 once, `'./src'`, exit 2 |
| `declaration: true` (per-file Programs) | **nothing reported, exit 0**, emits `dist/src/…` | TS5011, exit 2 |

Cause: every fragment computes the option diagnostics of a one-file program. `ts.transpileModule` (`Compiler.ts:1428`)
reports TS5011 with that file's directory as the "common source directory", so the per-message dedup in `report()`
(`:670`–`:690`), in watch (`:849`) and in the loader (`ModuleCompiler.ts:501`) sees different texts. The per-file
Programs (`:1329`) return only emit diagnostics, and the Program path filters file-less Program diagnostics (`:677`),
so those paths say nothing. On 5.7.3 none of this happens: there is no TS5011 default.

### Measured facts the fix rests on (executed for the original brief)

- **A stub Program gives TypeScript's single TS5011.** `ts.createProgram` over the parsed root names with
  `getSourceFile` returning empty source files, `noResolve`, `noLib`, `types: []`: `getOptionsDiagnostics()` is exactly
  one TS5011 `'./src'` on 6.0.3 and `[]` on 5.7.3. Cost: one empty `SourceFile` per root file.
- **TS 5.7.3 constraint:** the stub Program must produce no diagnostic on 5.7.3 (it does not: `[]`), and websmith's
  output on 5.7.3 stays unchanged. The unit expectations come from TypeScript of the running major, never from a
  literal.
- **Prototype ripple on 6.0.3:** `webpack-test/tests/webpack-loader-option-names.test.ts` 3 cases (fixture `:26` writes
  `outDir` without `rootDir`, sources in `src/`) go from exit 0 to exit 1. Expect more such fixtures; the full set was
  not measured.

### What to build

Commit the product change, the fixtures and the tests as separate commits (`B …`, `t …`).

1. **One TS5011 per compilation context, TypeScript's own.** In `Compiler` (`packages/core/src/compiler/Compiler.ts`):
   - compute it once per context (cache by profile and options), only when `rootDir` is unset and `outDir` or
     `declarationDir` is set: a stub Program over the context's root files (absolute paths) with
     `configFilePath` resolved to an absolute path, `getSourceFile` returning empty source files, `noResolve`,
     `noLib`, `types: []`; keep `getOptionsDiagnostics()` entries with code 5011, file and position cleared;
   - in `emitSourceFile` (`:463`; `ModuleCompiler.ts:461` calls `super`), drop every fragment diagnostic with code 5011
     and append the context's. The existing dedups (`report()` `:670`, watch `:849`, `ModuleCompiler.ts:501`) then
     print it once, and the declaration and Program paths report it too.
   - Measured pitfalls from a prototype: a relative `configFilePath` (`"tsconfig.json"`) crashes `createProgram` with
     "Paths must either both be absolute or both be relative"; `getRootFiles()` in virtual-system specs can yield paths
     outside the virtual root. Use the context's `cliArgs.fileNames` resolved through the context's system.
   - *Rejected: dedup by code.* Distinct option errors share codes (two TS5107 for two options).
   - *Rejected: building the TS5011 text in websmith.* The text is TypeScript's and changes by version.
2. **Ripple — fixtures this turns red.** websmith now fails where `tsc` 6 fails. Measured with the prototype on
   6.0.3: `webpack-test/tests/webpack-loader-option-names.test.ts` 3 cases (fixture `:26` writes `outDir` without
   `rootDir`, sources in `src/`) go from exit 0 to exit 1. Give that fixture `rootDir`. Expect more such fixtures in
   core `Compiler.spec.ts` (`emitSourceFile` cases with `outDir` and a `configFilePath`); fix each fixture, not the
   product. #183's `compiler-test/tests/tsc-root-dir.test.ts` compares code *sets*; tighten it to assert websmith prints
   `5011` exactly once on 6.x (zero on 5.x).
3. **Unit tests:** fast path, per-file declaration path and Program path each report exactly one TS5011 naming
   `./src` for `src/a.ts` + `src/sub/b.ts` on 6.x and none on 5.x (expectation from TypeScript of the running major,
   e.g. the stub's own `getOptionsDiagnostics()` text, never a literal); no TS5011 with `rootDir` set.

Unit-test conventions (assemble / act / assert, `testObj`, `actual`, no shared `testObj`) apply to new and rewritten
cases. **No version-dependent literals:** an expectation that differs by major comes from TypeScript of the running
major, or the case runs on one major only with the major in its title (`describeOnTs5` as #183 did:
`const describeOnTs5 = Number(ts.versionMajorMinor.split(".")[0]) < 6 ? describe : describe.skip;`; `it`-level
skips trip `jest/no-standalone-expect` in some packages).

### Done when

The plan's slice line is the specification.

- **TS5011 once:** the CLI on #183's fixture prints one `Error: 5011` naming `'./src'` and exits 1 on the fast path
  and with `declaration: true`; nothing on 5.7.3. Put both outputs in the PR.
- **6.0.3 cell, in the PR's own run:** no new failure compared with `develop` after own-compilations; every fixture
  that turned red because of item 1 is fixed in the fixture, listed in the PR. After this slice and #184 the cell
  stays green.
- **5.7.3 cells:** `dist (22)` and `dist (24)` green; every snapshot body unchanged. List every snapshot hunk.

Gates: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache` locally on 5.7.3; the
affected suites on 6.0.3 with the recipe below.

**`Release-Notes.md`**, under `## [Unreleased]`, `### Fixed`: "websmith reports TS5011 once, naming the directory
`tsc` names, also with `declaration` (where it passed before)". Because it changes exit codes on TypeScript 6 (a
project with `outDir` and no `rootDir` now fails the build as `tsc` does), put it under `### Changed` as well if the
maintainer prefers; say so in the PR. Set `"rootDir"` in `tsconfig.json` to fix it.

**How to run 6.0.3 locally** (same recipe as #171/#183; never edit `~/.npmrc`):

```bash
export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"  # node 24, pnpm 10
export NX_DAEMON=false
git worktree add --detach "$S" HEAD && cd "$S"          # S in your scratch dir; commit first
pnpm install --frozen-lockfile --offline
pnpm pkg set pnpm.overrides.typescript=6.0.3
: > "$S/.empty-npmrc"
NPM_CONFIG_USERCONFIG="$S/.empty-npmrc" pnpm install --no-frozen-lockfile --config.registry=https://registry.npmjs.org/
pnpm -r exec node -p "require('typescript/package.json').version"    # every line 6.0.3
pnpm build && pnpm test --skip-nx-cache && pnpm test:e2e --skip-nx-cache
cd - && git worktree remove --force "$S"
```

Do not run two full suites in parallel on one machine: two concurrent `test:e2e` runs cut `websmith-loader-test`
short twice during the original measurements.

### Scope guard

This branch owns:
- `packages/core/src/compiler/Compiler.ts` and `ModuleCompiler.ts` (only what item 1 needs);
- the specs and e2e files it turns red or tightens: core `Compiler.spec.ts` (`emitSourceFile` cases), webpack-test
  `webpack-loader-option-names.test.ts`, compiler-test `tsc-root-dir.test.ts`, plus new unit cases beside the code;
- its `### Fixed` line in `Release-Notes.md`, and the `→ #<PR>` suffix on its own line in the plan (before the
  `<!-- builds: -->` comment).

Do not touch:
- `packages/core/src/compiler/{defaults.ts,config/effective-options.ts,esm/check-esm.ts,addons/AddonRegistry.ts}`,
  `packages/webpack/src/WebpackAddonService.ts` and `packages/testing/src/compilation/environment.ts`
  (`bug/typescript-6-own-compilations`, merged before you start);
- **`packages/node/**`** and `packages/compiler-test/tests/tsc-ignore-config.test.ts` (#184,
  `bug/node-tsc-ignore-config`), nor `compile-tsc.test.ts` and its snapshot;
- `packages/compiler/src/bin.test.ts`;
- `package.json` files, `pnpm-lock.yaml`, tsconfigs, `.github/workflows/*`;
- the node16/nodenext module-kind checks and `packages/api` option types (`feature/typescript-6-module-kinds`);
- `checkTypeScript()` and the CLI's `typescript` dependency (`feature/cli-typescript-peer`).

If the cell shows a failure this brief does not name, triage it by error code and report it in the PR rather than
improvising outside scope.

### Repo facts for the implementer

- pnpm 10 is at `$HOME/.nvm/versions/node/v20.19.4/bin/pnpm` (Homebrew pnpm 11 fails with E401). CI is pnpm 9.
- Installs on the branch use `--offline`. The Artifactory login in `~/.npmrc` is expired; never edit it.
- `test:e2e` needs `pnpm build` first; e2e suites spawn the built CLI and loader, so rebuild after product edits.
- New files need the MIT header (`pnpm license:add`); never add them to the `license:check` list.
- Commits in Arlo's notation without a colon (`commit-notation` skill), e.g. `B Reports TS5011 once as tsc does`,
  `t Gives fixtures a rootDir`.
- Use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit early; the PR's 6.0.3 cell is the main evidence.
- Open the PR with `plot-open-pr.sh`, not `gh pr create`.
- In the PR body: the TS5011 CLI outputs (fast path, `declaration: true`, both majors), the `5011` grep, the list of
  fixtures changed, the snapshot hunks, and that the change alters exit codes on TypeScript 6.
