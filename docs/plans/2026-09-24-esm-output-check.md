<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# ESM compatibility check for client output

> A profile that targets ESM gets a compile-time diagnostic when its emitted JavaScript would fail to load as ESM.

## Status

- **State:** Approved
- **Type:** feature
- **Story:** node24-esm-support
- **Review:** pr
- **Impl:** own branches
- **Rounds:** 7
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->
- **Approved:** 2026-09-25, Jan Wloka, plan-PR #112 merged
- **Started:** 2026-09-25, Jan Wloka, `feature/cli-exit-and-written-set`

## Changelog

- New per-profile `esm` option: `{ "runtime": "node" | "bundler", "check": "error" | "warn" | "off", "ignore": string[] }`. A
  profile with `esm` gets compile-time diagnostics when its emitted JavaScript is not ESM compatible,
  including code that addons generate.
- `websmith` now exits with a non-zero code when a compilation reports an error-level diagnostic, including
  existing TypeScript errors that previously only printed. The webpack loader fails the build for them.

## Motivation

Most websmith clients get generated code through addons, and that code now has to run as ESM. Today a client
build can succeed and fail at runtime: websmith reports only what TypeScript checks, and TypeScript checks
nothing on transformer output (produced during emit, in every mode), nothing semantic in `transpileOnly` or
the `transpileModule` fast path (`Compiler.ts:597-604`), only syntax on the language-service path
(`Compiler.ts:968`, `984`), and Node's ESM rules only under `module: node16/nodenext`. See story
`node24-esm-support`, Phase 2b and Key Findings.

## Design

### Decided (story `node24-esm-support`, Jan Wloka, 2026-09-24)

- "ESM compatible" is configured **per profile**, as an explicit key; a profile without it gets no ESM check
  (backwards compatible).
- A failed check is an **error** by default; the profile can set `warn` or `off`.
- Three rule sources: (1) websmith's check on the **emitted JavaScript**, on every compilation path;
  (2) TypeScript's `node16`/`nodenext` diagnostics where a Program exists; (3) output format and
  `.cjs`/`.mjs` naming vs the nearest `package.json` `"type"`.
- Scope: **only emitted files** — exactly what is written to disk. Today that is *not* what
  `ResultProcessor`s receive: under `addonEmitOnly`, `processOutput` returns every output file whether or not
  it wrote it (`Compiler.ts:789-799`), and the list also carries `.d.ts` and `.map` files. `processOutput`
  therefore returns an explicit **written set**, and the check parses only the `.js` / `.mjs` / `.cjs` files in
  it. `ResultProcessor`s keep receiving today's list, so this plan changes no addon-visible behaviour there.
  JavaScript files that result processors create are checked too.
- **Failure semantics:** an error-level diagnostic fails the build. The CLI exits non-zero whenever an
  error-level diagnostic was reported (today `compiler.compile()` ignores its `EmitResult`,
  `packages/compiler/src/command.ts:169`, so nothing fails); the loader reports through the per-call
  `this.emitError`, not the no-op `error` option or the cached `loaderContext` (`TsCompiler.ts:30-32`). This
  applies to every error-level diagnostic, not only ESM ones — a deliberate behaviour change, called out in
  the changelog, because an "error" that cannot fail a build is only coloured text.

### Approach

- **Module classification** follows the runtime the profile targets, since that is what decides whether the
  output loads. For `runtime: "node"`, a file is ESM or CommonJS the way Node decides it: extension first
  (`.mjs` / `.cjs`), then the nearest `package.json` `"type"`, then Node's syntax detection; a missing
  `"type"` is a warning, not an error, because Node still runs the file (measured on Node 20.19 and 24 by the
  panel). For `runtime: "bundler"`, the classification is webpack's module type for the resource —
  `javascript/esm` for `.mjs` and for `.js` under `"type": "module"`, `javascript/auto` otherwise. Every rule
  below keys off this classification rather than off `tsConfig.module`, which says what TypeScript emitted,
  not how it will be loaded.
- **Parsing:** each JavaScript output is parsed once with `ts.createSourceFile`, and a websmith-owned scope walk
  decides whether `require`, `module`, `exports`, `__dirname` and `__filename` are *free* identifiers. The
  walk is what keeps the standard ESM migration pattern (`const require = createRequire(import.meta.url)`)
  from being flagged. References guarded by `typeof` — the UMD pattern
  `typeof require !== "undefined" ? require(…) : …` — are exempt too: under ESM the guard is false, so the code
  runs. This reuses the TypeScript dependency websmith already has and keeps the cost to one
  parse per file; the price is coupling to the TypeScript 5 API, which the `ts7-rearchitecture` story has to
  port with everything else (`analysis-ts7-api-gap.md`). The scope walk is kept behind a small interface so a
  JS parser can replace `ts.createSourceFile` without touching the rules. Rejected: a TypeScript Program over
  the JS output (binder for free, but a second Program per profile and deeper `ts.*` coupling) and an
  independent parser such as acorn or oxc (no TypeScript coupling, but a new dependency and a second AST
  model next to the one addons already use).

- **Config:** add `esm?: { runtime: "node" | "bundler"; check?: "error" | "warn" | "off"; ignore?: string[] }` to
  `CompilationProfile` (`packages/api/src/config/CompilationProfile.ts`), validated in
  `resolve-compiler-config.ts` next to the `depends` check (`:91-94`). `esm` is **not inherited** through
  `depends`: each profile declares its own, as it does its `tsConfig`, so a `client` profile that depends on
  `server` is not failed by `server`'s output. A profile whose `esm` contradicts its `tsConfig.module` (for
  example `module: CommonJS`) is a **configuration error** reported once at config resolution, naming both
  settings — not an error on every emitted file, and not a silent override of `module`. `ignore` takes glob
  patterns for deliberate exceptions such as a hand-written `.cjs` shim; matching files are skipped and listed
  in `--debug` output, so an exemption is never silent and never forces the whole profile to `warn` or
  `off`. The key is `esm` (rejected: `moduleCheck`, and a broader `output` block that would claim more
  contract than this plan builds).
- **Where it runs:** the check is one function over output files — roughly
  `checkEsm(files, profileEsm, context) → Diagnostic[]` — so every caller shares it instead of each path
  re-implementing a call site. Its diagnostics are added to the result's diagnostics with a location in the
  emitted file, so `report()` does not drop them (`Compiler.ts:600`, `:626-633`).

  | Path | v1 | Call site |
  |------|----|-----------|
  | CLI `compile()`: full compilation, `transpileOnly`, `transpileModule` fast path, per-file declaration Programs | covered | `Compiler.emitResult`, after the file loop and before `ResultProcessor`s (`Compiler.ts:620-640`) |
  | CLI `watch()` | covered | per fragment in `emitSourceFile` / `processOutput`, because `watch()` bypasses `emitResult` (`Compiler.ts:195-215`, `:668-678`) |
  | webpack dependent profiles (written to disk next to the target) | covered | `TsCompiler.build` (`TsCompiler.ts:78-89`) |
  | webpack target profile (the fragment handed to webpack) | covered | `TsCompiler.build` (`TsCompiler.ts:97`); reported through the per-call `this.emitError` / `this.emitWarning` in `loader.ts` |
  | JavaScript written by `ResultProcessor`s | CLI only | `ctx.getSystem().writeFile` is wrapped around the `ResultProcessor` loop (`Compiler.ts:640-645`); JavaScript written through it is checked |
  | Files addons write with `fs` directly | not covered | invisible to websmith; documented for addon authors |
- **Emitted-JS rules** (parse the output, not the source). The `bundler` rules key on webpack's module type,
  because that is where webpack's own behaviour splits: in `javascript/auto` it accepts `require` and
  `__dirname` inside ES modules, in `javascript/esm` it rejects them and enforces fully specified imports
  (both measured by the panel on webpack 5.97.1). A single strict `bundler` column would flag code that runs
  today; a single lenient one would miss the `fullySpecified` failures.

  | Rule | `node` | `bundler`, `javascript/esm` | `bundler`, `javascript/auto` |
  |------|--------|-----------------------------|------------------------------|
  | free `require`, `module`, `exports`, `__dirname`, `__filename` in ESM output | error | error | allowed |
  | ESM syntax mixed with `module.exports =` / `exports.x =` | error | error | error (builds, then throws at runtime) |
  | relative import without an explicit extension | error | error (`fullySpecified`) | allowed |
  | relative import that does not resolve to a written or existing file | error | CLI only | CLI only |
  | default import from a CommonJS module that sets `__esModule` | error (binds the whole `module.exports`) | error | allowed (webpack interop returns `default`) |
  | JSON import without `with { type: "json" }` | error (`ERR_IMPORT_ATTRIBUTE_MISSING`) | allowed | allowed |
  | named import that the CommonJS package does not export | error | allowed | allowed |
  | top-level `await` in output classified as CommonJS | error | error | error |

  The default-import rule targets the most likely silent breakage in generated code: the same
  `import def from "pkg"` yields an object under Node and strict webpack and a function under webpack's auto
  mode (measured by the panel). It lives in `esm-check-cjs-names` with the named-import rule, because both need
  the same bare-specifier resolution and CommonJS export detection (`cjs-module-lexer` also reports
  `__esModule`); one slice builds that machinery instead of two parallel ones.

  The relative-import rules inspect static imports, re-exports (`export … from`) and dynamic `import()` with a
  string literal; a non-literal `import()` cannot be resolved statically and is skipped. A relative import of a
  **directory** (`./utils` for `utils/index.js`) gets its own code and fix hint, separate from a missing
  extension: Node fails it with `ERR_UNSUPPORTED_DIR_IMPORT`, and the fix is `./utils/index.js`, not
  `./utils.js`.

  **In the webpack loader the resolution rule does not run.** The loader is synchronous (`loader.ts:21-35`) and
  webpack resolves every import itself, failing the build for one it cannot resolve; a second resolver in the
  loader would disagree with webpack's aliases, extensions and `fullySpecified` handling. The CLI keeps the
  rule, resolving against the written set and the file system. Rejected: converting the loader to async to
  call `this.getResolve()`, which changes the loader contract, the compilation queue and caching for one rule.

  **Named-import detection uses Node's own `cjs-module-lexer`** on the resolved CommonJS entry, following
  `__exportStar(require(...))` re-exports the way Node does. Judging by `"type"` or `exports` alone would flag
  nearly every TypeScript-compiled CommonJS dependency, which Node imports by name without trouble (measured
  by the panel). The lexer becomes a direct dependency of `core` (today it is only transitive); the rule gets
  its own slice.

  **Not in v1:** bare-specifier subpaths that a package's `exports` map does not allow, directory and
  extensionless subpaths without one, and tsconfig `paths` aliases left in emitted specifiers. They are real
  runtime failures under Node, but each needs package resolution that v1 does not build; the story tracks them.
- **Package rules:** output format vs the nearest `package.json` `"type"`; `.mjs` must contain ESM, `.cjs`
  CommonJS.
- **TypeScript rules:** surface `node16`/`nodenext` diagnostics that already exist (e.g. TS2835, relative
  import needs an extension) and attribute them to the ESM check. They are **best-effort**: TypeScript reports
  them only when a full Program is built, which happens only when an addon needs type information
  (`Compiler.ts:167`); the per-file declaration Programs return emit diagnostics only (`:1001-1040`). The
  emitted-JS check is the guarantee on every path, and the documentation says so, so nobody relies on TS2835
  in fast-path builds. Rejected: forcing a Program for every `esm` profile, which would give up the
  `transpileModule` fast path for all of them.
- **Diagnostics** carry what an addon author needs to act without reproducing the build: the source file, the
  emitted file and position, the construct, a stable code per rule, and a one-line fix hint (for example
  *"use `import.meta.url` with `fileURLToPath` instead of `__dirname`"*). They name the addon that introduced
  the construct: `registerTransformer` is extended to record the registering addon, as processors, generators
  and result processors already are (`CompilationContext.ts:229-259`). When exactly one of the profile's
  addons changed the file, the diagnostic names it; otherwise it lists the profile's active addons. Today the
  context only records *that* a file was changed (`addonProcessedFiles` is a set of paths,
  `CompilationContext.ts:50`), so attribution needs **per-addon tracking**: which addon changed each file —
  processors by comparing content per processor, generators through `addInputFile` / `addVirtualFile`, and
  transformers by wrapping each `TransformerFactory` at registration with its addon name: the wrapper records the
  file when the returned `SourceFile` is not the input node (TypeScript returns the same node when a transformer
  changed nothing). That needs no extra emit; a transformer that rebuilds nodes without a real change is
  over-attributed, but no changing transformer is missed. Rejected: re-emitting once per transformer addon when
  a diagnostic is found (exact, but N emits per failing file), and attributing every transformer addon
  (imprecise). Each rule has a **stable numeric code in the range 91000–91099** (all websmith diagnostics
  use `code: 0` today; `ts.Diagnostic.code` is a number, and 91xxx stays clear of TypeScript's own codes),
  documented in the README.
- **Performance budget:** the check may add at most **10% wall time** to a webpack watch rebuild, measured on
  a large fixture before the webpack slice merges. It stays inside that by parsing each output once, caching
  results by fragment version plus a hash of the output, memoizing `package.json` lookups per build, and
  running no file-system resolution in the loader. In the loader, every external file a rule reads
  (`package.json`, a CommonJS entry for the lexer) is registered with `this.addDependency`, so editing
  `"type"` re-checks the affected modules in watch mode.

## Slices

Wave 1 lands the two pipeline fixes the check depends on and that are useful without it — and it carries the
CLI's behaviour change in a PR of its own. Wave 2 fixes the check's interface, so the rule slices and the
loader build on it rather than rework it. The webpack slice comes last because it runs the rules the other
slices add.

### Wave 1

- `feature/cli-exit-and-written-set` — non-zero CLI exit on error-level diagnostics, and an explicit written set returned by `processOutput` (`ResultProcessor`s keep today's list) → #115 <!-- builds: CLI exit code on errors and the processOutput written set -->

### Wave 2

- `feature/esm-check-core` — `esm` profile option and validation (incl. `esm` vs `tsConfig.module`, no `depends` inheritance, `ignore`), module classification, shared `checkEsm` with located diagnostics and codes 91000–91099, free-identifier CommonJS rules (typeof-guarded uses exempt) and the ESM/`module.exports` mixing rule, wired into `compile()` <!-- builds: esm profile option and the shared checkEsm function -->

### Wave 3

- `feature/esm-check-coverage` — `watch()` and `ResultProcessor` write coverage, per-addon attribution (which addon changed each file, transformer registrations tagged) <!-- builds: ESM check coverage for watch and ResultProcessor writes, per-addon attribution -->
- `feature/esm-check-imports` — relative-import rules (missing extension, directory import, unresolved; static imports, re-exports and literal `import()`; CLI only for resolution), JSON import attributes <!-- builds: ESM relative-import and JSON-attribute rules -->
- `feature/esm-check-cjs-names` — bare-specifier resolution to a package's CommonJS entry and `cjs-module-lexer`, for two rules: named imports the package does not export, and default imports from a module that sets `__esModule` <!-- builds: cjs-module-lexer named-export and default-import checks -->
- `feature/esm-check-package-type` — output format and `.cjs`/`.mjs` naming vs `package.json` `"type"`, best-effort TypeScript `nodenext` diagnostics <!-- builds: package type consistency rules -->

### Wave 4

- `feature/esm-check-webpack` — the check for the loader's target and dependent profiles, reporting via `this.emitError`/`this.emitWarning`, `addDependency` for every file a rule reads, `.mjs`/`.cjs` output in `processResultAndFinish`, and the ≤10% watch-rebuild performance gate <!-- builds: ESM check in websmith-loader -->

## Definition of Done

<!-- From ## Plot Config in AGENTS.md; mirrors .github/workflows/pull-request.yml -->

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`

## Notes

<!-- Session log, decisions, links -->
