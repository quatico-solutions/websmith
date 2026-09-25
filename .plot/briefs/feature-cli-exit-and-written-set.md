<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — esm-output-check (wave 1)

- **Plan (canonical):** `docs/plans/2026-09-24-esm-output-check.md` on `develop`
- **Approved:** 2026-09-25, Jan Wloka, plan-PR #112 merged
- **Branch:** `feature/cli-exit-and-written-set` (base: `develop`), worktree `.worktrees/feature-cli-exit-and-written-set`
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh`; do not merge
- **Review of the code:** per repo convention (PR review; CI `pull-request.yml` must be green)

Wave 2 (`feature/esm-check-core`) waits on this branch: it builds the ESM check on the written set and relies on
error-level diagnostics failing the CLI. Nothing here is ESM-specific.

### What to build

Two pipeline fixes the ESM check depends on, each useful on its own:

1. **`websmith` exits non-zero when an error-level diagnostic was reported.** Today it never does:
   `command.ts:166-170` calls `compiler.compile()` and ignores the result, so a build full of type errors, a
   failed processor, or a missing addon exits 0. This is a deliberate behaviour change and is in the plan's
   changelog.
2. **`processOutput` returns an explicit written set.** Today it returns `files: output.outputFiles` whether or
   not it wrote them (`Compiler.ts:776-800`): under `addonEmitOnly`, files it skipped writing are reported as
   emitted, and the list includes `.d.ts` and `.map` files. Add a separate field for what was actually written;
   leave `files` and everything derived from it unchanged.

The plan is canonical; this is orientation.

### Settled decisions — do not re-derive them

**Count errors at the reporter, not in the `EmitResult`.** The obvious implementation — inspect
`compile()`'s returned diagnostics — misses most errors:

- `report()` sends TypeScript's pre-emit diagnostics to the reporter but returns `result` *without* them
  (`Compiler.ts:597-605`), so every type error on the Program path is absent from the return value.
- Addon-registry failures, result-processor errors (`Compiler.ts:641-643`) and config errors
  (`resolve-compiler-config.ts:94`) are reported straight to the reporter and never enter any `EmitResult`.
- `emitResult` adds fragment diagnostics to `result.diagnostics` only when the fragment has no files
  (`Compiler.ts:627-633`).

So wrap or extend the `Reporter` the CLI passes in (`command.ts`) to record whether any diagnostic with
`category === ts.DiagnosticCategory.Error` was reported, and set the exit code from that. Warnings and
messages never fail the build.

**Set the exit code; do not throw.** `bin.ts` replaces `process.exit` with a function that throws and then
rethrows for non-zero codes — the user would get a stack trace instead of an exit status. Prefer
`process.exitCode = 1` after `compile()`, and check that `bin.ts`'s wrapper still returns cleanly.

**Watch mode does not exit.** `compiler.watch()` keeps running; an error in one rebuild must not end the
watcher. Only the one-shot `compile()` path sets the exit code.

**`ResultProcessor`s keep today's list.** `emitResult` hands `result.emittedFiles` to result processors
(`Compiler.ts:636-646`). The plan decided that list does not change in this plan — changing what addons
receive is a behaviour change nobody asked for. The written set is a *new* field for the ESM check to use.
(The comment at `:636-637`, "only emitted files are passed", is wrong today; correct the comment, not the
behaviour.)

**The webpack loader is out of scope here.** Failing webpack builds via `this.emitError` is wave 4
(`feature/esm-check-webpack`). `TsCompiler.build` calls `emitSourceFile` directly and never uses the CLI
exit path; do not touch `packages/webpack` beyond keeping `CompileFragment` consumers compiling.

### Done when

- CLI e2e (`packages/compiler/src/bin.test.ts` or `packages/compiler-test`), each asserting the **exit status**:
  - a project with a **type error** exits non-zero — catches the `EmitResult`-only implementation, which exits 0
    here because `report()` drops pre-emit diagnostics from the return value;
  - a project whose **processor throws** exits non-zero — catches a check that only looks at TypeScript
    diagnostics;
  - a project with only **warnings** exits 0;
  - a clean project exits 0.
- Unit tests on `processOutput` / `emitSourceFile` (`Compiler.spec.ts`):
  - with `addonEmitOnly: true` and a file no addon touched, the written set is empty while `files` is not —
    catches a written set that simply aliases `files`;
  - with a processed file, the written set holds exactly the written outputs, including `.d.ts`/`.map` when they
    are written (filtering to JS is the ESM check's job in wave 2, not this slice's).
- `ResultProcessor`s receive the same list as before (existing tests stay green; add one asserting it under
  `addonEmitOnly`).
- Repo gates: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`; unit tests follow `docs/rules/testing.md`
  (AAA, `testObj` / `actual`); license header on new files.
- `Release-Notes.md`: entry under `[Unreleased]` for the exit-code change.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `../plot/scripts/plot-open-pr.sh` (from the Plot plugin; not `gh pr create`).
- When the PR exists, append `→ #<number>` to this branch's line in the plan's `## Slices`.

### Scope guard

This branch owns: `packages/compiler/src/command.ts`, `packages/compiler/src/bin.ts`, the reporter wiring it
needs, `processOutput` / `CompileFragment` in `packages/core/src/compiler/Compiler.ts`, their tests, and
`Release-Notes.md`.

In flight at dispatch (verified 2026-09-25): `feature/fix-ts-addons-esm-projects` (Draft plan, #111, touches
`AddonRegistry.ts` and `WebpackAddonService.ts`) and `feature/node-24-support` (Draft plan, config only). No
overlap with this branch's files. No other `esm-output-check` branch is claimed.

If you find something the plan did not anticipate, report it rather than improvising outside scope.
