<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Webpack loader owner

Verdict: amend

## 1. Problem

The motivation is correct. The loader builds each file on its own through `emitSourceFile(..., writeFile, true)` (`TsCompiler.ts:143-145`, where skipCache is forced to true). It takes the transpileModule or language-service path and reports only syntactic diagnostics (`Compiler.ts:909-918`, `:980-984`). Output from webpack clients that addons transform is never checked today.

The scope is right for the CLI and too loose for webpack. "Only emitted files — exactly what is written to disk" has no clear meaning in the loader. The loader gives `fragment.files` to webpack whether or not `addonEmitOnly` would have written them (`result-handling.ts:388-405`; `processOutput` returns the files even when `shouldEmitFile` is false, `Compiler.ts:789-799`). The plan must say which files the loader scope covers: the fragment handed to webpack.

## 2. Decisions

- The decisions agree with the story (STORY Phase 2b, Decisions table rows 3-5).
- **Missing: what "bundler" means under webpack.** The table makes `require(`, `module.exports` and `__dirname` errors for `bundler`. Webpack accepts these in `javascript/auto` modules and rejects them only in strict ESM (`.mjs`, or `"type": "module"`, where webpack also enforces `fullySpecified`). A flat `bundler` rule set will report false errors in auto-mode webpack builds. The plan should decide whether bundler strictness follows webpack's module type for the resource, or whether `bundler` always means strict ESM.
- **Missing: where loader diagnostics are reported.** This must be decided before Wave 2 (see risk 1).
- The story leaves "Interaction with `addonEmitOnly` and `ResultProcessor`s" open (STORY:78). The plan settles it for the CLI only.

## 3. Feasibility

- **Wave 1 hook point.** `emitResult` (`Compiler.ts:620-640`) is never called by the loader. `TsCompiler.build` calls `emitSourceFile` directly (`TsCompiler.ts:120`). If Wave 1 puts the check inside `emitResult`, Wave 2 has to re-implement the call site. The check should be a pure function, for example `checkEsm(files: OutputFile[], profileEsm, ctx) → Diagnostic[]`, called from `emitResult` in core and from `TsCompiler.build` in the loader. The plan should say so.
- **Result processors in the loader.** Result processors for non-target profiles run once per file and receive the *source* path, not emitted files (`TsCompiler.ts:109-113`, which has a TODO admitting this). The target profile's result processors never run in the loader at all. The plan's "again on JavaScript that result processors write" cannot run per fragment. It would need a compilation-level hook (`webpack-hooks.ts`, for example `processAssets` or `afterCompile`), which the plan does not mention. Otherwise that part should be declared out of scope for webpack.
- **`.mjs`/`.cjs` output in the loader.** `processResultAndFinish` matches output with `/\.jsx?$/i` (`result-handling.ts:389-390`), so `.mjs` output is not found. A `.mts` resource fails with "No processed output found" before any package-type rule runs. The `feature/esm-check-package-type` slice assumes the loader handles these extensions, and today it does not.
- **Loader rule: relative import resolves to an emitted or existing file.** In the loader, sibling modules have not been emitted yet; they compile on demand. Resolving through webpack (`this.getResolve`) is asynchronous, but the loader is synchronous (`loader.ts:21-35`, which calls `context.callback` synchronously). Resolving through the filesystem against `.ts` sources duplicates webpack's resolver (extensions, `extensionAlias`, aliases) and will disagree with it. For `bundler`, I would drop this rule in the loader and let webpack's own resolution failure be the error.

## 4. Slices

- Wave 1 is the right first cut, provided the check is factored as a reusable function (see §3).
- `feature/esm-check-webpack` sits in Wave 2 next to the resolution and package-type slices, but it depends on both: they change what the loader has to check. Either move it to Wave 3, or cut it to "loader runs the Wave 1 rule set per fragment, with reporting and cache invalidation fixed". The later slices would then each carry their own loader wiring and tests.
- The `.mjs` regex fix (§3) should go in the webpack slice or its own prerequisite. It should not land silently inside package-type.

## 5. Top three risks

1. **Errors in the loader are silently dropped.** `TsCompiler` defaults `error` and `warn` to no-ops (`TsCompiler.ts:30-31`; `loader-options.ts` and `options.ts` supply no defaults). The only diagnostic path in `build` is `this.error(...)` (`TsCompiler.ts:122-127`). `this.loaderContext` is captured at construction and never refreshed for cached instances (`compiler-instances.ts:22-39`, `TsCompiler.ts:32`), so it points at the first module loaded. With the plan as written, an "error by default" ESM check would print nothing and never fail a webpack build. The check must report through the per-call loader context (`this.emitError` / `this.emitWarning` in `loader.ts`), and the plan must say so.
2. **Watch-mode staleness from cross-file inputs.** The loader is `cacheable()` (`loader.ts:22`), so in watch mode only changed modules are checked again. That is good for cost. But the package rules and the CJS named-import rule read files outside the module (`package.json`, `node_modules/*/package.json`). Unless the loader calls `this.addDependency` on each file it consults, editing `"type"` in `package.json` leaves stale results in both directions. Dependency registration needs to be a decided part of the webpack slice.
3. **Cost of parsing every emitted file.** The loader already recompiles every module it is invoked for (skipCache=true, `TsCompiler.ts:144`). With `addonEmitOnly` and transformers it already transpiles twice (`Compiler.ts:817-835`). One more `ts.createSourceFile` on the output is cheap next to that. The expensive parts would be filesystem resolution per import and package lookups per specifier. The plan should set a budget: a single parse, results cached by `fragment.version` plus a hash of the output, a memoized `package.json` lookup per build, and no filesystem resolution in `bundler` mode. It should also require a measurement against a large fixture before the webpack slice merges. The last open point already names this; it has to be closed before Wave 2, not left open.

## 6. What must change before approval

- Decide where the loader reports diagnostics: the per-call `this.emitError` / `this.emitWarning`, not the no-op `error`/`warn` or the stale `this.loaderContext`. Make `check: "error"` fail the webpack build.
- Specify the check as a function over `OutputFile[]` so the CLI (`emitResult`) and the loader (`TsCompiler.build`) share it. Do not embed it in `emitResult`.
- Define what `bundler` means relative to webpack's module types (auto vs strict ESM), and drop the "resolves to an existing file" rule for loader and bundler use.
- For webpack, either scope out checking result-processor output or name the webpack compilation hook that will run it.
- Add the `.mjs`/`.cjs` handling in `processResultAndFinish` to a slice explicitly.
- Require `addDependency` for every external file a rule reads, and close the performance open point before Wave 2.
- Move `feature/esm-check-webpack` after the rule slices, or narrow it as described in §4.
