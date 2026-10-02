<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# TypeScript 6/7 roadmap

Read: the plan on `origin/idea/tsc-option-parity`, the story `docs/stories/ts7-rearchitecture/STORY-ts7-rearchitecture.md`,
`analysis-ts7-api-gap.md` (sections 3, 4, 5), and the cited code on `origin/develop`. Executed: `node -e` against the
installed `typescript@5.7.3` to check enum reverse maps and which helper functions exist. Not built, not reproduced:
the plan's own reproductions were taken as stated.

## Findings that would change the plan

1. **Slice 2 relies on `ts.getEmitScriptTarget` / `ts.getESModuleInterop`, which are not public API.**
   They exist at runtime in 5.7.3 (`typeof` is `function`) but are absent from `typescript.d.ts`
   (grep finds only `convertCompilerOptionsFromJson` and `getDefaultCompilerOptions`). Using them needs a cast, adds
   two untyped symbols to the 125 that the gap analysis counts (section 1), and neither is listed in the 7.x or 7.1-dev
   surface (analysis section 4). The plan's design text ("each fallback is checked and switched to
   `ts.getEmitScriptTarget(options)`") should instead name a websmith-owned helper that derives the effective target
   from `module` (node16 gives ES2022, nodenext gives ESNext, otherwise `ScriptTarget.Latest` as today's fallbacks
   do), kept in one place so the TS 6/7 slice has a single seam. Under TS 6.0 the floating default target and
   always-on interop make most of that helper vanish; say so, so it is written to be deleted.

2. **Slice 3's "derive `scriptTargetToString` from `ts.ScriptTarget`" has a trap.** `ts.ScriptTarget[99]` is
   `"Latest"` in 5.7.3 (`Latest` is declared after `ESNext`), not `"esnext"`. The existing table
   (`parsed-command-line.ts:155-174`) emits `esnext` into CLI args; a naive reverse-map would emit `latest`, which
   `tsc` rejects. The unit test must cover 99 and 100 explicitly, or the table is not removed but narrowed. The
   `moduleKindToString` precedent right below it has the same alias exposure (`ES6`/`ES2015`, `None`) and should be
   mentioned.

3. **The TS 6.0 overlap is mis-scoped in the opposite direction from the open point's framing.** Slice 2 removes
   two of the story's listed hits (`esModuleInterop: false` at `defaults.ts:16`, the implied `target: ES5` from
   `getDefaultCompilerOptions`), which is right and independent of strategy: it helps options A, B and D (story,
   "Candidate slice"). But slice 3 removes only the ES3/ES5 rows of *target* tables; the module tables, `strict: false`
   (`defaults.ts:20`), `Classic` resolution (`AddonRegistry.ts:559`), the test env `ScriptTarget.ES5`
   (`testing/.../environment.ts:394`) stay. That split is acceptable, but the plan must edit the story's candidate
   slice itself (move the two hits to "done by tsc-option-parity") in the same PR set, not leave "update the
   candidate slice's list once this plan lands" as an open point. Otherwise the story and the plan both claim them.

4. **Slice 2 is not undone by TS 6/7, but one of its premises expires.** Under TS 6 the `tsc` defaults the plan
   matches change (strict true, floating target, interop forced on, module esnext; analysis section 3). "Match `tsc`"
   is then relative to the installed TypeScript major. Dropping the `getDefaultCompilerOptions()` spread is the
   right move (it follows whichever TS is installed); keeping `strict: false`, `allowJs: false` etc. pinned is
   correct for now but the plan's open point on `strict` should state that the TS 6 slice decides it, not this plan.
   The Changelog sentence "uses the same defaults as `tsc`" is only true for the target/interop pair on 5.x;
   word it that narrowly.

5. **Unverified TS 6 behaviour the plan touches.** Analysis section 3 leaves open whether TS 6 raises deprecation
   errors through `transpileModule`. Slice 2 changes the `transpileOnly` default target; add a note that this stays
   neutral (it removes a deprecated `ES5` default, so it can only help).

## Problem, approach, slices, overlap

- **Problem.** Items 1 to 5 are credible and consistent with the code I read: `defaults.ts:9-21` spreads
  `getDefaultCompilerOptions()` (`{target:1,jsx:1}` on 5.7.3, verified) and sets `esModuleInterop: false`;
  `TARGET_MAP` at `Compiler.ts:58-73` is an identity map used once (`:1011`); the 6046 code is defined at
  `Compiler.ts:77` and in `resolve-compiler-config.ts`. Fallbacks at `Compiler.ts:1208,1215,1285` and `system.ts:73`
  exist as cited.
- **Approach, slice 1.** `ts.convertCompilerOptionsFromJson` is public in 5.x/6.x. It is in the strategy-independent
  set; 7.1-dev offers `parseJsonConfigFileContent` instead (analysis 2.4), so the call goes in one function and is
  trivially swappable. No conflict.
- **Slices.** Order (lib, defaults, constants) is sound; slice 3 last avoids churn in files the others touch.
  Slice 2 is the largest: defaults, fallback audit, Program and `transpileOnly` e2e, webpack-test snapshots, release
  note. Acceptable as one PR only if the fallback audit is bounded to the four listed sites. Slice 3 has no
  fail-before test by design (pure refactor), but finding 2 gives it one: the `esnext`/`latest` case.
- **Overlap with the TS 7 story.** Exactly: story "Candidate slice" hits `esModuleInterop: false` default and
  ES3/ES5 tables (partly). No duplication of strategy work; no plan content depends on options A to D. The plan would
  not be undone by any of them. Interaction with C (websmith-owned options record in `packages/api`): any `lib` or
  default-target helper added here operates on `ts.CompilerOptions` and would later move with that type; keep it
  free of `ts.System`/host use.
- **Overlap with other plans.** Open point on `convertEnumOptions` shared with `loader-options-once` is real; no
  TS 7 angle.

## Open points to decide before approval

1. Replace `ts.getEmitScriptTarget`/`getESModuleInterop` with a websmith helper (finding 1). Recommend: helper.
2. Add the `Latest`/`esnext` test requirement to slice 3 (finding 2).
3. Update the story's candidate-slice list in the same plan PR or as slice 3's final commit (finding 3). Recommend the latter.
4. `jsx: Preserve`: recommend keep as a websmith default. TS 6 does not change it, and the TS 7 work has no stake;
   matching `tsc` would only break previously passing `.tsx` builds.
5. Breaking note placement: `### Changed`, as proposed. The output changes for node16/nodenext users, regardless of
   `tsc` parity.

Verdict: amend
