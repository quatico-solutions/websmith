<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# addon author

Executed: nothing built or run. Read the plan on `origin/idea/esm-check-precision` and the cited code on
`origin/develop` (`CompilationContext.ts:412-445`, `Compiler.ts:726-783`, `check-esm.ts:~203`, the README ESM section).
The attribution items (7-9) rest on code reading in the plan too, so I could not rely on its reproductions there.

## Findings that would change the plan

1. **Item 7 should be decided as (c), not (a), and the plan should say so now.** An addon author's rule today is
   "a diagnostic that names no addon points at my source" (README, "A diagnostic that names no addon..."). The plan's own
   pre-check ("can an in-place edit introduce an ESM finding at all?") answers itself: `addSyntheticLeadingComment`
   and `setEmitFlags` only change comments and printing; they cannot add a `require`, `module`, `__dirname`, a
   specifier or a default import. A transformer that really adds code builds new nodes, and `visitEachChild` then
   returns a new SourceFile, so `output !== input` (`CompilationContext.ts:421-422`) already attributes it. Option (a)
   (before/after `emitNode` comparison over every visited node, for every transformer addon, on every file) adds
   per-build cost and a new class of misattribution, and fixes nothing that produces a finding. Leave the README
   sentence about in-place mutation as a documented, harmless gap, or word it as "has no effect on the check".
   Keep the pre-check as the slice's first commit so the decision is evidenced, not assumed.
2. **The fallback (item 8): agree with keeping the implementation.** From an author's view, listing every active addon
   on an unattributed finding makes the finding look like my fault when it is in hand-written code; "none named = my
   source" is the useful signal. Record it in the story; no code change.
3. **Nested compiles (item 9): the symbol-keyed set on the system object is fragile and the attribution result is
   incomplete.** (a) It relies on the nested `Compiler` receiving the very system object the outer
   `observeWrites` wraps; an addon that wraps or copies `ctx.getSystem()` (common when creating a nested
   `Compiler`) silently loses the mark and the file is double-checked again. Say what the slice does then, and test
   that case. (b) Skipping the outer record means the diagnostic from the nested check names only the nested
   compile's addons, never the outer result processor that ran it. For the author that is arguably right, but the
   plan should state it and the README should say a nested compile's findings are attributed by the nested profile.
   (c) Duplicates are reported twice today as two errors for one construct, so the miss cost is zero but the
   false-positive cost (double count, noisy output) is real; fine to fix, low priority.
4. **91022-91024 message text is unspecified.** Existing messages end with a fix ("use `fileURLToPath(...)`"),
   and 91010 gives a fix hint. The plan names the three conditions but no wording or hints. Require in the slice:
   91022 names the package, the subpath, and lists the exported subpaths (or the nearest) so the author can see
   what is allowed; 91023 gives the corrected specifier (`pkg/sub.js` or `pkg/sub/index.js`), like 91010; 91024
   names the matched `paths` pattern and says TypeScript does not rewrite aliases in emitted code, pointing at a
   transformer addon or a build-time tool. Without that, an addon author whose generator emits `pkg/internal.js`
   gets a code and no way to act.
5. **91024 false-positive risk for generated code.** "Matches a `paths` pattern and resolves to no package" will
   also fire when the alias is resolved by something the check cannot see: a processor/result processor that
   rewrites aliases after emit through `fs` directly (invisible to the check, so no issue) versus one writing
   through `ctx.getSystem()` (visible, checked on final content, so no issue). The real risk is an alias that matches
   a pattern but is satisfied at runtime by a Node `imports` map (`#alias`) or a workspace symlink in
   `node_modules`. Scope the rule to specifiers that cannot be resolved by `resolvePackage` from the importing
   file's directory upward, and test the workspace-symlink case. Node subpath `imports` (`#x`) must stay untouched.
6. **Cost of misses vs false positives, for the rules that touch generated code.** `check: "error"` is the default,
   so every new rule is a possible build break for an addon author who cannot change a third party's output.
   91022/91023 are certain Node failures, so keep them errors. The `import()`-in-`.cjs` rule (item 5) is also
   certain under `node`. The directory rule under `bundler` (item 6) is not certain (custom `resolve.mainFiles`,
   `resolve.extensions`) and the plan admits the extension list stays lenient; there `warn` severity, or explicit
   mention of `mainFiles` in the 91012 message, would limit damage. This is the one rule I would call riskier than
   the plan says.

## Approach / slices

- Slice order is sound; "False positives" first is right for authors, since it removes the only escapes they have
  (`esm.ignore`, `check: "warn"`). It is large (three rules, three modules, two e2e suites); acceptable because each
  item is small, but the UMD and the shadowing fix could each be a commit with its own failing test.
- "Attribution" slice mixes a decision-only item (8), a likely documentation-only item (7 per finding 1) and one
  code change (9). If 7 resolves to (c), the slice is small; fine as is.
- Tests: the plan lists a transformer addon that edits in place for the CLI e2e. If (c) is chosen, that test should
  assert the documented non-attribution, not attribution, so it still fails if someone changes the behaviour.
- Missing: an e2e with a nested compile whose system is wrapped (finding 3a), and a case where a processor addon
  (not transformer) legitimately introduces `require` in an ES module, to confirm attribution still names it after
  the UMD guard widens (the widened guard must not hide a real `require` that an addon added next to an unrelated
  `typeof module` test elsewhere in the file; the plan keeps direction rules, but add that test).

## Overlap

No duplicate of the other five plans or the TypeScript 7 story that I can see from this lens. The README ESM
section is the shared surface; the plan updates it per slice, so conflicts with other plans touching
`packages/compiler/README.md` are textual only.

## Open points

Decide before approval: item 7 (recommend (c), see finding 1), item 8 (keep, agreed), `typeof pkg` (agreed: keep
reporting, document; an author using `typeof pkg === "function"` guards on a default import really does differ
between Node and webpack). `import()` in CommonJS and subpaths under `bundler`: `node` only, agreed. Add: message
wording for 91022-91024 (finding 4) and the wrapped-system behaviour (finding 3a).

Verdict: amend
