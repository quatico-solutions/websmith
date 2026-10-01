<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# changelog

Lens: do the plan `## Changelog`, `Release-Notes.md` `[Unreleased]`, `packages/webpack/README.md` and `packages/compiler/README.md` describe what lands? Subject: `docs/plans/2026-09-24-esm-output-check.md`, round 3.

## Setup

- Code under review: scratch merge `7c94fea` (develop + #130 + #131). I read it in the `panel-3` worktree and did not modify it.
- Disk: 30 GiB free, above the 3 GiB threshold.
- I made my own copy with `git archive 7c94fea`. The run was `pnpm install --frozen-lockfile --offline`, then `pnpm build`, which succeeded for 9 projects.
- Scratch dirs `t1` (CLI) and `t2` (webpack loader) sit under `.../scratchpad/p3-changelog`. I trashed the copy's `node_modules` afterwards. No process I started is still running.

## Evidence

### Executed (built copy of 7c94fea)

1. **Syntax error beside a declaration emit error, CLI.** `declaration: true` with `src/a.ts` containing `export const b = ;` and a class expression with a `private` member.
   - Both errors print: "Expression expected." (3,18) and "Property 'y' of exported anonymous class type may not be private or protected." (2,14).
   - Exit code is 1.
   - SUPPORTED: the Release-Notes "Fixed" bullet and the #130 claim.
2. **Option error printed once.** Three files and the removed option `importsNotUsedAsValues` give TS5102 once, not three times. SUPPORTED. I did not test `--watch`.
3. **`--profile x` with `x` unconfigured** prints only `Missing profile: ... "x"`, with no "Custom profile configuration ... found" warning. SUPPORTED.
4. **Loader, broken selected profile.** A profile with `depends: ["nope"]` gives webpack exit 1 and one `ERROR in Unknown profile 'nope' in 'depends' of ...`. SUPPORTED.
5. **Loader, broken profile not selected.** `web` is selected and a sibling `bad` is broken. Exit is 0 with no error. SUPPORTED ("errors of profiles the build does not use are not reported").
6. **Loader, declaration and syntax errors together.** With `declaration: true`, `transpileOnly` unset or `false`, both errors are reported and exit is 1. SUPPORTED against the webpack README claim and the "Changed" bullet.
7. **Loader, `transpileOnly: true`.** The syntax error fails the build with exit 1, and the declaration error is not reported. SUPPORTED: the webpack README names `transpileOnly: false` for declaration errors and "under `transpileOnly: true` and `false`" for syntax errors.
8. **Loader, syntax error only.** Exit is 1 with `transpileOnly` both `false` and `true`. SUPPORTED.

### Read only

- The merged `[Unreleased]` in full, the plan `## Changelog`, `packages/webpack/README.md` lines 60–115 and `packages/compiler/README.md` (lines 125–140 and 250–262).
- #130 and #131 via `gh pr view`, for the claims they make.
- Not executed: thread-loader, watch-mode config edits, the persistent-cache limit and `--watch` option-error dedupe. I checked these only against the docs text and the PR bodies.

## Findings

### Claim-to-hunk map (claims to code)

- **#130, compiler README.** "The loader is not checked" is gone. `compiler/README.md:259-261` now says the webpack loader runs the check and links to the webpack README. SUPPORTED (read). The round-2 finding is fixed.
- **#130, webpack README.** Lines 77–83 list syntax errors (fast path, `transpileOnly` true and false) and declaration errors only under `transpileOnly: false`. This matches runs 6–8. SUPPORTED. The round-2 finding is fixed.
- **#131, config errors failing the loader.** The webpack README (lines 85–95) and the "Fixed" bullet match runs 4 and 5. The once-per-compilation dedupe, thread-loader and persistent-cache limits are documented. I did not run them.
- **Merged `[Unreleased]`: no duplicate or contradiction from the #130/#131 conflict.**
  - The two #131 additions appear once each. One is a single "Fixed" bullet on config errors failing loader builds. The other is the webpack-README paragraph.
  - #130's "Fixed" bullets (syntax errors beside declaration errors, option errors once, `--profile`, watch) sit before it, and the two sets do not overlap.
  - The "Fixed" bullet "Configuration errors in `websmith.config.json` are now reported only for the selected profile..." sits next to the new loader bullet. The two read consistently: the first says which profiles are checked, the second says those errors now fail loader builds.
  - The TS5053 bullet ("The webpack loader still reports them on each module") concerns TypeScript option errors. The #131 bullet concerns websmith config errors. These are different error classes. A reader could still conflate them, but nothing contradicts.

### Gaps (user-visible change to claim)

1. **Minor, wording.** Loader builds that passed before can now fail on config errors. #131 calls this out, but `Release-Notes.md` puts it under "Fixed". The "Breaking: webpack loader diagnostics now fail builds" bullet lists errors that now fail loader builds (syntax, declaration emit) and omits config errors. The information is present but not under the Breaking heading.
2. **Minor, plan `## Changelog`.** It says the loader fails for "syntax and declaration-emit errors and ESM check findings, not type errors". It does not mention websmith configuration errors, which now fail loader builds. The plan Changelog points to `Release-Notes.md` for detail, so this is a summary gap, not a false claim.
3. **Not in the docs, and I could not check it.** #130's PR body lists a known limit: with `declaration: true`, a TypeScript option error is not reported at all. It predates this branch, and neither README nor Release-Notes mention it. Documentation omission only.
4. **Looks ok.** Run 7 shows that under `transpileOnly: true` with `declaration: true`, declaration errors do not fail the loader. The README states this accurately.

I found no REFUTED claim. Every round-2 item has a supporting hunk, and the behaviours I executed match the docs.

Position: supported
Evidence: executed
