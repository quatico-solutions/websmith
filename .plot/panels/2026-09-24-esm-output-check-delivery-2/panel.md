<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Delivery panel, round 2: esm-output-check

- **Subject:** `docs/plans/2026-09-24-esm-output-check.md`. Evidence: PRs #115, #119–#123 and #125–#129 on develop
  `3de39b1`. Round 1 is in `.plot/panels/2026-09-24-esm-output-check-delivery/`.
- **Date:** 2026-10-01. **Lenses:** deliverable, behaviour, changelog.
- **Gate:** `Position` is divided: deliverable and changelog `supported`, behaviour `refuted`. `Evidence` is
  `executed` for all three.
- **Note:** the board auto-delivered the plan at 12:32, 31 s after #129 merged and while this panel was running.
  The delivery was rejected back to Approved (`d918c70`) because of this panel's findings.

## What each juror looked at

- **deliverable:** read the plan's deliverables against the Wave 5 diffs (#126–#129) and relied on round 1's
  per-hunk mapping for the earlier PRs. Ran all four Definition of Done targets on a clean copy of `3de39b1`, the
  watch e2e under CPU load three times, and 13 CLI probes.
- **behaviour:** built a clean copy and ran 19 Wave 5 behaviours and 22 round 1 behaviours against CLI and webpack
  fixtures, including the loader with a broken profile selected. Did not run the full suites.
- **changelog:** mapped the plan's `## Changelog`, `Release-Notes.md` `[Unreleased]` and both READMEs to the diffs in
  both directions. Ran 13 CLI fixtures and the relevant webpack and compiler e2e suites.

## Findings

The jurors do not disagree on any fact. They differ on whether the loader finding is in the plan's scope: only
the behaviour juror ran the loader with a broken profile selected, and the other two did not look there.

- **Loader config errors print 2–5 times and do not fail the build** (behaviour, executed). With a broken profile
  selected, each config error goes to the console once per loader call, and webpack exits 0. The ESM check also
  skips that profile, so the build passes silently. This contradicts § Failure semantics ("an 'error' that cannot
  fail a build is only coloured text") and the "reported once at config resolution" rule for an `esm` that
  contradicts `module`. Round 1 did not test it, so it is not a regression.
- **A syntax error is hidden by a declaration emit error in the same file** (changelog, executed). On the per-file
  declaration path, `program.emit` skips the emit when declaration diagnostics exist, and `Compiler.ts` then drops
  the syntactic diagnostics. `tsc` prints both. The build still exits 1. This narrows the Release Notes'
  "Fixed: syntax errors are reported … in per-file declaration programs".
- **`packages/webpack/README.md` still names only `transpileOnly: false`** among the syntax errors that fail the
  build (changelog, read). #129 made them fail under `transpileOnly: true` too.
- **`packages/compiler/README.md` says "The webpack loader is not checked yet"** (behaviour, read). It is out of
  date since #125.
- **A TypeScript option error prints once per emitted file on the fast path** (deliverable, executed). TS5070
  printed 3 times for 3 files. This is new from #129: `report()` dedupes only diagnostics that carry a file.
- **`--profile x` also prints `Custom profile configuration "x" found, but no profile provided.`** (all three).
  This predates the plan and is already a story follow-up.

Supported by all lenses that looked:
- the source file in diagnostics (#127): CLI, watch, declaration path and loader;
- fast-path, transpileOnly, nodenext and per-file declaration syntax errors failing the build (#129);
- config validation scoped to the selected profile and printed once in the CLI (#128);
- stable watch e2e under load (#126);
- every round 1 behaviour, with no regressions;
- the reworded Changelog line on the loader;
- all four Definition of Done targets on `3de39b1`.

## Verdict

Not delivered as planned. Decided in-session on 2026-10-01, fix all of these before delivery:

- `bug/declaration-emit-hides-syntax-errors`:
  - the syntax error hidden by a declaration emit error;
  - both READMEs;
  - option errors printed once per file;
  - the misleading profile warning.
- `bug/loader-config-errors-fail-build`: the loader reports config errors once through `this.emitError`, so the
  build fails.
