<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Delivery panel — Changelog lens — 2026-10-02-esm-check-precision

Position: supported
Evidence: executed

## Verdict

The plan's `## Changelog`, the `## [Unreleased]` entries in `Release-Notes.md` and the ESM check sections of
`packages/compiler/README.md` / `packages/webpack/README.md` describe what the four merged PRs do. Every emitted
message I produced with the CLI matches its documented wording and scope. The mismatches found are omissions or
plan-Design drift that the shipped docs already state correctly; none is a material misdescription.

## Deliverables (refutation attempted for each)

| # | Item | PR | Status | Evidence |
|---|------|----|--------|----------|
| 1 | UMD `typeof` guard covers all five CommonJS names | #145 | Done | `scan-module.ts:41,174-188` (`COMMONJS_NAMES` passed to `testsTypeof`/`readsDefined`); unit + CLI e2e `bin.test.ts:924`; webpack e2e `webpack-esm-check.test.ts:169,178`; Release-Notes.md:95-98 |
| 2 | 91021 ignores shadowing locals | #145 | Done | new `scopes.ts` (includes catch clauses, :71); e2e `bin.test.ts:961`, webpack :189; README "Only references to the import binding count" |
| 3 | Per-runtime specifier resolution; 91010/91013 on resolved path | #145 | Done | `import-rules.ts` `resolveNodeSpecifier`/`resolveBundlerSpecifier`, 91013 tests `resolveImport(...).resolved`; e2e `bin.test.ts:995,1020`, webpack :206. Executed: `./d.json?v=1` -> ESM91013 |
| 4 | 91013 for bare JSON under `node` | #160 | Done | `checkJsonImportAttribute` + `importsPackageJson`; e2e `bin.test.ts:1044`, webpack :216. Executed: `jpkg/d.json` -> ESM91013 |
| 5 | 91010–91013 on `import()` in CommonJS under `node` | #160 | Done | `selectImports` (`kind === "commonjs" && runtime === "node" && cur.dynamic`); e2e `bin.test.ts:~1071`, webpack `.cts` case. Executed: `dyn.cjs` `import("./b")` -> ESM91010 |
| 6 | Directory heuristic under `bundler`/`javascript/auto` (CLI only) | #160 | Done | `checkUnresolvedImport` `entryless-directory` branch; e2e `bin.test.ts:1103,1128`. Executed: `./dir` -> ESM91012 with the planned heuristic message; `./d2` with `module` field passes |
| 7 | In-place transformer edits documented, not detected | #167 | Done | `CompilationContext.spec.ts:623-647` (four in-place APIs); README sentence "such an edit cannot introduce an ESM finding"; e2e `bin.test.ts:760` |
| 8 | Attribution fallback kept, decision recorded in story | #167 | Done | story `STORY-node24-esm-support.md` slice-3 entry "Plan vs. brief on attribution fallback: closed, the implementation stays" |
| 9 | Nested compile checked once | #167 | Done | `esm-check-registry.ts` (`collectEsmChecks`/`recordEsmCheck`), `Compiler.spec.ts`, e2e `bin.test.ts:714` |
| 10 | 91022/91023/91024, CLI only, `node` only | #173 | Done | `checkPackageSubpath` in `IMPORT_RULES` only (not `NODE_IMPORT_RULES`, `TsCompiler.ts:46`); e2e `bin.test.ts:1154,1182,1206,1263,1297`. Executed: all three codes emitted |

## Mismatches found (none material)

1. `docs/plans/2026-10-02-esm-check-precision.md:40-41` (Changelog) and `Release-Notes.md:55-58` say `import()` in a
   CommonJS file gets 91010–91013; the code also runs 91022–91024 on it (`import-rules.ts:172-190`, `selectImports`).
   Executed: `dyn.cjs` with `import("epkg/internal.js")` and `import("@app/l")` got ESM91022 and ESM91024.
   `packages/compiler/README.md:202` documents it correctly, and the general 91022–91024 bullets in Release-Notes
   (lines 62-70) are not restricted to ES modules, so this is an under-statement, not a false claim.
2. Plan Design `:202` specifies the 91022 message with "conditions node, import, default"; the code emits
   "node, import, module-sync, default" (`cjs-names.ts:73`). README `:272` matches the code. Plan Design only.
3. Plan Design `:188` and Open Points say two copies of `@quatico/websmith-core` "fall back to today's double check";
   the code shares the registry via `globalThis[Symbol.for("@quatico/websmith-core/esm-check")]`
   (`esm-check-registry.ts:20`), and Release-Notes.md:119 and README:311 claim cross-copy dedup — docs match code;
   the plan's Design is stale, its Changelog is silent on it. Not executed (would need two core installs).
4. Release-Notes.md:59-61 (91012 directory bullet) omits that the rule is a heuristic and its escape, which the plan
   Changelog and README:227-230 state; the general escape sentence follows at Release-Notes.md:72-73. Minor.

## Executed vs. read

Executed (worktree of origin/develop 584666a2, Node 22.17.0, `pnpm install --frozen-lockfile --offline`, `pnpm build`
exit 0):
- `node packages/compiler/lib/bin.js --configFile websmith.config.json --profile client` on a `node` fixture, exit 1:
  - `ESM91013: JSON import "./d.json?v=1" has no import attribute, which Node requires; add: with { type: "json" }`
  - `ESM91013: JSON import "jpkg/d.json" has no import attribute, which Node requires; add: with { type: "json" }`
  - `ESM91022: "epkg/internal.js" is not exported by package "epkg" for conditions node, import, module-sync, default; exported subpaths: "./feature", "."`
  - `ESM91023: package import "npkg/sub" names a directory of package "npkg", which ES modules cannot import; import the file: "npkg/sub/index.js"`
  - `ESM91024: "@app/l" matches the tsconfig "paths" pattern "@app/*", which TypeScript does not rewrite in emitted code; rewrite it with a transformer addon or a build tool, or use a package "imports" entry`
  - `ESM91010: relative import "./b" has no file extension, which ES modules require; add the extension: "./b.js"` (in `dist/dyn.cjs`)
- Same CLI on a `bundler` fixture, exit 1, only:
  `ESM91012: relative import "./dir" names a directory with no index file and no package.json entry; if your webpack config sets `resolve.mainFiles` or `resolve.mainFields`, use `esm.ignore` or `check: "warn"`` (`./d2` with `"module"` passed).
- `dyn.cjs` with bare `import()` -> ESM91022 and ESM91024 (mismatch 1).

Read only: the plan; `git diff <merge>^1 <merge>` stats and the code/docs on origin/develop for all four PRs;
`esm-check-registry.ts`, `import-rules.ts`, `scan-module.ts`, `scopes.ts`, `TsCompiler.ts:46,372`; unit/e2e test
names; the story entry. I did not run the unit, e2e or webpack suites, nor the nested-compile or in-place-transformer
paths (items 7–9 rest on reading).
