<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Delivery panel: esm-output-check

- **Subject:** `docs/plans/2026-09-24-esm-output-check.md`. Evidence: PRs #115, #119–#123 and #125 (the slices),
  plus #124 (the related nodenext fix), on develop `ce7627f`.
- **Date:** 2026-09-30. **Lenses:** deliverable, behaviour, changelog.
- **Gate:** `Position` is unanimously `refuted`. `Evidence`: deliverable `executed`, behaviour `executed`,
  changelog `read`.

## What each juror looked at

- **deliverable:** read the plan's 25 deliverables against the merged diffs and the briefs' amendments. Made a clean
  clone of develop, then built and ran core (760), webpack (130), compiler (146) and the webpack ESM e2e (11).
  Ran 3 CLI probes.
- **behaviour:** took a fresh `git archive` of develop, built it, and ran about 30 behaviours against fixture
  projects: CLI rules and exit codes, `check: "warn"`, `ignore`, `depends`, result-processor writes, webpack-cli
  errors attached to modules, `.mts`, bundler classification, and CLI and webpack watch.
- **changelog:** mapped the plan's `## Changelog` and `Release-Notes.md` `[Unreleased]` to diff hunks in both
  directions. Ran the webpack and core unit tests; the CLI e2e could not run locally against a current build.

## Findings

The panel is unanimous in position but refutes on three different points; no juror disputes another's finding.

- **Diagnostics do not name the source file** (deliverable). The plan's § Diagnostics promised it and the
  addon-author juror asked for it; no decision dropped it. **Not delivered.**
- **Config errors print twice, and one bad profile fails every run** (behaviour). The duplicate print was already
  recorded as a follow-up on 2026-09-25. The whole-config validation is new.
- **Fast-path syntax errors are dropped** (behaviour). This predates the plan, but it undercuts § Failure
  semantics: the broken output is written and the CLI exits 0.
- **The plan's Changelog overstates the loader** (changelog). "The webpack loader fails the build for them" implies
  TypeScript type errors; the loader reports only syntax, declaration-emit and ESM diagnostics.
  `Release-Notes.md` is accurate.
- **Webpack watch e2e tests are timing-flaky under CPU load** (behaviour). CI is green.

Supported by all lenses that looked:
- the CLI rules 91001–91033 and their levels;
- exit codes for the errors that are reported;
- the loader's per-module reporting and bundler classification;
- `.mts`/`.cts`;
- attribution;
- watch coverage;
- the performance gate, judged on the check's own cost.

## Verdict

Not delivered as planned. Decided in-session on 2026-09-30:
- **Fix before re-delivery (wave 5):**
  - the source file in diagnostics;
  - fast-path syntax errors;
  - config validation scoped to the selected profile and printed once;
  - stable watch e2e tests.
- **Reword:** the plan's Changelog line on the loader.

The premature delivery commit (`8ff1444`) was rejected back to Approved.
