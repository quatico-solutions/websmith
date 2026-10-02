<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Fix false positives and known misses in the ESM check

> The ESM check stops failing builds on code that Node 24 loads, and reports the import failures it is known to miss today.

## Status

- **State:** Approved
- **Type:** bug
- **Story:** node24-esm-support
- **Review:** pr
- **Impl:** own branches
- **Rounds:** 1
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #137 merged
- **Started:** 2026-10-02, Jan Wloka, `bug/esm-check-false-positives`
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- The ESM check no longer reports `require`, `module` or `exports` inside a UMD wrapper whose CommonJS branch runs
  only when a `typeof module` / `typeof exports` / `typeof require` test says CommonJS is present (91001, 91002).
- 91021 no longer reports a default import when the only non-property use is a local variable of the same name.
- Relative specifiers with a query or fragment (`./b.js?v=1`) or percent-encoding (`./my%20file.js`) resolve the way
  the runtime resolves them and no longer get 91012; 91010 and 91013 test the resolved file, so
  `import d from "./d.json?v=1"` now gets 91013 under `node`.
- 91013 also reports JSON imports with a bare specifier (`import d from "pkg/d.json"`) under `node`.
- Under `node`, `import()` with a relative specifier in a CommonJS file (`.cjs`, `"type": "commonjs"`) gets the same
  checks as in an ES module (91010–91013), since Node resolves it with ESM rules.
- Under `bundler` (CLI only), a relative import of a directory in a `javascript/auto` file gets 91012 when the
  directory has neither an `index` file nor a `package.json` with a `main`, `module` or `browser` field. The rule is
  a heuristic, since webpack's `resolve.mainFiles` and `resolve.mainFields` are invisible to the CLI.
- A file that a nested websmith compile writes and checks is checked once, not twice; its findings name the nested
  profile's addons. A transformer that only edits nodes in place (comments, emit flags) is still not named, and the
  README says why that cannot hide an ESM finding.
- New ESM check codes for bare specifiers under `node` (CLI only): 91022 for a subpath (or the package root) the
  package's `"exports"` does not export, 91023 for an extensionless or directory subpath of a package without
  `"exports"`, 91024 for a tsconfig `paths` alias left in an emitted specifier.
- **Builds that passed 0.10.x may now fail:** 91010–91013 on `import()` in CommonJS files, 91012 on directories
  under `bundler`, 91013 on bare and query JSON imports, and 91022–91024 report code the check let through before.
  Each is a runtime failure (91012 on directories: a likely one); `esm.ignore` or `check: "warn"` turns a finding
  off or into a warning for the files concerned.

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
| 2b | 91021 for `typeof pkg` | same; `typeof pkg` is no property access | CLI: 91021; for an `__esModule` package with `exports.default = fn`, Node 24 gives `"object"` (the whole `module.exports`) where the author expects the function — see Open Points |
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
`checkEsm` interface; no config key changes.

**Rule set per runtime.** What runs where, before and after this plan. The Vite plugin (#132,
`2026-10-01-vite-plugin`) inherits this table for its per-module host: it runs the loader's column, not the CLI's,
because it shares the loader's situation (the bundler resolves imports itself).

| Rules | CLI `node` | CLI `bundler` | Loader / Vite `node` | Loader / Vite `bundler` |
|-------|-----------|---------------|----------------------|-------------------------|
| Scan rules 91001–91005 (UMD guard, item 1) | yes | yes | yes | yes |
| 91020 named CommonJS exports | yes | no | yes | no |
| 91021 default import of `__esModule` (shadowing, item 2) | yes | yes | yes | yes |
| 91010 missing extension, 91011 directory | yes | yes | yes | no |
| 91012 unresolved relative import (directory rule, item 6) | yes | yes | no — webpack reports "Module not found" | no |
| 91013 JSON attribute (bare and query JSON, item 4) | yes | no | yes | no |
| 91010–91013 on `import()` in CommonJS files (item 5) | new | no | new (91010, 91011, 91013) | no |
| 91022–91024 bare subpaths and `paths` aliases (item 10) | new | no | no — the bundler resolves bare specifiers | no |
| 91030–91033 package type rules | yes | yes | yes | yes |

The loader's import rules come from `TsCompiler.ts:317`: `importRules: esm.runtime === "node" ? NODE_IMPORT_RULES :
[]`, and `NODE_IMPORT_RULES` (`TsCompiler.ts:46`) is 91010, 91011, 91013. **Under `bundler` the loader runs no
import rules at all**, so items 3 and 6 never reach it there; items 1 and 2 reach it under both runtimes (scan and
CommonJS-name rules), items 3 (via 91010/91013), 4 and 5 under `node` only. This plan changes the rules *inside*
`checkMissingExtension`, `checkDirectoryImport`, `checkJsonImportAttribute` and `collectRelativeImports`, and adds
91022–91024 as a new rule in `IMPORT_RULES` only (the CLI list); **it does not edit `TsCompiler.ts:46`.** If a slice
finds it must change the loader's list after all, that slice lands after #134 `loader-options-once`'s first slice
(`bug/loader-resolve-options-once`, which rewrites the option handling around it) and rebases onto it.

**False positives (items 1–3).**

- *UMD guard.* A `typeof` test of any CommonJS name (`require`, `module`, `exports`, `__dirname`, `__filename`)
  guards uses of all five: in an ES module none of them exists (measured on Node 24: all five are `"undefined"`
  together), so a branch that runs only when one of them is defined does not run. `isTypeofGuarded` passes the set
  instead of `node.text` to `testsTypeof` and `readsDefined`; the direction rules (`readsDefined`, compound tests
  guard every branch) stay as they are, so `typeof module === "undefined"` still guards only its else branch. This
  covers TypeScript's own UMD output and the common hand-written forms (`typeof module === "object" &&
  module.exports`, `typeof exports === "object"`). It does not claim the fallback branch works (`root.X = …` with
  `this === undefined` still throws at runtime; that is no ESM check concern). A `require` an addon adds outside the
  guarded branch, next to an unrelated `typeof module` test elsewhere in the file, is still reported.
- *Shadowing in 91021.* `isUsedAsValue` counts only references that resolve to the import binding: the walk records,
  per scope, declarations of the binding's name (variables, parameters, functions, classes, catch clauses) and skips
  references inside a scope that redeclares it. The scope rules are those `scanModule` already applies to CommonJS
  names (`scan-module.ts:51-106`); they move to a shared helper rather than being written twice.
- *Query, fragment and percent-encoding — per runtime.* `collectRelativeImports` derives the file path from the
  specifier the way each runtime does:
  - `node`: resolve as a URL against the importing file (`new URL(specifier, pathToFileURL(file))`, then
    `fileURLToPath`), which drops `?…` and `#…`, decodes `%xx` and normalises dot segments — measured to be exactly
    Node 24's behaviour, including that a file literally named `a#b.js` is reachable only as `a%23b.js`. A specifier
    Node rejects (`%2F`, `%5C`: `ERR_INVALID_MODULE_SPECIFIER`) stays unresolved and gets 91012; the message differs
    from Node's error code, which is acceptable since both fail the import.
  - `bundler`: probe the specifier **as written first**, then with `?…` and `#…` stripped (webpack's resource query
    and fragment); no decoding. Probed with `enhanced-resolve` (webpack 5.97.1): `./a#b.js` resolves to a file named
    `a#b.js`, so strip-first would create a new false positive; `./my%20file.js` does not resolve, so no decoding
    keeps 91012 there.
  - The resolved path, not the written specifier, feeds every rule: 91013 tests `/\.json$/i` on the resolved path
    (today `import-rules.ts:118` tests `cur.specifier`, so `./d.json?v=1` is missed — Node 24 throws
    `ERR_IMPORT_ATTRIBUTE_MISSING`, measured), and 91010's extension test (`KNOWN_EXTENSIONS` via
    `path.extname`) does too. Diagnostics still quote the specifier as written; 91010's fix hint inserts `.js`
    before the query (`./b.js?v=1`).

**Import misses (items 4–6).**

- *Bare JSON imports.* 91013 also inspects bare specifiers under `node`: a specifier whose path ends in `.json`, or
  one whose resolution through `resolvePackage` (`cjs-names.ts:215`) ends in `.json` (measured: an `exports` entry
  `"./data": "./d.json"` throws the same `ERR_IMPORT_ATTRIBUTE_MISSING`). The relative and bare paths share one
  collector, so dynamic `import()` with options is handled the same way. The change stays inside
  `checkJsonImportAttribute`, so the loader picks it up under `node` with no list change.
- *`import()` in CommonJS files.* Under `node`, files classified `commonjs` run 91010–91013 on their `import()`
  calls with a string literal; static imports cannot occur there (91030/91031 already report them). `require()`
  stays unchecked (Node 24 `require()`s ES modules). Under `module: commonjs` TypeScript rewrites `import()` to
  `require`, so nothing is left to check, which is correct. Under `bundler` nothing changes: `.cjs` and
  `"type": "commonjs"` files are `javascript/dynamic` (`classify-module.ts:54,59`), and webpack's `fullySpecified`
  default applies to `javascript/esm` only (`webpack/lib/config/defaults.js:721,781`), so the Node rule would be a
  false positive there.
- *Directories under `bundler` / `javascript/auto` (CLI only).* A relative import of a directory resolves when the
  directory holds `index` with one of the extensions the rule already tries (`.js`, `.mjs`, `.cjs`, `.json`), or a
  `package.json` with a non-empty string `main`, `module` or `browser` field — whether or not that field names an
  existing file (probed: `module`-only, extensionless `main`, and `main` naming a directory all resolve under
  webpack's defaults; re-implementing the resolver is out of scope). Only a directory with neither gets 91012. The
  message says it is a heuristic and names the escape: "relative import "./dir" names a directory with no index file
  and no package.json entry; if your webpack config sets `resolve.mainFiles` or `resolve.mainFields`, use
  `esm.ignore` or `check: "warn"`". Severity: see Open Points. The loader does not run 91012 (webpack's own "Module
  not found" is the authority), so this rule has no loader test.

**Attribution (items 7–9).**

- *In-place transformer edits (item 7).* Decided under Open Points: documented, not detected. The slice's first
  commit is the evidence: a unit test per in-place API an addon can reach (`addSyntheticLeadingComment`,
  `addSyntheticTrailingComment`, `setEmitFlags`, `setTextRange`) showing the printed output carries no new
  `require`, `module`, `exports`, `__dirname`, `__filename`, specifier or default import. A transformer that adds
  such code builds new nodes, and `visitEachChild` returns a new `SourceFile`, so `output !== input`
  (`CompilationContext.ts:421-422`) already attributes it. The README sentence becomes: "A transformer that only
  edits nodes in place (comments, emit flags) is not named; such an edit cannot introduce an ESM finding."
- *Fallback (item 8).* Keep the implementation (name the addons that changed the file, or none) and record the
  decision in the story; the README already describes it.
- *Nested compiles (item 9).* Each `Compiler`'s ESM check records the outputs it checked (resolved path and text)
  in a registry the outer compile opens around `runResultProcessors` (`Compiler.ts:770-778`) and closes after. The
  outer `observeWrites` callback skips a write whose path and text a nested check recorded during that window; a
  file the nested compile wrote without a check (no `esm` in its profile), or rewrote after its check, stays checked
  by the outer compile, as today. The registry is held by the `Compiler` module, not by the system object, so an
  addon that wraps or copies `ctx.getSystem()` for the nested compile still deduplicates. Two copies of
  `@quatico/websmith-core` in one process (outer and nested from different installs) fall back to today's double
  check; the README says so. Findings of a nested check name only the nested profile's addons, never the outer
  result processor that ran it; the README states this.

**Package subpaths (item 10).** v1 left these out because "each needs package resolution that v1 does not build";
since `esm-check-cjs-names`, `resolvePackage` and `resolveEntry` exist. A new import rule
`checkPackageSubpath` in `IMPORT_RULES` (CLI only; not in `NODE_IMPORT_RULES`, since webpack resolves bare
specifiers itself) turns their "unknown" outcomes into findings where Node's answer is certain, `node` only:

- **91022** — a subpath, or the package root `"."`, that the package's `"exports"` does not export under Node's
  default conditions (`resolve.exports` throws, `cjs-names.ts:283` — Node's `ERR_PACKAGE_PATH_NOT_EXPORTED`,
  measured for both a subpath and `"."` with only a `require` condition). Silent when the profile's tsconfig sets
  `customConditions`, since the runtime may then be started with matching `--conditions` (measured: an export with
  only a `development` condition loads under `node --conditions=development`). Message: `"pkg/internal.js" is not
  exported by package "pkg" for conditions node, import, default; exported subpaths: ".", "./feature"` (the list
  capped at five, nearest match first).
- **91023** — a subpath of a package without `"exports"` that names no file but a directory or a file with `.js`
  added. Node: `ERR_UNSUPPORTED_DIR_IMPORT` when a directory of that name exists (even with `sub.js` beside it),
  `ERR_MODULE_NOT_FOUND` when only `sub.js` exists (both measured). The fix hint follows: `"pkg/sub/index.js"` when
  it is a directory with `index.js`, `"pkg/sub.js"` when only the file exists, like 91010 and 91011.
- **91024** — a bare specifier that matches a `compilerOptions.paths` pattern of the profile and that Node cannot
  resolve: not a `#…` specifier (package `imports`, left untouched), not a self-reference (the nearest
  `package.json` with that `name` and `"exports"`, measured to load), and no package found by `resolvePackage` from
  the importing file upward through `node_modules`, following symlinks (workspace packages). Message: `"@app/l"
  matches the tsconfig "paths" pattern "@app/*", which TypeScript does not rewrite in emitted code; rewrite it with
  a transformer addon or a build tool, or use a package "imports" entry`.

A package that is not installed stays "unknown", as today. `bundler` is excluded because webpack applies
`resolve.alias`, `resolve.extensions`, `tsconfig-paths-webpack-plugin` and its own `exports` conditions that the CLI
cannot see.

**Rollout.** Every new finding ships at the profile's `check` severity, with the Release-Notes line "Builds that
passed 0.10.x may now fail" from the Changelog above (decided under Open Points).

**Tests (every slice).** Unit tests next to the changed module in `packages/core/src/compiler/esm/*.spec.ts`
(`scan-module.spec.ts`, `cjs-names.spec.ts`, `import-rules.spec.ts`, `check-esm-imports.spec.ts`) and
`packages/core/src/compiler/compilation/CompilationContext.spec.ts` / `packages/core/src/compiler/Compiler.spec.ts`,
assemble/act/assert with `testObj` / `actual`. Every test named in a slice fails on `develop` before the change
(a false positive reported, or a miss not reported), except where the slice says it pins unchanged behaviour. CLI
e2e cases in `packages/compiler/src/bin.test.ts` with the fixtures from the table above; webpack e2e in
`packages/webpack-test/tests/webpack-esm-check.test.ts` only for rules the loader runs (the table above). Each slice
adds its `Release-Notes.md` `## [Unreleased]` entry and updates the ESM check section of `packages/compiler/README.md`.

### Open Points

- [x] **Attribution fallback (item 8).** — decided: keep the implementation and the docs (name the addons that
      changed the file, or none); record the decision in the story, pending approval. Listing every active addon on
      unattributed findings would name addons on findings in hand-written code and make the README's rule ("no addon
      named → your source") useless; all three jurors agreed.
- [x] **Detecting in-place transformer edits (item 7).** — decided: (c) document the gap, no detection, pending
      approval. An in-place edit (`addSyntheticLeadingComment`, `setEmitFlags`, `setTextRange`) changes comments and
      printing only and cannot introduce a `require`, specifier or default import; a transformer that adds code
      builds new nodes and is already attributed through `output !== input`. Option (a) (emit-node comparison per
      visited node, per transformer, per file) adds build cost and a new misattribution class while fixing no
      finding. The slice's first commit is the pre-check as evidence (unit tests per in-place API), and the CLI e2e
      asserts the documented non-attribution, so it fails if the behaviour changes. Rejected: (b), attributing every
      transformer that ran, which the delivered plan already rejected.
- [x] **Nested compiles with a wrapped system (item 9).** — decided: a registry held by the `Compiler` module, keyed
      by resolved path and written text and scoped to the outer compile's result-processor run, instead of a symbol
      on the system object, pending approval. The symbol is lost when an addon wraps or copies `ctx.getSystem()` for
      the nested `Compiler`, which is the common way to create one; the registry does not depend on the system
      object and still re-checks a file the outer pipeline rewrote after the nested check. Nested findings name the
      nested profile's addons only; the README says so. Residual gap, documented: two copies of
      `@quatico/websmith-core` in one process double-check as today (noise, never a miss).
- [x] **Bundler directory rule severity (item 6).** — decided: widen the accept set (any `index.*` from the lenient
      list, or any string `main` / `module` / `browser`) and keep it at the profile's severity (error by default),
      with the heuristic named in the message and the README, pending approval. The jurors disagreed: the bundler
      juror wanted widen + error, the addon author warn. Widening removes every false positive the probe found;
      what remains is a directory webpack's defaults cannot load, so the finding is a likely build failure, not a
      style issue. A fixed-`warn` code is possible (91005 is always a warning, `check-esm.ts:137`), but that is
      reserved for advice on code that runs; a `warn` directory case would make 91012 carry two severities, and a
      separate warning code would let a build pass that webpack's defaults fail. The escape for custom
      `resolve.mainFiles` / `mainFields` setups is the existing `esm.ignore` / `check: "warn"`, named in the message.
- [x] **Rollout of new error codes.** — decided: no warning-first period; new findings ship at the profile's
      severity with a Release-Notes "Builds that passed 0.10.x may now fail" entry listing each new finding and the
      escapes, pending approval. Every new finding except the directory heuristic is a certain runtime failure
      under Node 24 (measured), so a warning would let builds pass that fail at startup — the exact miss this plan
      exists to close. Warning-first is mechanically cheap (91005 shows a fixed-severity code) but needs a second
      release to flip each code back to the profile's severity.
      Rejected: a per-code `esm.newRules: "warn"` switch (a config key this plan otherwise avoids).
- [x] **`typeof pkg` in 91021 (item 2b).** — decided: keep reporting it under both runtimes, document it in the
      README, and close it in the story as not a false positive, pending approval. Measured: Node gives `"object"`
      only for an `__esModule` package with `exports.default = fn` (its default import is the whole
      `module.exports`); for `module.exports = fn` it gives `"function"` and 91021 does not fire (no `default`
      export). 91021 runs under `bundler` too (`cjs-names.ts:94-95` gates only 91020 by runtime), but only for
      `kind === "esm"` importers (`javascript/esm`), where webpack's strict ESM interop also gives
      `module.exports` as the default; webpack's `.default` unwrapping applies to `javascript/auto` importers,
      which the rule skips. Only shadowing is fixed.
- [x] **`import()` in CommonJS under `bundler` (item 5).** — decided: `node` only, pending approval. The reason is
      the module type: `.cjs` / `"type": "commonjs"` files are `javascript/dynamic`, where webpack does not apply
      `fullySpecified`, so the Node rules would be false positives.
- [x] **Package subpaths under `bundler` (item 10).** — decided: `node` only and CLI only, pending approval, since
      webpack applies `resolve.alias`, `resolve.extensions`, `tsconfig-paths-webpack-plugin` and its own `exports`
      conditions that the CLI cannot see, and the loader leaves bare specifiers to webpack's resolver.
- [x] **Package root `"."` in 91022.** — decided: in scope, pending approval. It is the same `resolve.exports` throw
      and the same measured `ERR_PACKAGE_PATH_NOT_EXPORTED`, and leaving it out would keep the miss for
      `import x from "pkg"` while catching `pkg/sub`.

## Slices

One branch per heading; headings run in order. The first two slices touch `import-rules.ts` and run one after the
other to avoid conflicts; the last builds on the resolution the second extends. No slice edits
`packages/webpack/src/TsCompiler.ts`; a slice that must is held until #134's `bug/loader-resolve-options-once` has
merged.

### False positives

- `bug/esm-check-false-positives` — items 1–3: a `typeof` test of any CommonJS name guards all of them (UMD), 91021 ignores references to a shadowing local, relative specifiers resolve per runtime (`node` via URL with `%2F`/`%5C` unresolved; `bundler` as written first, then with `?`/`#` stripped, no decoding), 91010 and 91013 test the resolved path; unit tests in `scan-module.spec.ts` (UMD guard; an addon's unguarded `require` beside an unrelated `typeof module` test still reported), `cjs-names.spec.ts` (shadowing local), `import-rules.spec.ts` (`?v=1`, `#h`, `%20`, `%2F`, `a#b.js` under `bundler`, `./d.json?v=1` under `node`); CLI e2e in `bin.test.ts` (UMD wrapper, shadowed default, `?v=1` and `%20` specifiers all build; `./d.json?v=1` fails with 91013); webpack e2e in `webpack-esm-check.test.ts`, each failing before the change: UMD wrapper in a `javascript/esm` module builds (`bundler` and `node`), shadowed default builds, `./d.json?v=1` under the `node` profile gets 91013 <!-- builds: CommonJS-environment typeof guard, scope-aware default-binding use, per-runtime relative specifier resolution -->

### Import misses

- `bug/esm-check-import-misses` — items 4–6: 91013 for bare JSON specifiers under `node` (by name or by `exports` resolution), 91010–91013 for `import()` in CommonJS files under `node`, directories under `bundler`/`javascript/auto` need an `index.*` file or a `package.json` `main`/`module`/`browser` field (CLI only, heuristic named in the message and README); unit tests in `import-rules.spec.ts` (bare `.json`, `exports`-mapped JSON, `.cjs` `import()` cases, directory with `module`-only / extensionless `main` / `main` naming a directory passes, empty directory fails) and `check-esm-imports.spec.ts`; CLI e2e in `bin.test.ts` (bare JSON import, `import("./b")` in a `.cjs` file, `./dir` without index under `bundler` all fail; `./d2` with only `"module"` passes); webpack e2e in `webpack-esm-check.test.ts` under the `node` profile, each failing before the change: bare JSON import gets 91013, `import("./b")` in a `.cjs` module gets 91010; no loader case for the directory rule (the loader runs no 91012) <!-- builds: bare-specifier JSON attribute rule, import() checks in CommonJS files, heuristic directory resolution for javascript/auto -->

### Attribution

- `bug/esm-check-attribution` — items 7–9: first commit the in-place-edit pre-check (unit tests per in-place API showing no ESM finding can arise) and the README wording for the documented gap, the fallback decision recorded in the story, a nested compile checked once through a `Compiler`-held registry scoped to the result-processor run; unit tests in `CompilationContext.spec.ts` (in-place edit not attributed, pinning unchanged behaviour) and `Compiler.spec.ts` (nested compile through the context system, through a wrapped system, and a file rewritten after the nested check are each reported the right number of times); CLI e2e in `bin.test.ts`: a result processor runs a nested compile through a wrapped `ctx.getSystem()` and a construct in its output is reported once (fails before: twice), and a transformer addon that only adds a synthetic comment is not named (pins the documented non-attribution) <!-- builds: nested-compile check deduplication, documented in-place transformer attribution gap -->

### Package subpaths

- `bug/esm-check-package-subpaths` — item 10: new CLI-only rule `checkPackageSubpath` in `IMPORT_RULES` with 91022 (subpath or `"."` not exported for Node's default conditions; silent with tsconfig `customConditions`; lists exported subpaths), 91023 (extensionless or directory subpath of a package without `"exports"`; hint `.js` or `/index.js`), 91024 (`paths` alias left in an emitted specifier, after `#` imports, self-reference and symlinked workspace packages are ruled out), `node` only; unit tests in `cjs-names.spec.ts` and `import-rules.spec.ts` (each code and hint; `development`-only export silent under `customConditions`; self-reference, `#x` and a workspace symlink not reported as 91024); CLI e2e in `bin.test.ts` (each of the three fails, an installed and exported subpath, a self-reference and a symlinked workspace package pass); no webpack e2e (the loader does not run the rule) <!-- builds: ESM check codes 91022-91024 for bare-specifier subpaths and paths aliases -->

## Notes

- Created 2026-10-02 from story `node24-esm-support` follow-ups. Type `bug`, plan PR review, implementation on own
  branches, given by the requester.
- **Items dropped:** none; all ten still hold on `develop` d7ffdf4 (see Motivation table). Item 2's `typeof pkg`
  variant is not a false positive (Open Points).
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
  bug that predates the ESM check, not a check precision issue (#136 `cli-error-exit-gaps` owns it). Loader option,
  CLI exit and tsc option parity items belong to the sibling plans `loader-options-once`, `cli-error-exit-gaps` and
  `tsc-option-parity`.
- **Cross-plan:** #132 `vite-plugin` takes its ESM rule set from the "Rule set per runtime" table (loader columns).
  #134 `loader-options-once` and this plan both name `TsCompiler.ts:46`; this plan makes no edit there, and any
  slice that must is held until #134's `bug/loader-resolve-options-once` merges.
- **Amended after the draft panel** (2026-10-02, `.plot/panels/2026-10-02-esm-check-precision/`, unanimous amend):
  (1) loader claim corrected — no import rules under `bundler` (`TsCompiler.ts:317`), item 6 CLI-only, rule set per
  runtime stated, real before/after loader cases named, the `?query` webpack e2e replaced by `./d.json?v=1`;
  (2) slice 1: 91010/91013 test the resolved path, `bundler` probes as written before stripping `?`/`#`, `node`
  keeps URL resolution with the `%2F`/`%5C` note; (3) directory rule widened to `index.*` or any string
  `main`/`module`/`browser`, severity decided, heuristic and escapes in the message and README; (4) 91022 silent
  under `customConditions` and `"."` in scope, 91024 rules out `#` imports, self-reference and workspace symlinks,
  messages and hints for 91022–91024 specified; (5) item 7 decided as (c) with the pre-check as evidence and a
  pinning e2e, nested compiles keyed off the system object so wrapped systems deduplicate; (6) `typeof pkg` wording
  names the `__esModule` case and records that 91021 reports it under `bundler` too; (7) rollout rule stated.
  Open Points are now decided, pending approval.
