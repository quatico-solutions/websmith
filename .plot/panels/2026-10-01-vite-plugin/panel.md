<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Panel: vite-plugin

- **Subject:** `docs/plans/2026-10-01-vite-plugin.md` (Draft, branch `idea/vite-plugin`, PR #132)
- **Date:** 2026-10-02
- **Commitment:** `Verdict: proceed | amend | reject`
- **Jurors:** addon author / Vite user, compiler pipeline, Vite plugin API and dev-server internals
- **Gate:** `plot-panel.mjs check` — all three committed; `reconcile` → **unanimous: amend**

## Process notes

- The jurors ran on Sonnet and wrote their own verdict files (`addon-author.md`, `compiler-pipeline.md`,
  `vite-internals.md`); the moderator saved nothing on their behalf and changed nothing in them. All three files pass
  the gate.
- The moderator re-ran `check` and `reconcile` on the files as committed: unanimous `amend`.
- **What each juror looked at:** all three only **read** — the plan, the loader sources on `origin/develop`
  (`TsCompiler`, `loader`, `compiler-instances`, `WebpackAddonService`, `WebpackAddonContext`), the TS 7 story and
  the sibling plans. Nobody built anything or ran Vite. The addon author also read Magellan's addons (read-only); the
  compiler juror read the old `feature/60--plugin-for-vite` adapter. The Vite juror states that its Vite facts
  (Vite 5–8 hook names, `hotUpdate` vs `handleHotUpdate`, `transform` filter form) come from knowledge and were not
  re-checked on the web; two are marked "verify".
- The moderator verified two load-bearing reads on `origin/develop`: `TsCompiler.ts:25` is a value import
  `import { type LoaderContext, WebpackError } from "webpack"`, and the loader package is named `websmith-loader`
  (unscoped, `packages/webpack/package.json:2`), not `@quatico/websmith-loader` as the plan's Open Point says.

## Where the jurors converge

| Finding | Jurors | Evidence |
|---------|--------|----------|
| The seam is decidable by reading: "depend on the loader" drags webpack into every Vite project, so a bundler-neutral per-module compiler in core is the only option; the tracer should not build both | all three | `TsCompiler.ts:25` value import of `webpack`; `WebpackAddonService.ts:14`, `WebpackAddonContext.ts:20`; `webpack` is a peer of the loader |
| The core extraction is its own first slice (loader migrated onto it, existing webpack unit and e2e tests as the guard); the Tracer is too big otherwise | all three | — |
| An addon-facing `AddonContext` for Vite is undefined: `addVirtualFile`, `removeOutputFile`, `addInputFile`, `addAssetDependency` need a mapping or a loud error | all three | `WebpackAddonContext.ts` ~L105-215 (`emitAsset`, `Compilation`) |
| "Generators and result processors once per build" has no loader behaviour to reuse; Vite must define it via hooks (`configResolved`, `buildStart`, `buildEnd`/`closeBundle`, dev-server start) | compiler, Vite | `Compiler.ts:~488-505` (generators per file); `TsCompiler.ts` `result.files.length > 0` branch fed an empty fragment |
| The ESM check needs a Vite `moduleKind` and rule set; the loader derives it from webpack module types | all three | `TsCompiler.ts:~36-41`, `NODE_IMPORT_RULES` at `:46` |
| Client vs SSR environments (Open Point 5) is core, not an edge: one compiler instance per environment, `profile` per environment | addon author, Vite | Magellan's `client` / `server` profiles; `this.environment` in `transform` |
| `enforce: "pre"` output must suit what follows: `.tsx` with non-`preserve` `jsx` hides JSX from esbuild / React Fast Refresh; esbuild still runs | addon author, Vite (compiler: CJS output guard) | — |
| TypeScript 7: in-process per-file compile is impossible on 7.x; the plan must say "TypeScript 5/6 only" | all three | `docs/stories/ts7-rearchitecture` |
| `emitFile`: decide "write to disk only" (loader parity); `emitFile` is a no-op in dev | addon author, Vite | — |
| Vite majors: 6 and 7 required; 8 (Rolldown) best-effort | addon author, Vite | Node 20.19 / 22.12 baseline |

## Where they differ — named, not averaged

1. **Addon throws.** Only the compiler juror reads that `applyAddonFunctionality` downgrades addon errors to
   warnings ("Don't break webpack builds due to addon errors", `TsCompiler.ts:425`, verified). The plan says "nothing
   is swallowed" and copies the loader's path; it cannot have both. The others did not weigh it, nobody disputes it.
   The decision is whether the extraction changes the rule **for both hosts** (a webpack behaviour change) or the
   Vite host diverges.
2. **Configuration errors in dev.** The addon author wants a `buildStart` throw (re-thrown on config change); the
   Vite juror says `this.error` in `buildStart` kills dev-server start and wants the logger plus per-module overlay in
   serve, `this.error` only in build. These are different contracts for `vite dev`; the Diagnostics slice must pick
   one per mode.
3. **Dev type-information default.** The addon author wants the default decided now (`transpileOnly: true` in dev
   for type-info-free profiles); the Vite juror wants measurement first and accepts a fallback only with a startup
   warning; the compiler juror wants the open point moved to the Dev-server slice. The disagreement is whether dev and
   build may differ silently — all three reject *silently*.
4. **Which registry.** Only the compiler juror names that the loader bypasses the core `AddonRegistry`
   (`super(..., undefined, ...)`, `TsCompiler.ts:149`) and uses `WebpackAddonService`. The extraction must pick one;
   the others assume a single registry exists.
5. **Dev-only hazards raised by one juror.** The Vite juror alone raises the write → watcher → HMR → regenerate
   loop, query-carrying ids (`?v=`, `?vue&type=script`, `\0` virtual ids) and concurrent dependent-profile writes.
   Undisputed; each needs a decision and an e2e.

## Shared blind spot

All three lenses treat the plan as **a new host for the loader's pipeline** and ask how faithfully Vite can mirror
it. None asks whether the loader's per-module shape is the right one for Vite at all: a `vite build` knows its
module graph up front and could run one Program-level compile per profile in `buildStart` and serve fragments from
it in `transform` — the CLI's shape, not the loader's. That would sidestep most of the per-module costs the jurors
inherit from #134, the dependent-profile write races and the "once per build" mapping. It may be wrong for dev
(per-request), but it was not considered.

A second: every juror names #134, #136 and #137 as edits to the same `TsCompiler.ts` and asks for ordering, but no
one asked whether the core extraction should **wait for** them or **absorb** them. Extracting first means four plans
rebase onto moved code.

## Cross-plan conflicts

- **#134 `loader-options-once`** rewrites `getCompilerInstance`, `updateLoaderConfig`, dependent-profile diagnostics
  and `webpack-hooks.ts` — the code the extraction moves. Land #134's resolve-once slice before the extraction, and
  reuse its once-per-compilation resolution (`configResolved`), do not re-implement it.
- **#137 `esm-check-precision`** changes the import rules the Vite host would run; the Vite rule set must be stated
  against #137's outcome (see that panel: the loader runs no import rules under `bundler`).
- **#136 `cli-error-exit-gaps`** changes reporter / `report()` behaviour in core that the extraction carries.
- **TS 7 story:** the Vite host is in-process and per-file; it inherits the story's limit and adds no new
  TypeScript-API coupling beyond `Compiler` in core.

## What the plan needs before approval

1. **Decide the seam:** core extraction, drop "depend on the loader" and "the tracer decides"; add
   `feature/neutral-module-compiler` as the first slice (no behaviour change, webpack suites as guard). Fix the package
   name (`websmith-loader`).
2. **Name the neutral contract and registry:** `build(file, { moduleKind })` → `{ fragment, diagnostics,
   dependencies }`, config errors separately; core `AddonRegistry` or `WebpackAddonService`.
3. **Specify a `ViteAddonContext`:** mapping for `addVirtualFile`, `removeOutputFile`, `addInputFile`,
   `addAssetDependency`; unsupported methods report an error. API note in `packages/api`.
4. **A lifecycle table** (Vite hook → websmith step) defining "once per build" for build and dev, cache invalidation in
   dev, and the addon-throw rule (fails the build, for both hosts or stated divergence).
5. **Environments:** one compiler instance per environment, `profile` per environment name; the ESM `moduleKind` and
   rule set per environment; a CJS-output guard.
6. **Dev-server rules:** `addWatchFile` from `transform`, `hotUpdate` only for non-module inputs, a write-loop guard
   with an e2e, id/query filtering with `createFilter`, config errors per mode, dev type-info policy with a visible
   warning.
7. **Close open points:** `emitFile` → disk only; Vite 6 and 7 required, 8 best-effort; "TypeScript 5/6 only" with a
   link to the TS 7 story; ordering after #134's first slice. Wire `packages/vite-test` into `pnpm test:e2e` in the
   Tracer, not in Release.

Nothing here is acted on by the panel. The plan author amends; `/challenge-the-plan` or `/plot-approve` follows.
