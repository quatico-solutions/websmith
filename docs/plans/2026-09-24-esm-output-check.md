<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# ESM compatibility check for client output

> A profile that targets ESM gets a compile-time diagnostic when its emitted JavaScript would fail to load as ESM.

## Status

- **State:** Draft
- **Type:** feature
- **Story:** node24-esm-support
- **Review:** pr
- **Impl:** own branches
- **Rounds:** 1
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- New per-profile `esm` option: `{ "runtime": "node" | "bundler", "check": "error" | "warn" | "off" }`. A
  profile with `esm` gets compile-time diagnostics when its emitted JavaScript is not ESM compatible,
  including code that addons generate.

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
- Scope: **only emitted files** — exactly what is written to disk, i.e. what `ResultProcessor`s receive
  under `addonEmitOnly`. JavaScript files that result processors create are checked too.

### Approach

- **Config:** add `esm?: { runtime: "node" | "bundler"; check?: "error" | "warn" | "off" }` to
  `CompilationProfile` (`packages/api/src/config/CompilationProfile.ts`), validated in
  `resolve-compiler-config.ts` next to the `depends` check (`:91-94`). Inherited through `depends`?
  (see Open Points)
- **Where it runs:** after emit, before `ResultProcessor`s (`Compiler.emitResult`, `Compiler.ts:620-640`),
  on the list of emitted files; again on JavaScript that result processors write. The webpack loader runs
  it per emitted fragment (`packages/webpack`).
- **Emitted-JS rules** (parse the output, not the source):

  | Rule | `node` | `bundler` |
  |------|--------|-----------|
  | `require(`, `module.exports`, `exports.x`, `__dirname`, `__filename` in ESM output | error | error |
  | relative import without an explicit extension | error | allowed |
  | relative import that does not resolve to an emitted or existing file | error | error |
  | named import from a CommonJS-only package | error (Node's CJS named-export limits) | allowed |
  | top-level `await` in output that is loaded as CommonJS | error | error |

- **Package rules:** output format vs the nearest `package.json` `"type"`; `.mjs` must contain ESM, `.cjs`
  CommonJS.
- **TypeScript rules:** surface `node16`/`nodenext` diagnostics that already exist (e.g. TS2835, relative
  import needs an extension) and attribute them to the ESM check.
- **Diagnostics** name the file, the construct, and the addon that produced it where known
  (`CompilationContext` tracks which addon registered each callback).

### Open Points

- [ ] Final key name and shape (`esm` vs `moduleCheck`), and whether `depends` inherits it.
- [ ] How to detect "CommonJS-only package" reliably (its `package.json` `"type"`/`exports`, or Node's own
  `cjs-module-lexer` behaviour) — needed for the named-import rule.
- [ ] Parser for emitted JavaScript: TypeScript's own (`ts.createSourceFile` on the `.js` output) vs a JS
  parser; TypeScript avoids a new dependency but ties the check to the TypeScript 7 story.
- [ ] Attribution: can the diagnostic name the transformer or processor that introduced the construct, or only
  the addon set of the profile?
- [ ] Performance budget for parsing every emitted file, especially in webpack watch builds.

## Slices

### Wave 1

- `feature/esm-check-core` — `esm` profile option, validation, check pipeline after emit, emitted-JS rules for CommonJS constructs <!-- builds: esm profile option and emitted-JS ESM check -->

### Wave 2

- `feature/esm-check-resolution` — relative-import extension and resolution rules, CJS named-import rule <!-- builds: ESM import resolution rules -->
- `feature/esm-check-package-type` — `package.json` `"type"` and `.cjs`/`.mjs` consistency, TypeScript nodenext diagnostics <!-- builds: package type consistency rules -->
- `feature/esm-check-webpack` — the check in the webpack loader, per emitted fragment <!-- builds: ESM check in websmith-loader -->

## Definition of Done

<!-- From ## Plot Config in AGENTS.md; mirrors .github/workflows/pull-request.yml -->

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`

## Notes

<!-- Session log, decisions, links -->
