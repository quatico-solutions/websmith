<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Node 24 support

> Develop, test and release on Node 24, and declare `engines.node: ">=22.12"` for the published packages.

## Status

- **State:** Approved
- **Type:** feature
- **Story:** node24-esm-support
- **Review:** in-session
- **Impl:** same branch
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->
- **Approved:** 2026-09-25, Jan Wloka, in-session
- **Started:** 2026-09-25, Jan Wloka, `feature/node-24-support`

## Approval

- **Assignee:** Jan Wloka

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
- `node-version: 20` → `24` in `protect-stable.yml:23` and `release-and-publish.yml:21`. `pull-request.yml`
  runs a matrix `node-version: [22, 24]`, so every PR exercises the declared `>=22.12` floor as well as the
  development version; Node 22 is supported until 2027-04-30. The stable-branch and release workflows run on
  Node 24 only.
- `@types/node` `20.19.9` → `24.x` in the root `package.json` and in `compiler`, `core`, `example-addons`,
  `node`, `webpack`, `compiler-test`, `webpack-test`; refresh `pnpm-lock.yaml`.
- `"engines": { "node": ">=22.12" }` in the published packages: `api`, `compiler`, `core`, `example-addons`,
  `node`, `testing`, `webpack` (the first `engines` fields in the repo).
- `Release-Notes.md`: a **breaking** entry under `[Unreleased]` for the new minimum Node version. It ships in
  **0.10.0** — under pre-1.0 semver a minor bump signals a breaking change — together with the CLI exit-code
  change from `esm-output-check`.
- CI uses pnpm 9 while the local Node 24 run used pnpm 10.34.1; this PR's own CI run (pnpm 9 on Node 22 and
  24) is the check, so a green PR settles it.

**Decided (in-session, Jan Wloka, 2026-09-24/25):** support `>=22.12`; PR CI tests Node 22 and 24, the other
workflows Node 24. Rejected: `>=20.19` with a `[20, 24]` matrix (Node 20 is EOL); `>=24` only (drops the active
Node 22 LTS for consumers); CI on 24 only (would leave the declared floor untested).

## Slices

### Node 24 support

- `feature/node-24-support` — Node 24 in `.nvmrc`, CI workflows and `@types/node`; `engines.node` in published packages → #114 <!-- builds: engines.node >=22.12 declaration -->

## Definition of Done

<!-- From ## Plot Config in AGENTS.md; mirrors .github/workflows/pull-request.yml -->

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`

## Notes

<!-- Session log, decisions, links -->
