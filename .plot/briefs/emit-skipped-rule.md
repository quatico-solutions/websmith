<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — cli-error-exit-gaps (wave 3: the emitSkipped rule)

- **Plan (canonical):** `docs/plans/2026-10-02-cli-error-exit-gaps.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #136 merged
- **Branch:** `bug/emit-skipped-rule` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on `PATH`); the implementer never merges it
- **Review of the code:** independent review, plus uncached gates run by the maintainer's session before merge

Wave 3 of 7. It waits on waves 1 and 2, `bug/cli-project-directory` (#147) and `bug/cli-config-parse-and-addons-dir`
(#163). Both have merged, so nothing blocks it. The plan puts this slice "before the slices that start reporting
more option errors". Wave 4 (`bug/report-config-option-errors`) and wave 5 (`bug/report-file-less-diagnostics`)
rely on this output rule, and both also edit `Compiler.ts`.

### What to build

This is item 8 of the plan, plus the output rule for items 1 to 3. All line numbers below were checked on `develop`
at `f7cc3606`. The plan's `Compiler.ts` numbers predate #161, #165, #167 and #168, so use these.

**Item 8: a type-info addon with `declaration: true` drops the `.js` of a file with a declaration emit error.**
Take `export const Foo = class { private x = 1; }` (TS4094) with an addon that needs type information (a legacy
addon, where `needsTypeInfo` is undefined, counts). websmith writes `b.js` and `b.d.ts` but no `a.js`. Without the
addon, websmith writes `a.js`, and so does `tsc`. Both exit 1 with TS4094. The plan ran this.

Root cause: `processOutput` writes only `if (output && !output.emitSkipped)` (`Compiler.ts:1062`). The language
service's `getEmitOutput` returns the `.js` with `emitSkipped: true`, and both language-service branches of
`transpileInternal` pass that value through:
- Case 4, an addon needing the big Program plus `declaration`: the branch spans `:1210-1257`, `getEmitOutput` is at
  `:1212` and the return at `:1253-1256` (the plan cites `:1201-1203`);
- the default slow path: `:1265-1272` (the plan cites `:1256-1258`).

The per-file declaration path (Case 3) writes `a.js` because it hardcodes `emitSkipped: false` (`:1387`, `:1398`;
the plan cites `:1370`, `:1389`).

**The fast path drops all output on an option error.** `transpileSourceCode` returns
`emitSkipped: filteredDiagnostics.some(cur => !cur.file)` (`:1423`; the plan cites `:1414`). An option error such as
TS5095 (`moduleResolution: "bundler"` with `module: "commonjs"`) has no file, so every file's output is dropped. The
build exits 1 and writes nothing, whereas `tsc` writes the output.

Measured here with TypeScript 5.7.3, the workspace version, through a language service and `ts.transpileModule`:

| Producer | `noEmitOnError` | `emitSkipped` | Output files | Diagnostics |
|----------|-----------------|---------------|--------------|-------------|
| LS `getEmitOutput("a.ts")` (TS4094) | false | **true** | `a.js` | 4094 |
| LS `getEmitOutput("b.ts")` (clean) | false | false | `b.js`, `b.d.ts` | — |
| LS `getEmitOutput("a.ts")` | true | true | none | 4094 |
| LS `getEmitOutput("b.ts")` | true | true | none | 4094 |
| `transpileModule` (TS5095) | false | — | full `outputText` | 5095, no file |
| `transpileModule` (TS5095) | true | — | full `outputText` | 5095, no file |

The last row matters. `transpileModule` ignores `noEmitOnError` (see `TRANSPILE_REMOVED_OPTIONS`,
`Compiler.ts:68-82`; `transpileNodeModule` removes it too). On the fast path, websmith must therefore decide
`noEmitOnError` itself.

The plan is canonical; this brief is orientation.

### Settled decisions — do not re-derive them

**One rule for all producers.** A fragment's `emitSkipped` is true only when the fragment has no output files, or
when `noEmitOnError` is set and the fragment carries an error. Option errors and declaration emit errors otherwise do
not stop `.js` output, as with `tsc`.

The rejected alternative is a separate rule per path. Then the same option error would emit or not depending on which
path found it: today the fast path emits nothing on TS5095, the Program path emits. The panel's compiler juror found
this contradiction (`panel.md`, "Where they differ" 4), and the plan's Open Point "One `emitSkipped` rule" decides it.

**Fix the three producers, not `processOutput`. No second emit.**
- **Both language-service branches** return
  `emitSkipped: emitOutput.emitSkipped && (!!noEmitOnError || emitOutput.outputFiles.length === 0)`, read from
  `ctx.getCompilerOptions()`. Put it in one small private helper that both branches call, so they cannot drift.
- **The fast path** (`:1418-1424`) returns `emitSkipped: true` only when it has no output files, or when
  `noEmitOnError` is set and `filteredDiagnostics` contains an `Error`-category diagnostic. Read `noEmitOnError` from
  `ctx.getCompilerOptions()`, not from the options handed to `transpileModule`, which drops it. This one return
  covers both `ts.transpileModule` and `transpileNodeModule`.
- **Leave alone:** `processOutput` (`:1062`), Case 3's hardcoded `false` (`:1387`, `:1398`), and `emitResult`'s
  aggregate flag (`:742`).
  - Case 3 already satisfies the rule: under `noEmitOnError`, `program.emit` writes no files, so `emitSkipped: false`
    writes nothing. The comment at `:1329-1330` and the specs at `Compiler.spec.ts:1388-1415` pin this.

Two alternatives were rejected:
- **A second, `.js`-only emit after a skipped emit.** The original plan text left this open. The compiler juror ran
  `getEmitOutput` under TS4094 and found that the `.js` is already in `outputFiles`; only the flag drops it
  (`compiler-pipeline.md` finding 1). A second emit would double the language-service work for nothing.
- **Changing `processOutput` to write despite `emitSkipped`.** That would also write output that a skipped emit never
  meant to write, and it hides the decision from the producers. The plan applies the rule "at the three producers
  that decide it today".

**Diagnostics are unchanged; only output changes.** TS4094 on the language-service path still reaches the reporter
through `report()` → `ts.getPreEmitDiagnostics` (`:664-687`). The language-service fragments carry only
`getSyntacticDiagnostics`. TS5095 on the fast path still travels in the fragment's diagnostics, deduplicated by
`getDiagnosticKey` (`:689`). Do not add, move or deduplicate diagnostics in this slice: waves 4 and 5 own reporting.
The exit code stays 1 because the error still reaches the reporter.

**A consequence of the rule: `noEmitOnError` now holds on the fast path too.** Today a syntax error on the fast path
writes output even under `noEmitOnError`, because the diagnostic has a file. Under the rule, such a fragment has
`noEmitOnError` and an error, so it writes nothing, as `tsc` does. `transpileOnly` takes the same fast path, so it
changes too.

Do not special-case either. State the change in the PR and in `Release-Notes.md`. No existing spec or e2e pins fast
path plus `noEmitOnError` (checked: the `noEmitOnError` cases in `Compiler.spec.ts` and at `bin.test.ts:513` use the
per-file path or a type-info addon). If a test does turn red on it, report it rather than weakening the rule.

**The webpack loader changes too.** `TsCompiler.build` takes `result.files` from `emitSourceFile`
(`packages/webpack/src/TsCompiler.ts:330-341`). A module with a fast-path option error now hands webpack its
JavaScript and runs the ESM check on it, where it used to get no files. The plan's Open Point "Webpack loader" makes
each slice run `packages/webpack-test` and state any change in the loader's output in its PR. Do not edit
`packages/webpack/src`.

**TS 7 inventory: no new entry.** This slice adds no new use of per-file Programs, `transpileModule` or the language
service; it only changes a flag on outputs that already exist. If your change does add a use, add a line to
`docs/stories/ts7-rearchitecture/analysis-ts7-api-gap.md`, as the plan's Notes require.

### Done when

- **Unit tests in `packages/core/src/compiler/Compiler.spec.ts`.** Use AAA with `testObj` / `actual`, never a shared
  `testObj`, and a virtual system. Call `emitSourceFile("/src/target.ts", undefined, false)` and assert on
  `actual.files`, as the specs at `:1362-1432` do. For a type-info addon, mirror `createCompiler` at `:4819-4840` (a
  legacy addon through `addons.getAvailableAddons`). Each assertion below catches a specific naive fix:
  - **Case 4** (type-info addon, `declaration: true`), TS4094 source:
    - Without `noEmitOnError`, `actual.files` contains `/src/target.js`. This fails today.
    - With `noEmitOnError`, it contains no files. This catches `emitSkipped: false` hardcoded like Case 3.
  - **Default language-service path** (type-info addon, no `declaration`):
    - With `noEmitOnError` and a type error (`const x: number = "s"`), no files.
    - Without `noEmitOnError`, `/src/target.js`.

    This pins the second branch, so fixing only Case 4 or hardcoding `false` there fails.
  - **Fast path**, `module: CommonJS` with `moduleResolution: Bundler` (TS5095, no file):
    - Without `noEmitOnError`, `actual.files` contains `/src/target.js` **and** `actual.diagnostics` still contains
      code 5095. The diagnostic check catches a fix that drops the diagnostic along with the flag.
    - With `noEmitOnError`, no files.
  - **Fast path, syntax error with `noEmitOnError`:** no files. The existing "yields output despite syntax error w/
    module $name on fast path" (`:1416-1432`, ESNext and NodeNext, no `noEmitOnError`) must stay green. Mirror its
    `it.each` over both module kinds, so the `transpileNodeModule` variant is covered.
  - The existing "reports TypeScript option error once w/ several files on fast path" (`:1214-1233`) stays green.
    Optionally add that each file's `.js` is now written.
- **e2e in `packages/compiler/src/bin.test.ts`.** The plan allows `bin.test.ts` or `packages/compiler-test`; use
  `bin.test.ts`, next to the declaration and option-error cases at `:448-511`. Use `getOutput` (`:1366`) for the
  files.
  - **TS4094, type-info addon, `declaration: true`.** Use `createAddon("type-info-addon", ...)` with `--addonsDir` /
    `--addons`, as at `:424-434`.
    - The status is 1.
    - `getOutput("test.js")` is defined. This fails today.
    - The TS4094 message (`(1,14): Property 'x' of exported anonymous class type may not be private or
      protected.`) appears exactly once.
    - Add the same case with `noEmitOnError: true`: status 1 and `getOutput("test.js")` undefined.
  - **TS5095 on the fast path.** Use `module: "commonjs"` with `moduleResolution: "bundler"` in `tsconfig.json` (cast
    with `as TscArguments`, as at `:492-500`).
    - The status is 1.
    - Option `'bundler'` (TS5095) is reported exactly once.
    - `getOutput("test.js")` is defined. This fails today.
    - Add the same case with `noEmitOnError: true`: no `test.js`.
- **Loader.** Run `packages/webpack-test`, and state in the PR whether the loader's output changed. Expect a change
  only for modules with a fast-path option error.
- **Gates**, all green locally: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`,
  `pnpm test:e2e --skip-nx-cache`. Run `pnpm build` before the e2e, because `bin.test.ts` runs `bin/bin.js`.
- **`Release-Notes.md`**, under `## [Unreleased]` / `### Changed`, appended after "A missing `--addonsDir` directory
  is warned about once instead of twice." Do not repeat the lead sentence: wave 1 added it. Add one entry, following
  the plan's Changelog:
  - Option errors and declaration emit errors no longer suppress `.js` output, as with `tsc`, unless `noEmitOnError`
    is set.
    - This covers the fast path: an option error such as TS5095 now writes the output.
    - It covers an addon that needs type information with `declaration: true`: a declaration emit error such as
      TS4094 no longer drops the file's `.js`.
    - With `noEmitOnError`, a file with an error is no longer written on the fast path or with `transpileOnly`.
- **README.** This slice has no README duty. The exit-code line in `packages/compiler/README.md` belongs to wave 4.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh` (on `PATH`). Do not use `gh pr create`.
- Once the PR exists, append `→ #<number>` to the `bug/emit-skipped-rule` line in the plan's `## Slices` (under
  "### The emitSkipped rule"), and commit that on this branch.
- Commits use Arlo's notation without a colon, for example
  `B Writes .js output despite option and declaration emit errors unless noEmitOnError is set`. See the
  `commit-notation` skill.

### Repo facts

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (put it first on `PATH`). The Homebrew pnpm 11 fails with
  E401.
- Install with `--offline`. The Artifactory login in `~/.npmrc` has expired; never edit `~/.npmrc`. If you need a
  registry package, use an empty `NPM_CONFIG_USERCONFIG` file plus `--config.registry=https://registry.npmjs.org/`.
- For Node 24 runtime checks, use `$HOME/.nvm/versions/node/v24.21.0/bin/node`.
- Use `trash`, never `rm`.

### Scope guard

This branch owns:
- `packages/core/src/compiler/Compiler.ts`: the two language-service returns in `transpileInternal`, the fast-path
  return in `transpileSourceCode`, and one new private helper. Nothing else in the file.
- `packages/core/src/compiler/Compiler.spec.ts`
- `packages/compiler/src/bin.test.ts`
- `Release-Notes.md`
- the `→ #<PR>` on this slice's line in the plan

Do not touch:
- `processOutput`, `report()`, `emitResult`, or the Case 3 per-file path in `Compiler.ts`
- `ResolvedCompilerOptions.ts` and `parsed-command-line.ts`, which wave 4 owns
- anything under `packages/webpack/src`

Branches starting at the same time, checked against their plans on `develop`:
- `bug/depends-closure-core` (`docs/plans/2026-10-02-loader-options-once.md`) adds one ordered `depends` closure in
  core. It touches the callers `resolve-compiler-config.ts:138`, `ResolvedCompilerOptions.ts:328`,
  `AddonRegistry.ts:194` and `WebpackAddonService` with their specs, and states "no behaviour change".
  - No shared file. Its plan names neither `Compiler.ts` nor `Compiler.spec.ts` and adds no Release-Notes entry.
- `infra/typescript-6-ci-leg` (`docs/plans/2026-10-02-typescript-6-support.md`) adds an advisory TypeScript 6.0.3
  cell (`continue-on-error`) to `.github/workflows/pull-request.yml`. No shared file.
  - If it merges first, your PR's run gets that cell. A red 6.0.3 cell is advisory. If your new specs fail only
    there, name it in the PR; the language service's `emitSkipped` semantics may differ on 6.x.
- `bug/esm-check-package-subpaths` (`docs/plans/2026-10-02-esm-check-precision.md`) adds the CLI-only rule
  `checkPackageSubpath` (91022–91024) in the import rules, `cjs-names` and their specs, the ESM section of
  `packages/compiler/README.md`, CLI e2e cases in `bin.test.ts`, and a `Release-Notes.md` entry. Its plan names no
  `Compiler.ts` or `Compiler.spec.ts` change.
  - `bin.test.ts` and `Release-Notes.md` get append conflicts only (it extends the ESM list under `### Changed`; you
    append a new entry).

Real collisions:
- `Release-Notes.md` with `bug/esm-check-package-subpaths`: an append conflict in `### Changed`.
- `bin.test.ts` with `bug/esm-check-package-subpaths`: append conflicts only.
- `Compiler.ts` and `Compiler.spec.ts`: none of the three starts there now. Every later wave of this plan edits both
  (`report()`, `watch()`, `transpileInternal` for `.d.ts` and JavaScript at `:1193-1201`). So do the queued
  TypeScript 6 slices (`Compiler.ts:802`, `:933`, `:1395` per their plan). Keep your diff to the three returns and
  the helper so those rebases stay trivial.

If you find something the plan did not anticipate, report it rather than improvising outside scope.
