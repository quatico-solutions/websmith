<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Panel: tsc-option-parity

- **Subject:** `docs/plans/2026-10-02-tsc-option-parity.md` (Draft, branch `idea/tsc-option-parity`, PR #135)
- **Date:** 2026-10-02
- **Commitment:** `Verdict: proceed | amend | reject`
- **Jurors:** TypeScript 6/7 roadmap, TypeScript compiler semantics, upgrade impact for existing users
- **Gate:** `plot-panel.mjs check` — all three committed; `reconcile` → **unanimous: amend**

## Process notes

- The jurors ran on Sonnet and wrote their own verdict files (`ts7-roadmap.md`, `tsc-semantics.md`,
  `upgrade-impact.md`); the moderator changed nothing in them. All three files pass the gate.
- The moderator re-ran `check` and `reconcile` on the files as committed: unanimous `amend`.
- **What each juror looked at:**
  - *tsc semantics* **executed** the most: built `origin/develop`, ran the CLI next to `tsc` 5.7.3, **simulated slice 2**
    (deleted the spread and `esModuleInterop: false` from the bundled defaults) and diffed output trees for nodenext,
    node16, commonjs, esnext+bundler, preserve, none and `-o`; probed `ts.convertCompilerOptionsFromJson`,
    `getEmitScriptTarget`, `getESModuleInterop`.
  - *TS 6/7 roadmap* **read** the story and `analysis-ts7-api-gap.md`, and ran `node -e` probes on 5.7.3 (enum reverse
    maps, which helpers exist, `typescript.d.ts` contents).
  - *Upgrade impact* **read** the plan, code, `Release-Notes.md` and qs-magellan's configs (read-only), and ran the two
    helper probes; it did not run a websmith build.
- The moderator verified `defaults.ts:9-21` on `origin/develop` (spread of `getDefaultCompilerOptions()`,
  `esModuleInterop: false`, `strict: false`).

## Where the jurors converge

| Finding | Jurors | Evidence |
|---------|--------|----------|
| Slice 3 trap: `ts.ScriptTarget[99]` is `"Latest"`, not `"ESNext"`; a reverse-mapped `scriptTargetToString` emits `latest`, which `--target` rejects. Unit case for 99/100 required | roadmap, semantics (both probed) | 5.7.3: `Latest` declared after `ESNext`; same reverse lookup already prints `Latest` at `Compiler.ts:802` |
| Keep `jsx: Preserve` as an explicit, documented websmith default; slice 2 removes only `target` and `esModuleInterop` | all three | `getDefaultCompilerOptions()` is `{ target: 1, jsx: 1 }` (probed) |
| Breaking note under `### Changed` with `**Breaking:**`, as for 0.10.0 | all three | `Release-Notes.md:76,79,101` |
| Slice 2's output equals `tsc` once the two defaults are removed | semantics (executed: byte-identical trees for seven `module` settings), upgrade (helper probes) | — |
| The changelog's "uses the same defaults as `tsc`" holds only for target / interop on 5.x; TS 6 moves the defaults again, so websmith output follows the installed TypeScript | roadmap, upgrade | `analysis-ts7-api-gap.md` section 3 |
| `convertEnumOptions` is shared with #134; agree the home and keep the conversion idempotent | all three | `resolve-compiler-config.ts:81` |

## Where they differ — named, not averaged

1. **What dropping `jsx` would do.** Upgrade impact (read) says a `.tsx` build would **fail** with "Cannot use JSX
   unless the '--jsx' flag is provided". tsc semantics (executed) found it **does not fail**: websmith emitted `a.js`
   containing raw `<div />`, exit 0, no diagnostic. Both recommend keeping `Preserve`, so the remedy agrees; the
   *reason* in the plan's Open Point ("can turn a passing build into a failing one") is the read claim and is wrong by
   the executed one. The worse outcome — silently invalid output — is what the plan should state.
2. **Use TypeScript's helpers or own them.** The plan's design names `ts.getEmitScriptTarget` / `ts.getESModuleInterop`.
   The roadmap juror shows both are **absent from `typescript.d.ts`** (runtime-only, internal) and from the TS 7
   surface, and wants a websmith-owned helper written "to be deleted" under TS 6. The semantics juror probed the same
   functions to establish `tsc`'s behaviour and accepts switching the fallbacks to them. This is a real choice between
   parity-by-calling-internals and parity-by-copying-rules; the plan must make it.
3. **Who is affected by slice 2.** The plan says "only node16 / nodenext". Upgrade impact shows `module: preserve` also
   flips (`getESModuleInterop` true; `allowSyntheticDefaultImports` true), and that `useDefineForClassFields` changes
   class-field semantics from ES2022 — the most likely *runtime* break, missing from the Breaking note. The semantics
   juror's simulation covered `preserve` and found output identical to `tsc` — which confirms it changes relative to
   today. Not contradictory; the plan's affected set is wrong.
4. **Slice 1 scope.** Only the semantics juror executed the conversion and found three defects: the existing
   `lib.es2022.d.ts` workaround becomes a 6046 error (not idempotent); converting every string array silently rewrites
   `rootDirs` / `typeRoots` with `basePath ""`; and `tsc` keeps valid `lib` entries on a bad one, while the plan drops the
   option. Undisputed.
5. **A third ES5 fallback.** Only upgrade impact found `Compiler.ts:802` (`target ?? "ES5"`) and `:798`
   (`getEmittedModuleKind`) reading `target`, missing from the slice 2 audit.

## Shared blind spot

All three jurors judged parity on **emitted output**. The semantics juror noted, and moved past, that websmith
reported **no diagnostic for a plain type error** in its fixture (exit 0) — and `tsc-parity` on the #136 panel
independently reproduced the same: on the default CLI path type errors are not reported at all. A plan named "match
`tsc`" whose jurors all saw `tsc` and websmith disagree on whether a project *has errors* did not ask whether that
is in scope. It probably belongs to #136 or its own plan, but this plan's abstract should not imply broader parity
than options and defaults.

## Cross-plan conflicts

- **#134 `loader-options-once`** changes `convertEnumOptions` (location, reporter, inline profiles) in the same
  function slice 1 extends. Decide the home and the order; make the conversion idempotent (accept `lib.*.d.ts`
  entries) because the loader may convert twice.
- **TS 6/7 story:** slice 2 removes two of the story's "Candidate slice" hits (`esModuleInterop: false`, implied
  `target: ES5`) and slice 3 part of a third. Edit the story's candidate-slice list in this plan's PR set, not "once
  this plan lands", or both claim them. Under C (websmith-owned options in `packages/api`) any helper added here moves
  with `ts.CompilerOptions`; keep it free of `ts.System`.
- **#136 `cli-error-exit-gaps`:** this plan does **not** claim `-p <directory>` (checked: no mention of `--project`,
  directories or TS505x). #136 owns it; its conditional sentence can go. #136's option-diagnostics slice should run
  after this plan's defaults slice, since a changed default `target` can surface new TS5xxx combinations.

## What the plan needs before approval

1. **Slice 1:** accept `lib.*.d.ts` entries (idempotent), restrict array conversion to `lib` (or use the config
   directory as `basePath`), keep valid entries on a bad name as `tsc` does; changelog line that unknown names are now
   errors.
2. **Decide the helper:** websmith-owned effective-target / interop helper (recommended by the TS 7 lens) or the
   internal `ts.*` functions with that cost recorded.
3. **Correct the affected set and Breaking note:** include `module: preserve`; add `useDefineForClassFields` and lib
   defaults; migration hint covers both keys plus `useDefineForClassFields: false` and the profile route; one line that
   unset options now follow the installed TypeScript's defaults.
4. **Extend the slice 2 audit** to `Compiler.ts:798` / `:802` with a unit test for an `esm` profile with unset
   `target`; e2e covers node16, nodenext and one unchanged `module`.
5. **Close `jsx`:** keep `Preserve` explicitly, with the executed reason (silently invalid output otherwise).
6. **Slice 3:** unit case `99 → esnext` (and the `moduleKindToString` aliases).
7. **Update the TS 7 story's candidate slice** in this plan's PR set; state the release (minor with a breaking
   change under 0.x).

Nothing here is acted on by the panel. The plan author amends; `/challenge-the-plan` or `/plot-approve` follows.
