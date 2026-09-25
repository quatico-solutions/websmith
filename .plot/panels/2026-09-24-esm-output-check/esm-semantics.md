<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Node ESM loader and bundler resolution

I ran the experiments on Node 24.21.0 and on webpack 5.97.1 from the repo's `node_modules`, in the scratchpad under `panel-esm/`.

## 1. Problem

The motivation is correct. On the fast path, `report()` only forwards `result.diagnostics` (`packages/core/src/compiler/Compiler.ts:596-609`), and transformer output is never re-checked. Checking the emitted JS is the right place. The scope has two problems:

- **Too narrow:** it leaves out the failure that most often breaks at runtime without any error: default-import interop (see risk 2).
- **Too wide:** for `bundler`, it treats webpack as one strict runtime. It is not (see risk 1).

## 2. Decisions

The decisions agree with each other and with story Phase 2b (STORY:65-77). The following are missing and must be decided before implementation:

- **How a file is classified as ESM or CJS.** Every rule depends on "in ESM output", and the plan never defines it.
  - Node decides by extension, then the nearest `package.json` `"type"`, then syntax detection. In a typeless package, Node 24 and 20.19 both ran a `.js` file with top-level await as ESM and only printed the `MODULE_TYPELESS_PACKAGE_JSON` warning.
  - Webpack decides by module rule type: `javascript/auto` vs `javascript/esm`, set by `.mjs`, or by a `.js` file under `"type":"module"`. For the loader, that is the `.ts` resource's rule, not the emitted file name.
  - The package rule ("format vs nearest `"type"`") must therefore say that a missing `"type"` is at most a warning for `node`. Otherwise it is a false positive.
- **Whether a profile with `esm` but `module: commonjs` output is an error.** The plan does not say.
- **`depends` inheritance** (already an Open Point). It must be settled in Wave 1, because the config shape ships there.

## 3. Feasibility

**Hook point.** `emitResult` (`Compiler.ts:618-645`) has the emitted list before the result processors run, so the plan's hook point is real. The list mixes `.d.ts`, `.map` and `.js` files. Only `.js`, `.mjs` and `.cjs` should be parsed.

**Result processors.** "JavaScript that result processors write" has no hook. Processors call `cur(emittedFiles, ctx)` (`:637-643`) and write through the system or `ctx`, so the check would need to intercept writes in `CompilationContext`. The plan does not name this.

**Webpack loader.** It calls `instance.build(this.resourcePath)` (`packages/webpack/src/loader.ts:28`) and writes nothing to disk. So "resolves to an emitted or existing file" cannot be evaluated the same way there. In bundler mode, resolution must go through webpack's resolver (`this.getResolve()`, respecting `resolve.extensions`, aliases and `fullySpecified`). The plan does not say this.

**Scope-aware detection needed.** The "CommonJS constructs" rule can only be built correctly if it checks for *free* (unbound) identifiers. A text or AST-shape match is not enough. This file is valid ESM and ran cleanly on Node 24:

```js
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exports = {}; exports.x = 1;
```

This is the standard ESM migration pattern, so a naive rule would flag the fix itself. `typeof require !== "undefined"` guards (UMD) need handling too. `ts.createSourceFile` alone gives no binding info, so the check needs a binder, or a Program over the JS output.

## 4. Slices

- **Wave 1 then Wave 2 is right:** core pipeline first.
- **`esm-check-resolution` should split.** It bundles two unrelated risks: extension/resolution rules versus the CJS named-import rule. The second needs its own detection mechanism (`cjs-module-lexer`) and should be a separate slice, possibly behind the Open Point decision.
- **`esm-check-webpack` is not a peer.** It depends on the classification decision and on resolver integration, and it can be merged and reviewed independently only once the bundler rule table is corrected (below).

## 5. Top three risks and gaps

**1. The bundler column produces false positives for the websmith loader's default case.**
- A `.ts` resource under webpack is `javascript/auto`. There, `require("tscjs")` inside an ESM module worked, and `__dirname` was a string. The plan marks both as errors for `bundler`.
- The only construct that fails at runtime is mixing `import` with `module.exports =`. It built with 0 errors and 0 warnings, then threw "ES Modules may not assign module.exports or exports.*".
- The reverse also holds: in a `"type":"module"` `.js` file, webpack rejected `import "./b"` ("Can't resolve './b'", `fullySpecified`). So the plan's "extensionless relative import: allowed" is a false negative there.
- The bundler rules must depend on the webpack module type, not on a flat `bundler` flag.

**2. Default-import interop is missing.** This is a false negative in both runtimes.
- Test setup: a TS-emitted CJS package (`__esModule: true`, with `exports.default = fn`) and the code `import def from "tscjs"`.
- Results for `typeof def`:
  - Node 24: `object`
  - webpack strict (`.js` under `"type":"module"`): `object`
  - webpack auto: `function`
- The same source works in one runtime and breaks silently in the others. This is the most likely addon-generated ESM breakage, and it is not in the rule table.

**3. The named-import rule as worded ("CommonJS-only package → error") gives mass false positives unless it uses `cjs-module-lexer`.**
- `import { named } from "tscjs"` (TS-emitted `exports.named = ...`) worked on Node 24.
- `module.exports = Object.assign({}, {a:1})` failed with "Named export 'a' not found".
- Detection by `"type"` or `exports` would flag nearly every TS-compiled CJS dependency. The rule must run the lexer on the resolved CJS entry, following `__exportStar(require())` re-exports as Node does. `cjs-module-lexer@1.3.1` is already in `node_modules/.pnpm`.
- Related false negatives for `node` that the table does not cover:
  - Bare deep imports into packages without `exports` (directory or extensionless subpaths): `ERR_UNSUPPORTED_DIR_IMPORT` / `ERR_MODULE_NOT_FOUND`, which I confirmed for relative dirs.
  - `ERR_PACKAGE_PATH_NOT_EXPORTED`, which affects webpack too.
  - Un-rewritten tsconfig `paths` aliases.
  - JSON imports without `with { type: "json" }`: `ERR_IMPORT_ATTRIBUTE_MISSING`, confirmed.
- Top-level await: in a typeless package it runs as ESM, but a CJS consumer that `require()`s it gets `ERR_REQUIRE_ASYNC_MODULE` (confirmed). The rule "TLA in output loaded as CommonJS" should state which classification it uses.

## 6. What must change before approval

1. Add a "Module classification" decision per runtime:
   - Node: extension, then `"type"`, then syntax detection. A missing `"type"` is a warning, not an error.
   - Webpack: module rule type (auto / esm).
   - Every rule keys off this classification.
2. Rewrite the `bundler` column:
   - `require` and `__dirname`/`__filename` are allowed in `javascript/auto` and errors in `javascript/esm`.
   - Mixing `module.exports`/`exports.x` with ESM syntax is an error in both.
   - Extensionless relative imports are errors in `javascript/esm` (`fullySpecified`).
3. State that CommonJS-construct detection is scope-aware (free identifiers only) and exempts the `createRequire` and `fileURLToPath` patterns. Record that this constrains the parser choice (binder needed).
4. Add rules for:
   - default import from an `__esModule` CJS module (`node` and webpack-strict: error or warn)
   - JSON import attributes (`node`)
   - bare-specifier subpath resolution against `exports` (both runtimes)
5. Resolve the CJS-detection Open Point now: use `cjs-module-lexer`, not the `"type"` field. Move that rule to its own slice.
6. Webpack slice: resolve through `this.getResolve()`, not "emitted or existing file". Name the hook for checking files that result processors write.

Verdict: amend
