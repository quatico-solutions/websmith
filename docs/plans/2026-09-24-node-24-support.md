<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Node 24 support

> Develop, test and release on Node 24, and declare `engines.node: ">=22.12"` for the published packages.

## Status

- **State:** Draft
- **Type:** feature
- **Story:** node24-esm-support
- **Review:** in-session
- **Impl:** same branch
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- websmith is built and tested on Node 24.
- Published packages declare `engines.node: ">=22.12"`; Node 20 is no longer supported.

## Motivation

Node 24 is the active LTS; Node 20 reached end of life on 2026-04-30. The repo still pins Node 20 everywhere.
Research for the `node24-esm-support` story (`analysis-node24-esm.md`, A.2–A.4) ran the full Definition of
Done on Node 24.21.0 — build, 757 unit tests, 154 e2e tests, typecheck, lint — with results identical to
Node 20.19.4, and `@types/node` 24 typechecked with 0 errors in all 9 packages. `>=22.12` is also the floor at
which Node can `require()` ES modules, which the story's ESM addon support relies on.

## Design

### Approach

Configuration only; no source changes expected.

- `.nvmrc`: `20` → `24`.
- `node-version: 20` → `24` in `.github/workflows/pull-request.yml:20`, `protect-stable.yml:23`,
  `release-and-publish.yml:21`.
- `@types/node` `20.19.9` → `24.x` in the root `package.json` and in `compiler`, `core`, `example-addons`,
  `node`, `webpack`, `compiler-test`, `webpack-test`; refresh `pnpm-lock.yaml`.
- `"engines": { "node": ">=22.12" }` in the published packages: `api`, `compiler`, `core`, `example-addons`,
  `node`, `testing`, `webpack` (the first `engines` fields in the repo).
- `Release-Notes.md`: entry under `[Unreleased]` for the new minimum Node version.

**Decided (in-session, Jan Wloka, 2026-09-24):** support `>=22.12`; CI runs Node 24 only. Rejected:
`>=20.19` with a `[20, 24]` matrix (Node 20 is EOL); `>=24` only (drops the active Node 22 LTS for consumers).

### Open Points

- [ ] Add an optional Node 22 CI job, so the declared floor is exercised? (The analysis suggests it; the decision
  was CI on 24.)
- [ ] CI uses pnpm 9; the local Node 24 run used pnpm 10.34.1. Confirm CI passes with pnpm 9 on Node 24.
- [ ] Is the minimum-version bump a breaking change for the release version (0.9.0 → 0.10.0 vs 1.0.0)?

## Slices

- `feature/node-24-support` — Node 24 in `.nvmrc`, CI workflows and `@types/node`; `engines.node` in published packages <!-- builds: engines.node >=22.12 declaration -->

## Definition of Done

<!-- From ## Plot Config in AGENTS.md; mirrors .github/workflows/pull-request.yml -->

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`

## Notes

<!-- Session log, decisions, links -->
