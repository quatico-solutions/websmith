<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Delivery panel: fix-ts-addons-esm-projects

- **Subject:** `docs/plans/2026-09-24-fix-ts-addons-esm-projects.md` · evidence: PR #116 (merged `6f40f73`), issue #111
- **Date:** 2026-09-25 · **Lenses:** deliverable, behaviour, changelog
- **Gate:** `Position` → unanimous `supported`; `Evidence` → unanimous `executed`

## What each juror looked at

- **deliverable:** read every Decided bullet against `gh pr diff 116`; ran the relevant spec and e2e cases.
- **behaviour:** built a scratch `"type": "module"` consumer with a single-file addon, a cross-addon import and a `node_modules` import, and ran the bundled CLI: exit 0, all three addons applied; ran the three CLI ESM e2e cases and the webpack `webpack-esm-consumer` suite (passing).
- **changelog:** matched `Release-Notes.md`, `README.md` and `packages/compiler/README.md` to the diff.

## Findings, none blocking

- **Partial — test location (deliverable and behaviour lenses agree):** the plan names `compiler-test` for the CLI e2e case; the three ESM cases live in `packages/compiler/src/bin.test.ts`, which runs the built CLI. The behaviour is pinned; only the location differs. Not worth moving.
- **By design:** `AddonRegistry`'s own fallback is the working directory; the CLI always passes the tsconfig directory, so CLI behaviour matches the plan. Direct API callers (e.g. `@quatico/websmith-node`) get the fallback — a possible follow-up.
- **Shared blind spot:** all runs were on macOS and Linux CI; nothing exercised Windows paths for the new cache directories.

## Verdict

Delivered as planned; one location-only partial, accepted.
