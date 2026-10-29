<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Delivery panel: addon-rebuild-gaps

- **Subject:** `docs/plans/2026-10-16-addon-rebuild-gaps.md` · evidence: PRs #214, #215, #216, #218 on `develop`
  at `a8844130`
- **Date:** 2026-10-27 · **Lenses:** deliverable, behaviour, changelog
- **Gate:** `Position` → **divided**: supported = deliverable; refuted = behaviour, changelog. `Evidence` →
  unanimous `executed`
- **Context:** the fleet delivered the plan on 2026-10-23 (`a88710a4`) without a panel. `/plot-deliver --verify`
  could not run in this repository (`prepare` → `tools-unavailable`: it looks for Plot's scripts in this repo's
  tree), so this panel ran by hand and books no `Verified:` record.

## What each juror looked at

- **deliverable:** mapped 21 deliverables to diff hunks and ran every unit and e2e case the plan names on a clean
  build of `develop`. Two mutations proved the tests bite: reverting the `FileCache.updateSource` fix fails 5 core
  tests; unregistering `watchChange` fails 2 of 8 `vite build --watch` cases. Did not run the 5% bench gate (#216's
  ratio 1.001 is read from the PR body only).
- **behaviour:** ran the e2e suites plus hand reproductions with **three successive edits** per host. That is what
  the e2e suites do not do; they edit once.
- **changelog:** mapped every Release-Notes, README and plan Changelog line to code, ran the targeted specs and
  suites, and probed the built `websmith` CLI against `tsc` 6.0.3 on a `noEmit` project.

## The disagreement, named

The deliverable lens is right that every promised change is in the code and covered by a passing test. The two
refutations are not about missing work. They are about what the tests do not reach:

1. **Webpack loader: an asset dependency is lost after the first rebuild (behaviour).** With the e2e's own addon
   shape (`addAssetDependency` in a processor, `transpileOnly: false`), DATA1 → DATA2 → DATA3 yields DATA2, then no
   rebuild on the third edit, and `data.txt` is gone from the module's file dependencies after the first rebuild.
   Reproduced in four tsconfig variants. `webpack-loader-resolve-once` edits once and passes. Likely in
   `WebpackAddonContext`'s dependency registration on rebuild, not in `FileCache`. **Not established whether it
   predates #214**, and Release-Notes says "The webpack loader was not affected", which is true of the stale-text
   defect but leaves this one unmentioned.
2. **CLI `noEmit`: Release-Notes.md:190 says "The `websmith` command keeps `tsc`'s meaning", and it does not
   (changelog).** Without an addon that needs type information, the CLI writes `dist/a.js` and exits 0 under
   `noEmit: true` and under `--noEmit`; `tsc` 6.0.3 writes nothing. #215 did not cause it (it did not touch the CLI's
   write decision), but the unreleased sentence is false.

The deliverable lens did not see either because both sit outside what a deliverable names: a third edit, and a host
the slice promised to leave unchanged. That is the shared blind spot of the e2e suites, not of the juror.

## Smaller findings, not blocking

- The plan's own Changelog bullet 2 says the loader kept stale `addAssetDependency` output. #214's guard test
  shows it never did. Plan record only; the user-facing entry is correct.
- Type-only dependencies reach the loader only with `declaration: true` (a Program), not with `needsTypeInfo`
  alone, as the plan's Approach read. Documented in README and Release-Notes; consistent with the loader passing
  core no AddonRegistry (already in the review follow-ups).
- The Vite plugin never reports TS5096, even where `tsc` does, so "no TS5096" in Vite rests on the core unit test.
- `ErrorTrackingReporter` failed once in a full parallel run and passed alone. Unrelated to this plan.

## For the caller

Not acted on here. The plan stays Delivered. Before the next release: reproduce both refutations, then decide
whether each is a follow-up bug (loader multi-edit dependency loss; CLI `noEmit` parity) and correct
Release-Notes.md:190 either way.
