<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Compiler pipeline

**Juror lens:** I own Compiler.ts, CompilationContext, the emit paths, addonEmitOnly and ResultProcessors.

## 1. Problem

The motivation is correct, and the citations check out against the code:
- `report()` skips semantic diagnostics when there is no Program (`Compiler.ts:595-609`).
- The language-service path returns only syntactic diagnostics (`Compiler.ts:968`, `:984`).
- Transformer output is never type-checked.

The scope is right: check the emitted JavaScript, gated per profile.

The plan does claim too much. It says the check runs on "every compilation path", but the chosen hook point sees only one of the entry paths (see 3).

## 2. Decisions

The decisions agree with each other and with the story (STORY Phase 2b, lines 60-72). Two of them rest on facts that do not hold in the code.

- **"Only emitted files, exactly what is written to disk, i.e. what ResultProcessors receive under addonEmitOnly."** These are two different sets.
  - `processOutput` writes only when `shouldEmitFile` is true (`Compiler.ts:789-792`).
  - It still returns `files: output.outputFiles` whether or not it wrote them (`:794-797`).
  - `emitResult` pushes every returned file into `emittedFiles` (`:626-628`) and hands that list to the ResultProcessors (`:639-640`).
  - So with `addonEmitOnly`, ResultProcessors receive files that were never written. The comment at `:637-638` is wrong.
  - The list also contains `.d.ts` and `.map` outputs.
  - The plan has to pick one set. "Written to disk" needs a new, explicit written-set returned by `processOutput`.
- **What "error" means.** It is decided as the default, but nothing says what it does to the build.
  - The CLI ignores the `EmitResult`: `compiler.compile()` at `compiler/src/command.ts:169` has no exit-code handling.
  - An `ErrorMessage` today does not fail `websmith` (`bin.ts` only rethrows on `process.exit`).
  - Before implementation, decide whether an ESM error makes the CLI exit non-zero and fails the webpack build (`this.error` vs `emitWarning`).
- **Attribution.** "CompilationContext tracks which addon registered each callback" is true for processors, generators and result processors (`CompilationContext.ts:237-259`). It is false for transformers: `registerTransformer` (`:229-235`) records no addon.
  - Transformers are the main source of unchecked output, so the Open Point on attribution is effectively already answered "no" unless `registerTransformer` is changed.

## 3. Feasibility (hook points)

- **CLI `compile()`.** `emitResult` (`Compiler.ts:620-644`) is the right place, between the file loop and the ResultProcessor loop. This works.
- **Watch mode is not covered.**
  - `watch()` calls `emitSourceFile` directly (`Compiler.ts:195-215`), and so does the watch callback (`:668-678`).
  - Neither goes through `emitResult`, so no check runs there (and no ResultProcessors either).
  - Either say so as a non-goal, or hook per fragment in `emitSourceFile`/`processOutput`.
- **Webpack is not "per emitted fragment" as described.** `TsCompiler.build` (`webpack/src/TsCompiler.ts:57-112`) runs two different things:
  - the dependent profiles, which are written to disk (`:82`), with ResultProcessors called on the **source path** `[filePath]` (`:87`, marked TODO);
  - the target profile, whose fragment goes to webpack (`:97`).
  - The slice must say which of these it checks. A per-fragment check cannot see the whole emitted set, so the "resolves to an emitted file" rule needs a filesystem/resolver fallback there.
- **Diagnostics get lost on two paths.**
  - (a) `emitResult` reports fragment diagnostics only when `files.length === 0` (`:626-633`). A check that appends to `fragment.diagnostics` on a file that emitted output is silently dropped.
  - (b) On the Program path, `report()` drops every diagnostic without `file` (`:600`). ESM diagnostics built with `file: undefined` (the `createDiagnostic` helper at `:1188`) vanish whenever an addon needs type info.
  - Fix: add the diagnostics to `result.diagnostics` in `emitResult`, and attach a `ts.SourceFile` for the emitted JS.
- **TypeScript rule source (2), "where a Program exists".**
  - A Program exists only when an addon needs type info (`Compiler.ts:167`).
  - The per-file declaration Programs (`:1001-1040`) return only `emitResult.diagnostics`, never the semantic ones.
  - So TS2835 appears only on the big-Program path, which ESM addons that opt into the fast path (`needsTypeInfo: false`) never take. The plan should say this is best-effort only.
- **JavaScript written by result processors.**
  - Result processors write through `ctx.getSystem().writeFile` (`example-addons/src/emit-metadata-result-processor/addon.ts:81`; `CompilationContext.ts:93`).
  - The practical hook is to wrap `writeFile` on the context's system around the loop at `Compiler.ts:640-645`.
  - Writes through direct `fs` calls stay invisible. State that limit.

## 4. Slices

- Wave 1 before wave 2 is the right order.
- `esm-check-webpack` should not run in parallel with the rule slices unless wave 1 fixes the check's interface: a pure `(outputFile, profileEsmConfig, emittedSet?) => Diagnostic[]` that can run per profile (CLI) or per fragment (loader). Otherwise the webpack slice will rework core.
- Moving "TypeScript nodenext diagnostics" into `esm-check-package-type` mixes a change to `report()` with the package rules. It reviews better as its own slice or folded into core.
- Each slice can be reviewed on its own if wave 1 includes the written-set fix and the diagnostic plumbing.

## 5. Top three risks and gaps

1. **The list of files the check sees is wrong under addonEmitOnly** (`Compiler.ts:789-797` vs `:626-640`). The check would parse files that were never written. Worse, "resolves to an emitted file" would accept an import of a compiled file that was never written, which is exactly the runtime failure this plan exists to catch.
2. **Diagnostics are lost** through the `files.length` branch (`:626-633`) and the `cur.file` filter (`:600`). Also, "error" does not fail the CLI (`command.ts:169`), so a default of error changes nothing today.
3. **"Every path" is overclaimed.** Watch mode (`:195-215`) and the webpack dependent profiles (`TsCompiler.ts:78-89`) never pass through `emitResult`, and transformer attribution does not exist (`CompilationContext.ts:229-235`).

## 6. What must change before approval

- Redefine the scope as the set actually written. Wave 1 changes `processOutput` so it returns the written files, and filters to `.js`/`.mjs`/`.cjs`.
  - Decide whether ResultProcessors keep getting today's list (a behaviour change otherwise).
- Decide what an error does: a non-zero CLI exit and a failed webpack build, or a report only.
- Add an explicit coverage table covering:
  - `compile()`: full, transpileOnly, fast path, declaration per-file Programs;
  - `watch()`;
  - the webpack target profile;
  - the webpack dependent profiles;
  - files written by result processors.
  - For each path, mark covered or not covered in v1.
- Wave 1 defines a check function that is called per fragment and works independently of the profile. It emits diagnostics carrying a `SourceFile` that are added to `result.diagnostics`, so they survive `report()`.
- Either add addon tracking to `registerTransformer`, or downgrade attribution to "the addon set of the profile". The baseline caches (`:86-96`) can tell whether a construct came from transformers, but only when `addonEmitOnly` is on.
- Mark TypeScript rule source (2) as available only on the big-Program path.

Verdict: amend
