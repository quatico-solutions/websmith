<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# CLI user in CI scripts

Executed: built `origin/develop` in a scratch copy and ran the CLI on a small fixture. Read only: items 2, 3, 7, 8, 9 (taken from the plan's own runs).

## Problem: real, and ranked by CI damage

Confirmed by running:

- Item 6: `-p .` on a project with a syntax error in `a.ts` prints nothing and exits 0; `-p ./tsconfig.json` on the same project prints the error and exits 1. `-p missing.json` exits 0 silently. This is the worst gap: a pipeline step that is green and compiled nothing. It needs no unusual setup and looks correct to the script author. Rank 1.
- Item 1: `"bogusOption": true` in tsconfig, exit 0, no output. Rank 2 (a typo such as `strcit` silently disables a check; the build stays green).
- Item 4: malformed `websmith.config.json` with `-c` ends in an uncaught `throw err` stack trace. Exit code is a failure (the stack trace path), so CI is not fooled, only the message is poor. Rank 4. Note: without `-c` the file is not auto-loaded, so a malformed one is silently ignored in that case; the plan should say whether discovery is in scope.
- Items 2, 3, 7, 8 (file-less errors, declaration option errors, `.d.ts`/JS syntax errors, missing `.js`) are silent successes only for narrower setups (type-info addon, `declaration`, `allowJs`). Rank 3. Item 5 and 9 are noise or watch-only, not CI-relevant.

## Approach

1. Exit code 1 vs tsc's 2: keep 1. A script distinguishing "tsc-style errors but emitted" (2) from failure is rare; every other websmith failure is 1, and `0 / non-zero` is what pipelines test. Decide and document it in the Changelog and README so nobody greps for 2. Not a blocker; close the open point as "keep 1".
2. Surprise after the change: slice 1 makes builds that were green turn red (typo'd options, `-p dir`). That is the intent, but it is a behaviour break for existing pipelines on a patch/minor line. The Changelog says "before, it printed nothing and exited 0", which is good, but Release-Notes should call it out under a heading that says "builds that passed may now fail". Recommend an explicit note, and consider whether the option errors should be a warning for one release; I recommend not, since silent success is the bug.
3. Slice 1 mixes the widest bug (`-p <dir>`) with config parse errors, option errors, and the addonsDir dedupe. A regression in `-p` resolution breaks everyone; keep it reviewable. Recommend splitting `-p` directory/missing resolution (item 6) from items 1, 4, 5, or at least landing it first inside the slice.
4. Message quality: the plan specifies TS5023 text and "file and the parser's message" for config errors. Require that the messages name the file path and that a `-p` miss prints TS5058/TS5057 wording with the resolved absolute path, since CI logs are read without the working directory. Reporter output today carries a timestamp prefix and the file path; keep exactly one line per error, no stack.
5. Explicit-file plus `-p` (TS5042) left unchanged is fine.

## Slices

Order is right: widest silent success first. Tests listed would fail before (exit 0 now), e2e cases are concrete (`-p .`, `-p missing.json`, unknown option). Slice 5 (watch) is not a CI concern and has an admitted flaky e2e; it could be deferred or moved to its own plan without hurting the CLI-in-CI goal. Slice 3 (item 8, output missing under TS4094) is about emitted files, not exit codes; it fits the title loosely but is harmless.

## Overlap

- `-p <directory>` resolution: plan 135 `tsc-option-parity` may claim it (the plan itself says slice 1 drops it if so). Decide ownership before approval; item 6 is too important to be lost between two plans.
- Item 4 and `getParsedCommandLineOfConfigFile` errors touch loader behaviour shared with plan 134 `loader-options-once`; the plan already defers once-per-module to it. No duplicate code found.
- No overlap with the TypeScript 7 story seen; not examined deeply.

## Open points to decide before approval

1. Exit code: keep 1, document it.
2. Ownership of `-p <directory>`: this plan (recommend), tell 135 to drop it.
3. Whether to split item 6 into its own PR (recommend yes).
4. Release-notes wording for newly failing builds.
5. Config discovery: does a malformed auto-discovered `websmith.config.json` get reported (here, `-c` is needed to load it)?

Verdict: amend
