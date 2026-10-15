<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — typescript-6-support (slice: module-kinds)

- **Plan (canonical):** `docs/plans/2026-10-02-typescript-6-support.md` on `develop` (slice line `:328`, heading
  "Module kinds and option types"; Design: rows 12 and 15 of the measured table, the ownership table at `:163`–`:177`,
  open points 4–6, and the "Findings carried over" bullet)
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #144 merged
- **Branch:** `feature/typescript-6-module-kinds` (base: `develop` at `21f7e8ec`, the merge of #200)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH); the implementer never merges it
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

**Ordering.** The plan orders this slice after own-compilations and before the CLI peer and peer range. Everything it
builds on has merged: fixtures #183, websmith-node #184, own-compilations #189, the last fixture #194, and
root-dir-once #200 (`21f7e8ec`). Nothing waits on this branch except the plan's order: `feature/cli-typescript-peer`
and `feature/typescript-6-peer-range` come after it. Open beside you: **#201** (`bug/loader-cached-config-errors`). It
edits `packages/core/src/compiler/ModuleCompiler.ts` (`takeUnreportedConfigErrors`, `setOptions`, the class doc
comment), `Release-Notes.md` and `packages/webpack/README.md` `:107`–`:119`. Your changes touch other lines of those
files. Whoever merges second rebases. #199's measurement report (`analysis-ts71-measurement.md`) does not touch this
slice.

### What changed on `develop` since the plan was approved

Every line number below is from `21f7e8ec`.

- **The sites moved, and there is a third.** The plan's `Compiler.ts:933`, `:1395` and `:1482` are now:
  - `packages/core/src/compiler/Compiler.ts:1078`: `registerPackageJsonWatches`, which drives the CLI's watch re-emit
    on a `package.json` change;
  - `:1558`: `transpileSourceCode`, which picks `transpileNodeModule` on the fast path and under `transpileOnly`;
  - `:1704`: `getImpliedNodeFormat`.

  #197 added a third check after the plan: `packages/core/src/compiler/ModuleCompiler.ts:549`–`:556`,
  `hasNodeModuleProfile`. It makes the loader (and the Vite plugin, which uses `ModuleCompiler`) record the nearest
  `package.json` `"type"` (`:411`–`:413`). All three checks read `module === ts.ModuleKind.Node16 || module ===
  ts.ModuleKind.NodeNext`.
- **`getImpliedNodeFormat` needs no code change.** It delegates to `ts.getImpliedNodeFormatForFile` (`:1708`). On
  6.0.3 that call returns `99` (ESNext) for a `.ts` file under `"type": "module"` with `module` 100, 101, 102 and 199,
  and `undefined` for 200 and 99. On 5.7.3 it returns `undefined` for 101 (all measured). TypeScript handles the
  node kinds itself. The plan's "checked alike" therefore means one unit test, not an edit. The declaration path
  (`:1448`) and the per-file Programs already emit ESM for `node20` (measured, table below).
- **The target for `Node18`/`Node20` is done.** #135's brief handed "`getEffectiveTarget` for `Node18`/`Node20`" to
  this slice. #189 made `getEffectiveTarget` return the installed default target on TypeScript 6 for every
  `module` (`packages/core/src/compiler/config/effective-options.ts:9`–`:10`, `:19`–`:21`). On 6.0.3,
  `ts.getEmitScriptTarget({ module })` is `12` for 100, 101, 102, 199 and 200 (measured), and 5.7.3 has no 101/102.
  Do not touch `effective-options.ts`.
- **The option tables already follow TypeScript.** `convertEnumOptions` (`config/convert-enum-options.ts`) uses
  `ts.convertCompilerOptionsFromJson`. `parsedCommandLine` (`config/parsed-command-line.ts:83`) uses
  `ts.parseCommandLine`. `moduleKindToString` (`:186`) reverses `ts.ModuleKind`, so on 6.0.3 101/102/200 become
  `node18`/`node20`/`preserve`. `SCRIPT_TARGET_NAMES` (`:167`–`:171`) has `12 → es2025` since #168. The three
  hard-coded node-kind checks above, the `packages/api` types and the CLI's option declarations are the only places
  that list module kinds or values.
- **`--ignoreDeprecations` is blocked twice.** The CLI does not declare it, so it lands in `additionalArguments`
  (`packages/compiler/src/command.ts:142`), which no compilation reads. Programmatically, `createOptions({ project,
  ignoreDeprecations: "6.0" })` throws `Error using the compiler with invalid arguments: "ignoreDeprecations".`
  (measured), because `parsedCommandLine` (`:29`–`:32`) checks keys against `COMPILER_ARGUMENT_KEYS`, which lacks
  it (`packages/api/src/CompilerArguments.ts:16`, `TSC_ARGUMENT_KEYS`).
- **The plan's 5.7.3 e2e is already green.** The plan wants "`module: node20` on 5.7.3 fails with TypeScript's own
  option error, not silently". Measured on develop with 5.7.3:
  - tsconfig: websmith prints TypeScript's TS6046 text (`Argument for '--module' option must be: …`), without the
    code, and exits 1.
  - `--module node20`: it prints `Error: 6046: …` and exits 1.
  - A profile `tsConfig`: it prints `Invalid 'tsConfig.module' value 'Node20' in profile 'p' of '…'. Argument for
    '--module' option must be: …` and exits 1.

  **Resolution:** add the case as a 5.x regression guard and say in the PR that it has no red-before. The red-before
  e2e of this slice is the 6.x behaviour below.
- **`--outFile` (row 12): the plan's premise is half true.** The plan says "TypeScript reports its own deprecation
  error; websmith only passes it on". Measured on 6.0.3: with `declaration: true` websmith reports TS5101 like `tsc`.
  On the fast path it drops TS5101, because `transpileModule` gets `outFile` removed (`TRANSPILE_REMOVED_OPTIONS`,
  `Compiler.ts:77`). The fast path also drops TS6082 and TS6131 on both majors: with `outFile` and `module`
  `commonjs` or unset, `tsc` exits 2 and writes nothing, while websmith exits 0 and writes `out.js`. With `module`
  `amd`/`system`/`none` (what `outFile` needs), the 6.x build still fails through TS5107 for `module`.
  **Resolution:** this slice writes the README note as the plan says, worded to the measured behaviour. Reporting the
  stripped options' errors changes exit codes on both majors, so it is a follow-up (Not in this slice).
- **Old docs this slice owns (from the own-compilations brief):**
  - `README.md:191`: a profile example with `"target": "es5"`, which is TS5107 on 6.x;
  - `packages/webpack/README.md:100`: uses TS5095 (`bundler` with `CommonJS`) as its option-error example. That
    combination is valid on 6.0.3.

### Current behaviour, reproduced

**Evidence.** A detached worktree of `21f7e8ec`, the built CLI (`packages/compiler/bin/bin.js`) and the built loader.
5.7.3 ran from the lockfile on Node 22.17.0. 6.0.3 ran with CI's override recipe (`pull-request.yml:48`–`:72`) on
Node 24.21.0, and all 11 workspace packages resolved 6.0.3. Each project is `src/a.ts` = `export const a = 1;` with a
`package.json` (`"type": "module"` unless stated), `rootDir: "src"`, `outDir: "dist"`, `types: []`. "fmt" is the
module format of the emitted `a.js`. "ws" is websmith on the fast path; `-o` (`--transpileOnly`) behaved the same
except where stated. The loader runs were `webpack-loader-package-type.test.ts`'s harness (transpileOnly, profile
`target`, `target: "es2020"`) with `node18`/`node20` cases added. The scripts and logs are not committed.

| Input | `tsc` 5.7.3 | websmith 5.7.3 | `tsc` 6.0.3 | websmith 6.0.3 |
|---|---|---|---|---|
| tsconfig `module: node20` (same for `node18`, and `node20` + `moduleResolution: nodenext`) | TS6046, exit 2 | TS6046 text, exit 1 | exit 0, **ESM** | exit 0, **CommonJS** (fast path and `-o`) |
| same with `declaration: true` | — | — | ESM | ESM; with `-o`: **CommonJS** |
| same under `"type": "commonjs"` | — | — | CommonJS | CommonJS |
| `module` `node16` / `nodenext` | ESM | ESM | ESM | ESM |
| `module: preserve` (+ `bundler`) | ESM, 0 | ESM, 0 | ESM, 0 | ESM, 0 |
| CLI `--watch`, `module: node20`/`node18`, `"type"` flipped `module` → `commonjs` | — | error, no re-emit | — | **CommonJS before and after**: no `package.json` watch (`nodenext`: ESM → CommonJS) |
| loader, `module: node20`/`node18`, `"type": "module"` | — | loader error (TS6046 text) | — | **CommonJS**, no `package.json` dependency, `websmithPackageTypes` **null** (`nodenext`: ESM, type `module` recorded) |
| loader `--watch`, `node20`/`node18`, `"type"` flip | — | error | — | **no rebuild** (`built: []`); `nodenext` rebuilds and emits CommonJS |
| profile `tsConfig` `{ "module": "Node20" }` / `{ "target": "ES2025" }` | — | `Invalid 'tsConfig.module' value 'Node20' … Argument for '--module' option must be: …`, exit 1 | — | accepted; `Node20` emits **CommonJS** under `"type": "module"` |
| tsconfig / `-t` `target: es2025` | TS6046 | TS6046, exit 1 | exit 0 | exit 0 |
| `--module node20` / `-m node18` (tsconfig `bundler`) | TS6046, exit 1, no output | `Error: 6046`, exit 1, writes `dist/a.js` | TS5095 + TS5109, exit 2 | 5095 + 5109, exit 1 |
| CLI `--ignoreDeprecations 6.0` (tsconfig `bundler`) | TS5103, exit 2 | **ignored**, exit 0 | exit 0 | ignored, exit 0 |
| tsconfig `moduleResolution: node10` + CLI `--ignoreDeprecations 6.0` | (not run) | (not run) | exit 0 | **TS5107, exit 1** |
| tsconfig `ignoreDeprecations: "6.0"` (also in a profile `tsConfig`) | TS5103, exit 2 | 5103, exit 1 | exit 0 | exit 0 |
| tsconfig `ignoreDeprecations: "5.0"` + `node10` | exit 0 | exit 0 | TS5107, exit 2 | 5107, exit 1 |
| `createOptions({ project, ignoreDeprecations: "6.0" })` | — | **throws** "invalid arguments" | — | **throws** |
| `outFile` + `module: amd` | exit 0 | exit 0 | TS5101 + TS5107, exit 2 | **5107 only**, exit 1; with `declaration: true` both |
| `outFile`, `module` unset / `commonjs` | TS6131 / TS6082, exit 2, no output | **exit 0**, writes `out.js` | + TS5101 | **exit 0**, writes `out.js` |
| CLI `--moduleResolution node10` / `classic` | exit 0 | ignored, exit 0 | TS5107, exit 2 | **ignored**, exit 0 |
| CLI `--module commonjs --moduleResolution bogus` | TS6046, exit 1 | `bogus` ignored | TS6046, exit 1 | ignored, exit 0 |
| `-p . --strict maybe` | TS5042, exit 1 | exit 0, compiles | TS5042, exit 1 | exit 0, compiles |

TypeScript facts measured on 6.0.3:
- `ts.ModuleKind`: `Node16: 100, Node18: 101, Node20: 102, NodeNext: 199, Preserve: 200`. On 5.7.3 there is no
  `Node18`/`Node20`; `Preserve` (200) exists.
- `ts.ScriptTarget[12]` is `"LatestStandard"`, and 5.7.3 has no `ES2025`.
- `ts.getDefaultCompilerOptions()` is `{ target: 12, jsx: 1 }`.
- `tsc --all` lists `--module` as `commonjs, es6/es2015, es2020, es2022, esnext, node16, node18, node20, nodenext,
  preserve` and `--target` up to `es2025, esnext`. It hides deprecated values and does not list
  `--ignoreDeprecations` at all.
- 5.7.3 accepts only `ignoreDeprecations: "5.0"` (`"6.0"` is TS5103). 6.0.3 accepts `"5.0"` and `"6.0"`, but only
  `"6.0"` silences TS5107.

### What to build

Line numbers are from `21f7e8ec`. Commit the red e2e first, then each item as its own commit.

1. **Treat every installed node module kind as one.**
   - Add `packages/core/src/compiler/config/module-kinds.ts` with the MIT header:
     `isNodeModuleKind(module: ts.ModuleKind | undefined, moduleKinds: Record<string, string | number> =
     ts.ModuleKind): boolean`. It is true when `module` equals the value of one of the members `Node16`, `Node18`,
     `Node20`, `NodeNext` that `moduleKinds` has. Look the members up by name. Write a one-line comment saying that
     `Node18`/`Node20` exist only in TypeScript 6.
   - Use it at `Compiler.ts:1078`, `Compiler.ts:1558` and `ModuleCompiler.ts:554`. Update the comments that say
     "node16/nodenext" (`Compiler.ts:125`, `:1071`, `:1586`–`:1588`; `ModuleCompiler.ts:411`, `:549`) to say "a
     node module kind (node16, node18, node20, nodenext)".
   - *Rejected: `ts.ModuleKind.Node20`.* It is a compile error (TS2339) against 5.7.3's typings, and the 5.7.3 cells
     build with them.
   - *Rejected: the range `Node16 <= module <= NodeNext`.* It also routes numeric values that the installed
     TypeScript does not have (e.g. a loader `tsConfig: { module: 101 }` on 5.7.3) into `transpileNodeModule`. The
     plan says "when the installed `ts.ModuleKind` has them".
   - No change to `getImpliedNodeFormat` (`:1704`); see above.
2. **Typed options in `@quatico/websmith-api`.** The changes are additive and optional.
   - `TsConfigOptions.ts` `TsConfigCompilerOptions`:
     - `target` (`:81`–`:95`) gains `"ES2025"`;
     - `module` (`:100`) gains `"Node18" | "Node20" | "Preserve"`;
     - new `ignoreDeprecations?: "5.0" | "6.0"`, with JSDoc: "`5.0` on TypeScript 5.x, `5.0` or `6.0` on 6.x; only
       `6.0` silences 6.0's deprecations; TypeScript reports a value its version does not accept (TS5103)".
   - `TscArguments.ts`:
     - `:10` becomes "Based on TypeScript 5.7 and 6.0; values marked 6.x exist only in TypeScript 6";
     - `TscCliArguments.target` (`:460`) gains `"es2025"`, and `module` (`:338`) gains `"node18" | "node20"`;
     - add `ignoreDeprecations?: "5.0" | "6.0"` under "Backwards compatibility" (`:392`);
     - add `ignoreDeprecations: "--ignoreDeprecations"` to `TSC_BACKWARDS_COMPATIBILITY_FLAGS` (`:126`).
   - `CompilerArguments.ts`: `"ignoreDeprecations"` in `TSC_ARGUMENT_KEYS` under `// Backwards compatibility`
     (`:88`).
   - Mark the 6-only values in their JSDoc ("TypeScript 6"). Do not add `"node10"` or other values the plan does not
     name.
3. **`--ignoreDeprecations` on the CLI.**
   - In `packages/compiler/src/command.ts`, add `.option("--ignoreDeprecations <version>", …)`; its help text says
     what the JSDoc above says. The value then flows through `createOptions` → `parsedCommandLine` → `createArgs` →
     `ts.parseCommandLine`.
   - On 5.7.3, `"6.0"` must surface as TypeScript's TS5103 (as it does from tsconfig today). Do not validate the
     value in websmith.
   - Update the help texts of `-t` (`:53`–`:56`: drop the duplicate `es5`, add `es2025`) and `-m` (`:57`: today
     `commonjs, amd, umd, system, esnext, none`) to the values `tsc --all` lists on 6.0.3, plus the 5.x-only names
     users still pass. Mark the TypeScript-6-only values.
4. **Docs.**
   - `packages/compiler/README.md` "Command line parameters" (`:71`–`:88`): add a bullet for `--ignoreDeprecations
     <version>`. Add an `--outFile` note: TypeScript 6 deprecates `outFile` (TS5101) and the `module` kinds it
     works with (`amd`, `system`, `none`; TS5107), so a 6.x build with `outFile` fails until `"ignoreDeprecations":
     "6.0"` is set. Do **not** write that websmith prints TS5101: on the fast path it does not (see above).
   - Near `:99`: profile `tsConfig` accepts `Node18`/`Node20`/`ES2025` on TypeScript 6 only.
   - `packages/webpack/README.md` `:137`–`:142`: heading and text from "`node16` and `nodenext`" to the node module
     kinds incl. `node18`/`node20` (TypeScript 6). At `:100`, replace the TS5095 example with TS5110
     (`moduleResolution: "node16"` with `module: "commonjs"`). It is an option error on both majors (measured by
     #183; `bin.test.ts` uses it).
   - `README.md:191`: `"target": "es5"` → `"es2020"`.

**Unit tests** (assemble / act / assert, `testObj`, `actual`, no shared `testObj`; MIT header on new files):
- `config/module-kinds.spec.ts`:
  - for every numeric member of the installed `ts.ModuleKind`, the result equals TypeScript's own answer:
    `ts.getImpliedNodeFormatForFile("/p/a.ts", <cache>, <host without files>, { module }) !== undefined`. That is
    defined for 100/101/102/199 on 6.0.3 and 100/199 on 5.7.3, and `undefined` for the others (measured; never a
    second list of names);
  - an absent member: `isNodeModuleKind(101 as ts.ModuleKind, { Node16: 100, NodeNext: 199 })` is false and
    `isNodeModuleKind(100 as ts.ModuleKind, { Node16: 100, NodeNext: 199 })` is true;
  - `undefined` is false.
- `Compiler.spec.ts`: next to `:1734`/`:1755` (fast path) and `:3076` (watch re-emit on a `"type"` change), one case
  per node kind of the installed TypeScript. Build the list from `["Node16", "Node18", "Node20", "NodeNext"].filter(name
  => name in ts.ModuleKind)` and read values as `(ts.ModuleKind as Record<string, number>)[name]`. Add one
  `getImpliedNodeFormat`/declaration-path case for the same list (no product change; it guards the delegation).
- `ModuleCompiler.spec.ts:930`: the same per-kind list for the recorded package type.
- `packages/compiler/src/command.spec.ts` or `command-cli-args.spec.ts`: `--ignoreDeprecations 5.0` reaches
  `cliArgs.options.ignoreDeprecations` as `"5.0"`. Use `"5.0"`, which is valid on both majors.
- `parsed-command-line.spec.ts`: `ignoreDeprecations` is accepted, not "invalid arguments".
- `packages/api`: `CompilerArguments.spec.ts` (`TSC_ARGUMENT_KEYS` contains `ignoreDeprecations`) and
  `TsConfigOptions.spec.ts:12` (the new values type-check). Both compile on 5.7.3.

**No version-dependent literals.**
- An expectation that differs by major comes from TypeScript of the running major. Otherwise, gate the case on the
  enum member: `const describeOnTs6 = "Node20" in ts.ModuleKind ? describe : describe.skip;`, or the `describeOnTs5`
  #183 used, with the major in the title.
- `it.each([])` throws in Jest ("`.each` called with an empty Array"). Gate the `describe`, never pass an empty table.
- `it`-level skips trip `jest/no-standalone-expect` in some packages.
- Never compare against a value the code under test computes (`isNodeModuleKind`, `getEffectiveTarget`,
  `moduleKindToString`).

**E2E, each shown red on develop first** (write and commit the `t` commit before the product change; put the red run
in the PR):
- **webpack-test** (the plan's case): extend `packages/webpack-test/tests/webpack-loader-package-type.test.ts` with a
  `describeOnTs6("… on TypeScript 6", …)` block for `node18` and `node20`. Do not set `moduleResolution`: the
  default is node16 for both. Cases:
  - the first build under `"type": "module"` emits ESM and records the `package.json` type (`recorded` not null);
  - under watch, flipping `"type"` to `commonjs` rebuilds `a.ts` and emits CommonJS (as the `nodenext` case `:51`).

  Red on develop with 6.0.3: `format: "commonjs"`, `recorded: null`, and `built: []` after the flip (measured). The
  5.7.3 cells skip the block; say so in the PR.
- **compiler-test**: new `packages/compiler-test/tests/tsc-module-kinds.test.ts`. Spawn the built CLI as
  `tsc-root-dir.test.ts:92` does, and spawn `tsc` with its own `outDir`.
  - "emits tsc's output w/ module `<kind>` under type module": for each node kind of the installed TypeScript
    (lower-case names), with and without `--transpileOnly`, the emitted files and their contents equal `tsc`'s. Red
    on 6.0.3 for `node18`/`node20` (CommonJS vs ESM, measured). Green on 5.7.3, which runs only `node16`/`nodenext`.
  - `describeOnTs5`, "fails w/ TypeScript's own option error for module node20 on TypeScript 5": the exit code is not
    0, and stdout contains `ts.flattenDiagnosticMessageText(ts.convertCompilerOptionsFromJson({ module: "node20" },
    "").errors[0].messageText, "\n")`. Green on develop (no red-before; see above).
  - "reports tsc's errors w/ --ignoreDeprecations 6.0": tsconfig `module: "esnext"`, `moduleResolution: "node10"`,
    plus `--ignoreDeprecations 6.0` for both tools. websmith's error codes equal `tsc`'s, and the exit codes are
    both 0 or both non-zero. Red on **both** cells: on 6.0.3 websmith reports `5107` and `tsc` nothing (measured); on
    5.7.3 `tsc` reports `5103` and websmith nothing (measured with `bundler`; check `node10` yourself).

### Done when

The plan's slice line is the specification, with the resolutions above.

- **6.0.3:** `module: node18`/`node20` emit what `tsc` emits per `package.json` `"type"`:
  - on the CLI fast path, under `--transpileOnly` and in the loader's `transpileOnly`;
  - the loader rebuilds on a `"type"` flip, and the CLI's `--watch` re-emits.

  Put the CLI outputs for `node20` under `"type": "module"` (websmith and `tsc`, both majors) in the PR.
- **`--ignoreDeprecations`** works on the CLI and programmatically: `6.0` silences TS5107 on 6.0.3, and on 5.7.3
  TypeScript's TS5103 is reported with exit 1.
- **Types:** `ignoreDeprecations: "5.0" | "6.0"`, `ES2025`, `Node18`, `Node20` and `Preserve` are in
  `TsConfigCompilerOptions` / `TscCliArguments`, and `ignoreDeprecations` is in `TSC_ARGUMENT_KEYS`. The `api`
  package builds on both cells.
- **The new e2e cases:** red on develop as stated, green after; the 5.x guard green.
- **Every other test:** no change on either cell. The 6.0.3 cell has been green since #200; keep it green. List every
  snapshot hunk (expect none).
- **Gates, on both versions, before opening the PR:** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache` and
  `pnpm test:e2e --skip-nx-cache` on 5.7.3 (lockfile, Node 22 or 24). The same four on 6.0.3 (override, Node 24),
  recipe below. Paste the summary lines of both into the PR.

**`Release-Notes.md`**, under `## [Unreleased]`:
- `### Added` (`:15`):
  - `--ignoreDeprecations` on the `websmith` command and in the programmatic arguments;
  - the typed options in `@quatico/websmith-api`: `ignoreDeprecations` (`"5.0"` on 5.x, `"6.0"` on 6.x), target
    `ES2025`, module kinds `Node18`, `Node20`, `Preserve`. Values that exist only in 6.x are reported by TypeScript
    on 5.x, not dropped silently. Exhaustive `switch`/`Record` code over these unions sees new members.
- `### Changed` (`:20`), a **Behaviour change (TypeScript 6 only)** entry: under `module: node18`/`node20`, the CLI's
  fast path, `transpileOnly`, the webpack loader and the Vite plugin emit each file in the format of its nearest
  `package.json` `"type"`, as `tsc` does. They watch that `package.json` too. Before, they emitted CommonJS whatever
  the `"type"`. A `"type": "module"` package therefore gets ES module output now.
  - The plan's Changelog lists this as "Fixed". It changes output, so it goes under Changed; say so in the PR.
  - Extend the existing node16/nodenext loader entry (`:29`) only if a separate entry reads worse.
- No entry for the `--outFile` note (docs only).

**README:** item 4 above.

### Repo mechanics

- **pnpm:** use the corepack-cached pnpm 10.8.0 through a PATH shim; pnpm 10.34 fails the frozen install, and CI is
  pnpm 9:
  ```sh
  mkdir -p "$S/pnpm-shim" && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > "$S/pnpm-shim/pnpm" && chmod +x "$S/pnpm-shim/pnpm"
  export PATH="$S/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline && pnpm build --skip-nx-cache
  ```
- **TypeScript 6.0.3, as CI's `dist (24, typescript 6.0.3)` cell does it** (`pull-request.yml:48`–`:72`). Run it only
  in a detached scratch worktree of your committed branch, never in your branch's checkout:
  ```sh
  git worktree add --detach "$S/wt6" HEAD && cd "$S/wt6"
  export PATH="$S/pnpm-shim:$HOME/.nvm/versions/node/v24.21.0/bin:$PATH" COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline
  pnpm pkg set pnpm.overrides.typescript=6.0.3
  : > "$S/empty.npmrc"
  NPM_CONFIG_USERCONFIG="$S/empty.npmrc" pnpm install --no-frozen-lockfile --config.registry=https://registry.npmjs.org/
  pnpm -r exec node -p "require('typescript/package.json').version"    # every line 6.0.3 (11 packages)
  pnpm build --skip-nx-cache && pnpm lint && pnpm test --skip-nx-cache && pnpm test:e2e --skip-nx-cache
  cd - && git worktree remove --force "$S/wt6"
  ```
  For the red-before run, do the same on a worktree of `develop` plus your `t` commit.
- **Never commit** the override, the rewritten `pnpm-lock.yaml` or a root `package.json` change. Never edit
  `~/.npmrc` (the Artifactory login in it is expired). If the lockfile changes in your checkout, `git checkout --
  pnpm-lock.yaml`. e2e runs can leave `test-output-*` importers in it, so check `git status` before every commit.
- Use `git -c rerere.enabled=false` for any merge or rebase.
- `test:e2e` needs `pnpm build` first: the e2e suites spawn the built CLI and loader, so rebuild after product edits.
- Do not run two full suites in parallel on one machine: concurrent `test:e2e` runs cut `websmith-loader-test`
  short.
- New files need the MIT header (`pnpm license:add`); never add them to the `license:check` list.
- Commits use Arlo's notation without a colon (`commit-notation` skill), e.g.:
  - `t Covers node18 and node20 package.json type in the loader and CLI`
  - `B Treats Node18 and Node20 as node module kinds`
  - `F Accepts --ignoreDeprecations on the command line`
  - `F Types ES2025, Node18, Node20, Preserve and ignoreDeprecations`
  - `d Notes the outFile deprecation and the TypeScript 6 module kinds`
- Use `trash`, never `rm`.

### Bookkeeping

- Push the `t` commit early, so the PR's 6.0.3 cell shows the red-before.
- Open the PR with `plot-open-pr.sh`, not `gh pr create`.
- Add the `→ #<PR>` suffix to the plan's slice line (`docs/plans/2026-10-02-typescript-6-support.md:328`, before the
  `<!-- builds: -->` comment) and commit it on this branch. Edit nothing else in the plan; it is frozen.
- The PR body carries:
  - the before/after CLI and loader outputs for `node20`, both majors;
  - the gate summaries of both versions;
  - the red-before runs;
  - the plan resolutions under "What changed on develop" (third site, no `getImpliedNodeFormat` edit, green 5.x
    guard, `--outFile` note wording, "Changed" instead of "Fixed");
  - the follow-ups below.

### Scope guard

This branch owns:
- `packages/core/src/compiler/config/module-kinds.ts` (new), plus its spec;
- in `Compiler.ts`, only the two checks (`:1078`, `:1558`) and the comments named in item 1;
- in `ModuleCompiler.ts`, only `hasNodeModuleProfile` and its comments (`:411`, `:549`–`:556`);
- `packages/api/src/{TsConfigOptions,TscArguments,CompilerArguments}.ts` and their specs;
- `packages/compiler/src/command.ts` (the new option and the `-t`/`-m` help texts), plus its specs;
- the new and extended e2e files named above;
- `README.md:191`, `packages/compiler/README.md`, `packages/webpack/README.md` (`:100`, `:137`–`:142`);
- its `Release-Notes.md` entries and its plan suffix.

Do not touch:
- `config/effective-options.ts`, `esm/check-esm.ts`, `config/convert-enum-options.ts`, `config/parsed-command-line.ts`
  (beyond what a spec needs; no product change is expected there);
- TS5011 handling, `TRANSPILE_REMOVED_OPTIONS` and the debug summary in `Compiler.ts`;
- `ModuleCompiler.ts`' config-error code (#201);
- `packages/node/**`, `packages/vite/**` (it inherits item 1 through `ModuleCompiler`), `packages/testing/**`;
- `package.json` files, `pnpm-lock.yaml`, tsconfigs, `.github/workflows/*`;
- `checkTypeScript()` and the CLI's `typescript` dependency (`feature/cli-typescript-peer`);
- peer ranges and the pin (`feature/typescript-6-peer-range`).

If a cell shows a failure this brief does not name, triage it by error code and report it in the PR rather than
improvising outside scope.

### Not in this slice (open follow-ups, verified on `21f7e8ec`)

- **The fast path drops option errors of the options it strips.** TS5101 (`outFile`, 6.x) is lost, and so are
  TS6082/TS6131 (`outFile` with `module` `commonjs`/unset, both majors): websmith exits 0 and writes `out.js` where
  `tsc` exits 2 and writes nothing. It changes exit codes, so it gets its own bug slice like root-dir-once. Owner:
  the maintainer files an issue (no plan owns it).
- **The CLI ignores tsc flags it does not declare.** `--moduleResolution node10`/`classic`/`bogus` are dropped into
  `additionalArguments` (exit 0 where `tsc` exits 2 or 1), and `-p . --strict maybe` exits 0 where `tsc` reports
  TS5042. This slice declares only `--ignoreDeprecations`. Passing unknown flags through to `ts.parseCommandLine`
  changes exit codes and makes `packages/compiler/README.md`'s "same command line parameters as `tsc`" true. Owner:
  a new CLI-parity bug slice outside this plan. The review's "writes `out/maybe`" did not reproduce: with and without
  `-p`, websmith compiled the project into `dist/` and wrote nothing named `maybe`.
- **#183/#189: the debug summary** (`Compiler.ts:1133`–`:1139`) prints `strict: true` when `strict` is unset (true
  on 6.x, wrong on 5.x), `module`/`moduleResolution` as numbers with `?? 99` / `?? 2` fallbacks, and `?? true` for
  `sourceMap`/`declaration`/`noEmit`/`allowJs`/`incremental`. It is debug output only. Owner: a small bug issue
  outside this plan.
- **#183/#189: TS6 specs that compare against code-under-test values** (e.g. `effective-options.spec.ts`,
  `check-esm.spec.ts:716` through `getEffectiveTarget`). This slice's new tests must not do that. Retrofitting the
  existing ones belongs to `feature/typescript-6-peer-range`, which moves the pin and reruns every spec with 6.0.3 as
  the lockfile version.
- **#184:** the websmith-node e2e and specs assume the imported `typescript` is the spawned `tsc`'s version, and
  `findTsc`'s first candidate (`lib/typescript/bin/tsc`) never exists. Owner: `feature/cli-typescript-peer`, which
  adds websmith-node's `checkTypeScript()` copy and resolves `typescript/package.json` there.
- **#200:**
  - websmith exits 1 where `tsc` exits 2. This is the documented convention (`packages/compiler/README.md:88`); no
    change.
  - Root files that share the tsconfig directory, with an import that leaves it, get no TS5011 from websmith. This is
    the documented gap (`Compiler.ts:622`–`:627`). Owner: the issue #200's review asked for.
