<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — esm-check-precision (slice 1: false positives)

- **Plan (canonical):** `docs/plans/2026-10-02-esm-check-precision.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #137 merged
- **Branch:** `bug/esm-check-false-positives` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on `PATH`). Do not merge it yourself.
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

First of the plan's four slices, which run in order. `bug/esm-check-import-misses` waits on this branch: both edit
`import-rules.ts`, and slice 2 builds on the resolved path this slice introduces. `bug/esm-check-attribution` and
`bug/esm-check-package-subpaths` come after slice 2. This branch waits on nothing.

### What to build

Three false positives fail builds whose output Node 24 loads. `check: "error"` is the default. All three were
reproduced on `develop` d7ffdf4 with `node packages/compiler/bin/bin.js --profile client` (`esm: { runtime: "node" }`),
and Node 24.21.0 ran each emitted file without error:

1. **UMD wrapper → 91001 + 91002.** In `factory(require, exports)` inside
   `if (typeof module === "object" && typeof module.exports === "object")`, `module` counts as guarded, but `require`
   and `exports` do not. The cause is `isTypeofGuarded` (`packages/core/src/compiler/esm/scan-module.ts:219-246`): it
   passes only `node.text` to `testsTypeof` and `readsDefined`, so a use counts as guarded only by a `typeof` test of
   its own name.
   **Fix:** pass the set of all five CommonJS names (`COMMONJS_NAMES`, `scan-module.ts:40`) instead. Keep the
   direction rules as they are (`readsDefined`; compound tests guard every branch).
2. **91021 on a shadowing local.** In `import pkg from "tscjs"; function f() { const pkg = () => 1; return pkg(); }`,
   the local `pkg()` call is reported. The cause is `isUsedAsValue` (`cjs-names.ts:177-189`), which matches by name
   only; its doc comment says so.
   **Fix:** count only references that resolve to the import binding. A reference resolves there when the nearest
   enclosing scope that declares the name is the `SourceFile`. Use the scope rules `scanModule` already applies to
   CommonJS names (`scan-module.ts:51-106`: `var` → function scope, `let`/`const`/function/class → block scope,
   parameters, named function and class expressions, catch clauses). Move those rules into one shared helper with a
   name filter, and use it from both places. Do not write them a second time.
3. **`./b.js?v=1` and `./my%20file.js` → 91012.** The cause is `collectRelativeImports` (`import-rules.ts:223`), which
   computes `path.resolve(dirname, literal.text)` and so treats the specifier as a file path.
   **Fix:** derive the file path the way each runtime does (decisions below). Every rule then tests the resolved path.

Two more defects show up once the resolved path exists:

- **91013 tests the written specifier.** `import-rules.ts:118` applies `/\.json$/i.test(cur.specifier)`, so
  `import d from "./d.json?v=1"` is missed, although Node 24 throws `ERR_IMPORT_ATTRIBUTE_MISSING` (measured).
- **91010 tests the extension of the written specifier.** It checks `path.extname` against `KNOWN_EXTENSIONS`, and its
  fix hint appends `.js` to the whole specifier, so today the hint reads `./b?v=1.js`.

The plan is canonical. This brief is orientation.

### The decisions the plan settles — do not re-derive them

**A `typeof` test of any CommonJS name guards all five.** Node 24 measured: in an ES module,
`typeof require/module/exports/__dirname/__filename` are all `"undefined"` together, so a branch that runs only when one
of them is defined never runs.

- Rejected: keeping the own-name test. TypeScript's own UMD output (`module: umd`) fails it.
- Rejected: "any `typeof` test in the file disables the rule." The plan requires an addon's unguarded `require` outside
  the branch, next to an unrelated `typeof module` test elsewhere, to stay reported.
- Rejected: dropping `readsDefined`. `typeof module === "undefined" ? require("x") : …` runs the `require` exactly when
  CommonJS is absent (measured: the else branch is taken), so that use must stay reported.
- The fallback branch itself (`root.X = …` with `this === undefined`) still throws at runtime. That is no ESM check
  concern, and nothing you write should claim every UMD file works.

**Shadowing uses the existing scope rules, through a shared helper.** One implementation of scope resolution, not
two. The import clause itself declares at file scope (`scan-module.ts:90-91`), so "nearest declaring scope is the file"
is the test.

**Only shadowing is fixed in 91021. `typeof pkg` stays reported, under both runtimes.**

- Measured on Node: `typeof pkg` is `"object"` only for an `__esModule` package with `exports.default = fn`, because
  the default import is the whole `module.exports`. For `module.exports = fn` it is `"function"`, and 91021 does not
  fire there (no `default` export).
- Under `bundler`, 91021 runs only for `kind === "esm"` importers (`javascript/esm`), where webpack's strict interop
  also yields `module.exports`.
- So it is not a false positive. Document it in the README, and close it as such in
  `docs/stories/node24-esm-support/STORY-node24-esm-support.md`.

**Specifier → path, per runtime.** The runtimes differ, and a single rule is wrong for one of them.

- **`node`:** `fileURLToPath(new URL(specifier, pathToFileURL(importingFile)))`. This drops `?…` and `#…`, decodes
  `%xx` and normalises dot segments. The node-semantics juror measured this to be exactly Node 24's behaviour,
  including that a file literally named `a#b.js` is reachable only as `./a%23b.js` (`./a#b.js` names `./a`).
- **`node`, `%2F` / `%5C`:** Node rejects these with `ERR_INVALID_MODULE_SPECIFIER`, so they must stay unresolved and
  get 91012. **Test for them explicitly** (case-insensitive) before the URL conversion. Checked for this brief on Node
  24.21.0: `fileURLToPath` throws `ERR_INVALID_FILE_URL_PATH` for `%2F`, but for `%5C` it returns `/dist/a\b.js`
  without error on POSIX. Catching the throw alone misses `%5C`. 91012's message then differs from Node's error code;
  the plan accepts that, since both fail the import.
- **`bundler`:** probe the specifier **as written first**. If it names no existing file or directory (for `auto`,
  also none with an `AUTO_EXTENSIONS` suffix), use the specifier with `?…` and `#…` stripped. Never decode.
  Measured with `enhanced-resolve` (webpack 5.97.1):
  - `./a#b.js` resolves to a file named `a#b.js`, so strip-first would create a new false positive.
  - `./my%20file.js` does not resolve, so no decoding keeps 91012 there.
  - `?v=1` and `#h` resolve to the file both with and without `fullySpecified`.
  - Careful: the as-written path of `./b?v=1` has `path.extname === ""`. Let only an *existing* as-written target win,
    or `getTarget` short-circuits to `missing-extension` on the wrong path.
- Rejected: one strip-and-decode for both runtimes. `#` breaks `bundler` and `%20` breaks `bundler`.
- Rejected: `decodeURIComponent` for `node`. It turns `%2F` into a resolvable `/` and misses dot-segment
  normalisation.

**The resolved path feeds every rule. Diagnostics quote the specifier as written.**

- 91013 tests `/\.json$/i` on the resolved path. 91010's `KNOWN_EXTENSIONS` / `path.extname` test does the same.
- The "names a directory" test (`import-rules.ts:145`) runs on the path part, without the query or fragment
  (`./utils/?v=1`).
- 91010's hint inserts `.js` before the query or fragment (`./b.js?v=1`). 91011's hint inserts `/index.js` the same
  way.
- `collectRelativeImports` is cached per `SourceFile` (`import-rules.ts:210`), and its result now depends on the
  runtime, so key the cache by runtime too, or resolve lazily from the context. The `getTarget` / `isDirectory` memos
  are keyed per `ImportRuleContext`, which carries the runtime, so they are fine.
- Keep reading the file system only through `context.system`; the loader wraps it to register dependencies.
- The unit specs use virtual POSIX paths (`/dist/target.js`), and CI runs `ubuntu-latest`.

**No edit to `packages/webpack/src/TsCompiler.ts`.** The loader runs `NODE_IMPORT_RULES` (`:46`: 91010, 91011, 91013)
under `node` and **no import rules at all under `bundler`** (`:317`). This slice changes the rules *inside*
`checkMissingExtension`, `checkDirectoryImport`, `checkJsonImportAttribute` and `collectRelativeImports`, so the loader
picks the changes up with no list change.

- If you find you must edit the list, stop and report. Such a change is held until #134's
  `bug/loader-resolve-options-once` has merged.
- Consequence for tests: no loader case for item 3 can fail before the change except `./d.json?v=1` under `node`.
  91012 is not in the loader, and nothing runs under `bundler`.

**No new codes, no config keys, no severity change.** Every finding keeps the profile's `check` severity.

**Carried over from the delivered ESM check:**

- Rules stay separately callable units.
- Duplicates with TypeScript diagnostics stay; do not cross-suppress them.
- Never re-derive ESM/CommonJS from `tsConfig.module`; classification comes from `classify-module.ts`.

### Done when

Every test below is new. Unless marked *(pin)*, it must **fail on `develop` before your change**: run it red first and
note the red run in the PR. A *(pin)* passes before and after, and catches a naive implementation. Names follow each
file's existing style. Unit tests use assemble / act / assert, `testObj` / `actual`.

`packages/core/src/compiler/esm/scan-module.spec.ts` (`describe("scanModule")`):

- `yields nothing w/ require and exports in UMD branch guarded by typeof module test`: the
  `if (typeof module === "object" && typeof module.exports === "object") { var v = factory(require, exports); … }`
  shape. Before: `require` and `exports` are free.
- `yields nothing w/ require and module in branch guarded by typeof exports test`:
  `if (typeof exports === "object") module.exports = factory(require("dep"));`.
- `yields nothing w/ TypeScript UMD output`: a source transpiled with `module: ts.ModuleKind.UMD`.
- *(pin)* `yields free require w/ require outside UMD branch and typeof module test elsewhere`. Catches
  "any `typeof` test disables the rule".
- *(pin)* `yields free require w/ require in true branch of typeof module undefined conditional`. Catches dropping
  `readsDefined`.

`packages/core/src/compiler/esm/cjs-names.spec.ts` (`describe("checkEsm CommonJS names")`, package `tscjs`, `node`
output):

- `yields nothing w/ default import of __esModule package and called local const of the same name in node output`.
- `yields nothing w/ default import of __esModule package and parameter of the same name passed as argument in node output`.
- `yields nothing w/ default import of __esModule package and var of the same name hoisted in function in node output`.
- *(pin)* `yields 91021 w/ default import of __esModule package called in function beside sibling function shadowing it in node output`.
  Catches "any declaration of the name anywhere suppresses".
- *(pin)* `yields 91021 w/ default import of __esModule package called after block with let of the same name in node output`.
  Catches treating `let` as function-scoped.
- *(pin)* `yields 91021 w/ typeof of default import of __esModule package in node output`. Records the 2b decision.

`packages/core/src/compiler/esm/import-rules.spec.ts` (files under `/dist/`; `createContext` defaults to `node`):

- `checkUnresolvedImport`:
  - `yields nothing w/ query on import of existing file in node ESM file`: `./b.js?v=1`.
  - `yields nothing w/ fragment on import of existing file in node ESM file`: `./b.js#h`.
  - `yields nothing w/ percent-encoded space in import of existing file in node ESM file`: `./my%20file.js` with
    `/dist/my file.js`.
  - `yields nothing w/ percent-encoded hash naming file with hash in node ESM file`: `./a%23b.js` with `/dist/a#b.js`.
  - `yields nothing w/ query on import of existing file in bundler ESM file`.
  - `yields nothing w/ extensionless import with query in bundler auto file`: `./b?v=1` with `/dist/b.js`.
  - *(pin)* `yields 91012 w/ percent-encoded slash in node ESM file`: `./a%2Fb.js` while `/dist/a/b.js` exists. Catches
    `decodeURIComponent`.
  - *(pin)* `yields 91012 w/ percent-encoded backslash in node ESM file`: `./a%5Cb.js` while `/dist/a\b.js` exists.
    Catches relying on `fileURLToPath` to throw.
  - *(pin)* `yields 91012 w/ percent-encoded space in import of existing file in bundler ESM file`. Catches decoding
    under `bundler`.
  - *(pin)* `yields nothing w/ import of file named with hash in bundler ESM file`: `./a#b.js` with `/dist/a#b.js`.
    Catches strip-first.
- `checkImports`:
  - `yields 91010 w/ import of file named with hash in node ESM file`: `./a#b.js` with only `/dist/a#b.js`; Node needs
    `%23`.
  - `yields findings per runtime w/ same scanned file checked under node and bundler`: one `scan(…)` result checked
    with both contexts; `./my%20file.js` gives `[]` under `node` and `[91012]` under `bundler`. Catches a
    runtime-blind `collectRelativeImports` cache.
- `checkMissingExtension`:
  - `yields 91010 with hint before query w/ extensionless import with query in node ESM file`: message contains
    `"./b.js?v=1"`. Before, the hint reads `./b?v=1.js`.
- `checkDirectoryImport`:
  - `yields 91011 with hint before query w/ directory import with query in node ESM file`: `./utils?v=1` with
    `/dist/utils/index.js`; hint `./utils/index.js?v=1`. Before: 91010.
- `checkJsonImportAttribute`:
  - `yields 91013 w/ JSON import with query in node ESM file`: `./d.json?v=1`.
  - *(pin)* `yields nothing w/ JSON import with query and type json attribute in node ESM file`.
  - *(pin)* `yields nothing w/ JSON import with query in bundler ESM file`.

`packages/compiler/src/bin.test.ts`, next to the existing ESM cases (`:607-660`). Use a `node` ESM profile, an
explicit `target: "esnext"`, and an output `package.json` with `"type": "module"`. Specifiers TypeScript cannot
resolve need `// @ts-nocheck`, like the 91020 case. Put `d.json` and `my file.js` where the emitted file looks for them
(`OUTPUT_DIR`).

- `should exit with zero status w/ UMD wrapper in node ESM profile`. Before: exit 1, 91001 + 91002.
- `should exit with zero status w/ default import of __esModule package shadowed by local in node ESM profile`. Before:
  91021.
- `should exit with zero status w/ query and percent-encoded relative imports in node ESM profile`: `./b.js?v=1` and
  `./my%20file.js`. Before: two 91012.
- `should exit with status 1 and report 91013 in emitted file w/ JSON import with query in node ESM profile`. Before:
  exit 0.

`packages/webpack-test/tests/webpack-esm-check.test.ts`. These are the only loader cases that can fail before the
change (see the rule-set table in the plan):

- `reports nothing w/ UMD wrapper under bundler runtime and javascript/esm rule`. Before: `ESM91001`.
- `reports nothing w/ UMD wrapper in node dependent profile` (`NODE_DEPENDENT()`). Before: `ESM91001`.
- `reports nothing w/ default import of __esModule package shadowed by local under bundler runtime and javascript/esm rule`.
  Needs an `__esModule` package in the project's `node_modules`. Before: `ESM91021`.
- `reports 91013 w/ JSON import with query in node dependent profile`. `src/d.json` must exist for webpack itself.
  Before: no error.

Docs:

- **`packages/compiler/README.md`, ESM check section:**
  - The `typeof` sentence (`:167-168`) says a `typeof` test of any CommonJS name guards all five.
  - The 91010–91013 paragraph (`:205-212`) states the per-runtime handling of query, fragment and percent-encoding:
    `%2F`/`%5C` → 91012 under `node`, no decoding under `bundler`, and that 91010/91013 test the resolved path.
  - The 91021 paragraph (`:227-230`) says shadowing locals are not counted, and that `typeof pkg` is reported (the
    `__esModule` + `exports.default` case).
- **`Release-Notes.md`, `## [Unreleased]`:**
  - `### Fixed` gets the three false positives.
  - `### Changed` gets the "Builds that passed 0.10.x may now fail" entry for 91013 on `./d.json?v=1` under `node`,
    naming `esm.ignore` / `check: "warn"` as the escapes. Slice 2 extends this entry.
  - Replace the `TBA` placeholder only in a section you write to.
- **Story:** in `docs/stories/node24-esm-support/STORY-node24-esm-support.md`, record that `typeof pkg` (item 2b) is
  closed as not a false positive.

Gates, all green:

- `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`.
- `pnpm license:add` for any new source file (e.g. the shared scope helper). Never add it to the `license:check` list.

Repo mechanics:

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin`; Homebrew's pnpm 11 fails with E401.
- Install with `--offline`; the Artifactory login in `~/.npmrc` has expired. Never edit `~/.npmrc`. For a registry
  package, use an empty `NPM_CONFIG_USERCONFIG` file plus `--config.registry=https://registry.npmjs.org/`; this slice
  needs no new dependency.
- Use Node 24 at `$HOME/.nvm/versions/node/v24.21.0/bin/node` for runtime checks of emitted fixtures.
- Commits use Arlo's notation without a colon (`B Fixes …`, see the `commit-notation` skill).
- Use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`; never use `gh pr create`.
- Append `→ #<PR>` to this branch's line in the plan's `## Slices` and commit that on this branch.
- Do not merge.

### Scope guard

This branch owns:

- `packages/core/src/compiler/esm/scan-module.ts`, `cjs-names.ts`, `import-rules.ts`, and a new shared scope helper
  beside them if you extract one.
- Their specs: `scan-module.spec.ts`, `cjs-names.spec.ts`, `import-rules.spec.ts`.
- The new cases in `packages/compiler/src/bin.test.ts` and `packages/webpack-test/tests/webpack-esm-check.test.ts`.
- The ESM check section of `packages/compiler/README.md`, the `Release-Notes.md` entries, the story note, and this
  branch's line in the plan.

Not this branch:

- Bare JSON, `import()` in CommonJS files and the `bundler` directory rule (slice 2).
- Attribution and nested compiles: `Compiler.ts`, `CompilationContext.ts` (slice 3).
- 91022–91024 (slice 4).
- `packages/webpack/src/TsCompiler.ts`, in any slice.

The other branches starting now, with each one's files checked against its plan on `develop`:

- `bug/tsc-default-target-interop` (#135):
  - Writes `Release-Notes.md` `### Changed` and the webpack-test snapshots, and changes `tsDefaults` (target,
    `esModuleInterop`).
  - Real collision: `Release-Notes.md`; the second to merge resolves it.
  - Give every new fixture an explicit `target` and `module` so its emit does not move when #135 lands.
- `bug/cli-project-directory` (#136):
  - Adds e2e cases to `packages/compiler/src/bin.test.ts`, edits `packages/compiler/README.md` (`--project` / TS5042,
    not the ESM section) and adds a `Release-Notes.md` entry.
  - Real collisions: `bin.test.ts`, `Release-Notes.md`, and possibly the README. Keep your cases with the ESM cases,
    not at the end of the file.
- `infra/typescript-6-toolchain` (#144):
  - Edits every package tsconfig, `package.json` files, `pnpm-lock.yaml` and the ts-jest / typescript-eslint
    versions.
  - Touch none of them. If it merges first, rebase and re-run `pnpm lint` and `pnpm test`.
- `infra/esm-bench-watchdog` (#134): `packages/webpack-test/perf/esm-watch-bench.cjs` only. No collision.
- `infra/dependabot-config` (#133): `.github/dependabot.yml` and the `claude-review` workflow. No collision.

If you find something the plan did not anticipate, report it rather than improvising outside scope. Two examples: a
`typeof` test of a CommonJS name that the file itself declares locally, or webpack itself failing on a fixture.
