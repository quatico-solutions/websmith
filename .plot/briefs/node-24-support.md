<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — node-24-support

- **Plan (canonical):** `docs/plans/2026-09-24-node-24-support.md` on this branch (same-branch flow)
- **Approved:** 2026-09-25, Jan Wloka, in-session
- **Branch:** `feature/node-24-support` (base: `develop`)
- **Ends as:** one PR to `develop` carrying plan and code; the PR body links the plan and mirrors its approval
- **Review of the code:** per repo convention; CI `pull-request.yml` green on Node 22 and 24

### What to build

Configuration only: `.nvmrc` 24; `node-version` 24 in `protect-stable.yml` and `release-and-publish.yml`; a
`[22, 24]` matrix in `pull-request.yml`; `@types/node` 24.x in the eight manifests that pin 20.19.9; the first
`engines.node: ">=22.12"` in the seven published packages; a breaking entry in `Release-Notes.md` (0.10.0).

### Settled decisions — do not re-derive them

- **No source changes are expected.** The full Definition of Done passed on Node 24.21.0 with counts identical to
  Node 20.19.4, and `@types/node` 24 typechecked with 0 errors in all 9 packages (story `node24-esm-support`,
  `analysis-node24-esm.md` A.2–A.4). A failure here is a finding to report, not a reason to change code.
- **`>=22.12`, not `>=20.19` or `>=24`.** Node 20 is EOL (2026-04-30); 22 is the active LTS until 2027-04-30 and
  22.12 is where `require()` of ES modules is unflagged, which the story's ESM addon support relies on.
- **pnpm 9 in CI vs pnpm 10 locally** is settled by this PR's own CI run; the lockfile stays `lockfileVersion: '9.0'`.

### Done when

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` pass on Node 24; CI passes on 22 and 24.
- `pnpm-lock.yaml` changes only the `@types/node` specifier and version lines.

### Scope guard

Config files, manifests, lockfile, `Release-Notes.md`, the plan. No `packages/*/src` changes.
