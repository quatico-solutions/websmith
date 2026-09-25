<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — esm-output-check (wave 2)

- **Plan (canonical):** `docs/plans/2026-09-24-esm-output-check.md` on `develop`
- **Approved:** 2026-09-25, Jan Wloka, plan-PR #112 merged (wave split amended 2026-09-25, in-session)
- **Branch:** `feature/esm-check-core` (base: `develop`) — **prepared ahead, not yet claimed.** Wave 2 becomes
  eligible when wave 1 (`feature/cli-exit-and-written-set`, PR #115) merges; claim it then with
  `/plot-implement esm-output-check`, which finds this brief and treats the start as a resume.
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh`; do not merge
- **Review of the code:** per repo convention; CI green

Wave 3 (`esm-check-coverage`, `esm-check-imports`, `esm-check-cjs-names`, `esm-check-package-type`) builds on the
interface this slice fixes; wave 4 (`esm-check-webpack`) calls the same function from the loader.

### What to build

The first working ESM check for client output, on the CLI's `compile()` path. Today a client build whose
generated code uses `require`, `module.exports` or `__dirname` compiles cleanly and fails when loaded as ESM:
websmith reports only what TypeScript checks, and TypeScript checks nothing on transformer output, nothing
semantic on the `transpileOnly` / fast path (`Compiler.ts:597-605`), and syntax only on the language-service path.

1. **Config.** `esm?: { runtime: "node" | "bundler"; check?: "error" | "warn" | "off"; ignore?: string[] }` on
   `CompilationProfile` (`packages/api/src/config/CompilationProfile.ts`). Validate in `resolve-compiler-config.ts`
   next to the `depends` check (`:91-96`): unknown `runtime`/`check` values, and **`esm` contradicting the profile's
   `tsConfig.module`** (e.g. `CommonJS`) — one `ErrorMessage` naming both settings, not an error per file. `esm` is
   **not inherited** through `depends`. It reaches the compile through `ResolvedCompilerOptions.getOptions(profile)`
   (`ResolvedCompilerOptions.ts:265`, profiles built at `:379`).
2. **Module classification** (a pure function over path, content and a `package.json` lookup):
   - `runtime: "node"`: `.mjs` → ESM, `.cjs` → CommonJS, otherwise the nearest `package.json` `"type"`; without one,
     Node's syntax detection (ESM syntax → ESM) plus a **warning** that `"type"` is missing — never an error, Node
     runs the file.
   - `runtime: "bundler"`: webpack's module type — `javascript/esm` for `.mjs` and for `.js` under
     `"type": "module"`, `javascript/auto` otherwise.
3. **`checkEsm(files, esm, context) → ts.Diagnostic[]`** in a new module under `packages/core/src/compiler/esm/`.
   Input: the JS files of wave 1's written set (`CompileFragment.writtenFiles`, filtered to `.js`/`.mjs`/`.cjs`).
   Parse each once with `ts.createSourceFile`; the scope walk sits behind a small interface so the parser can be
   replaced (TypeScript 7 porting cost, see the plan). Skip files matching `esm.ignore` and list them in `--debug`.
4. **Rules in this slice** (the rest are wave 3):

   | Code | Rule | `node` | `bundler` esm | `bundler` auto |
   |------|------|--------|---------------|----------------|
   | 91001 | free `require` in ESM output | error | error | allowed |
   | 91002 | free `module` / `exports` in ESM output | error | error | allowed |
   | 91003 | free `__dirname` / `__filename` in ESM output | error | error | allowed |
   | 91004 | ESM syntax mixed with `module.exports =` / `exports.x =` | error | error | error |
   | 91005 | missing `"type"`, file classified by syntax | warning | — | — |

   `check: "warn"` downgrades errors to warnings; `"off"` skips the profile.
5. **Wiring:** call `checkEsm` in `Compiler.emitResult` (`Compiler.ts:620-646`) after the file loop, before
   `ResultProcessor`s, and **add its diagnostics to `result.diagnostics`**.
6. **Docs:** the `esm` option and the code table in `packages/compiler/README.md` (next to "Compilation profiles",
   `README.md:89`), and `Release-Notes.md` under `[Unreleased]` / Added.

### Settled decisions — do not re-derive them

- **Classify by the runtime, never by `tsConfig.module`.** `module` says what TypeScript emitted, not how the file
  is loaded; a `.cjs` file in an ESM profile is CommonJS and must not be flagged.
- **Free identifiers only, via a scope walk.** A text or AST-shape match flags the standard migration pattern
  `const require = createRequire(import.meta.url)` and `const __dirname = path.dirname(fileURLToPath(import.meta.url))`
  — valid ESM that ran on Node 24 (panel, `esm-semantics.md`). Property access such as `obj.exports.x` is not a
  reference to the free `exports`.
- **`typeof`-guarded uses are exempt** (the UMD pattern `typeof require !== "undefined" ? require(…) : …`): under
  ESM the guard is false, so the code runs.
- **Diagnostics must survive `report()`.** `emitResult` only reports fragment diagnostics when a fragment has no
  files (`Compiler.ts:627-633`), and on the Program path `report()` drops every diagnostic without `file`
  (`:603`). Attach a `ts.SourceFile` of the emitted JS (you parsed it already) with `start`/`length` at the
  construct, and push into `result.diagnostics`. A diagnostic built with `file: undefined` vanishes whenever an
  addon needs type information.
- **Codes 91000–91099**, one per rule, stable; all other websmith diagnostics keep `code: 0`.
- **The shared function is the interface.** Wave 3 and wave 4 call it from `watch()`, the `ResultProcessor` write
  hook and the loader; do not bury it inside `emitResult`.
- **Not in this slice:** `watch()`, `ResultProcessor` writes and per-addon attribution (`esm-check-coverage`,
  wave 3). Until then a diagnostic names the profile's active addons.

### Done when

The plan is the specification. Assertions that exist because a naive implementation would pass without them:

- `const require = createRequire(import.meta.url); require("x")` in ESM output → **no** 91001 (catches a text match).
- `typeof require !== "undefined" ? require("x") : null` → no 91001 (catches a walk that ignores guards).
- A `.cjs` file in a `node` ESM profile with `module.exports =` → no diagnostic (catches classification by
  `tsConfig.module`).
- `import x from "y"; module.exports = x` → 91004 in `bundler` **auto** too (catches a flat "auto allows everything").
- An ESM profile on the **Program path** (an addon with `needsTypeInfo`) reports the diagnostic, located in the
  emitted file (catches `file: undefined` being dropped by `report()`).
- A file with output reports its diagnostic (catches the `files.length === 0` branch in `emitResult`).
- `esm` with `tsConfig.module: CommonJS` → exactly **one** config error; a dependent profile without `esm` is not
  checked (no inheritance); `ignore` skips the file and `--debug` lists it; `check: "warn"` yields warnings,
  `"off"` nothing.
- With wave 1 merged: an error-level ESM diagnostic makes the CLI exit 1.
- e2e (`compiler-test` or `bin.test.ts`): an addon that generates `require(…)` into a `node` ESM profile fails the
  build with 91001 and names the file.
- Repo gates: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`; tests per `docs/rules/testing.md`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh` (from the Plot plugin), then give it a descriptive title — the wave heading
  alone reads "Wave 2".
- When the PR exists, append `→ #<number>` to this branch's line in the plan's `## Slices`.

### Scope guard

This branch owns: `packages/api/src/config/CompilationProfile.ts`, `packages/core/src/compiler/esm/` (new),
`resolve-compiler-config.ts`, `Compiler.emitResult`, their tests, `packages/compiler/README.md`, `Release-Notes.md`.

Not this branch: `CompilationContext` attribution and `watch()` (wave 3 `esm-check-coverage`), import/package/
lexer rules (wave 3), `packages/webpack` (wave 4). In flight at preparation (2026-09-25): #115 (wave 1, prerequisite),
#114 (Node 24, manifests and workflows only), `feature/fix-ts-addons-esm-projects` (#111; `AddonRegistry`,
`WebpackAddonService`, `addonConfig()` in `command.ts`) — no overlap with this branch's files.

If you find something the plan did not anticipate, report it rather than improvising outside scope.
