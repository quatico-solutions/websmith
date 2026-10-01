<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Delivery panel, round 3: esm-output-check

- **Subject:** `docs/plans/2026-09-24-esm-output-check.md`. Evidence: a scratch merge of develop with PRs #130 and
  #131 at `7c94fea`, the code that lands. Round 2 is in `.plot/panels/2026-09-24-esm-output-check-delivery-2/`.
- **Date:** 2026-10-01. **Lenses:** deliverable, behaviour, changelog. The jurors ran on Sonnet because Opus
  subagents had reached the session limit.
- **Gate:** `Position` is unanimously `supported`. `Evidence` is `executed` for all three.
- **Note:** a first attempt at this round stopped when the disk filled (`ENOSPC`); all three jurors were rerun on
  fresh copies after space was freed.

## What each juror looked at

- **deliverable:** ran all four Definition of Done targets on a fresh copy of `7c94fea`, including the new e2e cases
  of both PRs, plus three CLI probes. Read the #130 and #131 hunks against the Wave 5 bullets and round 2's verdict.
- **behaviour:** ran 12 loader scenarios (broken, CommonJS and valid profiles, thread-loader, watch editing only
  `websmith.config.json`, `depends`, two rules, missing `configFile`), 14 CLI scenarios (TS4094 and TS9010 next to a
  syntax error, with and without `noEmitOnError`, TS5070 once also in watch, the `--profile` cases) and 5 round 2
  regression checks. Did not run the full suites.
- **changelog:** mapped the plan's `## Changelog`, the merged `Release-Notes.md` `[Unreleased]` and both READMEs to
  the hunks, and ran 8 CLI and loader cases.

## Findings

All round 2 findings are fixed, executed by at least one juror each:
- loader config errors fail the build, once each;
- a syntax error prints next to a declaration emit error;
- a TypeScript option error prints once;
- the misleading `--profile` warning is gone;
- both READMEs are accurate.

No regression was found in the round 2 behaviours, and the merged release notes read coherently.

Changelog gaps, fixed in #131 before merge (`6b87945`): the release notes' Breaking bullet on loader diagnostics
now lists configuration errors, and the plan's `## Changelog` line on the loader names them.

**What the lenses had in common.** All three ran on the same model and the same scratch state, and none executed
the documented limits: a build restored entirely from webpack's persistent cache reports no configuration errors,
and modules unchanged by a config-only watch edit keep their old output. Both are documented and predate the plan.

Observed, not counted against the plan (recorded as story follow-ups):
- an unconfigured profile name in the loader fails with a raw `Module build failed … No profile with name` stack
  trace, not the config-error format;
- `websmith -c websmith.config.json -p .` with relative paths ended silently with exit 0 in one attempt, not
  investigated;
- with `declaration: true` a TypeScript option error is not reported at all (predates the plan);
- the plan bullet says the loader reports through `this.emitError`; with compiler hooks it reports through the
  compilation's errors, with the same outcome.

## Verdict

Delivered as planned once #131 merges. Decided in-session on 2026-10-01: merge #131 and deliver.
