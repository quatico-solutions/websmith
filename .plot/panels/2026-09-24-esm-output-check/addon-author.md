<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Addon author and client

**Verdict: amend.** The per-profile `esm` option is usable and the goal is right. But three of the plan's claims don't match the code, and each one decides whether an addon author gets a diagnostic they can act on.

## 1. Problem

The motivation is correct. Output from transformers is not checked today:
- `Compiler.report` skips semantic diagnostics in `transpileOnly` mode, and whenever there is no Program (`packages/core/src/compiler/Compiler.ts:596-609`).
- The language-service path returns only syntactic diagnostics (`:968`, `:984`).

The scope is narrower than the story. The story promises to check "processor, transformer and generator output" (STORY:62). Files that addons write directly with `fs` (`export-yaml-generator/export-transformer.ts:38`, `:87`) are never seen by the check, and the plan should say so.

## 2. Decisions

- Opt-in per profile, error by default, with `warn` or `off` as alternatives: this matches the story (STORY:115-117).
- **Missing: `esm` against `tsConfig.module`.** With `esm: node` and `module: CommonJS`, every emitted file fails, instead of one error that points at the config. The plan should either validate this at config time (`resolve-compiler-config.ts:91-94`) or have `esm` set `module`.
- **Missing: how each emitted file is classified as ESM or CJS.** The inputs are the file extension, the nearest `package.json` `"type"`, and `module`. Every rule depends on this classification, so it must be decided before Wave 1.
- **Open: whether `depends` inherits `esm`.** If it does, a `client` profile that depends on `server` also fails on the server's output. The key ships in Wave 1, so this has to be decided first.

## 3. Feasibility

The hook point exists: `emittedFiles` is available before result processors run (`Compiler.ts:620-646`). Three places in the code contradict the plan:
- **Attribution.** `registerTransformer` does not record which addon registered the transformer (`CompilationContext.ts:229-235`). Only processors, generators and result processors are tracked (`:238-259`). Transformers are the main source of the problem, so a diagnostic can't name the addon that caused it.
- **Files written by result processors.** They are written with the raw `ctx.getSystem().writeFile` (`emit-metadata-result-processor/addon.ts:81`). The plan gives no way to observe these writes. It needs one, for example a wrapped `System` or a diff of the output directory.
- **Webpack.** Result processors run before the output is written (`packages/webpack/src/TsCompiler.ts:84-88`). Addon failures become warnings (`:211-213`), while fragment diagnostics are reported as errors (`:99-104`). The plan must say which path the ESM check takes.

## 4. Slices

A core slice followed by parallel rule slices is a sensible cut, with two problems:
- The core slice depends on four open points: the key name, `depends` inheritance, ESM/CJS classification, and the parser. If they are not settled first, the key will change after it ships.
- The webpack slice changes the loader's error policy. That change needs a recorded decision.

## 5. Top three risks and gaps

1. **False errors under `addonEmitOnly`.** A file may import a sibling that no addon changed. That sibling is not emitted, so the import resolves to nothing and the check reports an error. The story still lists this as open (STORY:78).
2. **Diagnostics with no location.** `DiagnosticMessage` locates a problem only through a `ts.SourceFile` (`packages/api/src/diagnostic/DiagnosticMessage.ts:15-32`). Emitted JS has no source file, and the plan does not mention source maps.
3. **No escape hatch for single files.** One deliberate `.cjs` shim forces the whole profile down to `warn` or `off`.

## 6. What must change before approval

- Decide the key name, whether `depends` inherits it, and how emitted files are classified as ESM or CJS.
- Validate `esm` against `module` at config time.
- Fix attribution: either tag transformers when they are registered, or state that a diagnostic names only the profile's set of addons.
- State how files written by result processors are observed, and that direct `fs` writes are out of scope.
- Decide how the resolution rule behaves under `addonEmitOnly`.
- Define what every diagnostic contains: the source file, the emitted file, the construct, a stable code, and a hint for the fix.
- Add an `ignore` option, or give the reason there is none.
- Reconcile "error by default" with the webpack loader's policy of turning addon failures into warnings.

Verdict: amend
