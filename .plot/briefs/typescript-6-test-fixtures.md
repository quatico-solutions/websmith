<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — typescript-6-support (slice: Fixtures)

- **Plan (canonical):** `docs/plans/2026-10-02-typescript-6-support.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #144 merged
- **Branch:** `bug/typescript-6-test-fixtures` (base: `develop`, at `ef29dce6` when this brief was refreshed; first
  written at `6013a526`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH); the implementer never merges it
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

**Ordering.** This is the third of the plan's eight slices (row 11 of the ownership table: "Test fixtures with
`Node10` / `ES5`"). It needs `infra/typescript-6-toolchain` (#166) and `infra/typescript-6-ci-leg` (#171). Both are
merged, so it can start now. The PR's own run of the advisory `dist (24, typescript 6.0.3)` cell is the slice's "red
before, green after" evidence. No slice carries a `waits:` on this branch. `bug/node-tsc-ignore-config` (row 8) runs
beside it. The two `compile-tsc` ES2020 cases go green only when both have merged (see "The boundary with the
websmith-node slice").

**What changed on `develop` since this brief was first written (`6013a526`).**
- **#175** (`infra/fix-transitive-alerts`, webpack 5.111.1) is **merged**. It rewrote both webpack-test snapshot
  files and touched `webpack-tsc.test.ts` and `websmith-loader.test.ts`. The old sequencing note ("regenerate on
  whichever merges first") is resolved. Regenerate the webpack-test snapshots on today's lockfile, on 5.7.3. Every line
  number below was re-read on `ef29dce6` and still holds.
- **#176** (`bug/fast-path-dts-js-syntax-errors`) is **merged**. It added fast-path cases to
  `packages/compiler/src/bin.test.ts`, which no longer collides with any open branch. **`bin.test.ts` is now part of
  this slice.** See "bin.test.ts" below for the decision and its evidence.
- **#177** (`bug/loader-tsconfig-enum-options`) is **merged**. Its `webpack-loader-option-names.test.ts` writes
  `outDir` without `rootDir` (`:26`), but it **passes** on the 6.0.3 cell (run 38374846296: `PASS
  tests/webpack-loader-option-names.test.ts`). Leave it alone. The old instruction to add `rootDir` there is withdrawn.
- **#174** (`feature/neutral-module-compiler`, core `ModuleCompiler`) is **merged**. Its 6.0.3 cell shows the same
  compiler-test and webpack-test failures, test for test, as #177's run. It moved nothing in this slice.
- Still true from the first version: **#161** removed websmith's own `target`/`esModuleInterop` defaults
  (`packages/core/src/compiler/defaults.ts:9`), and **#168** taught core `scriptTargetToString` about `12`. Neither
  changes these fixtures.

### What to build

**Evidence.** The 6.0.3 cells of run 38375974726 (#174 merged onto `b56d0203`, which contains #175 and #176) and run
38374846296 (#177 merged onto `b56d0203`) agree on every test name below. `develop` at `ef29dce6` is both merged
together. The `bin.test.ts` numbers were also reproduced locally on a 6.0.3 scratch copy of `ef29dce6`: 55 of 95,
the same test names.

**compiler-test: 37 failed / 57.**
- `compile-websmith.test.ts`: **34 failed** (3 pass). TS5107 `moduleResolution=node10` from the test options, TS5011
  "The common source directory of 'tsconfig.json' is './src'" from `outDir` without `rootDir`, and TypeScript 6's
  `rootDir` default, which moves the emit to `dist/src/…`. So `getOutput("foobar-arrow.js")` is `undefined` even where
  `result` is `""`. All 34 belong to this slice.
- `compile-tsc.test.ts`: **3 failed**, all TS5112 "Use '--ignoreConfig'" (log line "In directory 'compiler-test'
  error TS5112"). This is **row 8, `bug/node-tsc-ignore-config`**. See the boundary section.
- `bar-addon.test.ts` passes, but its log shows `5107 moduleResolution=node10` and `5107 target=ES5` from
  `@quatico/websmith-testing`'s environment (`packages/testing/src/compilation/environment.ts:394`, `:396`). That is
  **row 7, the own-compilations slice.** Do not chase it here.

**webpack-test (nx project `websmith-loader-test`): 42 failed / 102, 1 skipped** (97 in #174's run, which does not
contain #177's 5 new, passing webpack-test cases).
- `webpack-websmith.test.ts`: **26 failed**, TS5011 only. Fixture `outDir` without `rootDir` at `:87`, `:399`, `:812`.
- `websmith-loader.test.ts`: **11 failed**. TS5107 `node10` from `:89` and `:567`, plus TS5011.
- `webpack-profile-config.test.ts`: **2 failed** ("valid selected profile", with and without thread-loader), exit 1.
  The fixture is `outDir` without `rootDir` (`:27`, profile `tsConfig`s at `:34-37`). Confirm TS5011 locally before
  you fix it.
- `compile-module-date.test.ts`: **1 failed**. TS5107 `node10` from `:28`, plus TS5011.
- `webpack-tsc.test.ts`: **2 failed**, the two "ES5 target" cases (`:94`, `:111`), TS5107 `target=ES5` through
  ts-loader.
- Passing on 6.0.3, leave alone: `webpack-esm-check`, `webpack-loader-resolve-once`, `esm-watch-bench-steps`,
  `webpack-esm-consumer` (`:35` writes `outDir` without `rootDir` and still passes), `webpack-loader-option-names`.
- All 42 belong to this slice.

**compiler e2e (`packages/compiler/src/bin.test.ts`): 55 failed / 95. Now this slice's.** See the next section.

**Not this slice. They stay red after it, and you must not touch them:**
- unit tests: 39 (testing 4, loader 5, node 5, core 16, compiler 9). The node 5 belong to row 8. The others belong to
  rows 6, 7 and #135's leftovers;
- e2e core 3/8, loader 7/38, example-addons 7/11 (rows 6/7, own compilations).

### bin.test.ts — the decision and the evidence

**Decision.** `bin.test.ts`'s 6.0.3 failures come from its own fixtures. They belong to **this slice**, not to
`bug/node-tsc-ignore-config` and not to nobody:
- **None of them is TS5112.** `bin.test.ts` runs the websmith CLI, which compiles in process through core. It never
  spawns `tsc` through `@quatico/websmith-node`, so row 8 has nothing to do with it.
- The causes are the ones row 11 names, in a file that the slice line does not list: `node10`/`ES5` fixtures, TS5011
  from `outDir` without `rootDir`, and literals that differ between majors.
- The first version of this brief left the file unowned only because `bug/fast-path-dts-js-syntax-errors` was
  editing it. That branch merged as #176.
- If the reviewer wants it separate, put it in its own commits (below) so that it can be split off without
  touching the rest.

**The four #176 cases**, each traced on the 6.0.3 cell:

| Case (`bin.test.ts`) | Fixture | On 6.0.3 | Cause |
|---|---|---|---|
| "…syntax error in d.ts, skipLibCheck false/true on fast path" (`:448-464`) | `outDir`, `target: "esnext"`, no `rootDir` | exit 1 as expected, but `getOutput("test.js")` is `undefined` (`:461`) | TS5011 layout: `test.js` is written to `dist/src/test.js` |
| "…valid d.mts and module esnext on fast path" (`:466-477`) | same plus `module: "esnext"` | exit 1 (expects 0) | TS5011 |
| "…syntax error in js w/o allowJs on fast path" (`:511-519`) | `outDir`, `target: "esnext"`, no `rootDir` | exit 1 (expects 0) | TS5011 |

None of the four sets `moduleResolution` or `target: "es5"`, so **no TS5107 is involved in them**. The review
comment's "TS5011 rootDir / TS5107 deprecations" is right only for the first half. `tsc` 6.0.3 on the same
tsconfig, executed for this brief, gives `TS5011`, exit 2, and emits `dist/src/a.js`.

**The other 51** come from the same TS5011 (every `createTsConfig` call with `outDir`). The ESM-check cases show it
in their messages as `dist/src/test.js (…): ESM91001` where the test expects `dist/test.js`. Others are TS5107 from
`moduleResolution: "node10"` (`:113`, `:217`, `:259`), `ts.ModuleResolutionKind.Node10` in a profile (`:148`) and
`target: "es5"` (`:139`). Two are a version-dependent option error: `module: "commonjs"` +
`moduleResolution: "bundler"` (`:613-640`) is TS5095 on 5.7.3 but valid on 6.0.3, so "report the TypeScript option
error once" sees 0 reports.

**Measured fix, executed for this brief** on scratch copies of `ef29dce6` (6.0.3 through the override, and 5.7.3 from
the lockfile), changing only `bin.test.ts`:
1. `createTsConfig` (`:1707-1714`) writes `rootDir: "src"` when the caller passes `outDir` and no `rootDir`. Every
   fixture's sources live under `src/` (`include: ["src/**/*"]`, `:1710`), so the 5.7.3 layout does not change.
   Callers that pass their own `rootDir` (`:1572`) are untouched. `:808` sets `rootDir` in a nested compile inside an
   addon source, not through the helper. `createTsConfig` is the only writer of the project `tsconfig.json` in this
   file.
2. `moduleResolution: "node10"` → `"bundler"` at `:113`, `:217`, `:259`, and `ts.ModuleResolutionKind.Node10` →
   `Bundler` at `:148`. **Not omission.** These fixtures have an ES module kind (`target: "esnext"` with no `module`,
   or a profile with `module: ESNext`). Omitting the option gives **Classic** on 5.7.3, and that was measured to break
   3 cases on 5.7.3 (`:138`, `:212`, `:254`): `@types/jest`/`@types/node` fail with "Cannot find module 'expect' /
   'undici-types'". `bundler` is valid with an ES module kind on both majors.
3. `target: "es5"` → `"es2020"` at `:139`. The case's subject is the `target` profile, which overrides with ESNext
   (`:146`), so the base target is noise.
4. The option-error case (`:613-640`): `moduleResolution: "bundler"` → `"node16"`, keeping `module: "commonjs"`, and
   count `"Option 'module' must be set to 'Node16' when option 'moduleResolution' is set to 'Node16'"` (TS5110). This
   is an error on **both** majors, and `tsc` still emits with it (executed: 5.7.3 and 6.0.3 each give TS5110 and
   write `dist/a.js`). So the `write .js true/false` half of the case keeps its meaning.
5. `:106-135` "should yield script and declaration files …": the `.d.ts.map` inline snapshot (`:132-134`) holds a
   `mappings` string that differs by major (5.7.3 `…SAAS,SAAU,IAAI…`, 6.0.3 `…SAAS,GAAI,MAAM,IAAI…`, measured). Do
   not keep it as a literal. Compare the emitted map with the one TypeScript of the running major emits for the same
   file and options, for example through `ts.createProgram([...], options).emit(...)` capturing `writeFile`. The
   `.js` and `.d.ts` snapshots of that case are equal on both majors and stay.

Result with items 1-4 applied: **6.0.3: 55 → 1 failed**, and the one left is item 5's literal (item 5 was not part of
the measurement). **5.7.3: 95 / 95 passed, 13 / 13 inline snapshots unchanged.**

One `bin.test.ts` case keeps a deprecated value on purpose. "…report the TypeScript option error once w/ several files
on fast path" (`:564-584`) sets `moduleResolution: "classic"` because its subject is the error that `classic` plus
`resolveJsonModule` raises (TS5070). It passes on both majors. `tsc` 6.0.3 on that tsconfig also reports TS5107 for
`classic` (executed), and the test does not count that. Leave it, and mention it in the PR as a 7.0 concern.

Commit `bin.test.ts` separately from the compiler-test / webpack-test work, for example
`t Gives the CLI e2e fixtures an explicit rootDir and drops node10 and ES5`.

### The work in compiler-test and webpack-test

All in `packages/compiler-test/tests/` and `packages/webpack-test/tests/`. Every site was re-read on `ef29dce6`.

1. **`moduleResolution: Node10` off.** The sites are:
   - `compile-websmith.test.ts:60, 100, 149, 187, 220`;
   - `compile-tsc.test.ts:16`;
   - `websmith-loader.test.ts:89, 567`;
   - `compile-module-date.test.ts:28`.

   Under `module: CommonJS` (`websmith-loader.test.ts:92`, `:570`), omit it. Where the fixture's `module` is ESNext or
   unset next to an ES2015+ target, use `"bundler"`. The reason is in the decisions below, and `bin.test.ts` above
   shows the failure mode on 5.7.3. Per site:
   - `compile-websmith.test.ts`: `tsDefaults` has `module: ESNext` (`:59`), so use `bundler`. For the per-case
     options, take the `module` each case ends up with;
   - `compile-tsc.test.ts:16`: no `module`, `target: ES2020`, so use **`bundler`**. Measured in
     `packages/compiler-test` with the repo's own `node_modules`: omitting it gives Classic on 5.7.3, and `tsc` fails
     with TS2792 on `@types/jest`'s `import … from "expect"`. With `bundler`, 5.7.3 and 6.0.3 (`--ignoreConfig`)
     emit byte-identical `foobar-arrow.js`;
   - `compile-module-date.test.ts:28`: `getTsDefaults` sets neither `module` nor `target` (`:27-31`), so check what
     the loader ends up with before you choose.
2. **`target: ES5` off.** The sites are `compile-websmith.test.ts:117, 139, 167, 176, 209, 230, 546`,
   `compile-tsc.test.ts:60` and `webpack-tsc.test.ts:96, 103, 113, 120`.
3. **An explicit `rootDir` next to every `outDir` that hits TS5011** in the failing suites above. Use the test's
   `SOURCE_DIR` (absolute) or `"src"` in written tsconfigs. Leave the passing suites alone (see the list above).
4. **ES5-subject cases run on 5.x only.** These are `compile-tsc.test.ts` "should build foobar-arrow.js with ES5
   target" (`:56`) and the two `webpack-tsc.test.ts` "ES5 target" cases (`:94`, `:111`). On 6.x they are skipped by
   the installed major, and the skip is named in the title. For example:

   ```ts
   const itOnTs5 = Number(ts.versionMajorMinor.split(".")[0]) < 6 ? it : it.skip;
   itOnTs5("should build foobar-arrow.js with ES5 target on TypeScript 5", ...)
   ```

   Rename the snapshot key to match the new title. Its content must stay byte-identical. Every other ES5 site is
   fixture noise: either a tsconfig that a later option overrides to ESNext, or `compile-websmith.test.ts:112`
   "should build js and no d.ts with tsconfig.json", whose subject is that tsconfig.json is honoured. Those sites move
   to `ES2020`.
5. **One new e2e in compiler-test:** websmith's output paths equal `tsc`'s for a project with `src/`, `outDir` and
   no `rootDir`.
   - Base it on `tsc-defaults.test.ts`: a `mkdtemp` project, a `tsconfig.tsc.json` that extends the project's
     tsconfig with its own `outDir`, and `compile([], { tsConfig: { project } })` for `tsc`. That runs `tsc` without
     file arguments, so row 8's TS5112 does not touch it. websmith runs through `compile(files, { websmith: {
     tsConfigFile } })`, as in `tsc-defaults.test.ts:84-92`.
   - Use at least two levels, for example `src/a.ts` and `src/sub/b.ts`.
   - **Measured for this brief** (`tsc` directly, `outDir: "dist"`, `include: ["src/**/*"]`, no `rootDir`): 5.7.3
     exits 0 and emits `dist/a.js`, `dist/sub/b.js`; 6.0.3 reports **TS5011**, exits **2**, and still emits
     `dist/src/a.js`, `dist/src/sub/b.js`. websmith on 6.0.3 exits 1 with the same TS5011 and also writes under
     `dist/src` (seen in `bin.test.ts`'s ESM messages).
   - So **the `tsc` call rejects on 6.0.3.** websmith-node's `Compiler` rejects on any non-zero exit
     (`packages/node/src/websmith/Compiler.ts:119-126`). Catch it and keep the error text. The websmith call resolves
     with its reporter output (`compile.ts:56-59`). Assert that the set of emitted relative paths is equal, and that
     both sides report the same error codes (none on 5.7.3, `5011` on 6.0.3), read from the outputs, not written as
     literals per major.
   - Put the observed 5.7.3 and 6.0.3 layouts in the PR body.

### The boundary with the websmith-node slice

`packages/compiler-test/tests/compile-tsc.test.ts` spawns `tsc` through websmith-node with file arguments. Its two
ES2020 cases need both slices on 6.0.3:

| Merged | `compile-tsc` ES2020 cases on 6.0.3 |
|---|---|
| neither (today) | red, TS5112 |
| this slice only | red, TS5112 |
| `bug/node-tsc-ignore-config` only | red, TS5107 `moduleResolution=node10` (this file's `:16`) |
| both | green, and the output is byte-identical to the 5.7.3 snapshot (executed for this brief) |

The rule that keeps the branches apart:
- **This branch owns `compile-tsc.test.ts`, its snapshot file and every existing compiler-test / webpack-test file.**
  The websmith-node branch edits none of them.
- **This branch edits nothing in `packages/node/**`**, and not the websmith-node slice's new
  `packages/compiler-test/tests/tsc-ignore-config.test.ts`.
- **The `Compiler.spec.ts:52` "Version 5.7.3" literal is the websmith-node slice's.** It sits in `packages/node`.

### The decisions the plan settles — do not re-derive them

- **Fixtures move to `ES2020`, and expected output is regenerated from `tsc` of the running major.**
  - *Rejected: `ignoreDeprecations: "6.0"` in fixtures.* `"6.0"` is TS5103 on 5.7.3, so a shared fixture fails on
    one leg. It also only silences 6.x and breaks on 7.0. The plan rules it out for "any shared fixture".
  - *Rejected: a per-major helper that keeps ES5 everywhere on 5.x.* It hides on 6.x the behaviour the cases test,
    and it keeps a deprecated target in the main path. Only cases whose subject is ES5 output keep ES5, on 5.x only.
- **Replace `Node10` by omitting `moduleResolution` under CommonJS.** Under `module: CommonJS`, omitting it gives
  node10 on 5.7.3 and bundler on 6.0.3, with no diagnostic on either. An explicit `Bundler` is TS5095 on 5.7.3 with
  CommonJS.
  - **Edge the plan did not spell out, now measured.** If the fixture's `module` is ESNext/ES2015+, or is unset next
    to an ES2015+ `target`, omitting `moduleResolution` gives **Classic** on 5.7.3. Classic resolves neither bare
    specifiers nor the `@types` packages' own imports. In `bin.test.ts` that broke 3 cases on 5.7.3.
  - In those fixtures use `moduleResolution: "bundler"`. It is valid with an ES module kind on both 5.7.3 and 6.0.3,
    and it is what the toolchain slice put in the root tsconfig.
  - Never use `bundler` next to CommonJS. Name every `bundler` site and its reason in the PR.
- **TS5011 is a fixture problem in these suites.** The 6.0 default `rootDir` is the config directory, which matches
  `tsc`. websmith must not paper over it in product code. The fixtures get an explicit `rootDir`, and the new e2e
  pins websmith to `tsc` for the case without one.
- **No version-dependent literals.** Assertions on outputs that differ by major compare against `tsc` of the running
  major or are skipped by major. They are never two literal snapshots. The `.d.ts.map` at `bin.test.ts:132-134` and
  the TS5095 case at `:613-640` are the two places in `bin.test.ts` where this applies.

### Done when

The plan's slice line is the specification: the Definition of Done is green on the 5.7.3 cells, and on the 6.0.3 cell
no TS5107 for `target`/`moduleResolution` comes from these suites (red before).

A naive implementation would pass without these:

- **The 6.0.3 cell after this slice, as counted in the PR's own run:**
  - compiler-test: **2 failed** if `bug/node-tsc-ignore-config` has not merged (the two `compile-tsc` ES2020 cases,
    TS5112), **0** if it has. The ES5 case is **skipped**, and everything else passes, including the new e2e;
  - webpack-test: **0 failed**, with **3 skipped** (the 2 ES5 cases plus the existing thread-loader skip);
  - compiler (`bin.test.ts`): **0 failed** (was 55 / 95);
  - unchanged from today: the unit counts (39; node 5 → 0 once the websmith-node slice has merged), and the core /
    loader / example-addons e2e counts (3, 7, 7).

  Put a before/after table per suite in the PR body. Any remainder in compiler-test, webpack-test or `bin.test.ts` is
  a finding. Triage it by error code to a row (6, 7, 8, 9, 14, or unowned) before you call the slice done.
- **No TS5107 and no TS5011 from these suites' options.** In the 6.0.3 job log, between the
  `websmith-compiler-test:"test:e2e"` and `websmith-loader-test:"test:e2e"` groups, every `5107` line comes from
  `bar-addon.test.ts`'s testing environment (row 7), and none from a test option. In the `websmith-compiler:"test:e2e"`
  group, no failure message carries `5107` or `5011`. Jest prints output only for failing cases, so the `classic`
  case above does not show up. In compiler-test and webpack-test, no `5011` appears apart from the new e2e's
  expectation on the `tsc` side. Quote the greps in the PR.
- **5.7.3 output unchanged, proven by snapshot diff.** `git diff develop -- '*.snap'` may only show:
  - renamed keys for the 5.x-only ES5 cases, with identical bodies;
  - the regenerated `compile w/ websmith should build js and no d.ts with tsconfig.json 1` (ES5 → ES2020 CommonJS).

  Every other snapshot body is byte-identical on 5.7.3. The same holds for `bin.test.ts`'s inline snapshots: the only
  change there is the `.d.ts.map` literal becoming a comparison. Regenerate with `-u` on 5.7.3, then review every hunk
  and list it in the PR. Never accept a snapshot regenerated on 6.0.3.
- **The ES5 cases still run on 5.7.3.** The `dist (22)` / `dist (24)` logs show them passing, not skipped.
- **The new e2e fails if websmith drops `rootDir` handling.** Show it red, for example by giving websmith alone an
  explicit `rootDir` in a throwaway local edit. Mention this in the PR. Do not commit it.
- **Every `getOutput` that used to return `undefined` on 6.0.3 now returns content.** Do not "fix" a case by
  loosening `toBeDefined()` into a path search under `dist/src`.

Gates: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache` and `pnpm test:e2e --skip-nx-cache` locally on 5.7.3.
CI: `dist (22)` and `dist (24)` green, and `dist (24, typescript 6.0.3)` advisory with the counts above.

**No `Release-Notes.md` entry and no README change.** Only tests and fixtures change. Nothing users install
changes, and the plan's Changelog has no line for this slice.

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
pnpm --filter @quatico/websmith-compiler-test test:e2e
pnpm --filter websmith-loader-test test:e2e
(cd packages/compiler && npx jest --testRegex='.*\.test\.ts$' src/bin.test.ts)   # about 70 s
cd - && trash "$S"
```

### Repo facts for the implementer

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (put it first on `PATH`). The Homebrew pnpm 11 fails
  with E401. CI is pnpm 9.
- Installs on the branch use `--offline`. The Artifactory login in `~/.npmrc` is expired; **never edit
  `~/.npmrc`**. For registry packages, use an empty `NPM_CONFIG_USERCONFIG` file plus
  `--config.registry=https://registry.npmjs.org/`.
- Node 24 for runtime checks is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`.
- `test:e2e` needs `pnpm build` first. The suites run `--runInBand` and take minutes. `bin.test.ts` spawns the built
  CLI, so rebuild `packages/compiler` only if you touch product code (you should not).
- Unit-test conventions (assemble / act / assert, `testObj`, `actual`) apply to new spec code. The new e2e follows
  `tsc-defaults.test.ts`'s style (`expected` from `tsc`, `actual` from websmith).
- A new test file needs the MIT header (`pnpm license:add`). Do not add it to the `license:check` list.
- Write commits in Arlo's notation without a colon. Test-only changes are `t`, for example
  `t Moves the compiler-test fixtures off Node10 and ES5` (see the `commit-notation` skill).
- Use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists. The PR's 6.0.3 cell is the slice's main evidence.
- Open the PR with `plot-open-pr.sh`. Do not use `gh pr create`.
- Append `→ #<PR>` to the `bug/typescript-6-test-fixtures` line in the plan's `## Slices`
  (`docs/plans/2026-10-02-typescript-6-support.md:306`, before its `<!-- builds: -->` comment), and commit that on
  this branch. Say in the PR body that `bin.test.ts` was taken into this slice, and why (the decision above), so the
  plan's reader can find it.

### Scope guard

This branch owns:
- `packages/compiler-test/tests/*.test.ts` and `packages/compiler-test/tests/__snapshots__/*`, **except** the
  websmith-node slice's new `tsc-ignore-config.test.ts`;
- `packages/webpack-test/tests/*.test.ts`, `tests/test-files.ts` and `tests/__snapshots__/*`;
- `packages/compiler/src/bin.test.ts` (fixtures and expectations only, as above);
- one new compiler-test e2e file;
- the `→ #<PR>` suffix on its own line in the plan.

Do not touch:
- product code in any package, including `environment.ts`, `WebpackAddonService.ts` and `AddonRegistry.ts`
  (own-compilations slice), and `packages/node/**` (websmith-node slice, including `Compiler.spec.ts:52`);
- `packages/compiler/src/*.spec.ts` (the 9 red compiler unit tests are not row 11);
- `package.json`, `pnpm-lock.yaml`, tsconfigs and `.github/workflows/*`;
- suites that pass on 6.0.3 today (listed above).

Branches in flight or starting now. `origin` has no open feature branch today. Checked against the plans on
`develop`:
- **`bug/node-tsc-ignore-config`** (starts with you): the boundary above. No shared file except that it appends to
  `Release-Notes.md`, which you do not touch.
- **`bug/watch-generator-added-files`** (`docs/plans/2026-10-02-cli-error-exit-gaps.md:205`, no `waits:`, so
  eligible): its e2e is "a `--watch` case in `bin.test.ts`". **File collision on `bin.test.ts`.** It appends a case,
  and you change `createTsConfig`. Whoever merges second rebases. If you merge first, its new case gets the default
  `rootDir: "src"`. Say so in your PR so its owner knows.
- **`bug/profile-lib-names`** (#135, eligible since #177 merged): its e2e compares profile `lib` declarations with
  `tsc --lib`. It will likely add a case to `bin.test.ts` or compiler-test. If it lands first, give its fixture the same
  `rootDir` treatment.
- **`bug/loader-option-errors-once`** and **`bug/loader-unknown-profile-error`** (#134, both eligible): their e2e
  cases go into `packages/webpack-test`, possibly `webpack-profile-config.test.ts`. That is a possible file collision
  in the same file (`:27`, `:34-37`). Rebase, and keep their new cases out of your `rootDir` change unless they show
  TS5011 on 6.0.3.
- **`bug/report-config-option-errors`** and **`bug/report-file-less-diagnostics`** wait on
  `bug/loader-option-errors-once`, so they cannot start before you. They will add `bin.test.ts` cases later.
- **`feature/vite-plugin-tracer`** (#132): new `packages/vite*`. No overlap.

If you find something the plan did not anticipate beyond the items above, report it in the PR rather than
improvising outside scope.
