<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — esm-check-precision (slice 3: attribution)

- **Plan (canonical):** `docs/plans/2026-10-02-esm-check-precision.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #137 merged
- **Branch:** `bug/esm-check-attribution` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on `PATH`). Do not merge it yourself.
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

This is the third of the plan's four slices. It waited on `bug/esm-check-false-positives` (#145) and
`bug/esm-check-import-misses` (#160); both have merged, so it can start now. `bug/esm-check-package-subpaths` comes
after it, but touches different files (`cjs-names.ts`, `import-rules.ts`), so it does not wait on this slice's code.
This slice does not touch `packages/webpack/src/TsCompiler.ts` (plan, `## Slices` intro and Design § Approach), so it
is not held behind #134's `bug/loader-resolve-options-once` (PR #165, open).

### What to build

Three attribution items from story `node24-esm-support` (2026-09-25 "Wave 3 verification follow-ups"). None was run
on the CLI; they rest on code reading, and the line numbers below are from `develop` at c59594fc.

1. **A nested compile is checked twice (item 9) — the only code change.** A result processor that runs a nested
   websmith `Compiler` through `ctx.getSystem()` has its output checked by both compiles. The cause:
   - `emitResult` (`packages/core/src/compiler/Compiler.ts:728`) wraps the result-processor run in
     `ctx.observeWrites(…)` (`:771-781`), which records every `writeFile` through the context's system
     (`CompilationContext.ts:112-128`: `getSystem()` returns the observing `Object.create(system, { writeFile })`
     while the run lasts) and then checks everything it recorded (`:783`).
   - The nested `Compiler` writes through that system and checks its own output in its own `emitResult`. Every
     finding in the nested output is reported twice: once by the nested check, once by the outer one.
2. **In-place transformer edits are not attributed (item 7) — documentation plus evidence, no detection.**
   `attributeTransformer` (`CompilationContext.ts:418-445`) records a change only when `output !== input`
   (`:420`). A transformer that only calls `addSyntheticLeadingComment` or `setEmitFlags` on existing nodes returns
   its input and is never named. `packages/compiler/README.md:277-278` says so: "A transformer that rebuilds nodes
   without a real change is named too; one that only mutates nodes in place is not."
3. **The attribution fallback differs from the delivered plan (item 8) — a recorded decision, no code.** The
   delivered `esm-output-check` plan said a finding lists the profile's active addons when attribution is unclear.
   The code passes `ctx.getAddonsChangingFile(fileName)` (`Compiler.ts:737`, `:845`) and omits `addons:` when it is
   empty; the README describes the code.

The plan is canonical. This brief is orientation.

### The decisions the plan settles — do not re-derive them

**Item 7: document the gap, do not detect in-place edits (decision (c)).**

- An in-place edit changes comments and printing only. It cannot introduce a `require`, `module`, `exports`,
  `__dirname`, `__filename`, a specifier or a default import. A transformer that adds such code builds new nodes,
  and `visitEachChild` then returns a new `SourceFile`, so `output !== input` already attributes it.
- Rejected: (a) emit-node comparison per visited node, per transformer, per file. It adds build cost and a new
  misattribution class while fixing no finding (addon-author juror; no other juror weighed it).
- Rejected: (b) naming every transformer that ran. The delivered plan already rejected it.
- **The first commit is the evidence:** unit tests, one per in-place API an addon can reach, showing the printed
  output gains none of the constructs above and the addon is not named. If one of them *does* add a construct or
  get named, stop and report: decision (c) rests on it.
- README `:277-278` becomes: "A transformer that only edits nodes in place (comments, emit flags) is not named; such
  an edit cannot introduce an ESM finding." Keep the sentence about rebuilt nodes before it.

**Item 8: keep the implementation, record the decision in the story.**

- Rejected: listing every active addon on unattributed findings. It would name addons on findings in hand-written
  code and break the README's rule "a diagnostic that names no addon points at a construct from your own source";
  all three jurors agreed.
- No code and no README change (`:276-277` already describe the code). Add a dated section to
  `docs/stories/node24-esm-support/STORY-node24-esm-support.md`, after the slice-1 section (`:376`), that closes
  "Plan vs. brief on attribution fallback" (`:286-289`) with this decision and the rejected alternative. Close
  "In-place transformer edits" (`:283-285`) and "Nested compiles … checked twice" (`:293-294`) there too.

**Item 9: a registry held on `globalThis` under `Symbol.for("@quatico/websmith-core/esm-check")`, keyed by resolved
path and text, scoped to the outer result-processor run.** (Maintainer decision 2026-10-02, Jan Wloka, amending the
plan's module-held registry: see "Two copies of core" below.)

- Each `Compiler`'s ESM check records the outputs it checked (resolved path and text) in a registry that the outer
  compile opens around `runResultProcessors` (`Compiler.ts:771-781`) and closes after it.
- The outer compile skips a recorded write when a nested check recorded the same path and text during that window.
- A file the nested compile wrote without a check (no `esm` in its profile), or one rewritten after the nested
  check, is still checked by the outer compile, as today.
- Rejected: a symbol on the system object. It is lost when an addon wraps or copies `ctx.getSystem()` for the nested
  `Compiler`, which is the common way to create one (addon-author juror). The registry must not depend on the system
  object.
- Findings of a nested check name only the nested profile's addons, never the outer result processor that ran it.
  The README states this.
- No residual two-copies gap: because the registry lives on `globalThis` under a `Symbol.for` key, two copies of
  `@quatico/websmith-core` in one process share it. The README states one report per file also across copies, and
  drops the plan's "two copies double-check" sentence. Rejected: the plan's module-held registry, because it cannot
  satisfy the plan's own CLI e2e (below).

**Mechanics the plan leaves implicit:**

- **Timing: the nested check records *after* the write.** The outer `onWrite` callback (`Compiler.ts:772-778`) runs
  when the nested compile writes, which is before the nested `emitResult` checks and records the file. A skip inside
  `onWrite` therefore never fires. Filter `outputs` once `observeWrites` returns, before `checkEsmOutput` (`:783`),
  by comparing each entry's resolved path and final text against what the window recorded. A file the outer pipeline
  rewrote after the nested check then has different text and stays checked.
- **Nesting and exceptions.** Use a stack of open windows (a nested compile can run its own result processors), and
  close the window in a `finally`, as `observeWrites` restores its system (`CompilationContext.ts:125-127`). A
  throwing result processor must not leave a window open for the next compile.
- **What a check records.** Record every file passed to `checkEsm`, including the ones `esm.ignore` skips, so the
  outer compile does not re-check a file the nested profile chose to ignore. Record only while a window is open: a
  top-level compile and watch rebuilds (`checkWatchedFragment`, `:840-850`) must record nothing.
- **Key.** Resolve the path with the checking compiler's own `system.resolvePath`. Compare the text exactly.
- **Exit status.** The CLI sets exit code 1 from `reporter.hasErrors()` (`packages/compiler/src/command.ts:169-172`),
  that is, from the outer reporter. After this change, a nested finding fails the outer build only if the nested
  `Compiler` reports to the same reporter (`ctx.getReporter()`). The plan does not say this; state it in the README
  sentence on nested compiles, and give the e2e fixtures `reporter: ctx.getReporter()`.

**Carried over, unchanged:**

- A result processor that rewrites an emitted file is checked once, on the final content, and named only if it
  changed the content (`Compiler.ts:762-778`; Compiler.spec `yields one ESM diagnostic per file w/ result processor
  rewriting emitted file`, `names no addon w/ result processor rewriting emitted file unchanged`). Keep both green.
- `observeWrites` leaves the system's `writeFile` untouched and restores the context's system after a throw
  (`leaves writeFile of system unchanged …`, `restores system of context w/ throwing result processor`).
- No new codes, no config keys, no `AddonContext` change. Addons depend on `@quatico/websmith-api` only (AGENTS.md
  rule 10); the nested compile in a *test fixture* may load `@quatico/websmith-core`, see the warning below.

### Two copies of core: why the registry is on `globalThis`

The plan's CLI e2e has a result processor run a nested compile through a wrapped `ctx.getSystem()` and expects one
report instead of two. A module-held registry cannot pass it:

- `packages/compiler/bin/bin.js` is a webpack bundle; `packages/compiler/webpack.config.js:27` aliases
  `@quatico/websmith-core` to `../core/src`, so the CLI carries its own copy of `Compiler`.
- An addon under `PROJECT_DIR/addons` (`packages/compiler/test-output-<id>/`) that requires
  `@quatico/websmith-core` resolves `packages/compiler/node_modules/@quatico/websmith-core` → `packages/core/lib`, a
  second copy.

The maintainer chose the `globalThis` registry so the e2e passes as written. Requirements:

- Read and create it lazily: `(globalThis as any)[KEY] ??= { windows: [] }` with
  `KEY = Symbol.for("@quatico/websmith-core/esm-check")`. Keep the stored shape minimal and version-tolerant (plain
  objects and arrays of `{ path, text }` records, no class instances), since two different core versions may share it.
- Still not on the system object (the rejected alternative above).
- Unit test: two independently loaded module instances (`jest.isolateModules`) share one window, so a nested check in
  one suppresses the outer re-check in the other. Plus a test that no global state leaks after a window closes,
  including after a throw.
- The CLI e2e must pass on the built `bin.js` with one report.

### Done when

Unless a test is marked *(pin)*, it must **fail on `develop` before your change**. Run it red first and note the red
run in the PR. A *(pin)* passes before and after; it catches a naive implementation or pins the documented
behaviour. Unit tests use assemble / act / assert with `testObj` / `actual`. Names follow each file's style.

`packages/core/src/compiler/compilation/CompilationContext.spec.ts` (`describe("addon attribution")`, `:363`; use its
`transpile`, `createAddon`, `renaming`, `identity` helpers). The first commit, all *(pin)*:

- `yields no addon w/ transformer adding synthetic leading comment in place`
- `yields no addon w/ transformer adding synthetic trailing comment in place`
- `yields no addon w/ transformer setting emit flags in place`
- `yields no addon w/ transformer setting text range in place`
- `yields no ESM construct in output w/ transformer editing nodes in place`: one test (or `it.each` over the four
  APIs) on a source without CommonJS names, asserting that the printed output contains no `require`, `module`,
  `exports`, `__dirname`, `__filename` and no import specifier beyond those of the input.

`packages/core/src/compiler/Compiler.spec.ts` (`describe("compile w/ esm profile")`, near the result-processor tests
at `:4069-4240`). The nested compile is a `CompilerTestClass` built inside the result processor, writing
`ESM_SOURCE` output under `type: "module"` and reporting to the outer `ReporterMock`. Count 91001 per file.

- `yields one ESM diagnostic w/ result processor running nested compile through context system`. Before: two.
- `yields one ESM diagnostic w/ result processor running nested compile through wrapped context system`: the nested
  compiler gets `{ ...processorCtx.getSystem(), writeFile: (…) => processorCtx.getSystem().writeFile(…) }` (a copy,
  not `Object.create`). Catches a symbol on the system object.
- `yields two ESM diagnostics w/ result processor rewriting file after nested compile checked it`: the processor
  runs the nested compile, then rewrites the nested output with a banner, keeping the `require`. Expect the nested
  check on the first text and the outer check on the rewrite. *(pin)* if it already gives two on `develop`; it
  catches a skip keyed by path alone.
- `yields one ESM diagnostic w/ nested compile without esm writing CommonJS`: the nested profile has no `esm`. The
  outer compile checks the file. *(pin)*: catches recording files the nested compile wrote but did not check.
- `names nested profile addons only w/ result processor running nested compile`: the finding names the nested
  profile's addons and not the outer result processor's addon.
- `yields one ESM diagnostic per compile w/ two compiles after throwing nested result processor`: a throwing
  processor in the first compile must not leave a window open, so a second top-level compile of the same output
  still reports. Catches a missing `finally`.
- The existing result-processor tests stay green.

`packages/compiler/src/bin.test.ts`, after the ESM result-processor case at `:610` and before `createEsmProject`.
Give every fixture an explicit `target` and `module` in tsconfig and profile.

- `should exit with status 1 and report 91001 once w/ result processor running nested compile through wrapped system in node ESM profile`:
  the addon builds a nested compile with a wrapped `ctx.getSystem()` and `reporter: ctx.getReporter()`; count
  `ESM91001` lines for the nested output file. Before: two. See the known risk above: this is the test expected to
  stay at two with a module-scoped registry.
- *(pin)* `should report 91001 without naming transformer addon w/ transformer only adding synthetic comment in node ESM profile`:
  a source that keeps a `require` (91001) and a transformer addon that only calls `addSyntheticLeadingComment`.
  Assert the 91001 line and that the output does not contain `addons: <that addon>`. It fails if someone changes the
  documented non-attribution without updating the README.

Docs:

- **`packages/compiler/README.md`, ESM check section:**
  - `:277-278`: the in-place sentence from the decision above.
  - Near `:280-283` (result processors): a nested websmith compile that a result processor runs through
    `ctx.getSystem()` is checked once, by the nested compile, and its findings name the nested profile's addons
    only. They fail the outer build only when the nested compile reports to `ctx.getReporter()`. Two copies of
    `@quatico/websmith-core` in one process check such a file twice.
- **`Release-Notes.md`, `## [Unreleased]`, `### Fixed`** (`:66`): one entry for item 9. A file a nested compile
  writes and checks is checked once, not twice; its findings name the nested profile's addons. This entry needs no
  "may now fail" line, since it removes a report.
- **Story:** the dated section for items 7–9 described under item 8.

Gates, all green:

- `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`.
- `pnpm license:add` for any new source file. Never add a file to the `license:check` list.

Repo mechanics:

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin`. Homebrew's pnpm 11 fails with E401.
- Install with `--offline`; the Artifactory login in `~/.npmrc` has expired. Never edit `~/.npmrc`. For a registry
  package, use an empty `NPM_CONFIG_USERCONFIG` file plus `--config.registry=https://registry.npmjs.org/`. This slice
  needs no new dependency.
- Use Node 24 at `$HOME/.nvm/versions/node/v24.21.0/bin/node` for runtime checks of emitted fixtures.
- `bin.test.ts` runs `packages/compiler/bin/bin.js`; run `pnpm build` before the CLI e2e, or it tests the old bundle.
- Commits use Arlo's notation without a colon (`B Fixes …`; see the `commit-notation` skill).
- Use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit (the item-7 evidence) as soon as it exists.
- Open the PR with `plot-open-pr.sh`. Never use `gh pr create`.
- Append `→ #<PR>` to this branch's line in the plan's `## Slices` and commit that on this branch.
- Do not merge.

### Scope guard

This branch owns:

- `packages/core/src/compiler/Compiler.ts`: `emitResult`'s result-processor window and `checkEsmOutput`'s recording
  only, plus a registry module beside it if you prefer one.
- `packages/core/src/compiler/compilation/CompilationContext.ts` only if `observeWrites` needs a hook; the item-7 work
  changes no production code there.
- Their specs: `Compiler.spec.ts`, `CompilationContext.spec.ts`.
- The new cases in `packages/compiler/src/bin.test.ts`.
- The ESM check section of `packages/compiler/README.md`, the `Release-Notes.md` entry, the story section, and this
  branch's line in the plan.

Not this branch:

- `packages/core/src/compiler/esm/*` (slices 1, 2 merged; slice 4 owns `cjs-names.ts` and `import-rules.ts`).
- `packages/webpack/src/TsCompiler.ts` and `NODE_IMPORT_RULES`, in any slice of this plan. If you find you must touch
  them, stop and report: such a change is held until #165 merges.
- `packages/api` (`AddonContext`): no API change.

The other branches in flight, with each one's files checked (`gh pr diff`, or its plan line on `develop`):

- `bug/loader-resolve-options-once` (#134, PR #165, open):
  - It changes `Compiler.ts` (new `resetCompilationCaches` and `recreateCompilationContexts` at `:341`) and
    `Compiler.spec.ts` (a `CompilerTestClass` hunk at `:76`, a `setOptions` block at `:768`, and Prettier re-wraps of
    the result-processor tests at `:3900-3966` and `:4189-4229`), plus `Release-Notes.md` `### Changed`,
    `packages/api/src/addons/AddonContext.ts`, `packages/webpack/*` and `packages/webpack/README.md`.
  - Real collisions: `Compiler.spec.ts`, where your new tests sit right next to the tests #165 re-wraps; and
    `Compiler.ts`, in a different region (no textual conflict expected). Add your tests after
    `restores system of context w/ throwing result processor`, do not reformat the existing ones, and expect to
    rebase if #165 lands first.
- `bug/cli-config-parse-and-addons-dir` (#136, PR #163, open):
  - It changes `packages/compiler/src/bin.test.ts` (one hunk at `:569`), `command.ts`, `command.spec.ts`,
    `packages/core/src/compiler/config/resolve-compiler-config.*`, `Release-Notes.md` `### Changed` and its plan.
  - Real collisions: `bin.test.ts` (a nearby hunk, before your insertion point at `:610`) and `Release-Notes.md`
    (different section). The second to merge resolves them.
- `bug/trim-runtime-dependencies` (PR #164, open): root `package.json`, `packages/core/package.json`,
  `packages/node/package.json`, `packages/compiler-test/package.json`, `pnpm-lock.yaml`, `browser-system.*` and
  `Release-Notes.md`. Collision: `Release-Notes.md` only. Add no dependency.
- `infra/typescript-6-toolchain` (docs/plans/2026-10-02-typescript-6-support.md): every package tsconfig, ts-loader
  and the CLI bundle's `rootDir`, ts-jest / typescript-eslint versions, `package.json` files, `pnpm-lock.yaml`.
  Touch none of them. Its CLI-bundle change touches the `webpack.config.js` behind the known risk above; do not edit
  that file. If it merges first, rebase and re-run `pnpm lint` and `pnpm test`.
- `bug/option-enum-tables` (docs/plans/2026-10-02-tsc-option-parity.md, starting now):
  - It removes `TARGET_MAP` and its `normalizeCompilerOptions` branch from `Compiler.ts`, changes the message at
    `Compiler.ts:804` (the plan says `:802`) and the 6046 constant (`TS_ERROR_CODE_INVALID_CLI_OPTION`, `:78`), and
    edits the `ts7-rearchitecture` story.
  - Real collision: `Compiler.ts`, in regions apart from `emitResult` (`:728-788`) and `checkEsmOutput` (`:856`). Do
    not touch `getCheckedEsm` (`:795-822`), which holds that message.

If you find something the plan did not anticipate, report it rather than improvising outside scope. Three examples:
- the two-copies case above;
- an in-place API that adds a construct or gets an addon named;
- a nested compile whose check runs outside the outer result-processor window, for example from a timer or a
  promise the result processor does not await.
