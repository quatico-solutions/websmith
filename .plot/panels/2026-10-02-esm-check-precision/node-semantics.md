<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Node.js ESM semantics, measured

Method: fixtures run on Node v24.21.0 (ESM files, `.cjs` files, a fake `node_modules`). I read `import-rules.ts` and
`cjs-names.ts` on `origin/develop`. I did NOT build websmith or run its CLI, so the plan's own CLI reproductions are
taken as given. Only the Node side of each claim is measured here.

## Findings that would change the plan

1. **91013 on a specifier with a query is missed, and the plan does not say so.** `checkJsonImportAttribute`
   (`import-rules.ts:117`) tests `/\.json$/i` against `cur.specifier`. `import d from "./d.json?v=1"` throws
   `ERR_IMPORT_ATTRIBUTE_MISSING` on Node 24, and `with {type:"json"}` plus a query loads fine (both measured).
   Once slice 1 makes `./x.json?v=1` resolve, the rule must test the resolved path (query and fragment stripped,
   `%`-decoded for `node`), not the written specifier. The same holds for 91010's extension test (`./b?v=1`).
   Put this in slice 1 (or make slice 2 explicitly depend on the resolved path).
2. **Item 10, 91022 needs a conditions caveat.** `exports` that has only `development` (or only `require`) gives
   `ERR_PACKAGE_PATH_NOT_EXPORTED` under plain Node, but loads under `node --conditions=development` (measured).
   `resolveExports(..., { conditions })` at `cjs-names.ts:283` throws for any unmatched condition set, so 91022 is
   "certain" only when the check's conditions equal the runtime's. tsconfig `customConditions` is not
   `--conditions`. Recommend: report 91022 only when the profile sets no custom conditions, or word it
   "not exported under conditions X, Y". The plan's wording "where Node's answer is certain" does not hold otherwise.
   Also: a bare `pkg` (subpath ".") with `exports` lacking `import`/`default` (e.g. only `require`) gives the same
   code (measured); the plan limits itself to subpaths, so say whether "." is in or out.
3. **Item 10, 91024 must try self-reference first.** A package whose own `package.json` has `name` and `exports`
   resolves `selfapp/lib/x` without `node_modules` (measured, loads). A `paths` alias that equals the project's own
   name is not "no package". Likewise `#x` specifiers resolve through `imports`
   (`ERR_PACKAGE_IMPORT_NOT_DEFINED` only when undefined). Add both to the "resolves to no package" test.
4. **Item 2b prose is imprecise.** The plan says `typeof pkg` is `"object"` under Node "where the package's default
   export is a function". Measured: for `module.exports = function(){}` Node gives `"function"`. It gives
   `"object"` only for an `__esModule` package with `exports.default = fn` (Node's default import is the whole
   `module.exports`; webpack auto mode unwraps `.default`). The recommendation (keep reporting) is right; fix the
   wording to name the `__esModule` case so the README text is accurate.

## Item by item against Node

- **Items 1 UMD (rule matches Node).** In an ES module `typeof exports/module/require/__dirname/__filename` are all
  `"undefined"` (measured, together), so a branch guarded by a `typeof` test of one name is as dead as one guarded by
  another; the all-five set is sound. TypeScript's UMD wrapper file loads on Node 24 (measured). The direction
  rules must stay (`typeof module === "undefined"` takes the else, measured). Caveat: the else/fallback branch does
  run, e.g. `root.X = …` with `this === undefined` throws a TypeError at runtime (measured). That is not a check
  concern, but the changelog should not imply every UMD file works.
- **Item 3 query/fragment/percent (the `new URL` approach matches Node).** Measured: `?v=1` and `#frag` are
  dropped; `%20`, `%23`, `%3F`, `%62` decode; a literal space works; `%2F`/`%5C` throw
  `ERR_INVALID_MODULE_SPECIFIER`; `./b.js%3Fv=1` looks for a file literally named `b.js?v=1`; a file literally named
  `a#b.js` is unreachable with `#` (must be `%23`), same for `?`. So resolving via URL then `fileURLToPath` is
  exactly Node. One nit: `%2F` is not "unresolved", Node gives a different error; reporting 91012 is acceptable,
  say so. Dot segments normalise (`./dir/../b.js` works).
- **Item 4 bare JSON (correct).** `import d from "jpkg/d.json"` throws `ERR_IMPORT_ATTRIBUTE_MISSING`; with
  `with {type:"json"}` loads (measured). Resolution through `exports` that maps a non-`.json` subpath
  (`"./data": "./d.json"`) also throws the same code (measured), so the plan's "or whose resolution ends in
  `.json`" is needed and right. `assert` is a SyntaxError on Node 24 (measured), which the existing rule already
  handles.
- **Item 5 `import()` in CJS (correct under `node`).** In a `.cjs` file `import("./b")` gives `ERR_MODULE_NOT_FOUND`,
  `import("./dir")` gives `ERR_UNSUPPORTED_DIR_IMPORT`, a bare JSON import gives `ERR_IMPORT_ATTRIBUTE_MISSING`,
  and query and `.js` load (all measured). Rules are the ESM rules. The check reads emitted output, so under
  `module: commonjs` (TS rewrites `import()` to `require`) nothing is left to check, which is correct. `require()`
  of an ESM file works in Node 24 (measured, returns a namespace), so leaving `require()` unchecked is right.
- **Item 6 directory under bundler.** Not Node-measurable; plan's reasoning rests on webpack. Note webpack 5's
  default `resolve.extensions` is `.js,.json,.wasm`, so the lenient list is wider than default; fine and safe.
- **Item 10 (each of the three Node failures is real, measured).** `epkg/internal.js` (not exported) gives
  `ERR_PACKAGE_PATH_NOT_EXPORTED`; `npkg/sub` gives `ERR_UNSUPPORTED_DIR_IMPORT` when a `sub/` directory exists
  (even with `sub.js` beside it) and `ERR_MODULE_NOT_FOUND` when only `sub.js` exists; `@app/l` gives
  `ERR_MODULE_NOT_FOUND`; `npkg/sub/` also `ERR_UNSUPPORTED_DIR_IMPORT`. The plan's hint must differ: add `.js`
  when only the file exists, `/index.js` when it is a directory (91011 already does the latter,
  `import-rules.ts:81`). Exports patterns behave as `resolve.exports` models (`./*` maps, `x.js` under
  `"./*": "./lib/*.js"` fails, measured).

## Slices

Ordering is right (shared `import-rules.ts`). Slice 1 is the largest (three independent fixes) but each is small
and tested in the same files; acceptable as one PR. Slice 1 needs finding 1. Slice 4 needs findings 2 and 3 before
approval, or 91022 and 91024 become new false positives, the exact class this plan exists to remove.

## Overlap

None with the TypeScript 7 story or the other five plans from the Node-semantics side.

## Open points to settle before approval

- Conditions handling for 91022 (finding 2): recommend silence when custom conditions are set.
- Self-reference and `imports` in the 91024 test (finding 3): recommend yes.
- The five existing open points: the recommendations are consistent with measured Node behaviour.

Verdict: amend
