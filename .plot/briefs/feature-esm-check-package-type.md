<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — esm-output-check (wave 3: package type)

- **Plan (canonical):** `docs/plans/2026-09-24-esm-output-check.md` on `develop`
- **Approved:** 2026-09-25, Jan Wloka, plan-PR #112 merged (decisions below settled 2026-09-25, in-session)
- **Branch:** `feature/esm-check-package-type` (base: `develop`). **Prepared ahead, not yet claimed.** Wave 3 becomes
  eligible when wave 2 (`feature/esm-check-core`) merges; claim it then with `/plot-implement esm-output-check`.
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh`; do not merge
- **Review of the code:** per repo convention; CI green

Parallel to `esm-check-coverage`, `esm-check-imports` and `esm-check-cjs-names`. This slice adds rules to `checkEsm`
(wave 2) and labels existing TypeScript diagnostics. Its only call-site change is to `Compiler.report()`.

Line numbers below were taken on `develop` and in the wave 2 worktree before wave 2 merged, so they may be a few
lines off.

### What to build

A file whose **module format** contradicts how it will be loaded fails at load time. Wave 2 catches only half of
this: it reports free CommonJS identifiers in ESM-loaded files. It reports nothing for ESM syntax in a
CommonJS-loaded file.

Measured on Node 20.19.4 and 24.21.0, each case run directly, imported from an `.mjs` and required from a `.cjs`:

| Emitted file | Node | Wave 2 |
|---|---|---|
| `export` in `.cjs` (any `"type"`) | `SyntaxError: Unexpected token 'export'` | nothing |
| `import` in `.cjs`, no `"type"` | `SyntaxError: Cannot use import statement outside a module` | nothing |
| `export` in `.js` under `"type": "commonjs"` | `SyntaxError: Unexpected token 'export'` | nothing |
| top-level `await` in `.js` under `"type": "commonjs"` | `SyntaxError: await is only valid…` | nothing |
| whole-file CommonJS in `.js` under `"type": "module"` or `.mjs` | `ReferenceError: exports is not defined in ES module scope` | dozens of 91001/91002, one per identifier |

webpack 5.97.1 fails the build for ESM syntax in `javascript/dynamic` modules, which are `.cjs` files and `.js` under
`"type": "commonjs"`. It builds CommonJS under `javascript/esm` silently, with empty exports.

**These cases are still reachable, config validation notwithstanding (measured, TypeScript 5.7.3):**
- **Fast path with `module: nodenext`/`node16`.** `ts.transpileModule` never reads `package.json`, so every `.ts`
  file emits CommonJS, including a `.ts` under `"type": "module"`. websmith calls it without a format hint
  (`Compiler.ts:1111`, `:823`/`:835`). This is the likeliest real-world hit.
- **`module: esnext`/`es2022`** under `"type": "commonjs"` emits ESM into `.js`.
- **`module: preserve`** emits `export` from `.cts` into `.cjs`.
- **`nodenext` with a Program**: TypeScript emits `import.meta` and top-level `await` into CommonJS output. It does
  report TS1470/TS1309 on the source. Transformers, generators and `ResultProcessor` writes can produce any of the
  above.

Pieces:

1. **Rules.**

   | Code | Rule | `node` | `bundler` esm | `bundler` auto | `bundler` dynamic (`.cjs`, `.js` under `"type":"commonjs"`) |
   |------|------|--------|---------------|----------------|------|
   | 91030 | `.cjs` contains ESM syntax (`import`/`export`/`import.meta`) | error | — | — | error |
   | 91031 | `.js` with ESM syntax under `"type": "commonjs"`; the message names the `package.json` | error | — | — | error |
   | 91032 | file loaded as ESM whose output is whole-file CommonJS: no ESM syntax, plus `exports.x =`, `module.exports =` or the `__esModule` marker | error | error | — | — |
   | 91033 | top-level `await` in a file loaded as CommonJS | error | — | — | error |

   Hints:
   - 91030: "rename to `.mjs` or emit CommonJS"
   - 91031: "set `"type": "module"` in `<path>` or rename to `.mjs`"
   - 91032: "the output is CommonJS: set `module` to an ESM format; under the fast path `transpileModule` ignores
     `"type"`"
   - 91033: "wrap in an async function or load as ESM"

2. **`scan-module.ts`**:
   - expose the **position** of the first ESM construct (today `hasEsmSyntax` is a bare boolean, `scan-module.ts:23`);
   - detect top-level `await` / `for await` outside functions, if wave 2's review fix did not already add it;
   - expose the CommonJS export shapes 91032 needs.
3. **`check-esm.ts`**: register the rules, and when 91032 fires, **suppress 91001–91004 for that file**.
4. **TypeScript labelling in `Compiler.report()`** (`Compiler.ts:599-611`, Program created at `:170`):
   - Pass the profile in.
   - When the profile has `esm`, append the ESM label and the profile name to the message of TS2835, TS2834, TS1543,
     TS1470, TS1309 and TS1203.
   - Keep code and category.
   - Diagnostics without `file` still drop as today (`:605`).
5. **Docs**:
   - README code-table rows for 91030–91033 (`packages/compiler/README.md`, the ESM section);
   - a short paragraph on which TypeScript codes are labelled and that they appear only when an addon needs type
     information;
   - `Release-Notes.md` `[Unreleased]` / Added.

### Settled decisions — do not re-derive them

- **One file-level finding, not dozens.** When 91032 fires, the per-identifier 91001–91004 in that file are
  suppressed: one root cause, one fix. Rejected alternatives:
  - reporting both, which gives dozens of diagnostics for a single `module` setting;
  - only improving the 91002 hint, which never names the actual cause.
- **Attribution labels, it does not remap.** These TypeScript diagnostics are already reported, and since wave 1 they
  already fail the CLI. Rejected alternatives:
  - letting `esm.check: "warn"` downgrade them, which would let a build pass that fails today;
  - websmith codes (9104x), which lose the TS codes people search for.
- **Never label TS1479 or TS1471.** Both are false positives here: a CommonJS `require()` of an ESM-only package runs
  on Node ≥20.19 (measured), the `engines` floor is 22.12, and TypeScript 5.8 dropped TS1479 under `nodenext`.
  Leave TS2307, TS1202, TS1286 and TS1287 unlabelled as well; they are generic or authoring rules, not load failures.
- **Duplicates across source and output stay.** TS2835 on `src/a.ts` and 91010 on `out/a.js` point at different
  files, and the output-side rule is the only one that holds on every path. Cross-suppression would be fragile.
- **Classification comes from wave 2, never from `tsConfig.module`.** Wave 2 already classifies bundler `.cjs` and
  `.js` under `"type": "commonjs"` as kind `dynamic` (webpack's `javascript/dynamic`). It also reports every
  `package.json` it probes through `EsmCheckContext.onDependency` and returns the path; 91031 uses that path.
- **Dynamic `import()` is legal in CommonJS.** It never triggers 91030/91031; wave 2's `isEsmSyntax` already
  excludes it (`scan-module.ts:101-106`).
- **Node stops at the nearest `package.json`.** A typeless `out/package.json` (`{}`) under a root with
  `"type": "module"` means typeless, which is 91005, not ESM.
- **Not this slice:** the fast-path `nodenext` emit itself. `transpileModule` in TypeScript 5.7 cannot take a format,
  so this slice reports the problem (91032 with the hint) and does not change emit. It is tracked as a story
  follow-up in `node24-esm-support`.
- **Probes need importer files.** `node -e "require(…)"` defines a global `module` and passes by accident.

### Done when

The plan is the specification. Assertions that exist because a naive implementation would pass without them:

- `module: esnext`, a `.js` under `"type": "commonjs"` with `export` → **91031** naming the `package.json`. Catches
  classification by `tsConfig.module`.
- A typeless ESM `.js` → 91005 only, **no** 91031. Catches "missing type = CommonJS".
- A nested `out/package.json` `{}` under a root `"type": "module"` → 91005, not an ESM classification. Catches
  walking past the nearest `package.json`.
- A `.cjs` containing only `import.meta` → 91030. Catches checking only `import`/`export` declarations.
- A `.cjs` with `await import("./x.mjs")` inside an async function → nothing. Catches treating `import()` as ESM
  syntax.
- A `.cjs` with `export` under `bundler` → 91030 error. Catches `.cjs` classified as `auto`.
- A fast-path profile with `module: nodenext` under `"type": "module"` → **exactly one** 91032 per file, with the
  `transpileModule` hint, and no 91001/91002 in that file. Catches missing suppression.
- `.cts` under `module: preserve` → 91030.
- Top-level `await` in a CommonJS-classified file → 91033. `await` inside an async function → nothing.
- TypeScript labelling:
  - profile without `esm`: TS2835 prints unchanged;
  - profile with `esm` on the Program path: labelled, same code and category;
  - profile with `esm` on the fast path: no TS2835, but 91010 (imports slice) still fires;
  - TS1479 is never labelled.
- `esm.ignore` also skips the new rules. Every new diagnostic carries `file` and `start`, so it survives `report()`.
- e2e (`bin.test.ts` or `compiler-test`): a `.cjs` output with `export` fails the CLI with 91030 and names the file.
- README rows for 91030–91033 and the TypeScript-label paragraph; `Release-Notes.md`.
- Repo gates: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`; tests per `docs/rules/testing.md`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, then give it a descriptive title; the wave heading alone reads "Wave 3".
- Append `→ #<number>` to this branch's line in the plan's `## Slices`.

### Scope guard

This branch owns:
- a new `packages/core/src/compiler/esm/package-type-rules.ts` and its spec;
- codes 91030–91033 and their registration and 91032 suppression in `check-esm.ts`;
- the scan additions in `scan-module.ts`;
- `Compiler.report()`'s profile parameter and labelling;
- README rows and the release note.

Shared with the other wave 3 slices:
- `check-esm.ts`: the code object and the per-file loop;
- `scan-module.ts`: imports and cjs-names add specifier data;
- the README table and `Release-Notes.md`.

In each case the second to merge resolves the conflict. `esm-check-coverage` owns the processor and
`ResultProcessor` loops and `watch()` in `Compiler.ts`; this slice touches only `report()` and its call at `:178`.

Not this branch: relative and bare specifiers (`esm-check-imports`, `esm-check-cjs-names`), attribution and call
sites (`esm-check-coverage`), `packages/webpack` (wave 4).

In the loader, webpack decides the module type from the `.ts` resource, so wave 4 may classify differently.
Keep the rules pure over `(classification, scan)` so wave 4 can feed webpack's own type.

If you find something the plan did not anticipate, report it rather than improvising outside scope.
