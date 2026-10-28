<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — loader-asset-dep-and-cli-noemit (wave 1: CLI noEmit)

- **Plan (canonical):** `docs/plans/2026-10-28-loader-asset-dep-and-cli-noemit.md` on `develop`
- **Approved:** 2026-10-28, jwloka, in-session
- **Branch:** `bug/cli-no-emit` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

Wave 2 ("Loader asset dependencies", `bug/loader-asset-dependency`) waits on this branch's merge. Both add a Fixed
bullet to `Release-Notes.md`; keep yours to one bullet under `### Fixed` in `## [Unreleased]`.

### What to build

The `websmith` command ignores `noEmit` on its fast path. Measured on `develop` `a8844130` with `tsconfig.json`
`{ outDir: "dist", rootDir: "src", noEmit: true }` and `src/a.ts`:

| Variant | `tsc` 6.0.3 | `websmith` |
|---|---|---|
| `noEmit` in tsconfig, no addons | nothing | `dist/a.js`, exit 0 |
| `--noEmit` flag, no addons | nothing | `dist/a.js`, exit 0 |
| `noEmit` + addon with `needsTypeInfo: false` | nothing | `dist/a.js`, exit 0 |
| `noEmit` + addon with `needsTypeInfo: true` | nothing | nothing |
| `noEmit` + `--transpileOnly` | n/a | `dist/a.js` |
| `noEmit`, no addons, `--watch` | — | `dist/a.js` |

Same on `db76de85` (before #215): the defect is old. The cause: `shouldUseTranspileModuleFastPath`
(`packages/core/src/compiler/Compiler.ts:764`) chooses `ts.transpileModule` whenever no addon needs type information
and no declarations are asked for. `transpileModule` drops `noEmit` (it is in `TRANSPILE_REMOVED_OPTIONS`, `:66-80`),
returns output files, and `processOutput` (`:1178-1196`) writes them through `selectWrittenFiles` (`:1210`), which in
the base class returns every file. Nothing on that path reads `noEmit`. The Program path is right because
`program.emit` and the language service honour `noEmit` themselves.

Make the CLI write no output file when the profile's effective compiler options set `noEmit`, on every path, while
the addons still run (processors transform in memory, generators and result processors run as on the Program path).

### Settled — do not re-derive

- **The bundler hosts must not change.** `ModuleCompiler` (webpack loader, Vite plugin) compiles a `noEmit` profile
  with `IN_MEMORY_OPTIONS = { noEmit: false, … }` (`ModuleCompiler.ts:76`, spread at `:242`) and overrides
  `selectWrittenFiles` (`:626`) for its own in-memory rule (#215). A check that reads the options the base `Compiler`
  emits with therefore never fires for them. Prove it with `webpack-test`'s and `vite-test`'s `noEmit` suites
  (webpack-no-emit, vite-no-emit), not by reading.
- **Do not route `noEmit` to the Program path instead.** Building a Program for every `noEmit` project costs the type
  check the fast path exists to avoid, and still would not stop a `transpileOnly` run from writing.
- **`declaration` + `emitDeclarationOnly` is already right** (the Program path is taken when `declaration: true`
  and not `transpileOnly`; `tsc` and `websmith` both write only `dist/a.d.ts`). Leave it unchanged and keep a test
  that says so.
- **`--showConfig`'s `noEmit: … ?? true` (`Compiler.ts:1134`) is display only**, not behaviour; do not chase it.

Rules carried over: absent is not false (an option not set is not `noEmit: false` set); read exit codes, not output
emptiness; TypeScript-version-dependent diagnostics are asserted against what the running TypeScript reports (the
`dist (24, typescript 5.7.3)` CI leg runs the suites on 5.7.3).

### Done when

- Unit tests in `packages/core/src/compiler/Compiler.spec.ts` for the write decision: `noEmit` in the profile's
  tsconfig, `noEmit` from the CLI options, `noEmit` with `transpileOnly`, and no `noEmit` (still writes). Follow
  `docs/rules/testing.md`: assemble/act/assert, `testObj`/`actual`, no shared `testObj`.
- An e2e in `packages/compiler-test/tests/` that runs the built CLI: `noEmit` in tsconfig, `--noEmit`, and a
  `needsTypeInfo: false` addon each write **no file** and exit 0, and the addon is shown to have run (e.g. a generator
  side effect or a reporter line); a short `--watch` run writes nothing either.
- **Check existing tests first:** `compile-websmith.test.ts` and `tsc-ignore-config.test.ts:56` pass `noEmit: true`
  to programmatic `compile()` calls. If any of them asserts that output *was* written under `noEmit`, it encoded the
  defect: change the assertion and say so in the PR, do not work around it.
- The webpack and Vite `noEmit` e2e suites pass unchanged.
- `Release-Notes.md`: one Fixed bullet. The `[Unreleased]` behaviour-change sentence "The `websmith` command keeps
  `tsc`'s meaning" stays: this branch makes it true.

Plus the repo gates: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e` (`AGENTS.md`). pnpm is pinned to
10.8.0 through `packageManager`; run it through corepack, never a newer system pnpm. Before each push, run the local
checks command `node <plot scripts>/board/plot-local-checks.mjs` and run what it prints; CI runs the full suites and
a failure comes back as a correction. New source files carry the MIT header (`pnpm license:add`).

### Bookkeeping

Push the first real commit as soon as it exists. Open the PR with `plot-open-pr.sh`, never `gh pr create`, then
append `→ #<number>` to this branch's heading line in the plan's `## Slices`. Commits follow Arlo's notation without
a colon (`B …` for the fix, `t …` for tests, `d …` for the release note).

### Scope guard

This branch owns `packages/core/src/compiler/Compiler.ts` (the write decision), its spec, a new e2e under
`packages/compiler-test/tests/`, and one `Release-Notes.md` bullet. Do not touch `ModuleCompiler.ts`, the webpack
or Vite packages, or `CompilationContext.ts` (wave 2 owns the asset-dependency change there). No other branch is in
flight on these files at dispatch.

If you find something the plan did not anticipate (for example `emitDeclarationOnly` with `--transpileOnly` writing
JavaScript), report it in the PR rather than fixing it here.
