<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Delivery panel: esm-check-precision

- **Subject:** `docs/plans/2026-10-02-esm-check-precision.md` (Delivered 2026-10-03, PR #137)
- **Evidence:** #145 (55c9be70), #160 (c59594fc), #167 (e93d2b95), #173 (c9d69d8d), checked on `origin/develop` 584666a2
- **Date:** 2026-10-13, Plot 2.26.0 `/plot-deliver` step 5 shape
- **Commitment:** `Position: supported | refuted` and `Evidence: executed | read`
- **Jurors:** Deliverable, Behaviour, Changelog (`delivery-deliverable.md`, `delivery-behaviour.md`, `delivery-changelog.md`)
- **Gate:** `plot-panel.mjs check` passed both labels for all three jurors; `reconcile` → **unanimous: supported**

The delivery panel is separate from the Draft panel in `panel.md`, which judged the plan before approval
(`amend`).

## What each juror looked at

- **Deliverable** *read* only: the four merge diffs and `git grep` on develop, one row per item, each with file:line.
  It built and ran nothing.
- **Behaviour** *executed*: built develop and ran about 25 CLI runs on 8 fixtures, 10 webpack loader runs, and
  loaded the emitted output under Node 24.21.0 for items 1–5 and 10. It did not review the diffs line by line.
- **Changelog** *executed*: built develop and ran the CLI on a `node` and a `bundler` fixture to compare emitted
  codes and messages with `Release-Notes.md`, both READMEs and the plan's `## Changelog`. It did not run the suites.

So all ten items were found in the diffs by one juror and observed at runtime by another. The two runtime jurors
wrote their own fixtures, independently of the PRs' tests.

## Agreement

All ten items are Done. No juror found a deliverable missing, a promised behaviour that does not hold, or a
documented claim of scope (CLI vs loader, `node` vs `bundler`) that the code contradicts.

## What the agreement does not cover

The three lenses share a blind spot: each judged the plan's promises, so a defect outside a promise could only
surface by accident. One did, in the Behaviour juror's fixtures:

1. **Nested compile through `ctx.getSystem()` crashes when the working directory holds a `tsconfig.json`**
   (`host.readFile is not a function`). The system handed to a result processor loses `readFile` when it is
   copied with `{...system}` (`CompilationContext.ts:116` with `parsed-command-line.ts:31` /
   `ResolvedCompilerOptions.ts:375`). The README text added by #167 (L308–309) says the direct form works; the
   e2e and the Behaviour juror's passing case use a wrapped system or a directory without a `tsconfig.json`.
   Item 9's promise (reported once) holds; the documented usage fails in the common setup. **Follow-up bug.**
2. **Loader, first build:** `import("./dir")` gets 91010 with the hint `"./dir.js"` instead of 91011 because the
   directory is not on disk yet; a second build reports 91011. ESM importers behave the same, so this predates
   item 5, and the build fails either way. Low priority.

Release notes (Changelog juror): `Release-Notes.md:55-58` says `import()` in a CommonJS file gets 91010–91013;
it also gets 91022–91024 (the compiler README says so). One-line fix. The remaining mismatches are in the frozen
plan's Design section (91022's condition list, the two-copies sentence superseded by the `globalThis` registry
decision) and need no action.

## Outcome

The delivery stands. Two follow-ups: the nested-compile `readFile` bug (with the README claim) and the
Release-Notes scope line.
