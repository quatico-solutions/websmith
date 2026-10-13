<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — typescript-6-support (slice: websmith-node)

- **Plan (canonical):** `docs/plans/2026-10-02-typescript-6-support.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #144 merged
- **Branch:** `bug/node-tsc-ignore-config` (base: `develop`, at `ef29dce6` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH); the implementer never merges it
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

**Ordering.** This is the plan's fourth slice (`### websmith-node`, rows 8 and 16 of the measured table, "websmith-node
`tsc` spawn, target names" in the ownership table). It needs `infra/typescript-6-toolchain` (#166) and
`infra/typescript-6-ci-leg` (#171). Both are merged, so it can start now. It carries no `waits:`, and no slice waits on
it. It runs beside `bug/typescript-6-test-fixtures` (row 11). Neither waits on the other, but one e2e file needs both
(see "The boundary with the fixtures slice"). The PR's own run of the advisory `dist (24, typescript 6.0.3)` cell is the
slice's "red before, green after" evidence.

**What changed on `develop` since the plan.** No commit since the plan's probe (`cfb284cc`) changed the code this slice
touches. The toolchain, nx, lodash and webpack commits touched only `packages/node/package.json` and the package's
tsconfigs. The plan's citations still hold: the spawn is at `packages/node/src/websmith/Compiler.ts:86`, and
`findTsc()` is called at `:55`. One citation has moved: the target names are in `compiler-options.ts:35-40`
(plan: `:31-33`). Two merged changes matter here:
- **#168** (`bug/option-enum-tables`) added core's `SCRIPT_TARGET_NAMES` with explicit `12`/`99`/`100` entries
  (`packages/core/src/compiler/config/parsed-command-line.ts:151-166`). That is the model for row 16. The plan
  duplicates it in websmith-node on purpose, so do not import it from core.
- **#171** gave every PR a 6.0.3 cell. The latest runs on `develop` + PR (#174 run 38375974726, #177 run
  38374846296, both merged onto `b56d0203`) give the numbers below.

### The failure, measured

**The 6.0.3 cell, job `dist (24, typescript 6.0.3)` of run 38375974726.** `@quatico/websmith-node:test` fails
**5 of 57**:

| Suite | Test | Cause in the log |
|---|---|---|
| `src/websmith/Compiler.spec.ts` | `Compiler#compile › should yield success with default config and existing file path` (`:35`) | TS5112 |
| `src/websmith/Compiler.spec.ts` | `Compiler#compile › should yield compile error with unknown file path` (`:55`) | TS5112 instead of the expected TS6053 |
| `src/websmith/Compiler.spec.ts` | `Compiler#compile › should yield help with help flag` (`:45`) | the literal `"Version 5.7.3"` at `:52`; the binary prints `Version 6.0.3` |
| `src/websmith/compile.spec.ts` | `compile › should yield success with default config and existing file path` (`:19`) | TS5112 |
| `src/websmith/compile.spec.ts` | `compile › should yield compile error with unknown file path` (`:28`) | TS5112 instead of TS6053 |

The plan's "4 node suites fail" is now these 2 suites. The third row is not TS5112. It is a version-dependent literal in
this package, and no other slice touches `packages/node`, so it belongs here.

In `@quatico/websmith-compiler-test:"test:e2e"`, `compile-tsc.test.ts` fails 3 of 3, all with TS5112
("In directory 'compiler-test' error TS5112 …"). `compile-tsc.test.ts` is the only e2e that spawns `tsc` through
websmith-node with file arguments. `tsc-defaults.test.ts` calls `compile([], { tsConfig: { project } })`, which passes
no files, so TS5112 does not affect it. `compile-websmith.test.ts` passes a `websmith` key, so it runs core in process
and never spawns `tsc` (`compile.ts:17-59`). The webpack suites use websmith-node's `webpack()`, not `compile()`. **No
`bin.test.ts` failure is TS5112.** The CLI runs core in process. Its 55 failures on the cell come from its own
fixtures. They belong to the fixtures slice (see that brief), not here.

**`tsc` 6.0.3 vs 5.7.3, executed for this brief** with `typescript@6.0.3` and `@5.7.3` from registry.npmjs.org in a
scratch directory:

| Call (in a directory with `tsconfig.json`) | 5.7.3 | 6.0.3 |
|---|---|---|
| `tsc --noEmit src/a.ts` | exit 0, config ignored | **TS5112**, exit 1 |
| same, but `tsconfig.json` only in a **parent** directory | exit 0 | **TS5112** (the search walks up) |
| `tsc --ignoreConfig --noEmit src/a.ts` | **TS5023** "Unknown compiler option '--ignoreConfig'", exit 1 | exit 0 |
| `tsc --ignoreConfig --noEmit src/a.ts`, no `tsconfig.json` anywhere | – | exit 0 (harmless without a config) |
| `tsc --ignoreConfig src/does-not-exist.ts` | – | TS6053, exit 2 (as 5.7.3 without the flag) |
| `tsc --ignoreConfig --outDir lib --target ES2020 src/a.ts src/sub/b.ts` | `lib/a.js`, `lib/sub/b.js` (no flag) | same layout; **no TS5011** (no config file is read) |
| `tsc --ignoreConfig --moduleResolution Node10 …` | – | **TS5107** `moduleResolution=node10`, emits anyway, exit 2 |
| `--target ES2025` | **TS6046** (not in its list) | exit 0 |
| `--target LatestStandard` (today's rendering of `12`) | – | **TS6046** |
| `-p tsconfig.json src/a.ts` | – | TS5042, so `project` plus files is already an error |

Enum reverse maps on both versions: only `ScriptTarget` is ambiguous. `ScriptTarget[99]` is `"Latest"` on both, and
`ScriptTarget[12]` is `"LatestStandard"` on 6.0.3 and `undefined` on 5.7.3. `ModuleResolutionKind[2]` is `"Node10"`
on both, which is a valid CLI value. `ModuleKind`, `JsxEmit`, `NewLineKind`, `ModuleDetectionKind` and
`ImportsNotUsedAsValues` are unambiguous. `ignoreConfig` is not in 6.0.3's `ts.CompilerOptions` typings, but
`ts.parseCommandLine` accepts it.

### What to build

All in `packages/node/src`. Line numbers are from `develop` at `ef29dce6`.

1. **Read the version of the binary that `findTsc()` returns** (`websmith/find-tsc.ts:15-46`). Add an exported helper
   next to it, for example `readTscVersion(tscPath: string): Promise<string | undefined>`:
   - resolve `tscPath` with `fs.promises.realpath` first. The nvm-global candidate (`:31`,
     `~/.nvm/versions/node/<v>/bin/tsc`) is a symlink into `lib/node_modules/typescript/bin/tsc`, and only the real
     path has a `package.json` two levels up;
   - read `path.join(path.dirname(realPath), "..", "package.json")` and return `version` only when `name` is
     `"typescript"`;
   - return `undefined` on any error. **Never use `ts.version`.** The imported `typescript` and the spawned binary can
     differ: `findTsc` prefers `process.cwd()/node_modules` (`:20`) over `require.resolve("typescript")` (`:25`).
2. **Pass `--ignoreConfig` only to a binary of major 6 or later, and only with file arguments.** Extend
   `parseCliArguments` (`websmith/compiler-arguments.ts:11-31`, internal, not exported from `src/index.ts`) with the
   binary's version, for example `parseCliArguments(tsConfig, files, tscVersion?: string)`:
   - add `--ignoreConfig` when `files.length > 0` and the major of `tscVersion` is `>= 6`, placed before the files;
   - add nothing when the version is `undefined` or unparsable. That keeps today's behaviour for a binary whose
     version cannot be read;
   - add nothing when `tsConfig.ignoreConfig === true`, because the reduce at `:12-30` already emits it (no duplicate
     flag);
   - never add it without files. `tsc --help` and `-p <project>` calls (`tsc-defaults.test.ts`) stay as they are.

   "6.x" in the plan's slice line is the supported range. `>= 6` is the rule, because the flag exists from 6.0 on. A
   7.x `typescript` is rejected earlier by the CLI-peer slice's guard, which is not this slice's concern.
3. **Wire it in `Compiler.compile`** (`websmith/Compiler.ts:47-77`). After `findTsc` (`:55`), read the version and
   pass it to `parseCliArguments` (`:64`). Add it to the existing `logger.debug` calls. The spawn line logged at `:67`
   then shows `--ignoreConfig`, as it should.
4. **Target names by name** (`compiler-options.ts:35-40`, row 16). Replace the `99` special case and
   `ts.ScriptTarget[value]` with an explicit table, as core's `SCRIPT_TARGET_NAMES` does but in this package's
   PascalCase: `{ 12: "ES2025", 99: "ESNext" }`, then `ts.ScriptTarget[value]`, then `String(value)`. Do not import
   core. `100` (`JSON`) is not a `--target` value. Leave it to the reverse map, which yields `"JSON"` on both majors.
   Delete the stale `// TODO: This is a bug in typescript 5.7.2 …` comment (`:36`) and put the reason next to the
   table: the reverse map yields `Latest` for 99 and `LatestStandard` (or nothing on 5.x) for 12. Note the current
   bug: on 5.7.3, `parseNumberValue("target", 12)` returns `undefined`, so the argument list carries `undefined`.
5. **Fix the version literal** in `Compiler.spec.ts:52`. Expect `` `Version ${ts.version}` `` (`ts` is already
   imported at `:8`). In this workspace the imported `typescript` and the binary found from `packages/node` are the
   same, and every cell's assertion step proves it. The literal is the third red test on the cell.

**Docs.** In `packages/node/README.md`, under "Compile files with the websmith compiler" (`:23-38`), add one sentence:
without a `websmith` option, `compile` runs the project's `tsc` on the given files with the given `tsConfig` and does
not load a `tsconfig.json`, as `tsc` 5 does with file arguments; with TypeScript 6 it passes `--ignoreConfig` for
that. Also drop `moduleResolution: ts.ModuleResolutionKind.Node10` from the example at `:49`. TypeScript 6 deprecates
it (TS5107), and the example works without it.

### The boundary with the fixtures slice

The two slices meet in one e2e file. `packages/compiler-test/tests/compile-tsc.test.ts` spawns `tsc` through
websmith-node with `moduleResolution: Node10` (`:16`) and has one ES5 case (`:56-67`). On the 6.0.3 cell, its two
ES2020 cases need **both** slices:

| Merged | `compile-tsc` ES2020 cases on 6.0.3 |
|---|---|
| neither (today) | red, TS5112 |
| this slice only | red, TS5107 `moduleResolution=node10` (from the fixture's `:16`) |
| fixtures slice only | red, TS5112 |
| both | green. Checked in `packages/compiler-test`: `tsc` 6.0.3 with `--ignoreConfig` and `tsc` 5.7.3, both with `--moduleResolution bundler --target ES2020 --removeComments` (the fixtures slice's replacement for `Node10` there), emit byte-identical `foobar-arrow.js` |

The rule that keeps the two branches apart:
- **This branch edits no existing file in `packages/compiler-test` or `packages/webpack-test`, and no snapshot.**
  `compile-tsc.test.ts`, its snapshot file and every fixture belong to the fixtures slice.
- **The fixtures branch edits nothing in `packages/node/**`**, and not the new e2e file below.
- This slice gets its own red-before e2e in a **new** file, so its PR shows the flip on the 6.0.3 cell whatever the
  fixtures slice's state is.

### Tests

**Unit** (`packages/node/src`, assemble / act / assert, `testObj` and `actual`, no shared `testObj`; see
`docs/rules/testing.md`):
- `compiler-arguments.spec.ts`: with files and `tscVersion` `"6.0.3"`, the result contains `--ignoreConfig` before the
  files. With `"5.7.3"`, it does not. With `undefined` and with `"garbage"`, it does not. With no files and `"6.0.3"`,
  it does not. With `{ ignoreConfig: true }` and `"6.0.3"`, the flag appears exactly once.
- `find-tsc.spec.ts` (new): a temp dir with `typescript/package.json` (`name` `"typescript"`, `version` `"5.7.3"` /
  `"6.0.3"`) and `typescript/bin/tsc`. `readTscVersion` returns the version. A **symlinked** `tsc` in another directory
  (the nvm layout) returns the target's version. A `package.json` with another `name`, a missing `package.json`, and
  a missing file all return `undefined`.
- **The mixed cases** the plan asks for: a 6.x binary next to the imported 5.x `typescript`, and the reverse. The
  decision must depend only on the binary. Test it with the fake binaries above: a fake `"5.7.3"` binary gives no
  flag and a fake `"6.0.3"` binary gives the flag, **whatever the installed `typescript` is**. These tests run
  unchanged on both cells, and that is the proof that `ts.version` is not consulted. One `Compiler` test can stub
  `findTsc` to return the fake binary path and assert the spawned argument list through the existing `spawn` call,
  without running `tsc`. Use `jest.mock("cross-spawn")` scoped to that file or test. Do not mock in a shared
  `beforeEach`.
- `compiler-options.spec.ts`: `parseNumberValue("target", value)` for every value with its expected name, `0` `ES3`
  through `11` `ES2024`, `12` `ES2025` and `99` `ESNext`. Use `it.each` with literal names. These are `--target`
  spellings and do not vary by version, and the test passes on both cells. Also `parseCliArguments({ target: 12 }, [])`
  gives `["--target", "ES2025"]`.
- `Compiler.spec.ts:52`, as in step 5. The existing `Compiler.spec.ts` and `compile.spec.ts` cases at `:35`, `:55`
  and `:19`, `:28` are the plan's "e2e node suites' single-file compile". They spawn the real `tsc` and must go green
  on 6.0.3 **without edits**.

**e2e** (one new file, `packages/compiler-test/tests/tsc-ignore-config.test.ts`, MIT header). Follow
`tsc-defaults.test.ts`'s setup: a `mkdtemp` output dir under `packages/compiler-test`, `process.stdout.write` spied,
cleanup in `afterEach`. Jest runs it with `cwd` `packages/compiler-test`, which has a `tsconfig.json`. Assert that
precondition with `ts.findConfigFile(process.cwd(), ts.sys.fileExists)` so that the test cannot pass vacuously.
- "should compile a single file w/ tsconfig.json in the working directory": `compile([<abs src file>], { tsConfig: {
  outDir, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, removeComments: true } })`, **no
  `moduleResolution`**. It resolves, and `<outDir>/<name>.js` exists. Red before on 6.0.3 (TS5112), green on both
  cells. Keep `module: CommonJS`. Without a `module`, `target: ES2020` gives Classic resolution on 5.7.3. `tsc` then
  picks up `packages/compiler-test`'s ambient `@types/jest` and fails with TS2792 "Cannot find module 'expect'"
  (measured).
- "should pass target 12 by name":
  `compile([file], { tsConfig: { noEmit: true, module: ts.ModuleKind.CommonJS, target: 12 as ts.ScriptTarget } })`.
  On a 6.x binary it resolves (red before: `--target LatestStandard`, TS6046). On a 5.x binary it rejects with
  `TS6046` and `'--target'`, because TypeScript reports a 6-only value on 5.x and websmith-node does not drop it (plan
  Changelog). Branch on `Number(ts.versionMajorMinor.split(".")[0])`. The expectation comes from the running major,
  not from two literal snapshots.

Do not add a webpack-test case. websmith-node's `webpack()` does not spawn `tsc`.

### Done when

The plan's slice line is the specification. These are the checks a naive implementation would pass without:

- **6.0.3 cell, in the PR's own run:** `@quatico/websmith-node:test` **0 failed** (was 5 of 57), including the
  five tests named above. The new e2e file passes. The other unit counts are unchanged from run 38375974726 (testing 4,
  loader 5, core 16, compiler 9).
- **compiler-test on the 6.0.3 cell:** the two `compile-tsc` ES2020 cases are red **with TS5107 `node10`, not TS5112**,
  if the fixtures slice has not merged. Grep the job log for `5112`: it must not occur at all. If the fixtures slice
  has merged, they are green. Put a before/after table per suite in the PR body, and quote the `5112` grep.
- **5.7.3 cells:** `dist (22)` and `dist (24)` green. On 5.7.3 the spawned argument list is unchanged: no
  `--ignoreConfig` reaches a 5.x binary (TS5023). The unit tests on fake binaries prove it on every cell.
- **The flag is keyed on the binary.** A reviewer who swaps the version source for `ts.version` must turn a test red.
  Show this in the PR: a throwaway local edit, reverted and not committed.
- **No `--target LatestStandard` and no `--target undefined`** can be produced.

Gates: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache` and `pnpm test:e2e --skip-nx-cache` locally on 5.7.3.
CI: `dist (22)` and `dist (24)` green, and `dist (24, typescript 6.0.3)` advisory with the counts above.

**`Release-Notes.md`**, under `## [Unreleased]` → `### Fixed` (`Release-Notes.md:106`), append the plan's Changelog
line: "`@quatico/websmith-node` works with TypeScript 6's `tsc`, which rejects file arguments next to a
`tsconfig.json` (TS5112), and passes `--target ES2025` by its name." **README:** `packages/node/README.md`, as above.
No change to the root `README.md`. websmith-node's `typescript` peer (`package.json`, `"5.x"`) belongs to the
peer-range slice. Leave it.

**How to run the 6.0.3 suites locally** (optional; CI is the proof). Use the same recipe as #171. Commit first; the
copy is taken from `HEAD`.

```bash
export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"   # pnpm 10
S=$(mktemp -d /private/tmp/claude-501/ts6-scratch.XXXX)
git archive HEAD | tar -x -C "$S" && cd "$S"
pnpm install --frozen-lockfile --offline
pnpm pkg set pnpm.overrides.typescript=6.0.3
: > "$S/.empty-npmrc"
NPM_CONFIG_USERCONFIG="$S/.empty-npmrc" pnpm install --no-frozen-lockfile \
  --config.registry=https://registry.npmjs.org/
pnpm -r exec node -p "require('typescript/package.json').version"     # every line 6.0.3
pnpm build
pnpm --filter @quatico/websmith-node test
pnpm --filter @quatico/websmith-compiler-test test:e2e
cd - && trash "$S"
```

compiler-test maps `@quatico/websmith-node` to `../node/src` (`packages/compiler-test/jest.config.ts`), so the e2e
sees source changes without a rebuild of `packages/node`.

### Found while writing this brief — report, do not fix

- `findTsc`'s first candidate, `path.join(__dirname, "..", "typescript", "bin", "tsc")` (`find-tsc.ts:17`), resolves to
  `lib/typescript/bin/tsc` inside the package, which never exists. Lookup always falls through to the `cwd` and
  `require.resolve` candidates. That is out of scope. Mention it in the PR as a finding.
- The plan says websmith-node "must not import core". `websmith/compile.ts:8` already imports `AddonRegistry`,
  `DefaultReporter` and `Compiler` from `@quatico/websmith-core`. This slice adds no core import (the target table is
  duplicated, as the plan wants). Mention it so that the CLI-peer slice, which copies `checkTypeScript()` into
  websmith-node for the same reason, knows.

### Repo facts for the implementer

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (put it first on `PATH`). The Homebrew pnpm 11 fails
  with E401. CI is pnpm 9.
- Installs on the branch use `--offline`. The Artifactory login in `~/.npmrc` is expired; **never edit
  `~/.npmrc`**. For registry packages, use an empty `NPM_CONFIG_USERCONFIG` file plus
  `--config.registry=https://registry.npmjs.org/`. This branch needs no new package.
- Node 24 for runtime checks is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`.
- `test:e2e` needs `pnpm build` first. compiler-test runs `--runInBand` and takes minutes.
- New files need the MIT header (`pnpm license:add`). Do not add them to the `license:check` list.
- Write commits in Arlo's notation without a colon (see the `commit-notation` skill). For example:
  `B Passes --ignoreConfig to a TypeScript 6 tsc with file arguments`, `B Passes target 12 to tsc as ES2025`,
  `t Expects the installed tsc version in the help output`.
- Use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists. The PR's 6.0.3 cell is the slice's main evidence.
- Open the PR with `plot-open-pr.sh`. Do not use `gh pr create`.
- Append `→ #<PR>` to the `bug/node-tsc-ignore-config` line in the plan's `## Slices`
  (`docs/plans/2026-10-02-typescript-6-support.md:310`, after the text and before its `<!-- builds: -->` comment),
  and commit that on this branch.

### Scope guard

This branch owns:
- `packages/node/src/websmith/Compiler.ts`, `find-tsc.ts`, `compiler-arguments.ts`, `src/compiler-options.ts`, their
  specs, and the new `find-tsc.spec.ts`;
- `packages/node/README.md`;
- the new `packages/compiler-test/tests/tsc-ignore-config.test.ts`;
- its `### Fixed` line in `Release-Notes.md`, and the `→ #<PR>` suffix on its own line in the plan.

Do not touch:
- any existing file in `packages/compiler-test` or `packages/webpack-test`, including `compile-tsc.test.ts` and all
  `__snapshots__` (fixtures slice);
- `packages/compiler/src/bin.test.ts` (fixtures slice, see its brief);
- `packages/node/package.json` (the `typescript` peer belongs to the peer-range slice), `pnpm-lock.yaml`, tsconfigs and
  `.github/workflows/*`;
- core's `SCRIPT_TARGET_NAMES` and anything else in `packages/core`;
- `findTsc`'s candidate order and the `:17` finding above;
- the `webpack/` half of websmith-node.

Branches in flight or starting now, checked against `origin` (no feature branch open there today) and the plans on
`develop`:
- **`bug/typescript-6-test-fixtures`:** the boundary above. **One shared file: `Release-Notes.md`.** The fixtures
  slice adds no entry, so there is no conflict in practice.
- **`bug/profile-lib-names`** (#135, now eligible because #177 merged), **`bug/loader-option-errors-once`** and
  **`bug/loader-unknown-profile-error`** (#134): core, loader and webpack-test only. **No overlap.** All of them may
  append to `Release-Notes.md` `### Fixed`. It is append-only, so rebase and keep both.
- **`bug/watch-generator-added-files`** (cli-error-exit-gaps): core and `bin.test.ts`. No overlap.
- **`feature/vite-plugin-tracer`** (#132): new `packages/vite*`. No overlap.

If the cell shows a websmith-node failure that this brief does not name, report it in the PR rather than improvising
outside scope.
