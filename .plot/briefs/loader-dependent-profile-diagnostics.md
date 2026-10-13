<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — loader-options-once (slice: Dependent-profile diagnostics)

- **Plan (canonical):** `docs/plans/2026-10-02-loader-options-once.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #134 merged
- **Branch:** `bug/loader-dependent-profile-diagnostics` (base: `develop`, at `a888e451` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** The slice line carries `<!-- waits: bug/loader-option-errors-once -->`
(`docs/plans/2026-10-02-loader-options-once.md:255`). That branch merged as #181 and added the file-less error store
this slice routes into (`takeFileLessErrors`). #188 (`bug/loader-unknown-profile-error`) merged as `a888e451` and put
its early return directly above the loop you change. So this slice can start now. No slice waits on this one.

Line numbers are from `develop` at `a888e451`. If they move, find the code by name.

### What changed on `develop` since the plan

The plan's item 5 and its slice note (`<!-- builds: dependent fragment diagnostics in TsCompiler.build -->`) predate
#174, which moved the per-module build out of the webpack `TsCompiler` into core.

| Plan says | Now on `develop` |
|---|---|
| `build` emits each dependent profile (`TsCompiler.ts:258`) and keeps only its ESM findings (`:260`); `fragment.diagnostics` is discarded | `ModuleCompiler.build`, `packages/core/src/compiler/ModuleCompiler.ts:338-412`. The dependent loop is `:366-384`: `emitSourceFile(filePath, profile, true)` at `:374`, then only `checkLoaderOutput(...)` (the ESM check) is pushed at `:376`. `fragment.diagnostics` is still dropped. |
| Only the target's `result.diagnostics` reach webpack (`:283`) | `ModuleCompiler.ts:400-403`: the target's diagnostics go through `takeFileLessErrors` and are returned in `diagnostics` (`:411`). `TsCompiler.build` (`packages/webpack/src/TsCompiler.ts:65-75`) only maps webpack's module type to `moduleKind` and calls `super.build`. |
| File-less ones go through the item-6 dedup | #181: `takeFileLessErrors` (`ModuleCompiler.ts:505-518`) moves TypeScript errors without a file (`code > 0`) into `fileLessErrors` (`:160`), keyed by `getDiagnosticKey` (`:575-577`: file name, start, code, flattened message). `getConfigErrors()` (`:215-222`) returns them; webpack's `afterCompile` reports them once per compilation, deduplicated by the formatted message (`packages/webpack/src/webpack-hooks.ts:58-68`); without hooks, `takeUnreportedConfigErrors` (`ModuleCompiler.ts:229-241`) gives each to one carrier module. The store is cleared only by `setOptions` (`:200-208`). |
| (not in the plan) | #182 added the Vite plugin, a second `ModuleCompiler` host. Its `transform` raises every error diagnostic of `build` (`packages/vite/src/plugin.ts:62-66`) and its `buildEnd` raises `getConfigErrors()` (`:82-87`). `feature/vite-plugin-diagnostics` (brief `.plot/briefs/vite-plugin-diagnostics.md`, running in parallel) leaves dependent profiles' TypeScript diagnostics to this slice and states that Vite reports whatever lands in `ModuleCompiler.build`'s result. |
| (not in the plan) | #188: `build` returns an empty result when `isProfileConfigured()` is false (`ModuleCompiler.ts:362-364`), right above the loop. |

**How profiles are labelled elsewhere today.** The ESM check names the profile in the message:
`describeOrigin` (`packages/core/src/compiler/esm/check-esm.ts:216-223`) appends `(source "…", profile "dep")`. The
CLI's `report` labels some TypeScript codes with ` (ESM check, profile "x")` through `createEsmLabel`
(`packages/core/src/compiler/Compiler.ts:705-723`), on a copy of the diagnostic. Hosts print the message:
`formatDiagnostic` (`packages/webpack/src/WebpackAddonService.ts:52-59`) is `file (line,col): message`.

**Reproduced on `a888e451`** (built loader, Node 22.17.0, TypeScript 5.7.3). The script spawns webpack with
`transpileOnly: false`, `profile: "app"`, a `configFile`, and two entries `hello.ts` and `other.ts`. `tsconfig.json`
has `target: "es2020"`, `module: "esnext"`, `strict`, `rootDir: "./src"`. "Decl error" means `hello.ts` holds
`export const C = class { private p = 1; };`, which gives TS4094 under `declaration: true`.

| Case (`websmith.config.json` profiles) | Today (exit code) | The slice must print |
|---|---|---|
| A: `app: { depends: ["dep"], tsConfig: { declaration: false, outDir: "./dist" } }`, `dep: { tsConfig: { declaration: true, outDir: "./dep-out" } }`, decl error | `compiled OK`, exit **0**. `dep-out/hello.js` is written, `dep-out/hello.d.ts` is **not** | `ERROR in ./src/hello.ts` … `src/hello.ts (1,14): Property 'p' of exported anonymous class type may not be private or protected. (profile "dep")`, exit 1 |
| A2: A under `thread-loader` (`workers: 1`) | exit **0** | the same error once, exit 1 |
| B: both profiles `declaration: true`, decl error | one error without a label, exit 1 | unchanged: **once**, without a label |
| C: no `declaration`, `export const x = ;` (syntax error in both profiles) | `Expression expected.` once (plus webpack's own `Module parse failed`), exit 1 | unchanged: **once**, without a label |
| D: `app` `module: "esnext"`, `dep` `module: "commonjs"`, both `moduleResolution: "bundler"` (TS5095 only in `dep`, file-less) | exit **0** | `ERROR in Option 'bundler' can only be used when 'module' is set to 'preserve' or to 'es2015' or later. (profile "dep")` **once** over both modules, exit 1 |
| E: `app` `depends: ["dep1", "dep2"]`, both `declaration: true`, `app` `declaration: false`, decl error | exit **0** | the error **once**, labelled `(profile "dep1")`, exit 1 |

The Vite plugin, same fixture as A (`main.ts` holds the decl error and re-exports `./b`), plugin `{ profile: "app" }`:
`vite build` **passes**, and `dep-out` holds `main.js` and `b.d.ts` but no `main.d.ts`.

**Prototype check.** The design below was applied as a throwaway patch to `ModuleCompiler.ts` and rebuilt. All six
webpack cases then printed exactly the right-hand column. `vite build` for case A failed in `transform` with
`[plugin websmith] src/main.ts: Property 'p' … may not be private or protected. (profile "dep")`. No host code
changed.

**Fixture traps** (they make a test green for the wrong reason):

- **A profile inherits the `tsConfig` of the profiles it `depends` on** (`getTsConfig`,
  `packages/core/src/compiler/options/ResolvedCompilerOptions.ts:377-381`, closure "dependencies-first"). An option set
  only on `dep` is also on `app` unless `app` overrides it. So `app` must set `declaration: false` explicitly, or the
  error is the target's own and the test passes on `develop`. In case D, `app` must set `module: "esnext"`. Each
  profile needs its own `outDir`, or the target writes into the dependent's.
- **Declaration errors need the per-file Program path:** `transpileOnly: false` and a profile `tsConfig` with
  `declaration: true` (`shouldUseTranspileModuleFastPath`, `Compiler.ts:661-670`, reads the **profile's**
  `declaration`; the per-file Program is `Compiler.ts:1312`). With an addon whose `needsTypeInfo` is not `false`, the
  language-service path (`Compiler.ts:1221-1271`) returns syntactic diagnostics only, so no declaration error is
  reported at all. The webpack `TsCompiler` passes no `AddonRegistry`, so the loader always takes the per-file path.
  Keep e2e fixtures without addons.
- **Use TS4094, not `isolatedDeclarations`.** On `develop`, `export function f() { return 1; }` under
  `isolatedDeclarations` reports **nothing**, even in the target profile alone (reproduced). TS4094 is reported. See
  "Found while writing this brief".

### The work

The plan's Design → "Dependent-profile diagnostics (item 5)" is the spec: `build` adds each dependent profile's
`fragment.diagnostics`, labelled with the profile. A diagnostic identical (file, position, code, message) to one of
the target or of another dependent is reported once. File-less ones go through the item-6 dedup.

**Where (settled here): core `ModuleCompiler.build`, not `TsCompiler.build`.** The plan's slice note names
`TsCompiler.build` because that is where the loop lived when the plan was written. Since #174 it lives in
`ModuleCompiler.build`, and `TsCompiler.build` never sees a dependent fragment. Fixing it in core gives both hosts the
fix with no host code: webpack's `reportDiagnostics` (`packages/webpack/src/loader.ts:64-79`) and `afterCompile`, and
Vite's `transform`/`buildEnd` (reproduced with the prototype). A webpack-only fix would need a new hook to expose
dependent fragments, and Vite would still pass silently.

**Label (settled here): in the message text, applied after the dedup.** Append ` (profile "<name>")` to the
diagnostic's message, on a copy, the same way `createEsmLabel` does it (`Compiler.ts:705-723`): for a string
`messageText` append to it; for a chain, append to the head's `messageText`. Do not mutate the diagnostic TypeScript
returned; TypeScript caches diagnostics per Program.

- **Why in the message.** `ts.Diagnostic` has no profile field. A separate field would need profile logic in
  webpack's `formatDiagnostic` and in Vite's new `formatDiagnostic`. The Vite brief keeps that free of profile logic.
  It is also how the ESM check already words it (`profile "dep"`).
- **Why after the dedup.** A label in the message makes the copies from two profiles differ, so a host's
  message-based dedup could not merge them. That covers webpack's `afterCompile` set and Vite's
  `partitionDiagnostics` by file/start/code/message. So `build` deduplicates on the **unlabelled** key and labels only
  what it keeps. Each host then receives one copy per module and needs no dedup of its own for this.
- **Which copy survives.** If the target reports the diagnostic, the target's copy survives, **unlabelled**. It is the
  module's own error, and the profile the user selected. Otherwise the first dependent in emit order wins
  (`getSelectedProfiles`, "dependencies-first", `ResolvedCompilerOptions.ts:347-349`), labelled with that profile.
  The ESM check's dependent diagnostics (`:376`) are already labelled and are never identical to a TypeScript
  diagnostic: leave them out of the dedup and do not label them again.

**Steps**, all in `packages/core/src/compiler/ModuleCompiler.ts`:

1. **A module-private label helper** next to the types at the top, e.g.
   `const labelWithProfile = (diagnostic: ts.Diagnostic, profile: string): ts.Diagnostic`. It returns a copy with
   ` (profile "${profile}")` appended as described above.
2. **File-less errors of dependents into the #181 store.** Give `takeFileLessErrors` (`:510`) an optional
   `dependentProfile?: string`. A file-less TypeScript error (`!file && code > 0 && category === Error`, unchanged)
   is keyed by `getDiagnosticKey` of the **unlabelled** diagnostic.
   - Without `dependentProfile` (the target), `set` it as today, so the target's copy replaces a dependent's.
   - With `dependentProfile`, store `labelWithProfile(cur, dependentProfile)` only when the key is not yet present.
     Then a later module's dependent emit does not replace the target's unlabelled copy.

   Update its doc comment (`:505-509`). File-less errors never stay on the module: N modules give one configuration
   error, not N.
3. **Collect in the loop.** In the loop (`:371-383`), after `emitSourceFile` (`:374`), keep
   `this.takeFileLessErrors(fragment.diagnostics ?? [], profile)` as `[profile, diagnostic]` pairs in a local array.
   Leave the ESM push (`:376`) and the result processors (`:378-382`) as they are.
4. **Merge after the target.** Replace `:400-403`. Take `targetDiagnostics = this.takeFileLessErrors(result.diagnostics
   ?? [])`, seed a `Set` with their `getDiagnosticKey`s, and push, in this order:
   - `targetDiagnostics`;
   - each kept dependent pair whose key is not yet in the set, adding its key, mapped through `labelWithProfile`;
   - the target's `checkLoaderOutput(...)`.

   Every category is kept (errors, warnings, messages); the hosts decide what to show (`loader.ts:75`). websmith's own
   file-less diagnostics with code 0, e.g. `Transpilation failed: …` of a dependent emit, stay on the module, labelled,
   as #181 keeps them for the target.
5. **Comments.** Update `build`'s doc comment (`:333-337`): it returns the dependent profiles' diagnostics too,
   labelled, each once. Update `getConfigErrors`' doc (`:210-214`): file-less errors of dependent profiles are labelled
   unless the target reports them too. Add a line to the class comment (`:137-145`), so host authors know they get
   dependent diagnostics with no work of their own.

The core of the prototype that produced the "must print" column, for orientation. Write your own, test-first:

```ts
const targetDiagnostics = this.takeFileLessErrors(result.diagnostics ?? []);
const reported = new Set(targetDiagnostics.map(cur => ModuleCompiler.getDiagnosticKey(cur)));
diagnostics.push(
    ...targetDiagnostics,
    ...dependentDiagnostics
        .filter(([, cur]) => { const key = ModuleCompiler.getDiagnosticKey(cur); return !reported.has(key) && !!reported.add(key); })
        .map(([profile, cur]) => labelWithProfile(cur, profile)),
    ...this.checkLoaderOutput(this.profile, filePath, result.files, moduleKind, onDependency)
);
```

No change to `packages/webpack/src` production code: `TsCompiler.build`, `loader.ts` and `webpack-hooks.ts` already
emit what `build` returns.

### Settled decisions — do not re-derive them

- **Core, not `TsCompiler`** (above). Say in the PR that this departs from the slice note's `TsCompiler.build`
  because of #174, and that the Vite plugin gets the fix too (reproduced with the prototype).
- **Label text ` (profile "<name>")`, suffix, in the message.** It matches the ESM check's `profile "dep"`. The target
  is never labelled: today's messages for single-profile builds stay byte-identical, so no existing e2e or snapshot
  changes.
- **Dedup in `build` on the unlabelled key; the target's copy wins, else the first dependent's.** Hosts keep their
  dedup and add none.
- **Severity unchanged.** A dependent's error fails the build, as the plan's Changelog says ("**Behaviour change:**
  TypeScript errors that only a dependent profile produces, e.g. a declaration-emit error, now fail the webpack
  build"). Do not turn it into a warning.
- **The CLI is unaffected.** It compiles each profile through `Compiler.compile`/`report`, not `ModuleCompiler`.

### Tests

**Unit, core: `packages/core/src/compiler/ModuleCompiler.spec.ts`**, a new
`describe("ModuleCompiler dependent profile diagnostics")` after `describe("ModuleCompiler option errors")` (`:417`).
Model the subclass on `InjectingCompiler` there (`:429-436`), but key the injection by profile, e.g.
`injected: Record<string, ts.Diagnostic[]>` added to `super.emitSourceFile(...)`'s diagnostics for `args[1]`. Use
`config: { profiles: { target: { depends: ["dep"], tsConfig: { outDir: "/dist" } }, dep: { tsConfig: { outDir: "/lib" } } } }`
with `profile: "target"`, `transpileOnly: true` and the file's `TS_CONFIG`. Each case below is red on `develop`
unless marked *guard*. Guards pin what a naive "push everything" would break.

- an error with a file injected only for `dep` → `build(...).diagnostics` messages equal
  `['<msg> (profile "dep")']`;
- the same error (same `file`, `start`, `code`, message) injected for `dep` and `target` → one diagnostic,
  unlabelled (*guard*);
- the same error injected for two dependents (`depends: ["dep1", "dep2"]`) → one, labelled `(profile "dep1")`;
- a warning injected only for `dep` → kept, labelled;
- a chained `messageText` → the head is labelled, the chain is kept, and the injected object is not mutated;
- a file-less TypeScript error (`code > 0`) only for `dep`, two files built → not in either build's diagnostics;
  `getConfigErrors()` holds it **once**, labelled;
- the same file-less error for `dep` and `target`, two files built → `getConfigErrors()` holds it once,
  **unlabelled** (*guard*: a dependent emit of the second module must not replace the target's copy);
- a websmith error with code 0 and no file only for `dep` → stays in `build`'s diagnostics, labelled;
- a real syntax error (`export const x = ;`), no injection, both profiles on the fast path → `Expression expected.`
  once, unlabelled (*guard*).

**Unit, webpack: `packages/webpack/src/TsCompiler.spec.ts`** (the plan names this file). Add a new
`describe("TsCompiler dependent profile diagnostics")` after `describe("TsCompiler not ESM profile")` (`:673`), not
inside `describe("Transpilation")` (`:95-163`), which a parallel branch edits. The declaration path reads the real
file system (the per-file Program uses `ts.createCompilerHost`), so use real temporary directories as
`describe("Transpilation")` does (`getTestDirs`, `createSource`), with a fresh `TsCompiler` per test:

- TS4094 source, `transpileOnly: false`, profiles `fragment: { depends: ["write"], tsConfig: { declaration: false } }`
  and `write: { tsConfig: { declaration: true, outDir: … } }` → `build(...).diagnostics` holds code 4094 once, its
  message ending in `(profile "write")` (fails before: empty);
- the same with `declaration: true` on both → 4094 once, unlabelled (*guard*).

Leave the shared `let testObj` of the existing `describe("Transpilation")` alone. New tests create their own
`testObj`.

**E2E, `packages/webpack-test/tests`.** Add a new file, `webpack-loader-dependent-profile-diagnostics.test.ts`. Copy
`getTestDirs`/`runWebpack`/`countOf` from `webpack-loader-unknown-profile.test.ts:14-32`, `:83-140`. Then:

- set `transpileOnly: false`;
- always pass `configFile`;
- give the runner a `threadLoader` flag;
- write `websmith.config.json` into `testDirs.PROJECT_DIR` (the default directory of `writeWebsmithConfig` is
  `test-output/`; see the #188 brief's finding).

Two entries, `hello.ts` (the error) and `other.ts`. Run each case on `develop` first; it must be red there.

- **should fail w/ declaration error only in dependent profile** (case A): exit 1;
  `countOf(output, 'may not be private or protected. (profile "dep")')` is **1**.
- **should fail w/ declaration error only in dependent profile under thread-loader** (A2): exit 1, count **1**.
- **should report declaration error once w/ error in target and dependent profile** (B): exit 1;
  `countOf(output, "may not be private or protected")` is **1**; output does not contain `(profile "dep")`. *Guard*:
  green on `develop`, red for a naive implementation. Say so in the PR.
- **should fail w/ option error once w/ option error only in dependent profile** (D): exit 1;
  `countOf(output, "(profile \"dep\")")` is **1** over two modules; the TS5095 text matched with a RegExp, since its
  wording varies across TypeScript versions.
- **should report declaration error once w/ error in two dependent profiles** (E): exit 1; count **1**, labelled
  `(profile "dep1")`.

The existing suites with `depends` stay green unchanged: `webpack-profile-config.test.ts`,
`webpack-websmith.test.ts`, `webpack-esm-check.test.ts`, `webpack-loader-unknown-profile.test.ts`. If one of them
turns red, a dependent profile there had a hidden error. Report it in the PR and fix the fixture, not the
production code.

**E2E, Vite.** Only if `feature/vite-plugin-diagnostics` merged before you open the PR: its
`packages/vite-test/tests/vite-diagnostics.test.ts` carries
`it.todo("should fail w/ declaration error in dependent profile — bug/loader-dependent-profile-diagnostics")`.
Turn that one `it.todo` into the test (the Vite reproduction above, TS4094, `app` with `declaration: false`), using
that file's helpers. It is your only edit under `packages/vite-test`. If that branch has not merged, do not touch
`packages/vite-test`; say in the PR that the todo can now be filled.

### Release notes and docs

- `Release-Notes.md`, `## [Unreleased]` (`:13`) → `### Changed` (`:19`), one bullet with the plan's prefix, e.g.:
  "**Behaviour change:** the webpack loader reports the TypeScript diagnostics of the profiles the selected `profile`
  depends on, labelled `(profile "<name>")`. Builds with an error only a dependent profile produces, e.g. a
  declaration emit error such as TS4094 in a profile with `declaration: true`, now fail; before, the dependent
  profile wrote its files and the error was dropped. An error that the target and a dependent profile both produce
  is reported once, without a label. An option error of a dependent profile, e.g. TS5095, is a configuration error,
  reported once per compilation." Leave Vite out: `@quatico/websmith-vite` is unreleased, and its notes belong to
  `docs/vite-plugin-release`.
- `packages/webpack/README.md`, the diagnostics paragraph (`:86-98`): add after the list (`:94`) that with
  `depends` the dependent profiles' diagnostics of the module are emitted too, labelled `(profile "<name>")`, and
  that one the target or another dependent profile reports identically is emitted once. In the file-less paragraph
  (`:96-98`), add that a dependent profile's option errors are reported the same way, labelled.
- No `packages/api` or `packages/compiler` README change: no CLI flag, config key or addon API changes.

### Done when

The plan's slice line is the specification. These are the assertions a naive implementation would pass without:

- **A dependent-only error fails the build, with and without `thread-loader`** (A, A2), labelled with the profile.
- **An error both profiles report appears once, without a label** (B, C). Pushing `fragment.diagnostics` unfiltered
  doubles it.
- **Two dependents with the same error: once, first dependent's label** (E).
- **A dependent's file-less option error: once per compilation, labelled** (D). It is not emitted per module, and
  the dependent emit of a later module does not replace the target's unlabelled copy (unit guard).
- **No message changes for single-profile builds:** every existing spec and e2e stays green unedited, apart from any
  fixture with a hidden dependent error, reported in the PR.
- **Gates, all green:** `pnpm lint`, `pnpm build --skip-nx-cache`, `pnpm test --skip-nx-cache`,
  `pnpm test:e2e --skip-nx-cache`. The shared `.nx-cache` replays outputs from other worktrees. Say in the PR whether
  the advisory TS 6.0.3 cell is green.
- **Tests follow `docs/rules/testing.md`:** assemble / act / assert with no part comments, `testObj` and `actual`, no
  shared `testObj`. New files carry the MIT header (`pnpm license:add`). Do not add them to the `license:check` list.
- **The PR states:** the move from `TsCompiler.build` to core and why; the label format and why it sits in the message
  and after the dedup; that the target's copy wins; that Vite benefits (and whether the Vite todo was filled); and the
  behaviour change.

### Repo mechanics

- **pnpm 10** from `$HOME/.nvm/versions/node/v22.17.0/bin`: put it first on `PATH` and check that `pnpm --version`
  prints `10.34.1`. The Homebrew pnpm 11 fails with E401. Set `NX_DAEMON=false`.
- **Installs:** `pnpm install --frozen-lockfile --offline`. Never edit `~/.npmrc`. This branch adds no package.
- **webpack-test e2e runs against the built packages:** run `pnpm build --skip-nx-cache` before `pnpm test:e2e`.
  After a core-only edit, `pnpm --filter @quatico/websmith-core build` refreshes what the loader loads.
- **Reproducing by hand:** put fixtures under `packages/webpack-test/test-output-<name>` (git-ignored by
  `test-output*`). Resolve `webpack` and `websmith-loader` from `packages/webpack-test`. Remove the fixtures afterwards
  with `trash`.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill), e.g.
  `B Reports TypeScript diagnostics of dependent profiles labelled with the profile`,
  `B Reports a diagnostic of several profiles once`,
  `t Covers dependent-profile diagnostics in the webpack loader end to end`,
  `d Documents dependent-profile diagnostics of the loader`.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first green commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`, then give it a descriptive title.
- Append `→ #<number>` to the `bug/loader-dependent-profile-diagnostics` line
  (`docs/plans/2026-10-02-loader-options-once.md:255`), before its `<!-- builds: -->` comment, and commit that on
  this branch. Do not edit the `builds:` note.

### Scope guard

This branch owns:

- `packages/core/src/compiler/ModuleCompiler.ts`, limited to:
  - the label helper;
  - `build`'s dependent loop (`:366-384`) and the target push (`:400-403`);
  - `takeFileLessErrors` (`:505-518`);
  - the doc comments of `build`, `getConfigErrors` and the class;
- `ModuleCompiler.spec.ts` (a new describe), `packages/webpack/src/TsCompiler.spec.ts` (a new describe after `:673`);
- the new `packages/webpack-test/tests/webpack-loader-dependent-profile-diagnostics.test.ts`;
- `Release-Notes.md` (one bullet), `packages/webpack/README.md` (`:86-98`), the `→ #<PR>` line in the plan;
- conditionally, the one `it.todo` in `packages/vite-test/tests/vite-diagnostics.test.ts` (see E2E, Vite).

Do not touch:

- `packages/core/src/compiler/Compiler.ts` (owned by `bug/report-file-less-diagnostics` and
  `bug/typescript-6-own-compilations`), `check-esm.ts`, `ResolvedCompilerOptions.ts`;
- the rest of `ModuleCompiler.ts`, in particular:
  - the #188 early return (`:362-364`);
  - `getConfigErrors`' composition (`:215-222`), `takeUnreportedConfigErrors` and the carrier map
    (`bug/loader-cached-config-errors`);
  - `ModuleBuildResult.dependencies` and `onDependency` (`bug/loader-package-type-deps`);
- `packages/webpack/src/*.ts` production code (`loader.ts`, `webpack-hooks.ts`, `TsCompiler.ts`,
  `WebpackAddonService.ts`);
- `packages/webpack/src/loader.spec.ts` and `describe("Transpilation")` in `TsCompiler.spec.ts` (`:95-163`):
  `bug/typescript-6-own-compilations` edits both;
- `packages/vite/**`, `packages/vite-test/**` except the one conditional `it.todo`;
- `packages/webpack-test/perf/**`, `packages/webpack-test/src/**`, `package.json` files, `pnpm-lock.yaml`,
  tsconfigs, `.github/`, snapshots.

**Branches running at the same time:**

- **`feature/vite-plugin-diagnostics`** (`.plot/briefs/vite-plugin-diagnostics.md`, `docs/plans/2026-10-01-vite-plugin.md`).
  - It owns `packages/vite/**`, `packages/vite-test/**` and two export names in `packages/core/src/compiler/index.ts:12`.
  - Its scope guard forbids `ModuleCompiler.ts`, so there is no shared source file.
  - Contract between the two: its `partitionDiagnostics` deduplicates by file/start/code/message, and its
    `formatDiagnostic` has no profile logic. This slice delivers one labelled copy per module from `build`, so both
    hold.
  - Its `buildEnd` raises `getConfigErrors()` minus the keys raised in `buildStart`, which picks up the labelled
    file-less dependent errors once.
  - The only possible touch point is its `it.todo` (see E2E, Vite). If it merges after you, its author fills the todo.
- **`bug/report-file-less-diagnostics`** (`docs/plans/2026-10-02-cli-error-exit-gaps.md:197`).
  - It edits `Compiler.ts`: `report()`, `watch()`, and the per-file declaration Programs, which start returning
    `getOptionsDiagnostics()`.
  - No shared file, but the two combine. After both land, a **dependent** declaration profile's option errors reach
    `takeFileLessErrors` through your step 2: one labelled configuration error each, unless the target has the same
    one.
  - Whoever merges second re-runs `webpack-loader-option-errors-once.test.ts` and your D case, and checks that each
    error is still reported once.
- **`bug/typescript-6-own-compilations`** (in flight, `origin/bug/typescript-6-own-compilations`). It edits
  `Compiler.ts`, `check-esm.ts`, `AddonRegistry.ts`, `WebpackAddonService.ts`, `TsCompiler.spec.ts:129-136` (inside
  `describe("Transpilation")`) and `loader.spec.ts`. Your `TsCompiler.spec.ts` describe goes after `:673`, so the
  hunks do not touch.
  - Watch the semantics on TypeScript 6: that `Transpilation` test's dependent profile `write` uses `target: ES5`,
    which TypeScript 6 reports as a file-less deprecation error. Before this slice that error was dropped; after it,
    `getConfigErrors()` holds it. The test asserts files only, so it stays green, and that branch moves the profile
    to ES2015 anyway.
  - Expect the advisory TS 6 cell to surface similar deprecations in other dependent-profile fixtures. Report them;
    do not fix them in production code.
- **`infra/typescript-7-1-bench`** (`.plot/briefs/typescript-7-1-bench.md`): new files under
  `packages/webpack-test/perf/` and one `scripts` line. No overlap.

All of them may append to `Release-Notes.md`. Its sections are append-only: whoever merges second rebases and keeps
every bullet.

### Found while writing this brief — not this slice

- **`isolatedDeclarations` errors are not reported by the loader at all.** On `a888e451`, target-only
  `tsConfig: { declaration: true, isolatedDeclarations: true }` with `export function f() { return 1; }` (TS9007 under
  `tsc`) builds with exit 0, and `hello.d.ts` is written. `packages/webpack/README.md:92-94` claims "under
  `isolatedDeclarations`, TS9xxx" fail the build. The Vite brief reported TS9007 failing in Vite with a fast-path
  addon, so the cause is probably the path the per-file Program takes without an `AddonRegistry`. Not this slice:
  report it to the maintainer as a possible issue, and do not use TS9xxx in tests.

If you find something else the plan did not anticipate, report it in the PR rather than improvising outside scope.
