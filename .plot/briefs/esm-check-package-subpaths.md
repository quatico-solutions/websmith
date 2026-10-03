<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — esm-check-precision (slice 4: package subpaths)

- **Plan (canonical):** `docs/plans/2026-10-02-esm-check-precision.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #137 merged
- **Branch:** `bug/esm-check-package-subpaths` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on `PATH`). Do not merge it yourself.
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

This is the last of the plan's four slices. All three predecessors have merged: `bug/esm-check-false-positives`
(#145), `bug/esm-check-import-misses` (#160, merge c59594fc) and `bug/esm-check-attribution` (#167, merge e93d2b95).
`develop` is at f7cc3606. Nothing in this plan waits on this slice; after it the plan goes to `/plot-deliver`.
Read #160's diff before you start (`gh pr diff 160`): it exported `resolvePackage`, `isBareSpecifier` and
`IMPORT_CONDITIONS` from `cjs-names.ts`, added the bare flag to the one import collector, and added
`onDependency` / `cjsNamesCache` to `ImportRuleContext`. This slice builds on exactly that resolution.

The plan's hold on `packages/webpack/src/TsCompiler.ts` is lifted (#165 `bug/loader-resolve-options-once` merged),
but this slice does not need to edit it: the new rule goes into `IMPORT_RULES` only, and the loader passes its own
`NODE_IMPORT_RULES` (`TsCompiler.ts:46`, used at `:372`). Leave that file alone.

### What to build

Item 10 of the plan: three bare-specifier imports pass the build under `esm: { runtime: "node" }` and fail on
Node 24. Reproduced on `develop` d7ffdf4 (fixture C, `node packages/compiler/bin/bin.js --profile client`, output
run on Node 24.21.0); nothing since has changed it:

1. `import x from "epkg/internal.js"` where `epkg`'s `"exports"` does not export `./internal.js` → no finding; Node
   throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. The same holds for the root `"epkg"` when `"exports"` has only a
   `require` condition (measured by the Node juror).
2. `import x from "npkg/sub"` where `npkg` has no `"exports"` and holds `sub.js` and/or a `sub/` directory → no
   finding; Node throws `ERR_MODULE_NOT_FOUND` (only `sub.js`) or `ERR_UNSUPPORTED_DIR_IMPORT` (a `sub/` directory,
   even with `sub.js` beside it; also for `npkg/sub/`).
3. `import l from "@app/l"` where `@app/*` is a tsconfig `compilerOptions.paths` alias, which TypeScript leaves in the
   emitted specifier → no finding; Node throws `ERR_MODULE_NOT_FOUND`.

Why nothing is reported today, with line numbers on `develop` f7cc3606:

- `resolveEntry` (`packages/core/src/compiler/esm/cjs-names.ts:267-306`) catches the `resolve.exports` throw at
  `:287-291` and returns only a `reason` string. 91020/91021 treat every `reason` as "unknown" (`:102-110`, a
  `--debug` line only).
- Without `"exports"`, a subpath is probed as written (`candidates = [subpath]`, `:302`), so `sub` (directory or
  extensionless) ends as "no entry file" — again just a `reason`.
- An alias finds no `node_modules/@app/l/package.json` and ends as "package not found in node_modules" (`:249`).
- No import rule looks at a bare specifier except `checkJsonImportAttribute` (`import-rules.ts:145-164`).

The plan is canonical. This brief is orientation.

### The decisions the plan settles — do not re-derive them

**One new rule, `checkPackageSubpath`, in `IMPORT_RULES` only, `node` only, three codes.**

- Export it from `import-rules.ts` and append it to `IMPORT_RULES` (`:166`). Add `PackageSubpathNotExported: 91022`,
  `UnresolvedPackageSubpath: 91023`, `UnresolvedPathsAlias: 91024` (or equally clear names) to
  `ImportDiagnosticCode` (`:16-21`), and update its doc comment, which says only 91013 checks bare imports.
- Return `[]` unless `context.runtime === "node"`. Rejected: `bundler`. webpack applies `resolve.alias`,
  `resolve.extensions`, `tsconfig-paths-webpack-plugin` and its own `exports` conditions, which the CLI cannot see;
  the bundler juror called 91024 under `bundler` a false positive in common setups.
- Rejected: adding it to `NODE_IMPORT_RULES` in the loader. webpack resolves bare specifiers itself and reports
  what it cannot resolve. The plan's "Rule set per runtime" table says "no" for both loader columns, and #132's Vite
  plugin inherits that column.
- Select imports with the existing `selectImports(file, kind, context, ["esm"])` and keep `cur.bare` only, as
  `checkJsonImportAttribute` does. That covers ES modules and, under `node`, `import()` in CommonJS files (Node
  resolves those with ESM rules and the `import` condition). `require()` stays unchecked; the collector does not see
  it. Do not write a second collector.
- Each bare import yields at most one of the three codes.

**Use the one resolver, and make its failures distinguishable.** Rejected: a second package resolver in
`import-rules.ts`. #160 exported `resolvePackage` so that 91013 and this slice share one copy.

- Today `Resolution` (`cjs-names.ts:26`) carries `entry` or a free-text `reason`. Add a structured outcome beside
  `reason`, e.g. `failure?: "not-found" | "not-exported" | "no-entry" | "unreadable" | …`, plus what 91022/91023 need
  for their messages (package name, subpath, package directory, the manifest's `exports`). Keep every `reason`
  string as it is: 91020/91021's `--debug` output must not change, and `cjs-names.spec.ts` pins some of it.
- Resolve with `IMPORT_CONDITIONS` (`cjs-names.ts:52`) and share the cache the way `importsPackageJson`
  (`import-rules.ts:255-267`) does (`context.cjsNamesCache`, else the per-context `packageCaches` entry). Then
  91013 and this rule hit one cache entry per specifier: same key, no second probe. Factor the cache lookup out of
  `importsPackageJson` rather than copying it.
- Replay every probe to `context.onDependency`, as `importsPackageJson` does (`:265`). That includes the new probes
  below (directory, `sub.js`, `sub/index.js`, the importer's nearest `package.json` for self-reference). Read the file
  system only through `context.system`.

**91022 — subpath or `"."` not exported under Node's default conditions.**

- Fires when the package is found, has `"exports"`, and `resolve.exports` throws for the subpath (`cjs-names.ts:288`).
  The root `"."` is in scope (decided Open Point: the same throw and the same measured error; leaving it out keeps the
  miss for `import x from "pkg"`).
- **Silent when the profile's tsconfig sets `customConditions`** (non-empty). Measured: an export with only a
  `development` condition loads under `node --conditions=development`, and `customConditions` is the hint that the
  runtime runs that way. Rejected: wording it "not exported under conditions X" and reporting anyway, because the
  finding is then no longer certain, and certainty is what lets it ship at error severity.
- Message (plan § Package subpaths), with the specifier as written:

  ```text
  "pkg/internal.js" is not exported by package "pkg" for conditions node, import, default; exported subpaths: ".", "./feature"
  ```

  - **The condition list:** the resolver uses `IMPORT_CONDITIONS` = `node, import, module-sync, default`, and the
    README already names all four. Render the list from `IMPORT_CONDITIONS` rather than hard-coding the plan's
    three. Say so in the PR; the plan's text predates the constant.
  - **"Exported subpaths":** the keys of `"exports"` that start with `.` and do not map to `null`, patterns
    (`"./*"`) as written. A string or condition-only `"exports"` exports `"."` alone.
  - **Cap and order:** at most five, nearest match first. Define "nearest" deterministically (e.g. longest common
    prefix with the requested subpath, ties in manifest order) and test the order.
- Rejected (panel, addon-author juror): a bare code without the list. An author whose generator emits
  `pkg/internal.js` gets no way to act.

**91023 — extensionless or directory subpath of a package without `"exports"`.**

- Fires when the package is found, has no `"exports"`, the subpath is not `"."`, and `packageDir/<subpath>` is not a
  file, but either a directory of that name exists or `<subpath>.js` is a file.
- **Directory first.** Node gives `ERR_UNSUPPORTED_DIR_IMPORT` when the directory exists, even with `sub.js` beside
  it (measured). A trailing slash (`npkg/sub/`) counts as a directory.
- Hint, like 91010/91011:
  - a directory with `index.js` → `"npkg/sub/index.js"`;
  - a directory without `index.js` → "import a file inside the directory", as 91011 does (`import-rules.ts:96-99`);
  - only the file → `"npkg/sub.js"`.

  Reuse 91010/91011's wording style; the message names the package.
- The root `"."` without `"exports"` stays as it is: `main` with `.js` / `/index.js` fallbacks (`cjs-names.ts:295-300`).
  Node's legacy main resolution does try those.
- A subpath that names neither file, directory nor `sub.js` stays "unknown". It is not 91023, and not this slice.

**91024 — a tsconfig `paths` alias left in an emitted specifier.**

- Fires when **all** hold:
  1. the specifier matches a key of the profile's `compilerOptions.paths`: exact for a key without `*`, prefix plus
     suffix for a key with one `*`;
  2. it is not a `#…` specifier (`isBareSpecifier` already drops those);
  3. it is not a self-reference;
  4. `resolvePackage` finds no package (the "not-found" outcome) from the importing file upward through
     `node_modules`.
- **Self-reference follows Node exactly.** Node looks only at the importing file's *nearest* `package.json` (its
  package scope). It self-resolves only when that file's `name` equals the specifier's package name **and** it has
  `"exports"` (measured to load). Do not search further up past a nearer `package.json`. Watch the fixtures: the
  existing e2e cases write `{"type":"module"}` into `OUTPUT_DIR/package.json`, which is then the nearest scope and has
  no `name`. A self-reference fixture must put `name` and `"exports"` in the package.json that is nearest to the
  emitted file.
- **Workspace symlinks** (`node_modules/@app/l` → `packages/l`) need nothing new. `resolvePackage` probes
  `node_modules/<name>/package.json` through `system.fileExists`, which follows the link, and the package is then
  found. The tests pin that.
- Message (plan):

  ```text
  "@app/l" matches the tsconfig "paths" pattern "@app/*", which TypeScript does not rewrite in emitted code; rewrite it with a transformer addon or a build tool, or use a package "imports" entry
  ```

- A package that is not installed and matches no `paths` key stays "unknown", as today.
- Rejected: reporting every unresolvable bare specifier. That would flag packages that are installed later or at
  deploy time, which the plan keeps as "unknown".

**How the rule gets `customConditions` and `paths`.**

- The check sees neither today. `importContext` (`check-esm.ts:116-122`) carries `runtime`, `system`,
  `writtenFiles`, `onDependency` and `cjsNamesCache`.
- Add an optional field to `ImportRuleContext` and to `EsmCheckContext`, e.g.
  `compilerOptions?: Pick<ts.CompilerOptions, "customConditions" | "paths">`, and pass it through `importContext`.
- In `Compiler.checkEsmOutput` (`packages/core/src/compiler/Compiler.ts:871-905`), fill it from
  `ctx.getCompilerOptions()` (`CompilationContext.ts:134`). That is the profile's parsed tsconfig. Do not take it from
  the transpile path's options, which drop `paths` (`TRANSPILE_REMOVED_OPTIONS`, `Compiler.ts:67-82`). Keep `overrides`
  able to replace it.
- With no `compilerOptions`, the rule behaves as if neither option is set.
- This is the slice's only edit in `Compiler.ts`; see the scope guard.

**No config keys, no loader change, the profile's severity.** Decided Open Point "Rollout": no warning-first
period. Every new finding ships at the profile's `check` severity. The escape is `esm.ignore` / `check: "warn"`,
named in the Release-Notes entry.

**Carried over from the earlier slices and the delivered ESM check:**

- Rules stay separately callable units.
- Diagnostics quote the specifier as written.
- Classification comes from `classify-module.ts`, never from `tsConfig.module`.
- Memos are keyed per `ImportRuleContext`.
- The existing pins on bare specifiers stay green:
  - `checkMissingExtension` › `yields nothing w/ bare specifier in ESM file`;
  - `checkUnresolvedImport` › `yields nothing w/ bare specifier in ESM file`;
  - `checkImports` › `yields nothing w/ bare specifiers in node ESM file`. It runs `IMPORT_RULES`, so its fixture
    must stay silent under the new rule: check what it imports, and do not weaken it.
  - `check-esm-imports.spec.ts` › `yields nothing w/ bare specifier in node ESM output`.

### Done when

Every test below is new. Unless a test is marked *(pin)*, it must **fail on `develop` before your change**. Run it
red first and note the red run in the PR. A *(pin)* passes before and after, and catches a naive implementation.
Unit tests use assemble / act / assert with `testObj` / `actual`. Names follow each file's existing `yields … w/ …`
style.

`packages/core/src/compiler/esm/cjs-names.spec.ts` (`resolvePackage`; use the real-fs temp root and
`fs.symlinkSync(…, "junction")` pattern already in the file, `:87`, `:380`):

- yields the not-exported outcome w/ subpath missing from `"exports"`, and w/ `"."` when `"exports"` has only
  `require`.
- yields the not-found outcome w/ no package in any `node_modules`.
- yields an entry w/ a workspace package symlinked into `node_modules` *(pin)*.
- 91020/91021 `--debug` reasons unchanged *(pin: the existing "skipped" tests stay green untouched)*.

`packages/core/src/compiler/esm/import-rules.spec.ts` (`describe("checkPackageSubpath")`, virtual system; packages
under `/dist/node_modules/…`; an empty directory as a trailing-slash key):

- 91022:
  - `yields 91022 w/ subpath not exported by package in node ESM file`.
  - `yields 91022 w/ package root exported only for require in node ESM file`.
  - `yields 91022 w/ literal dynamic import of unexported subpath in node CommonJS file` (`COMMONJS`).
  - `yields message listing exported subpaths nearest first w/ unexported subpath`: the exact message; more than five
    keys, so the cap and the order are both asserted; a `null` key is not listed.
  - *(pin)* `yields nothing w/ development-only export and customConditions in node ESM file`.
  - *(pin)* `yields nothing w/ exported subpath in node ESM file`, including a `"./*"` pattern match.
  - *(pin)* `yields nothing w/ unexported subpath in bundler ESM file`.
- 91023:
  - `yields 91023 w/ extensionless subpath of package without exports in node ESM file`: hint `"npkg/sub.js"`.
  - `yields 91023 w/ directory subpath of package without exports in node ESM file`: `sub/index.js` **and** `sub.js`
    present, hint `"npkg/sub/index.js"`. Catches file-before-directory.
  - `yields 91023 w/ subpath with trailing slash in node ESM file`.
  - `yields 91023 w/ directory subpath without index.js in node ESM file`: the "import a file inside the directory"
    hint.
  - *(pin)* `yields nothing w/ subpath naming existing file of package without exports in node ESM file`.
  - *(pin)* `yields nothing w/ subpath naming nothing of package without exports in node ESM file`. It stays unknown.
- 91024:
  - `yields 91024 w/ specifier matching paths pattern and no package in node ESM file`: the exact message, naming the
    pattern.
  - `yields 91024 w/ specifier matching exact paths key in node ESM file`.
  - *(pin)* `yields nothing w/ self-reference to nearest package.json with name and exports in node ESM file`.
  - `yields 91024 w/ alias equal to name of package.json beyond the nearest one`. Catches searching past the package
    scope.
  - *(pin)* `yields nothing w/ hash imports specifier matching paths pattern in node ESM file` (`#x` with a `"#x"`
    paths key).
  - *(pin)* `yields nothing w/ uninstalled package matching no paths pattern in node ESM file`.
  - *(pin)* `yields nothing w/ paths alias in bundler ESM file`.
- Dependencies: `reports probed files to onDependency w/ unexported subpath`, including the probes the
  91023 / self-reference checks add.

`packages/core/src/compiler/esm/check-esm-imports.spec.ts`:

- `yields 91022 w/ unexported subpath in node ESM output` through `checkEsm`, so `importContext` wiring is covered.
- *(pin)* `yields nothing w/ development-only export and customConditions in compilerOptions in node ESM output`.
  Catches a field that is declared but not passed through.

`packages/compiler/src/bin.test.ts`: put the cases with the ESM cases, after
`should exit with zero status w/ import of directory with package.json module field in bundler profile` (`:1072`),
not at the end of the file. Use the `node_modules` fixture pattern of the bare JSON case (`:988-1013`), with
`// @ts-nocheck` sources where TypeScript would reject the import.

- `should exit with status 1 and report 91022 in emitted file w/ import of unexported package subpath in node ESM profile`.
- `should exit with status 1 and report 91023 in emitted file w/ extensionless package subpath in node ESM profile`.
- `should exit with status 1 and report 91024 in emitted file w/ tsconfig paths alias in node ESM profile`: `paths`
  in the profile's `tsConfig`. This also proves the `Compiler.ts` wiring.
- `should exit with zero status w/ import of exported package subpath in node ESM profile`.
- `should exit with zero status w/ package self-reference in node ESM profile`: the nearest `package.json` to the
  output carries `name` and `"exports"`.
- `should exit with zero status w/ symlinked workspace package matching paths alias in node ESM profile`.
- Added by this brief, beyond the plan's list: `should exit with zero status w/ development-only export and
  customConditions in node ESM profile`. It needs `module` / `moduleResolution` `nodenext` (TS5098 otherwise). It is
  the only end-to-end proof that `customConditions` reaches the rule.
- Run each emitted fixture on Node 24 (`$HOME/.nvm/versions/node/v24.21.0/bin/node`) once by hand, and record in the
  PR that the failing ones throw the expected error codes and the passing ones load.

No webpack e2e: the loader does not run this rule.

Documentation:

- **`packages/compiler/README.md`, ESM check section** (`:135-293`):
  - three table rows for 91022–91024: `node` error, the three `bundler` columns "allowed";
  - in the paragraph at `:214-216`, replace "Of the bare specifiers … only 91013 checks any" with the new scope;
  - add a paragraph on each code's trigger and its silences: `customConditions` for 91022; `#imports`,
    self-reference and symlinked workspace packages for 91024; CLI only and `node` only;
  - keep the "When the check cannot decide … `--debug` lists the import" paragraph (`:262-263`) true: an uninstalled
    package, and a subpath naming nothing, still land there.
- **`packages/webpack/README.md`**, the loader code table (`:157-160`): add `| 91022, 91023, 91024 | never; webpack
  resolves bare specifiers |`, so the table stays complete.
- **`Release-Notes.md`, `## [Unreleased]`, `### Changed`:** extend the existing "Builds that passed 0.10.x may now
  fail. The ESM check now reports these imports…" list. Do not add a second entry. Add one bullet per code (91022,
  91023, 91024: under `node`, CLI only, the Node error each prevents), and keep the closing escapes sentence true for
  them. `### Added` stays `TBA`.

Gates, all green:

- `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`.
- `pnpm license:add` for any new source file (this slice should need none). Never add a file to the `license:check`
  list.

Repo mechanics:

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin`. Homebrew's pnpm 11 fails with E401.
- Install with `--offline`; the Artifactory login in `~/.npmrc` has expired. Never edit `~/.npmrc`. For a registry
  package, use an empty `NPM_CONFIG_USERCONFIG` file plus `--config.registry=https://registry.npmjs.org/`. This slice
  needs no new dependency: `resolve.exports` is already a dependency of core.
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

- `packages/core/src/compiler/esm/import-rules.ts` (the new rule, codes, context field, shared cache lookup).
- `cjs-names.ts`: the structured resolution outcome only. 91020/91021 behaviour unchanged.
- `check-esm.ts`: the `EsmCheckContext` field and the `importContext` line.
- `Compiler.ts`: filling that field in `checkEsmOutput` (`:871-905`) only.
- The specs `import-rules.spec.ts`, `cjs-names.spec.ts`, `check-esm-imports.spec.ts`.
- The new cases in `packages/compiler/src/bin.test.ts`.
- The ESM sections of `packages/compiler/README.md` and `packages/webpack/README.md`, the `Release-Notes.md` entry,
  and this branch's line in the plan.

Not this branch: `packages/webpack/src/TsCompiler.ts` and `NODE_IMPORT_RULES`; `scan-module.ts`, `scopes.ts`,
`classify-module.ts`; the attribution / nested-check code in `Compiler.ts` (#167, merged).

The other branches starting now, each one's files checked against its plan on `develop`:

- `bug/emit-skipped-rule` (`docs/plans/2026-10-02-cli-error-exit-gaps.md`, #136):
  - It changes `Compiler.ts` (the language-service branches near `:1201-1203` / `:1256-1258` and the fast path near
    `:1414`), `Compiler.spec.ts`, `bin.test.ts` (or `packages/compiler-test`) and `Release-Notes.md`.
  - **Real collisions: `Compiler.ts`, `bin.test.ts`, `Release-Notes.md` `### Changed`.**
  - In `Compiler.ts` the hunks are far apart (`checkEsmOutput` vs the emit paths), so expect a clean textual merge,
    but rebase and re-run the gates if it merges first.
  - In `bin.test.ts`, keep your cases inside the ESM block, not at the end of the file.
  - In `Release-Notes.md`, it adds its own entry under `### Changed`, likely beside the "Builds that passed before
    can now fail: the `websmith` command reports errors…" paragraph. You extend the separate ESM bullet. The second
    to merge resolves the conflict.
- `bug/depends-closure-core` (`docs/plans/2026-10-02-loader-options-once.md`, #134):
  - It changes `ResolvedCompilerOptions.ts`, `config/resolve-compiler-config.ts`, `addons/AddonRegistry.ts`,
    `packages/webpack/src/WebpackAddonService.ts` and their specs.
  - No behaviour change and no Release-Notes entry. No collision.
- `infra/typescript-6-ci-leg` (`docs/plans/2026-10-02-typescript-6-support.md`, #144):
  - It changes `.github/workflows/pull-request.yml` only; the TypeScript override is set in the 6.0.3 CI cell, not
    committed.
  - No file collision. Its advisory TypeScript 6.0.3 cell will run your tests, though:
    - do not rely on `baseUrl` in the `paths` fixtures, which TypeScript 6 deprecates; `paths` without `baseUrl`
      resolve relative to the tsconfig;
    - check that the `customConditions` e2e uses a `moduleResolution` both 5.7.3 and 6.0.3 accept (`nodenext`).

If you find something the plan did not anticipate, report it in the PR rather than improvising outside scope. Three
examples:

- A catch-all `paths` key `"*"`: as specified, it would turn every uninstalled bare import into 91024, which
  contradicts "a package that is not installed stays unknown". Report it before you choose a behaviour.
- A subpath that `"exports"` maps to a file that does not exist (Node: `ERR_MODULE_NOT_FOUND`). The plan does not
  cover it; leave it unknown.
- A self-reference whose subpath the package's own `"exports"` does not export (Node: `ERR_PACKAGE_PATH_NOT_EXPORTED`).
  It is not 91024, and the plan does not say whether it is 91022.
