<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Delivery panel — Deliverable lens — 2026-10-02-esm-check-precision

Position: supported
Evidence: read

## Method

Read the plan on `origin/develop` (Design, Open Points, Slices) and, for each slice line, `git diff <merge>^1 <merge>`
of #145 (55c9be70), #160 (c59594fc), #167 (e93d2b95), #173 (c9d69d8d). For every named unit test, CLI e2e case,
webpack e2e case, README and Release-Notes entry, I searched the diff for its absence, then confirmed the code is still
on `origin/develop` with `git grep`. Line numbers below are on `origin/develop`.

EXECUTED: only `git fetch`, `git diff --stat`, `git diff`, `git log`, `git show`, `git grep` (read-only inspection).
No build, lint, unit test or e2e run. READ: plan, the four merge diffs, the #167 commit list, the story diff.

## Per deliverable

| # | Deliverable | Verdict | Evidence |
|---|-------------|---------|----------|
| 1 | UMD guard: any CommonJS `typeof` guards all five | Done | `scan-module.ts:41` `COMMONJS_NAMES`, `:168` `isTypeofGuarded`; unit `scan-module.spec.ts:120` (guarded), `:149` (addon `require` beside unrelated `typeof module` still reported); CLI `bin.test.ts` "UMD wrapper in node ESM profile"; webpack `webpack-esm-check.test.ts:178` (node) and bundler/`javascript/esm` case; README + Release-Notes Fixed in #145 |
| 2 | 91021 ignores shadowing local (`typeof pkg` kept) | Done | new shared `scopes.ts` (#145), `cjs-names.ts`; unit `cjs-names.spec.ts:281` + param/var/sibling/let/typeof cases; CLI `bin.test.ts:961`; webpack "shadowed by local under bundler runtime and javascript/esm"; README documents `typeof pkg` |
| 3 | Per-runtime relative resolution; 91010/91013 on resolved path | Done | `import-rules.ts` (#145); unit `import-rules.spec.ts` `?v=1`, fragment, `%20`, `%2F` (`:362`), `%5C`, `a#b.js` bundler (`:384`), `./d.json?v=1` node (`:613`), hint-before-query; CLI `?v=1`/`%20` build, `d.json?v=1` -> 91013; webpack `:206`; Release-Notes "may now fail" entry |
| 4 | 91013 for bare JSON (by name and via `exports`) | Done | `import-rules.ts` (#160); unit `import-rules.spec.ts:563` exports-mapped, bare `.json`, dynamic; `check-esm-imports.spec.ts` dependency case; CLI `bin.test.ts:1044`; webpack `:216` |
| 5 | 91010-91013 on `import()` in CommonJS, node only | Done | unit `.cjs` and `type: commonjs` cases, bundler negative cases; CLI `bin.test.ts:1071` (`.cts` source emitting `.cjs`); webpack `:228` reports 91010 |
| 6 | Bundler `javascript/auto` directory heuristic, CLI only | Done | message names `resolve.mainFiles`/`mainFields` + escape at `import-rules.ts:127`; unit module-only / extensionless main / main->dir pass, empty dir `:404` fails; CLI 91012 for `./dir` and `bin.test.ts:1128` module-field passes; no loader case, as planned; README + Release-Notes |
| 7 | In-place transformer edits documented, pre-check first commit | Done | first code commit 7f2d2225 "t Pins that transformers editing nodes in place…"; `CompilationContext.spec.ts` four APIs (`:666` setTextRange) + `it.each` asserting no require/module/exports/__dirname/__filename/new specifier/default import; CLI `bin.test.ts:760` pins non-attribution; README sentence as planned |
| 8 | Fallback decision recorded in story | Done | `STORY-node24-esm-support.md` slice-3 entry (#167) "Plan vs. brief on attribution fallback: closed, the implementation stays" with rejected alternative |
| 9 | Nested compile checked once via registry | Done | `esm-check-registry.ts` + spec (8 tests); `Compiler.ts:30,769`; `Compiler.spec.ts:4471` context system, wrapped system, rewritten-after (two), no-esm, nested-addons-only; CLI `bin.test.ts:714` once. Deviation: registry on `globalThis` via `Symbol.for`, not module-held; broader than promised (also dedups across two core copies), recorded in the story and README |
| 10 | 91022/91023/91024 `checkPackageSubpath`, CLI node only | Done | `import-rules.ts:197` in `IMPORT_RULES`; `TsCompiler.ts:46` untouched; messages `:323` (exported subpaths list), `:419` (paths); unit each code + hints (`.js`, `/index.js`), `"."` require-only, customConditions silent, self-reference, `#x` (`:852`); CLI `bin.test.ts:1154` ff. three failures and four passes incl. symlinked workspace (`:1297`); no webpack e2e, as planned; Release-Notes + both READMEs |

## Minor findings (not material)

- Item 10: the "workspace symlink not reported as 91024" unit case lives in `cjs-names.spec.ts:577` at the
  `resolvePackage` layer, not as a 91024 case in `import-rules.spec.ts`; the CLI e2e at `bin.test.ts:1297` covers the
  end-to-end behaviour.
- Item 5: the CLI e2e uses a `.cts` source emitting `.cjs`, not a hand-written `.cjs` file; it exercises the same rule.
- Item 9: implementation location differs from the plan's Design (`globalThis` vs module-held) but the behaviour is a
  superset of the promise.
