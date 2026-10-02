<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Bundler runtime and the webpack loader

Executed: an `enhanced-resolve` 5.x probe (the resolver of the installed webpack 5.97.1) on a scratch tree, with
webpack's default `extensions` (`.js`, `.json`, `.wasm`), `mainFields` `["module", "main"]`, `mainFiles` `["index"]`,
once with and once without `fullySpecified`. Read only: the CLI/loader code on `origin/develop`. The CLI repro
claims in the plan were not re-run.

## Findings that change the plan

1. **The loader runs no import rules under `bundler` at all.** `packages/webpack/src/TsCompiler.ts:317` sets
   `importRules: esm.runtime === "node" ? NODE_IMPORT_RULES : []`, and `NODE_IMPORT_RULES` (`:46`) is 91010, 91011,
   91013 only, never 91012. The plan's Approach ("items 1–5 reach it too", "its e2e suite gets a case per changed
   rule") is wrong for items 3, 5 and 6 under `bundler`. Consequences:
   - Slice 1's "webpack e2e for the `?query` specifier" cannot fail before the change: 91012 is not in the loader,
     and under `node` a `./b.js?v=1` is "unresolved", which 91010/91011 ignore. It is not a before/after test. A
     loader case for item 3 exists only for a rule the loader runs: `./b?v=1` (no extension, `node`: 91010 stays
     correct) or `./d.json?v=1` (see 2). Name that case, or drop the webpack e2e claim for item 3.
   - Item 6 (bundler directory rule) is CLI-only by construction; the plan should say so. The loader leaves it to
     webpack's own "Module not found", which is the right division (webpack's resolver is the authority), so no
     loader test is owed, but the plan must not imply one.
   - Loader tests that do apply and fail before the change: item 1 (UMD in a `javascript/esm` module; scan rules
     run under `bundler` through `moduleKind`), item 2 (91021), item 4 (bare JSON under `node`), item 5 (`import()`
     in a `.cjs` under `node`, via the `node` profile in `webpack-esm-check.test.ts:44`). List these explicitly in
     the slice text; today only the `?query` case is named.
2. **Query stripping must also reach the 91013 test.** `import-rules.ts:118` tests `/\.json$/i` on `cur.specifier`.
   After the change, `./d.json?v=1` resolves to `d.json` under `node` and needs the attribute, but the regex on the
   raw specifier still misses it. The plan changes `resolved` only; 91013 (and the 91010 `KNOWN_EXTENSIONS` check
   via `path.extname(resolved)`) must use the stripped path. Add to slice 1, with a test.
3. **The bundler directory rule is too narrow as worded.** "A `package.json` whose `main` names such a file"
   produces false positives, which is the failure class this plan exists to remove. Probe results under webpack's
   defaults, `javascript/auto`:
   - `./d2` with `package.json` `{"module":"m.js"}` and no `main`/index: resolves (webpack's `mainFields` starts with
     `module`; `browser` first for web targets).
   - `./d1` with `{"main":"lib"}` and `lib.js` beside it: resolves (`main` is extensionless and may be a file stem).
   - `./d3` with `{"main":"./lib"}` and `lib/index.js`: resolves (`main` may name a directory).
   - `./d4` with only `index.mjs`: fails under defaults (the plan's lenient `.mjs`/`.cjs` is a safe over-accept).
   Recommendation: the rule accepts a directory when it holds `index.*` from the lenient list, or has a
   `package.json` with a string `main`, `module` or `browser` field at all (do not require it to resolve to a
   file). Report only directories with neither. That keeps the rule's promise ("no index file or entry webpack
   could load") without re-implementing the resolver. Custom `resolve.mainFiles`/`mainFields` are invisible to the
   CLI, so state in the README that 91012 for directories is a heuristic under `bundler`, and that `check: "warn"`
   or `esm.ignore` is the escape.
4. **Percent-encoding under `bundler`: plan is right, test must show it.** `./my%20file.js` fails under webpack
   (probe: ERR, with `my file.js` on disk), so "no decoding" matches webpack and keeps 91012 there. `?v=1` and
   `#h` resolve to the file in both modes (also with `fullySpecified`), so stripping is right. Note one edge: a
   file literally named `a#b.js` also resolves, so the strip must probe the specifier as written first and the
   stripped form second, or it creates a new false positive. The plan says "strip `?…` and `#…`" without that
   order. Add the ordering and a fixture.

## Judgement of the `node`-only decisions

- `import()` in CommonJS under `bundler` (item 5): `node` only is right. `.cjs`/`"type":"commonjs"` is
  `javascript/dynamic` (`classify-module.ts:54,59`); webpack's `fullySpecified` default rule applies to
  `javascript/esm` and `"type":"module"` packages (`webpack/lib/config/defaults.js:721,781`), so `import("./b")`
  in a dynamic module resolves leniently and the Node rule would be a false positive. Keep `node`-only, and say in
  the Open Point that the reason is the module type, not only "webpack's own rules".
- Package subpaths (item 10) `node` only: right. webpack uses `exports` with `import`/`module`/`browser`
  conditions and `resolve.alias`; tsconfig `paths` aliases are routinely resolved by webpack through
  `resolve.alias`/`tsconfig-paths-webpack-plugin`, so 91024 under `bundler` would be a false positive in common
  setups. Under the loader the rules are not run for `bundler` anyway.
- Open Point on `typeof pkg`: under `bundler`/auto the difference (`"function"` under webpack interop vs `"object"`
  under Node) means "keep reporting" holds only for `node`. Under `bundler` the check should arguably not report it
  at all, since webpack's value is what runs. Check `cjs-names.ts` for whether 91021 is already `node`-only; if it
  runs under `bundler`, decide it explicitly in the Open Point.

## Slices, overlap

- Slice order is sound (1 and 2 both edit `import-rules.ts`; 4 builds on resolution from 2/`cjs-names`).
- Slice 2 bundles three rules; only 4 and 5 reach the loader, item 6 does not. Splitting item 6 is not required,
  but the slice text should state its tests are CLI-only and unit.
- No overlap with the TypeScript 7 story or the five sibling plans from this lens. `loader-options-once` (#134) and
  the loader's `NODE_IMPORT_RULES` list are untouched by this plan, which is correct. If slice 1 or 2 adds a rule
  to the loader's list (e.g. a new function for query handling), `TsCompiler.ts:46` must be edited; the plan names
  the file but no change to it, so either say "no change, rules are shared by name" or list the edit.

## Open points to settle before approval

1. Fix the loader-test claim (finding 1) and name the real before/after cases.
2. Widen the directory rule (finding 3) to any `main`/`module`/`browser` string; recommend README text.
3. Add the 91013 and `#` ordering amendments (findings 2 and 4) to slice 1.
4. Record, for `typeof pkg`, whether `bundler` reports it.

Verdict: amend
