<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# tsc parity

Executed: built `origin/develop` in a scratch copy (`pnpm build`), ran `node packages/compiler/bin/bin.js` and
`node_modules/.bin/tsc` (5.7.3) side by side on one fixture (`outDir`, `allowJs`, `skipLibCheck`, `types: []`,
one `src/a.ts`). Only read: items 8 and 9 (not re-run), exit code of `tsc` for watch.

## Reproduced (tsc vs websmith, exit / files written)

| Case | tsc | websmith (develop) | Plan |
|------|-----|--------------------|------|
| `-p .` | 0, writes `a.js` | 0, writes nothing | fixed, slice 1 |
| `-p missing.json` | TS5058, 1 | silent, 0 | fixed, TS5058 |
| `-p emptydir` | TS5057, 1 | silent, 0 | fixed, TS5057 |
| `-p tsconfig.json src/a.ts` | TS5042, 1, no output | no error, 0, compiles | deliberately not changed, open point 5 |
| unknown option `bogusOption` | TS5023, 2, writes `a.js` | silent, 0, writes `a.js` | fixed: report, exit 1, still emit |
| `types: ["nope"]` | TS2688, 2, writes `a.js` | silent, 0 | fixed on Program path only (see 2) |
| syntax error in `src/c.d.ts` | TS1110, 2 | silent, 0 | fixed, slice 4 |
| syntax error in `src/b.js` (allowJs) | TS1134, 2 | silent, 0 | fixed, slice 4 |
| `-c websmith.config.json` containing `{` | n/a | unhandled `SyntaxError` throw, stack | fixed, slice 1 |
| `--foo` | TS5023, 1 | TS5023, 1 | already equal |

Plan claims for items 1, 2, 4, 6, 7 hold. Note `websmith` with a malformed config that is only discovered
(not passed with `-c`) printed nothing and exited 0 in my run (the file was not picked up from the project
directory); the plan's item 4 is about the `-c` path, which I confirmed. The plan should say whether discovery
is meant to find it.

## Findings that would change the plan

1. **Exit code 1 vs 2 is stated, but its cost is not.** `tsc` exits 2 ("emitted despite errors") for every
   case above that still writes output, and 1 only when nothing is emitted (TS5058, TS5057, TS5042). The plan
   keeps 1 everywhere (open point 1) and says why for websmith, but the changelog ("reports every error `tsc`
   reports ... exits 1") and the Approach ("one rule") read as full parity. Say once, in the Changelog or
   Design, that the exit code is 1 for every failure and differs from `tsc`'s 2 for emit-despite-errors. Drop-in
   scripts that test `$? -eq 2` are the audience. Recommend: keep 1, state the difference, add a README line.
2. **`-p` with file names (TS5042) is the one silent success left in the plan's own theme.** websmith compiles
   the file list and ignores the tsconfig; `tsc` refuses with exit 1. The plan edits exactly this branch
   (`parsed-command-line.ts:74-76`) in slice 1 and still defers it. It is cheap (one `errors` entry, same
   channel as TS5058) and the same class as item 6. Recommend: decide before approval, either fix in slice 1 or
   name it as a deliberate difference in Notes (websmith has profiles driven by `-c`, so `-p x -c y files`
   may be a use someone relies on; check git history of `:76`).
3. **TS2688 is only parity on one of two paths and the plan states this only as an open point.** The Changelog
   says "reported and fail the build on every compilation path", but open point 2 accepts that the
   declaration-only path will not report global errors. Those two statements contradict. I reproduced TS2688
   missing with a type-info addon; the declaration-only path was not run. Either reword the Changelog to
   "on the Program path" or take the open point's alternative (one options-and-globals Program per profile).
   Recommend: reword, and add the e2e that pins the accepted gap so it is visible.
4. **Output layout differs from tsc for `allowJs` and is outside the plan.** With `src/b.js` and
   `allowJs`, `tsc` writes `out/a.js`, `out/b.js` (rootDir inferred as `src`); websmith writes `out/a.js` and
   `out/src/b.js`. Ran, not investigated. It is a parity bug in the same fast path slice 4 touches. Not a
   reason to block, but slice 4's e2e (syntax error in `.js`, "output unchanged") would pin the wrong layout.
   Recommend: do not assert the `.js` output path in that test; record the layout difference as a follow-up.
5. **Type errors on the default CLI path are not reported at all.** `const x: number = "s"` with no addon:
   `tsc` TS2322 exit 2; websmith printed nothing, exit 0. `docs/rules/configuration.md` calls this
   "Full compilation ... used for CLI builds" with `transpileOnly: false`, so the fast path (item 7's term)
   appears to be taken whenever no addon needs type information and no declaration is requested. If that is
   by design (no type check), the plan's headline ("reports every error `tsc` reports for the same project")
   is false by construction. Either narrow the sentence to "syntactic, option and config errors", or open a
   separate plan. Recommend: narrow the sentence in the abstract and Changelog; this does not change the slices.

## Where the plan matches or deliberately differs, and whether it says so

- Matches and states it: `-p <dir>` resolution, TS5057/TS5058, TS5023, option errors do not stop emit
  (`tsc` does emit; `noEmitOnError` exception noted), TS4094 keeps `.js`.
- Differs and states it: exit code 1 (open point 1), TS5042 (open point 5), declaration-only TS2688
  (open point 2).
- Differs and does not state it: the headline claim (finding 5), `allowJs` output layout (finding 4),
  and the contradiction in finding 3.

## Slices

Order is sound: slice 1 touches `parsed-command-line.ts` only, later slices `Compiler.ts`. Slice 1 is the largest
(four items, three files) but each item shares the "report once through the reporter" mechanism; acceptable, but
it is the first candidate to split (`-p` resolution vs. config parse error) if review drags. The tsc-option-parity
plan (#135) does not claim `-p` resolution (checked: no mention of directory or TS505x), so the Notes' conditional
sentence can be removed.

Open points to decide before approval: 1 (state, keep 1), 2 of mine above (TS5042), contradiction (finding 3).

Verdict: amend
