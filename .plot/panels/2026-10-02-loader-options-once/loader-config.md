<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Configuration and diagnostics correctness

Method: read the plan on `origin/idea/loader-options-once` and the cited code on `origin/develop`. Nothing was built
or executed; every finding below rests on reading code and the sibling plans.

## Findings that change the plan

1. **The top-level `profiles` loader option is not covered, and it is dead end to end.** `WebpackLoaderOptions.profiles`
   is still declared and documented as "Profiles configuration from loader options"
   (`packages/api/src/options/WebpackLoaderOptions.ts`). `createOptions` never destructures it
   (`packages/webpack/src/options.ts:16`) and does not return it (`:82-92`), so `getLoaderOptions` drops it
   (`loader-options.ts:59`). Even where it survives, `ResolvedCompilerOptions` only stores it in a field
   (`ResolvedCompilerOptions.ts:98`, `:154`); no code reads `getOptions().profiles`, and `config.profiles` is built from
   the config file and `config` only. The option was superseded by `profile` + `config.profiles` in `2c7aab3a`
   ("R!!") and left in the type. Net effect: a user passing `profiles` gets no error, and `profile: "x"` then fails as
   an unconfigured profile (item 7). The plan's slice 2 says "inline `config.profiles`" and slice 4 validates the
   profile name, but neither mentions `profiles`. Decide and add to slice 2 or 4: either remove the option from the
   API type (breaking, needs a Release-Notes entry) or report it as a config error ("'profiles' is not a loader option,
   use 'config.profiles'") through the #131 path. Recommend the config error plus a deprecation note in the type; no
   silent drop.
2. **Slice 2 reports to a reporter that discards it.** `getLoaderOptions` calls `createOptions(options)` with the
   default `NoReporter` (`loader-options.ts:59`, `options.ts:15`). Errors reported there never reach the loader; the
   only reporter that reaches webpack is the `ConfigErrorReporter` inside `setOptions`
   (`TsCompiler.ts:91`, `:164`), which only runs `resolveCompilationConfig` for the config file
   (`ResolvedCompilerOptions.ts:415-417`). So converting in `createOptions` converts the names but loses the "unknown
   names reported as config errors" half of the slice. Resolve Open Point 3 now: put the conversion for loader-option
   `tsConfig` and inline `config.profiles` into core's `ResolvedCompilerOptions` (before `getTsConfig`,
   `ResolvedCompilerOptions.ts:178`), where `this.reporter` is the collecting reporter. That also gives the CLI's
   `--tsConfig` JSON the same behaviour. The #131 message names `configFilePath`; for inline config there is none, so
   the plan must define the wording ("... in profile 'x' of the loader options").
3. **Slice 1 drops three per-module side effects the plan does not name.** `updateLoaderConfig` also (a) calls
   `AddonRegistry.refresh()` via `setOptions` (`Compiler.ts:328-338`; `refresh` reloads addons, `AddonRegistry.ts:182-188`),
   so editing an addon under `addonsDir` is picked up on the next rebuilt module today; (b) rebuilds the
   `WebpackAddonService` (`TsCompiler.ts:181`); (c) re-reads `tsconfig.json` through `getTsConfig`
   (`ResolvedCompilerOptions.ts:352`). The plan's re-resolve triggers are `websmith.config.json`, `tsconfig.json` and the
   options hash. Gaps: addon source edits in watch mode would silently go stale (decide: reload the addon registry in
   `thisCompilation`, which is cheap thanks to its mtime cache, or document the change); and `tsconfig.json` is not a
   webpack dependency at all (grep of `webpack-hooks.ts`, `loader.ts`, `compiler-instances.ts`, `TsCompiler.ts` finds none;
   only the config file is added, `webpack-hooks.ts:120-125`), so it never appears in `compiler.modifiedFiles`. The slice
   must register `tsconfig.json` (and, to close Open Point 1, its `extends` chain, which `ts.parseJsonConfigFileContent`
   already reports via `parsedCommandLine`'s `raw`/`extendedSourceFiles`) as file dependencies, or the trigger never fires.
   Open Point 1 should be answered "stat or register the extends chain": registering it as dependencies is the same
   cost and also covers the compiler-hooks case.
4. **Slice 1's named e2e would pass before the change.** "A watch build edits `websmith.config.json` and sees the change"
   already works on develop (per-module re-read). The failing-before test has to count resolutions, e.g. a unit test on
   `getCompilerInstance` that `setOptions` runs once for N modules, plus the benchmark gate. Name that test.
5. **Slice 4 is two changes.** The `depends` closure unification touches core behaviour shared with the CLI and
   `getSelectedProfiles` ordering: `getDependentProfiles` (`ResolvedCompilerOptions.ts:318-337`) returns a reverse-order
   array that decides the `tsConfig` merge order (`:347-349`), while `getUsedProfiles` (`resolve-compiler-config.ts:138`)
   returns an unordered `Set`, and `getAddonsWithDependencies` (`WebpackAddonService.ts:530`) yields addon order. A single
   closure must preserve both orders; a refactor that only changes ordering is a behaviour change for CLI users. Split:
   `bug/depends-closure-core` (pure refactor, characterisation tests for order, circular and missing dependencies) before
   `bug/loader-unknown-profile-error`. The cli-error-exit-gaps plan explicitly leaves the closure copies and
   `hasInvalidProfile` to this plan (its Notes), so this is the only home.
6. **Unconfigured-profile root cause is wider than the loader.** `resolveProfile` (`resolve-profile.ts:9-24`) only warns
   (a `WarnMessage`, which `ConfigErrorReporter` does not collect, `TsCompiler.ts:108`, so it prints on every
   `setOptions`, i.e. every module today) and returns the name unchecked when no config exists. The throw comes from
   `Compiler.emitSourceFile` (`Compiler.ts:571`), shared with the CLI. Turning the validation into a config error in the
   loader only (`getFragmentProfile`) leaves the CLI path to cli-error-exit-gaps; state that boundary, and make the
   validation also cover "profile given, no config file" (`resolveProfile` returns early on `!config`, and
   `getFragmentProfile` checks only `config?.profiles`).

## Checked and holds

- Item 2: `options.ts:51` spreads `tsConfig` unconverted and `:66` merges inline `config` shallowly (inline
  `config.profiles` replaces file profiles wholesale, `Object.assign`; worth one sentence in the plan, since conversion
  must run on the merged result). `convertEnumOptions` is module-private (`resolve-compiler-config.ts:81`), so
  "exported" is a real change.
- Item 5: `TsCompiler.ts:258-260` keeps only `checkLoaderOutput` of dependent fragments; `fragment.diagnostics` dropped.
  Add to slice 5: the same TypeScript error often comes from both target and dependent profile, so label and dedupe
  identical file diagnostics across profiles or users see each error twice.
- Item 6: `loader.ts:34-38` as described; `reportedConfigErrors` dedup is per compilation in `afterCompile`
  (`webpack-hooks.ts:126-136`).
- Item 8 reading is plausible: hooks only register in `getCompilerInstance` (`compiler-instances.ts:35-41`). Correctly
  marked "reproduce first".
- Removing the `NormalModule` `loader` tap (`webpack-hooks.ts:163-182`) loses nothing: it passes the whole parsed
  config file as loader options, which only fills `ResolvedCompilerOptions.profiles` (unused, finding 1).

## Slices

Order is right (resolve once first, as it unmasks cache staleness). Slice 2 collides with `tsc-option-parity` slice 1
(`bug/profile-lib-names` rewrites `convertEnumOptions` for string arrays in the same function and file); sequence slice 2
after it, or state who merges first, and make the loader path reuse the array handling so `lib: ["ES2022"]` in loader-option
`tsConfig` works too. Slice 6 (`package.json` "type") and slice 7 are correctly gated on reproduction; each of them should be
droppable without blocking the others. The vite-plugin plan reuses `TsCompiler.build`/`getCompilerInstance`; slice 1 changes
the instance contract it depends on, so slice 1 should land first.

## Open points to decide before approval

1. Top-level `profiles`: error vs remove (finding 1). Recommend config error now, removal in a later breaking release.
2. `convertEnumOptions` location: recommend core's `ResolvedCompilerOptions` (finding 2).
3. Addon reload and `tsconfig.json`/`extends` dependencies in slice 1 (finding 3).
4. Open Point 1: register the `extends` chain as dependencies rather than statting per module.
5. Open Points 2, 4, 5 can stay open until their slices start.

Verdict: amend
