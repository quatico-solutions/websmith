<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Sprint: TypeScript 7.1 adoption

> Decide, with numbers, whether websmith can run on TypeScript 7.1 for builds without transformer addons.

## Status

- **State:** Active
- **Start:** 2026-10-28
- **End:** 2026-11-04
- **Release:** 0.11.0

## Sprint Goal

**Why now.** TypeScript `7.1.0-beta` has shipped and ts-loader merged 7.1 support on 2026-10-22. The 2026-10-15
measurement decided "stay on TypeScript 6", but it timed only one-file-per-call emit; the multi-file
`getJavaScriptEmit` and `api.batch` that both 7.1 builds already have were never measured.

**The question.** Does batched emit bring 7.1 under the decision rule's speed thresholds, criterion 4 in particular
(p95 at most 3 × its own median; measured 7.6 ×)?

**Done means.** The bench re-run against `7.1.0-beta` with batched variants, the measurement report updated, and the
`ts7-rearchitecture` story recording the decision: stay on A, or plan B/D for transformer-free builds.

**Out of scope.** Shipping TypeScript 7.1 support or widening the peer range. Custom transformers (3C) are still
missing upstream, so addons with transformers stay on TypeScript 6 whatever the result.

**Release.** `0.11.0` also ships the fixes already merged (addon-rebuild-gaps, `noEmit`, asset dependencies). The
sprint's one Must Have keeps the release gate on the measurement plan, not on adoption.

### Must Have

- [x] [typescript-7-1-batched-measurement] Re-run the 7.1 bench against `7.1.0-beta` with batched emit and record the decision <!-- pr: #0, branch: docs/typescript-7-1-batched-measurement -->

### Should Have

- [x] Check custom transformers (3C) upstream on the run date: the beta's declarations, TypeScript#64709, the 7.1 release notes — not met on 2026-10-28, see section 7 of [analysis-ts71-batched-measurement.md](../stories/ts7-rearchitecture/analysis-ts71-batched-measurement.md)

### Could Have

<!-- add items here -->

### Deferred

<!-- Items moved here during sprint when they won't make the timebox -->

## Notes

### Scope Changes

<!-- - YYYY-MM-DD: Added/Deferred/Reprioritized [slug] — <reason> -->
