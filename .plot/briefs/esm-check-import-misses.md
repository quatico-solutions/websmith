<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — esm-check-precision (slice 2: import misses)

- **Plan (canonical):** `docs/plans/2026-10-02-esm-check-precision.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #137 merged
- **Branch:** `bug/esm-check-import-misses` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on `PATH`). Do not merge it yourself.
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

This is the second of the plan's four slices, which run in order. It waited on `bug/esm-check-false-positives`, which
has merged (PR #145, in `develop` at 55c9be70), so it can start now. `bug/esm-check-attribution` comes next, and
`bug/esm-check-package-subpaths` builds on the bare-specifier resolution this slice exposes. Read slice 1's diff
before you start (`gh pr diff 145`). It added `resolveImports`, `resolveNodeSpecifier` and `resolveBundlerSpecifier`
to `import-rules.ts`, the shared scope helper `scopes.ts`, and the README and Release-Notes text this slice extends.

### What to build

The check misses three import failures. Each one passes the build, and the emitted output fails at runtime. They were
reproduced on `develop` d7ffdf4 with `node packages/compiler/bin/bin.js --profile client`, and the output was run on
Node 24.21.0. Slice 1 did not touch any of them; the line numbers below are from `develop` after #145.

1. **Bare JSON specifiers get no 91013 (item 4).** `import d from "jpkg/d.json"` builds without a finding under
   `esm: { runtime: "node" }`, but Node 24 throws `ERR_IMPORT_ATTRIBUTE_MISSING`. The cause is that
   `checkJsonImportAttribute` (`packages/core/src/compiler/esm/import-rules.ts:129-142`) reads only
   `collectRelativeImports` (`:231`), and `isRelative` (`:226`) drops every bare specifier. One existing unit test
   pins the miss: `checkJsonImportAttribute` › `yields nothing w/ bare JSON specifier in node ESM file`
   (`import-rules.spec.ts:405`). Replace it (see Done when). Do not keep it next to the new test.
2. **`import()` in CommonJS files is not checked (item 5).** `import("./b")` in a `.cjs` file builds without a
   finding, but Node 24 throws `ERR_MODULE_NOT_FOUND`. The cause is that every rule returns `[]` unless `kind` is
   `"esm"` (`import-rules.ts:69`, `:84`, `:130`), or `"esm"`/`"auto"` for 91012 (`:109`).
3. **Directories under `bundler` / `javascript/auto` always pass (item 6).** `./dir` passes when `dir/` contains only
   `other.js`, and `./nothing` gets 91012. The cause is the `auto` branch of `checkUnresolvedImport`
   (`import-rules.ts:113-116`): `… || isDirectory(cur.resolved, context)` accepts any directory, so webpack's
   "Module not found" shows up only in the bundle step.

The plan is canonical. This brief is orientation.

### The decisions the plan settles — do not re-derive them

**91013 covers bare specifiers under `node`, in two ways: by name, or by `exports` resolution.**

- A bare specifier gets 91013 when either of these holds, and the import has no `with { type: "json" }`:
  - its text ends in `.json` (`/\.json$/i`), whether or not the package is installed;
  - `resolvePackage` resolves it to an entry that ends in `.json`.
- Rejected: by name only. The Node juror measured that an `exports` entry `"./data": "./d.json"` makes
  `import d from "jpkg/data"` throw the same `ERR_IMPORT_ATTRIBUTE_MISSING`.
- Rejected: a second package resolver in `import-rules.ts`. Use `resolvePackage` (`cjs-names.ts:222`) with Node's
  import conditions (`IMPORT_CONDITIONS`, `cjs-names.ts:51`). Use `isBareSpecifier` (`cjs-names.ts:148`) to decide
  what counts as bare, so `#imports`, `node:` builtins and URLs stay out. Export the three from `cjs-names.ts` (or
  move them to a module beside it). `bug/esm-check-package-subpaths` builds its 91022–91024 on the same resolution,
  so there must be one copy.
- Rejected: a separate collector for bare specifiers. The plan wants relative and bare specifiers in **one**
  collector. Then dynamic `import("jpkg/d.json", { with: { type: "json" } })` gets the same attribute handling as
  the static form (`hasDynamicJsonAttribute`, `findProperty`). Give each collected import a flag for whether it is
  bare.
- A bare import must never reach `getTarget` or rules 91010–91012. Existing tests pin this, and they must stay green:
  `checkMissingExtension` › `yields nothing w/ bare specifier in ESM file`, `checkUnresolvedImport` ›
  `yields nothing w/ bare specifier in ESM file`, `checkImports` › `yields nothing w/ bare specifiers in node ESM
  file`, and `check-esm-imports.spec.ts` › `yields nothing w/ bare specifier in node ESM output`.
- Bare JSON runs under `node` only. webpack loads JSON without an attribute, and the existing `bundler` pins stay.
- **Dependencies.** `resolvePackage` returns the files it probed in `dependencies`. `createCjsNamesCheck` replays
  them to `context.onDependency` (`cjs-names.ts:75-85`). The loader does **not** wrap `ts.System`. It learns
  dependencies only through `onDependency` (`TsCompiler.ts:248`, passed at `:316`). So replay the dependencies of
  every bare resolution as well, and share the build's `cjsNamesCache`. Today `importContext` (`check-esm.ts:116`)
  carries only `runtime`, `system` and `writtenFiles`. Add the two as optional `ImportRuleContext` fields and fill
  them there.
- The change stays inside `checkJsonImportAttribute` and the collector. The loader runs that rule under `node`
  (`NODE_IMPORT_RULES`, `TsCompiler.ts:46`), so it picks the change up with no list edit.

**`import()` in CommonJS files: under `node` only, dynamic imports only, every one of 91010–91013.**

- Under `node`, a file classified `commonjs` (`.cjs`, `"type": "commonjs"`, or no `"type"` and no ESM syntax) runs
  91010, 91011, 91012 and 91013 on its `import()` calls with a string literal, relative or bare. The Node juror
  measured each case in a `.cjs` file on Node 24:
  - `import("./b")` → `ERR_MODULE_NOT_FOUND`;
  - `import("./dir")` → `ERR_UNSUPPORTED_DIR_IMPORT`;
  - a bare JSON `import()` → `ERR_IMPORT_ATTRIBUTE_MISSING`;
  - a query, and an explicit `.js`, load.
- **Static imports in a CommonJS file stay unchecked by these rules.** 91030 and 91031 already report them.
  `check-esm-imports.spec.ts` › `yields only 91030 w/ extensionless import in node .cjs output` pins this and must
  stay green. A naive "let `commonjs` through the `kind` gate" adds 91010 there. The collector needs a dynamic flag
  for that.
- **`require()` stays unchecked.** Node 24 `require()`s ES modules (measured), and the collector does not see
  `require` calls.
- **Gate on `context.runtime === "node"` as well as `kind`.** `classifyModule` gives `commonjs` only under `node`
  (`classify-module.ts:54-63`), but unit tests and the loader's `moduleKind` override pass any `kind`.
- Rejected: doing the same under `bundler`. There, `.cjs` and `"type": "commonjs"` files are `javascript/dynamic`
  (`classify-module.ts:54,59`). webpack's `fullySpecified` default applies to `javascript/esm` only
  (`webpack/lib/config/defaults.js:721,781`), so `import("./b")` resolves there. The Node rule would be a false
  positive. The reason is the module type.
- Under `module: commonjs`, TypeScript rewrites `import()` to `require`. Nothing is left to check, and that is
  correct. Fixtures therefore need `module: nodenext`, which keeps `import()` in `.cts` → `.cjs` output.
- In the loader this reaches 91010, 91011 and 91013 under `node`. 91012 is not in `NODE_IMPORT_RULES`.

**The directory rule under `bundler` / `javascript/auto` is a widened heuristic. It is CLI-only and keeps the
profile's severity.**

- A relative import that names a directory resolves only in one of two cases:
  - the directory holds `index` with one of `AUTO_EXTENSIONS` (`.js`, `.mjs`, `.cjs`, `.json`, `import-rules.ts:100`),
    either on disk or written this run;
  - the directory has a `package.json` whose `main`, `module` or `browser` is a **non-empty string**.
- Any other directory gets 91012, with this message (from the plan) instead of the generic one. Quote the specifier
  as written:

  ```text
  relative import "./dir" names a directory with no index file and no package.json entry; if your webpack config sets `resolve.mainFiles` or `resolve.mainFields`, use `esm.ignore` or `check: "warn"`
  ```
- **Do not check that the field names an existing file.** The bundler juror probed this with `enhanced-resolve`
  (webpack 5.97.1, default `mainFields`/`mainFiles`). Each of these resolves:
  - `{"module":"m.js"}` with no `main` and no index;
  - an extensionless `{"main":"lib"}` next to `lib.js`;
  - `{"main":"./lib"}` naming `lib/index.js`.

  The plan also accepts a field that names nothing. Re-implementing the resolver is out of scope.
- Rejected: "a `package.json` whose `main` names such a file" (the draft wording). The probe above shows it creates
  false positives.
- `index.mjs` and `index.cjs` alone fail under webpack's defaults (probed). The plan accepts them anyway as a safe
  over-accept. Do not narrow the list.
- **Severity: the profile's `check`, error by default.** Rejected: a fixed warning, or a separate warning code. The
  addon-author juror wanted `warn`. The plan chose error: once the accept set is widened, what remains is a directory
  webpack's defaults cannot load. A warning code would also let such a build pass. The escape for custom
  `resolve.mainFiles` / `resolve.mainFields` is the existing `esm.ignore` / `check: "warn"`, named in the message.
- **Scope of the change: the `auto` branch of `checkUnresolvedImport` only.**
  - `kind === "esm"` directories stay with 91011.
  - Leave the existence probe in `resolveBundlerSpecifier` (`import-rules.ts:312`) as it is. It decides only between
    the as-written and the stripped path.
  - Read `package.json` through `context.system.readFile`. Treat a missing or unparsable file as "no entry".
- **No loader test.** The loader runs no 91012 under either runtime (`TsCompiler.ts:46`, `:317`), and webpack's own
  "Module not found" is the authority there.

**No new codes, no config keys, no `TsCompiler.ts` edit.** Every new finding ships at the profile's `check`
severity, with the Release-Notes "Builds that passed 0.10.x may now fail" line. If you find that you must change
`NODE_IMPORT_RULES`, stop and report. Such a change is held until #134's `bug/loader-resolve-options-once` has
merged. `infra/esm-bench-watchdog` is not that slice.

**Carried over from slice 1 and the delivered ESM check:**

- The resolved path feeds every rule, and diagnostics quote the specifier as written.
- Rules stay separately callable units.
- Read the file system only through `context.system`.
- The memos keyed per `ImportRuleContext` stay valid. `resolveImports` keys by `kind`, file and specifier, so key bare
  resolutions so that they cannot collide with relative ones.
- Never re-derive ESM/CommonJS from `tsConfig.module`. Classification comes from `classify-module.ts`.
- Duplicates with TypeScript diagnostics stay. Do not cross-suppress them.

### Done when

Every test below is new, except the one you replace. Unless a test is marked *(pin)*, it must **fail on `develop`
before your change**. Run it red first and note the red run in the PR. A *(pin)* passes before and after, and catches
a naive implementation. Names follow each file's existing style. Unit tests use assemble / act / assert with
`testObj` / `actual`. In `import-rules.spec.ts`, add `const COMMONJS = { kind: "commonjs" } as const;` beside `ESM`,
`AUTO` and `DYNAMIC`. Create an empty directory in the virtual system with a trailing-slash key (`"/dist/empty/": ""`).

`packages/core/src/compiler/esm/import-rules.spec.ts`:

- `checkJsonImportAttribute`:
  - **Replace** `yields nothing w/ bare JSON specifier in node ESM file` with
    `yields 91013 w/ bare JSON specifier in node ESM file`: `import data from "pkg/d.json"`, with no package installed.
  - `yields 91013 w/ bare specifier mapped to JSON file by package exports in node ESM file`:
    `import d from "jpkg/data"`, with `/dist/node_modules/jpkg/package.json` =
    `{"name":"jpkg","exports":{"./data":"./d.json"}}` and `d.json`. Catches "by name only".
  - `yields 91013 w/ literal dynamic bare JSON import in node ESM file`: `import("jpkg/d.json")`.
  - `yields 91013 w/ literal dynamic JSON import in node CommonJS file`: `import("./d.json")` with `COMMONJS`.
  - *(pin)* `yields nothing w/ bare JSON specifier with type json attribute in node ESM file`.
  - *(pin)* `yields nothing w/ bare JSON specifier in bundler ESM file`.
  - *(pin)* `yields nothing w/ bare specifier resolving to JS entry in node ESM file`: `jpkg` with `main: "index.js"`.
    Catches reporting every bare import that resolves.
- `checkMissingExtension`:
  - `yields 91010 w/ extensionless literal dynamic import in node CommonJS file`.
  - *(pin)* `yields nothing w/ extensionless static import in node CommonJS file`. Catches dropping the `kind` gate
    instead of checking only `import()`.
  - *(pin)* `yields nothing w/ extensionless literal dynamic import in bundler dynamic file`. Catches a missing
    `node` gate.
  - *(pin)* `yields nothing w/ extensionless literal dynamic import in CommonJS file under bundler runtime`: `COMMONJS`
    with `runtime: "bundler"`. Catches gating on `kind` alone.
- `checkDirectoryImport`:
  - `yields 91011 w/ literal dynamic import of directory in node CommonJS file`: `/dist/utils/index.js`.
- `checkUnresolvedImport`:
  - `yields 91012 w/ literal dynamic import of missing file in node CommonJS file`: `import("./gone.js")`.
  - `yields 91012 w/ import of directory without index file in bundler auto file`: `/dist/dir/other.js` only.
  - `yields 91012 w/ import of empty directory in bundler auto file`.
  - `yields 91012 w/ import of directory with package.json without entry field in bundler auto file`: `{"name":"d"}`.
  - `yields 91012 w/ import of directory with package.json with empty main in bundler auto file`: `{"main":""}`.
  - `yields message naming heuristic w/ import of directory without index file in bundler auto file`: the exact
    message above.
  - *(pin)* `yields nothing w/ import of directory with package.json with only module field in bundler auto file`.
  - *(pin)* `yields nothing w/ import of directory with package.json with extensionless main in bundler auto file`:
    `{"main":"lib"}` plus `lib.js`.
  - *(pin)* `yields nothing w/ import of directory with package.json with main naming directory in bundler auto file`:
    `{"main":"./lib"}` plus `lib/index.js`.
  - *(pin)* `yields nothing w/ import of directory with package.json with main naming missing file in bundler auto file`.
    Catches re-implementing the resolver.
  - *(pin)* `yields nothing w/ import of directory with package.json with only browser field in bundler auto file`.
  - *(pin)* `yields nothing w/ import of directory with only index.mjs in bundler auto file`. Catches narrowing the
    lenient list.
  - *(pin)* `yields nothing w/ import of directory with index.js written this run in bundler auto file`: `writtenFiles`
    only, not on disk.
  - The existing `yields nothing w/ directory import in bundler auto file` (with `index.js`) and
    `yields nothing w/ directory import in ESM file` stay green.

`packages/core/src/compiler/esm/check-esm-imports.spec.ts` (`describe("checkEsm w/ relative imports")`):

- `yields 91010 w/ extensionless dynamic import in node .cjs output`: `/dist/target.cjs` with `import("./b")`, and
  `/dist/b.js` written.
- `yields 91010 w/ extensionless dynamic import in node .js output under type commonjs`: `/package.json` =
  `{"type":"commonjs"}`.
- `yields 91013 w/ bare JSON import in node ESM output`.
- `yields 91012 warning w/ check warn and directory without index file in bundler auto output`: `[[91012, Warning]]`.
  Records that the rule keeps the profile's severity.
- *(pin)* `yields nothing w/ require of extensionless relative path in node .cjs output`. Catches checking
  `require`.
- *(pin)* `yields nothing w/ extensionless dynamic import in bundler .cjs output`.
- The existing *(pin)* `yields only 91030 w/ extensionless import in node .cjs output` stays green.

`packages/compiler/src/bin.test.ts`: put the cases after the slice-1 ESM cases (after `:758`, before
`createEsmProject`). Give every fixture an explicit `target` and `module` in both the tsconfig and the profile. Use
`// @ts-nocheck` where TypeScript cannot resolve a specifier.

- `should exit with status 1 and report 91013 in emitted file w/ bare JSON import in node ESM profile`: `OUTPUT_DIR`
  `package.json` `{"type":"module"}`, and `PROJECT_DIR/node_modules/jpkg/{package.json,d.json}`. Before: exit 0.
- `should exit with status 1 and report 91010 in emitted file w/ extensionless dynamic import in .cts source in node ESM profile`:
  `module: nodenext` (with `moduleResolution: nodenext`) so the emitted `test.cjs` keeps `import("./b")`, plus a
  `b.ts`. Check once that the emitted file really contains `import(`. Before: exit 0.
- `should exit with status 1 and report 91012 in emitted file w/ import of directory without index file in bundler profile`:
  `esm: { runtime: "bundler" }`, `OUTPUT_DIR/package.json` = `{}` (no `"type"` → `javascript/auto`), and
  `OUTPUT_DIR/dir/other.js`. Before: exit 0.
- *(pin)* `should exit with zero status w/ import of directory with package.json module field in bundler profile`:
  `OUTPUT_DIR/d2/package.json` = `{"module":"m.js"}` plus `m.js`.

`packages/webpack-test/tests/webpack-esm-check.test.ts`, under the `node` profile only. These are the only loader
cases that can fail before the change. There is no loader case for the directory rule.

- `reports 91013 w/ bare JSON import in node dependent profile` (`NODE_DEPENDENT()`):
  `node_modules/jpkg/{package.json,d.json}` in `PROJECT_DIR`, `a.ts` = `// @ts-nocheck` +
  `import d from "jpkg/d.json"`. Expect `{ exitCode: 1, errors: ["ESM91013"] }`. Before: exit 0, no errors.
- `reports 91010 w/ extensionless dynamic import in .cts module in node dependent profile`: a `NODE_DEPENDENT`
  variant whose `node` profile sets `module` / `moduleResolution` `nodenext`, entry `./src/c.cts` containing
  `import("./b")`, and `b.ts`. Expect `{ exitCode: 1, errors: ["ESM91010"] }`. Before: no error.

Docs:

- **`packages/compiler/README.md`, ESM check section:**
  - `:209-210`: bare specifiers are no longer "not checked". Under `node`, 91013 checks them, by a `.json` name or by
    `exports` resolution to a `.json` file.
  - `:192-195` (dynamic `import()` in CommonJS): under `node`, its relative and bare specifiers get 91010–91013
    (in the loader 91010, 91011, 91013), and `require()` is not checked.
  - `:215-216` ("accepts directories, like webpack does"): replace with the heuristic. A directory resolves with
    `index.{js,mjs,cjs,json}` or a `package.json` with a string `main`, `module` or `browser`. Say it is a heuristic,
    name `resolve.mainFiles` / `resolve.mainFields` and the `esm.ignore` / `check: "warn"` escapes, and say it is
    CLI-only.
- **`Release-Notes.md`, `## [Unreleased]`, `### Changed`:** extend the existing "Builds that passed 0.10.x may now
  fail" entry (slice 1 wrote it for `./d.json?v=1`). Do not add a second entry. List:
  - 91013 on bare JSON imports under `node` (CLI and loader);
  - 91010–91013 on `import()` in CommonJS files under `node` (loader: 91010, 91011, 91013);
  - 91012 on directories with neither an index file nor an entry field under `bundler` / `javascript/auto` (CLI
    only).

  Keep the escapes. `### Added` and `### Removed` still hold `TBA`. Do not write to them.

Gates, all green:

- `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`.
- `pnpm license:add` for any new source file. Never add a file to the `license:check` list.

Repo mechanics:

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin`. Homebrew's pnpm 11 fails with E401.
- Install with `--offline`; the Artifactory login in `~/.npmrc` has expired. Never edit `~/.npmrc`. For a registry
  package, use an empty `NPM_CONFIG_USERCONFIG` file plus `--config.registry=https://registry.npmjs.org/`. This slice
  needs no new dependency.
- Use Node 24 at `$HOME/.nvm/versions/node/v24.21.0/bin/node` for runtime checks of emitted fixtures.
- Commits use Arlo's notation without a colon (`B Fixes …`; see the `commit-notation` skill).
- Use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`. Never use `gh pr create`.
- Append `→ #<PR>` to this branch's line in the plan's `## Slices` and commit that on this branch.
- Do not merge.

### Scope guard

This branch owns:

- `packages/core/src/compiler/esm/import-rules.ts`, the exports it needs from `cjs-names.ts` (`resolvePackage`,
  `isBareSpecifier`, `IMPORT_CONDITIONS`), and the `importContext` line in `check-esm.ts`.
- Their specs: `import-rules.spec.ts` and `check-esm-imports.spec.ts`.
- The new cases in `packages/compiler/src/bin.test.ts` and `packages/webpack-test/tests/webpack-esm-check.test.ts`.
- The ESM check section of `packages/compiler/README.md`, the `Release-Notes.md` entry, and this branch's line in
  the plan.

Not this branch:

- Attribution and nested compiles: `Compiler.ts`, `CompilationContext.ts` (slice 3).
- 91022–91024 and any new rule in `IMPORT_RULES` (slice 4). Export the resolution, but do not report on bare
  subpaths beyond JSON.
- `packages/webpack/src/TsCompiler.ts`, in any slice.
- `scan-module.ts` and `scopes.ts` (slice 1, merged).

The other branches in flight now, with each one's files checked against its plan on `develop`:

- `bug/cli-project-directory` (#136, PR #147 open):
  - It changes `packages/compiler/src/bin.test.ts`, `packages/compiler/README.md` (`--project` / TS5042, outside the
    ESM section) and `Release-Notes.md`, plus `command.ts`, `find-config.ts` and `packages/core/src/compiler/config/`
    and `options/`.
  - Real collisions: `bin.test.ts`, `Release-Notes.md` and the README. Keep your cases with the ESM cases, not at the
    end of the file. The second to merge resolves the conflicts.
- `bug/tsc-default-target-interop` (#135):
  - It changes `tsDefaults` (target, `esModuleInterop`), `Compiler.ts` and `system.ts` (`getEffectiveTarget`), the
    webpack-test snapshots, and `Release-Notes.md` `### Changed` (a Breaking entry).
  - Real collision: `Release-Notes.md` `### Changed`, the same section you extend.
  - Explicit `target` and `module` keep your fixtures' emit stable when #135 lands.
- `infra/typescript-6-toolchain` (#144):
  - It changes every package tsconfig, the `package.json` files, `pnpm-lock.yaml`, and the ts-jest / typescript-eslint
    versions.
  - Touch none of them. If it merges first, rebase and re-run `pnpm lint` and `pnpm test`.
- `infra/upgrade-nx` (#133):
  - It changes `nx` / `@nx/eslint-plugin` in all ten `package.json` files, `nx.json` and `pnpm-lock.yaml`.
  - No collision while you add no dependency. If it merges first, rebase and re-run the gates uncached.
- `infra/esm-bench-watchdog` (#134): `packages/webpack-test/perf/esm-watch-bench.cjs` and its extracted step scheduler
  only. No collision.

If you find something the plan did not anticipate, report it rather than improvising outside scope. Three examples:
- webpack itself fails on a `.cts` or bare-JSON fixture;
- TypeScript's `nodenext` emit rewrites `import()` in a `.cts` file;
- a bare `.json` name whose `exports` maps it to a non-JSON file.
