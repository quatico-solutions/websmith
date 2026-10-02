<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Fix false positives and known misses in the ESM check

> The ESM check stops failing builds on code that Node 24 loads, and reports the import failures it is known to miss today.

## Status

- **State:** Draft
- **Type:** bug
- **Story:** node24-esm-support
- **Review:** pr
- **Impl:** own branches
- **Rounds:** 1
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- The ESM check no longer reports `require`, `module` or `exports` inside a UMD wrapper whose CommonJS branch runs
  only when a `typeof module` / `typeof exports` / `typeof require` test says CommonJS is present (91001, 91002).
- 91021 no longer reports a default import when the only non-property use is a local variable of the same name.
- Relative specifiers with a query or fragment (`./b.js?v=1`) or percent-encoding (`./my%20file.js`) resolve the way
  the runtime resolves them and no longer get 91012.
- 91013 also reports JSON imports with a bare specifier (`import d from "pkg/d.json"`) under `node`.
- Under `node`, `import()` with a relative specifier in a CommonJS file (`.cjs`, `"type": "commonjs"`) gets the same
  checks as in an ES module (91010–91013), since Node resolves it with ESM rules.
- Under `bundler`, a relative import of a directory in a `javascript/auto` file gets 91012 when the directory has no
  index file or `package.json` entry webpack could load.
- ESM diagnostics name a transformer addon that changed the file in place (decided under Open Points), and a file
  that a nested websmith compile writes through `ctx.getSystem()` is checked once, not twice.
- New ESM check codes for bare specifiers under `node`: a package subpath the package's `"exports"` does not allow,
  an extensionless or directory subpath of a package without `"exports"`, and a tsconfig `paths` alias left in an
  emitted specifier.

## Motivation

The ESM check (91001–91033) shipped with plan `2026-09-24-esm-output-check` (delivered 2026-10-01). Its reviews and
verification recorded false positives and misses in story `node24-esm-support` (sections 2026-09-25 "Known gaps in
the relative-import rules", 2026-09-25 "Wave 3 verification follow-ups", and Phase 2b "Not in v1 of the check").
A false positive is the worse kind: `check: "error"` is the default, so it fails a build whose output Node runs, and
the only escape is `esm.ignore` or `check: "warn"` for the file. A miss lets a build pass that fails at runtime,
which is what the check exists to prevent.

All ten items still hold on `develop` (d7ffdf4). Each was read in the code and, where a CLI run can show it,
reproduced with `node packages/compiler/bin/bin.js --profile client` (profile `esm: { runtime: "node" }` or
`"bundler"`) and the emitted files run under Node 24.21.0:

| # | Item | Where on `develop` | Reproduced |
|---|------|--------------------|------------|
| 1 | UMD wrapper in an ESM file: `factory(require, exports)` inside `if (typeof module === "object" && …)` gives 91001 + 91002 | `scan-module.ts:219-246`: a use is guarded only by a `typeof` test of its own name (`testsTypeof(…, node.text)`) | CLI: 91001 and 91002 on `umd.js`; Node 24 imports the file without error |
| 2 | 91021 when a local `const pkg` shadows the default binding | `cjs-names.ts:173-190`: `isUsedAsValue` matches by name; its doc says "Shadowing declarations are not told apart" | CLI: 91021 on `shadow.js`; Node 24 runs it |
| 2b | 91021 for `typeof pkg` | same; `typeof pkg` is no property access | CLI: 91021; Node 24 gives `"object"` where the package's default export is a function — see Open Points |
| 3 | `./b.js?v=1`, `./my%20file.js` get 91012 | `import-rules.ts:223`: `path.resolve(dirname, literal.text)` takes the specifier as a path | CLI: two 91012 on `query.js`; Node 24 loads both |
| 4 | No 91013 for `import d from "pkg/d.json"` | `import-rules.ts:114-127`: the rule reads `collectRelativeImports` only (`:208`, `:220`) | CLI: nothing; Node 24 throws `ERR_IMPORT_ATTRIBUTE_MISSING` |
| 5 | No check of `import("./b")` in a `.cjs` file | `import-rules.ts:58`, `:72`, `:95`, `:115`: every rule returns `[]` unless `kind` is `esm` (or `auto` for 91012) | CLI: nothing on `dyn.cjs`; Node 24 throws `ERR_MODULE_NOT_FOUND` |
| 6 | `./dir` without an index file passes under `bundler`, `javascript/auto` | `import-rules.ts:101`: `… \|\| isDirectory(cur.resolved, context)` accepts any directory | CLI: `./dir` (only `dir/other.js`) not reported, `./nothing` gets 91012 |
| 7 | Transformer that edits in place (`addSyntheticLeadingComment`, `setEmitFlags`) is not attributed | `CompilationContext.ts:418-445`: the wrapper records a change only when `output !== input`; `packages/compiler/README.md` documents "one that only mutates nodes in place is not" | code reading |
| 8 | Attribution fallback differs from the plan | plan § Diagnostics: list the profile's active addons; code: `Compiler.ts:736`, `:843` pass `ctx.getAddonsChangingFile(fileName)`, `check-esm.ts:211` omits `addons:` when empty; README describes the code | code reading |
| 9 | A nested websmith compile run by a result processor through `ctx.getSystem()` is checked twice | `Compiler.ts:770-778`: `observeWrites` records every write through the context's system, and the nested `Compiler` checks its own output in its own `emitResult` | code reading |
| 10 | Bare subpaths not allowed by `"exports"`, extensionless/directory subpaths without `"exports"`, `paths` aliases left in emitted specifiers | `cjs-names.ts:281-285`: a subpath `"exports"` rejects becomes "unknown" (debug only); `:294-295` probes `subpath` as written; an alias is a bare specifier with no `node_modules` match → "package not found" | CLI: nothing; Node 24 throws `ERR_PACKAGE_PATH_NOT_EXPORTED`, `ERR_MODULE_NOT_FOUND`, `ERR_MODULE_NOT_FOUND` |

## Design

### Approach

All changes stay in `packages/core/src/compiler/esm/` and `CompilationContext` / `Compiler`, behind the existing
`checkEsm` interface; no config key changes. The webpack loader shares `collectRelativeImports` and the rules it runs
(`TsCompiler.ts:46`, without 91012), so items 1–5 reach it too and its e2e suite gets a case per changed rule.

**False positives (items 1–3).**

- *UMD guard.* A `typeof` test of any CommonJS name (`require`, `module`, `exports`, `__dirname`, `__filename`)
  guards uses of all five: in an ES module none of them exists, so a branch that runs only when one of them is
  defined does not run. `isTypeofGuarded` passes the set instead of `node.text` to `testsTypeof` and
  `readsDefined`; the direction rules (`readsDefined`, compound tests guard every branch) stay as they are. This
  covers TypeScript's own UMD output and the common hand-written forms (`typeof module === "object" &&
  module.exports`, `typeof exports === "object"`).
- *Shadowing in 91021.* `isUsedAsValue` counts only references that resolve to the import binding: the walk records,
  per scope, declarations of the binding's name (variables, parameters, functions, classes, catch clauses) and skips
  references inside a scope that redeclares it. The scope rules are those `scanModule` already applies to CommonJS
  names (`scan-module.ts:51-106`); they move to a shared helper rather than being written twice.
- *Query, fragment and percent-encoding.* `collectRelativeImports` derives the file path from the specifier the way
  the runtime does. `node`: resolve as a URL against the importing file (`new URL(specifier, pathToFileURL(file))`,
  then `fileURLToPath`), which drops `?…` and `#…` and decodes `%xx`; a specifier Node rejects (`%2F`, `%5C`) stays
  unresolved. `bundler`: strip `?…` and `#…` (webpack's resource query and fragment), no decoding. The diagnostic
  still quotes the specifier as written. 91010's fix hint appends `.js` before the query.

**Import misses (items 4–6).**

- *Bare JSON imports.* 91013 also inspects bare specifiers under `node`: a specifier ending in `.json`, or one whose
  resolution through `resolvePackage` (`cjs-names.ts:215`) ends in `.json`. The relative and bare paths share one
  collector, so dynamic `import()` with options is handled the same way.
- *`import()` in CommonJS files.* Under `node`, files classified `commonjs` run 91010–91013 on their `import()`
  calls with a string literal; static imports cannot occur there (91030/91031 already report them). `require()`
  stays unchecked. Under `bundler`, `javascript/dynamic` and `javascript/auto` files are unchanged (see Open Points).
- *Directories under `bundler` / `javascript/auto`.* A relative import of a directory resolves only when the
  directory holds `index` with one of the extensions the rule already tries (`.js`, `.mjs`, `.cjs`, `.json`), or a
  `package.json` whose `main` names such a file. The extension list stays lenient; it is what keeps custom webpack
  `resolve.extensions` setups from false positives.

**Attribution (items 7–9).**

- *In-place transformer edits.* Decided by the Open Point below. The recommended shape: the transformer wrapper
  marks the file as changed by the addon when the returned node is the input and the transformer touched it, detected
  by comparing the emit nodes (`emitNode`: synthetic comments, emit flags) of the nodes it visited before and after
  the call — no extra emit, cost proportional to the tree once per transformer addon.
- *Fallback.* Per the Open Point: keep the implementation (name the addons that changed the file, or none) and
  record the decision in the story; the README already describes it.
- *Nested compiles.* A compile records the files its own ESM check covered on the context's system (a symbol-keyed
  set on the system object the result processor writes through). The outer compile's `observeWrites` callback skips
  writes the nested compile checked; files the nested compile wrote without a check (no `esm` in its profile) stay
  checked by the outer one, as today.

**Package subpaths (item 10).** v1 left these out because "each needs package resolution that v1 does not build";
since `esm-check-cjs-names`, `resolvePackage` and `resolveEntry` exist. The slice turns their "unknown" outcomes
into findings where Node's answer is certain:

- a subpath the package's `"exports"` does not export: `resolve.exports` throws (`cjs-names.ts:283`) — Node's
  `ERR_PACKAGE_PATH_NOT_EXPORTED`;
- a subpath of a package without `"exports"` that names no file but a file with `.js` added, or a directory —
  Node's `ERR_MODULE_NOT_FOUND` / `ERR_UNSUPPORTED_DIR_IMPORT`, with the fixed specifier as hint;
- a bare specifier that matches a `compilerOptions.paths` pattern of the profile and resolves to no package — a
  `paths` alias TypeScript does not rewrite in emitted code.

New codes in the bare-specifier group: 91022, 91023 and 91024, `node` only (bundlers apply their own aliases and
extensions). A package that is not installed stays "unknown", as today.

**Tests (every slice).** Unit tests next to the changed module in `packages/core/src/compiler/esm/*.spec.ts`
(`scan-module.spec.ts`, `cjs-names.spec.ts`, `import-rules.spec.ts`, `check-esm-imports.spec.ts`) and
`packages/core/src/compiler/compilation/CompilationContext.spec.ts` / `Compiler.spec.ts`, assemble/act/assert with
`testObj` / `actual`. CLI e2e cases in `packages/compiler/src/bin.test.ts` with the fixtures from the table above
(each a false positive that must pass, or a miss that must fail); webpack e2e in
`packages/webpack-test/tests/webpack-esm-check.test.ts` where a changed rule runs in the loader. Each slice adds its
`Release-Notes.md` `## [Unreleased]` entry and updates the ESM check section of `packages/compiler/README.md`.

### Open Points

- [ ] **Attribution fallback (item 8).** The delivered plan says a diagnostic lists the profile's active addons when
      attribution is unclear; the implementation names the addons that changed the file, or none, and the README
      says "A diagnostic that names no addon points at a construct from your own source." **Recommendation: keep the
      implementation and the docs; record the decision in the story.** Listing every active addon on unattributed
      findings would name addons on findings in hand-written code, and the README's rule ("no addon named → your
      source") would become useless. That rule holds only if item 7 is fixed, which is why item 7 stays in scope.
- [ ] **Detecting in-place transformer edits (item 7).** Options: (a) compare emit nodes before/after each
      transformer (recommended above); (b) attribute every transformer addon that ran on a file whose diagnostic has
      no other addon (cheap, imprecise — the plan rejected this once); (c) document the gap and drop the README
      sentence in the fallback point. Before choosing, the slice checks whether an in-place edit can introduce an
      ESM finding at all (`addSyntheticLeadingComment` writes comments, `setEmitFlags` changes printing); if none can,
      (c) is enough and the slice records why. Recommendation: decide by that check, (a) if any can.
- [ ] **`typeof pkg` in 91021 (item 2b).** The story lists it as a false positive, but the reproduction shows it is
      the difference 91021 reports: `typeof pkg` is `"object"` under Node where the package's default export is a
      function, and `"function"` under webpack's auto mode. **Recommendation: keep reporting it, document it in the
      README, and close it in the story as not a false positive.** Only shadowing is fixed.
- [ ] **`import()` in CommonJS under `bundler` (item 5).** webpack resolves `import()` in `javascript/dynamic` and
      `javascript/auto` files with its own rules (no `fullySpecified` by default). Recommendation: `node` only; add
      `bundler` only if a webpack e2e case shows a failure the check would catch.
- [ ] **Package subpaths under `bundler` (item 10).** Recommendation: `node` only, since webpack applies
      `resolve.alias`, `resolve.extensions` and its own `exports` conditions that the CLI cannot see.

## Slices

One branch per heading; headings run in order. The first two slices touch `import-rules.ts` and run one after the
other to avoid conflicts; the last builds on the resolution the second extends.

### False positives

- `bug/esm-check-false-positives` — items 1–3: a `typeof` test of any CommonJS name guards all of them (UMD), 91021 ignores references to a shadowing local, relative specifiers resolve with query/fragment/percent-encoding the way `node` and `bundler` do; unit tests in `scan-module.spec.ts`, `cjs-names.spec.ts`, `import-rules.spec.ts`; CLI e2e in `bin.test.ts` (UMD wrapper, shadowed default, `?v=1` and `%20` specifiers all build); webpack e2e for the `?query` specifier <!-- builds: CommonJS-environment typeof guard, scope-aware default-binding use, URL-aware relative specifier resolution -->

### Import misses

- `bug/esm-check-import-misses` — items 4–6: 91013 for bare JSON specifiers under `node`, 91010–91013 for `import()` in CommonJS files under `node`, directories under `bundler`/`javascript/auto` need an index file or `package.json` entry; unit tests in `import-rules.spec.ts` and `check-esm-imports.spec.ts`; CLI e2e in `bin.test.ts` (bare JSON import, `import("./b")` in a `.cjs` file, `./dir` without index under `bundler` all fail) <!-- builds: bare-specifier JSON attribute rule, import() checks in CommonJS files, strict directory resolution for javascript/auto -->

### Attribution

- `bug/esm-check-attribution` — items 7–9: in-place transformer edits attributed (or documented, per Open Point), the attribution fallback decision recorded in the story and README, a nested compile through `ctx.getSystem()` checked once; unit tests in `CompilationContext.spec.ts` and `Compiler.spec.ts`; CLI e2e in `bin.test.ts` with a transformer addon that edits in place and a result processor that runs a nested compile <!-- builds: in-place transformer attribution, nested-compile check deduplication -->

### Package subpaths

- `bug/esm-check-package-subpaths` — item 10: 91022 subpath not exported by `"exports"`, 91023 extensionless or directory subpath of a package without `"exports"`, 91024 tsconfig `paths` alias left in an emitted specifier, `node` only; unit tests in `cjs-names.spec.ts`; CLI e2e in `bin.test.ts` (each of the three fails, an installed and exported subpath passes) <!-- builds: ESM check codes 91022-91024 for bare-specifier subpaths and paths aliases -->

## Notes

- Created 2026-10-02 from story `node24-esm-support` follow-ups. Type `bug`, plan PR review, implementation on own
  branches, given by the requester.
- **Items dropped:** none; all ten still hold on `develop` d7ffdf4 (see Motivation table). Item 2's `typeof pkg`
  variant is probably not a false positive (Open Points).
- **Reproduction** (2026-10-02, worktree build of d7ffdf4, Node 22.17 for websmith, Node 24.21.0 for the output):
  fixture A (`"type": "module"`, `module: nodenext`, `runtime: "node"`) gave 91001 + 91002 on the UMD file, 91021 on
  the shadowing and `typeof` files, two 91012 on the query/encoded specifiers, and nothing on `jpkg/d.json` and
  `dyn.cjs`; Node 24 loaded the first four and threw `ERR_IMPORT_ATTRIBUTE_MISSING` and `ERR_MODULE_NOT_FOUND` on
  the last two. Fixture B (`runtime: "bundler"`, no `"type"`) reported `./nothing` but not `./dir`. Fixture C
  (`runtime: "node"`) reported nothing for `epkg/internal.js` (not exported), `npkg/sub` (extensionless) and
  `@app/l` (`paths` alias); Node 24 threw `ERR_PACKAGE_PATH_NOT_EXPORTED`, `ERR_MODULE_NOT_FOUND` and
  `ERR_MODULE_NOT_FOUND`. Item 6 under webpack itself, items 7 and 9 were not run; they rest on code reading.
- **Item 10 as a slice, not an Open Point:** the resolution v1 lacked now exists in `cjs-names.ts`, and the three
  cases are certain Node failures.
- **Deliverable search** (`plot-deliverable-search.sh`): every hit is the code this plan changes, none a separate
  implementation — `isTypeofGuarded` (`scan-module.ts:219`), `isUsedAsValue` (`cjs-names.ts:177`),
  `collectRelativeImports` (`import-rules.ts:213`), `checkJsonImportAttribute` / `checkUnresolvedImport`
  (`import-rules.ts`, also `packages/webpack/src/TsCompiler.ts:46`), `attributeTransformer`
  (`CompilationContext.ts:418`), `observeWrites` (`Compiler.ts:770`), `resolvePackage` (`cjs-names.ts:215`).
  "paths alias" and "specifier URL" found nothing beyond the `paths` option type.
- **Not taken:** "Duplicate watch diagnostics for generator-added files" from the same story section — a watcher
  bug that predates the ESM check, not a check precision issue. Loader option, CLI exit and tsc option parity items
  belong to the sibling plans `loader-options-once`, `cli-error-exit-gaps` and `tsc-option-parity`.
