<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — cli-error-exit-gaps (slice: Option errors)

- **Plan (canonical):** `docs/plans/2026-10-02-cli-error-exit-gaps.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #136 merged
- **Branch:** `bug/report-config-option-errors` (base: `develop`, at `fa114cbe` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on `PATH`). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is wave 4, item 1 of the plan. Its line carries `<!-- waits: bug/loader-option-errors-once -->`.
That branch merged as #181 (`bcb9a75a`), and #135's defaults slice merged as #161, so both prerequisites the plan's
Order paragraph names are met. Waves 1 to 3 and 6 have merged: #147, #163, #170, #176. It runs **in parallel** with:

- `bug/watch-generator-added-files` (same plan, wave 7). It rewrites the loops of `Compiler.watch()`, where you add
  one line. See Scope guard.
- `bug/loader-unknown-profile-error` (`docs/plans/2026-10-02-loader-options-once.md:251`). It moves profile
  validation into core option resolution, i.e. `ResolvedCompilerOptions.ts` and `ModuleCompiler.ts`, on other lines
  than yours.
- `bug/typescript-6-own-compilations` and `bug/node-tsc-ignore-config`. They do not touch your files.

**Not yours: `bug/report-file-less-diagnostics`** (wave 5, same plan, also waiting on #181, not started). It owns:

- the file-less filter in `Compiler.report()` (`packages/core/src/compiler/Compiler.ts:677`);
- `getOptionsDiagnostics()` in the per-file declaration Programs (`transpileSourceCode`, `:1297` onward);
- reporting the language-service Program's options diagnostics in `watch()`;
- TS2688 / TS5095 / TS6059 with `declaration`, and the before/after fixture run around `:677`.

The 6046 filter in `transpileSourceCode` (`:1436`) stays everywhere; the plan says so. If a test of yours needs one of
these, it belongs to wave 5. Leave it.

All line numbers are from `develop` at `fa114cbe` (#182 merged). If they move, find the code by name.

### What changed on `develop` since the plan

| Plan says | Now on `develop` |
|---|---|
| `getParsedCommandLineOfConfigFile` errors spread at `parsed-command-line.ts:94`/`:123`, copied at `:140` | `packages/core/src/compiler/config/parsed-command-line.ts`: spread at `:97` (CLI files) and `:126`; the branch without a tsconfig returns `errors: tscArgs.errors` (`:142`) |
| `ResolvedCompilerOptions.ts:131` copies them into the pre-merge object | `packages/core/src/compiler/options/ResolvedCompilerOptions.ts:143` |
| the resolved `cliArgs` ends with `errors: []` (`:230`) | `:250` |
| the CLI's tsconfig parse at `ResolvedCompilerOptions.ts:201` | `:220-221` (`parsedTsConfig`) |
| profile re-parses at `:287`, `:352` | `getTsConfig` `:341-373`, its parse at `:348`, called at `:198` and per profile at `:307` |
| `command.ts:117-119`, the `NoReporter` pass | `packages/compiler/src/command.ts:106-126`; `NoReporter` at `:122` |
| `report()` runs once per profile (`Compiler.ts:217`) | `compile()` `:142-217`, `report` called per profile at `:198`; `watch()` `:219-253` |
| — | #181 added `ModuleCompiler.getConfigErrors` (`packages/core/src/compiler/ModuleCompiler.ts:208-211`), `takeUnreportedConfigErrors` (`:218-230`) and the private `takeFileLessErrors` (`:501`). #182 made the Vite plugin a second host of `getConfigErrors` (`packages/vite/src/plugin.ts:83`) |

### The failure, measured

Built `develop` (`a24984de`; #182 since changes only the context compiler options, which are `{}` on the CLI path) and
ran `node packages/compiler/bin/bin.js` next to the workspace `tsc` 5.7.3. Fixture: `tsconfig.json` with
`outDir: "out"`, `types: []`, `include: ["src"]`, and a valid `src/a.ts`.

| Input | `tsc` | `websmith` |
|---|---|---|
| `--target foo` | `error TS6046: Argument for '--target' option must be: …`, **exit 1, no output** | nothing, exit 0, `out/a.js` |
| `-p tsconfig.json --target foo` | same TS6046, exit 1 | nothing, exit 0 |
| `--module bogus`, `--jsx bad`, `--lib es9999` | TS6046 each, exit 1 | nothing, exit 0 |
| no tsconfig, `--outDir out --target foo src/a.ts` | TS6046, exit 1 | nothing, exit 0 |
| tsconfig `"bogusOption": true, "target": "foo"` | `tsconfig.json(1,54): error TS5023 …` and `(1,85): error TS6046 …`, exit 2, output written | nothing, exit 0 |
| tsconfig `"strict": "yes"` | `TS5024 … requires a value of type boolean`, exit 2 | nothing, exit 0 |
| tsconfig with a JSON syntax error (missing `}`) | `tsconfig.json(2,1): error TS1005: '}' expected.`, exit 2 | nothing, exit 0 |
| tsconfig `"extends": "./missing.json"` | `error TS5083: Cannot read file '…/missing.json'.`, exit 2 | nothing, exit 0 |
| tsconfig whose `include` matches nothing | `TS18003: No inputs were found …`, exit 2 | nothing, exit 0 |

**The command-line case, traced.** For `websmith --target foo`:

1. `command.ts` passes the commander options to `createOptions` (`:108-124`). That calls
   `parsedCommandLine(project, args)` (`packages/core/src/compiler/options/options.ts:33`).
2. `parsedCommandLine` turns them into argv (`createArgs(rest)`, `:69`) and calls `ts.parseCommandLine` (`:73`). That
   returns `{}` for `target` and one TS6046.
3. With a tsconfig (`:76`), both branches pass only `tscArgs.options` to `getParsedCommandLineOfConfigFile`
   (`:84`, `:114`) and return the tsconfig result, so `tscArgs.errors` is dropped. Without a tsconfig they are
   returned (`:142`).
4. Either way, `ResolvedCompilerOptions` ends with `errors: []` (`:250`), and nothing reports anything.

The fast path's 6046 filter (`Compiler.ts:1436`) is not involved: the invalid value never reaches `transpileModule`.

### Four traps found while writing this brief — read before coding

All four were hit by a throwaway prototype of the design below (not committed).

1. **Every CLI run passes websmith's own flags to `ts.parseCommandLine`.** Instrumented on the built CLI:
   - `websmith` with no arguments calls it with `["--files", "", "--project", "<abs>/tsconfig.json"]`. `files` comes
     from `command.ts:83` (`files: source`). The result is `TS5023 Unknown compiler option '--files'`, on **every**
     run.
   - `--addonEmitOnly` gives TS5023 for that flag, and `-b` gives `TS6369 Option '--build' must be the first command
     line argument`.

   `parsedCommandLine` destructures only some websmith keys out of `rest` (`:37-49`); `files`, `addonEmitOnly` and
   `build` stay. If you only forward `tscArgs.errors`, every build fails. **Fix:** drop every key in
   `WEBSMITH_ARGUMENT_KEYS` (`packages/api/src/CompilerArguments.ts:184-196`; it has `files` and `addonEmitOnly`), plus
   `build`, from what `createArgs` gets at `:69`. websmith does not implement `--build`; reporting it is outside this
   slice. Nothing else reads those argv entries: the options they produced were already ignored.
2. **A JSON syntax error in `tsconfig.json` is not in `result.errors`.** TypeScript keeps it in
   `result.options.configFile.parseDiagnostics`. `options.configFile` is non-enumerable, so the spreads at `:97-103`
   and `:126-132` drop it. Use `ts.getConfigFileParsingDiagnostics(result)` **on the raw result**, inside
   `parsedCommandLine`. It returns the parse diagnostics and then `errors`. Checked on 5.7.3: `errors` is `[]`, and
   `getConfigFileParsingDiagnostics` returns `[1005]`.
3. **The CLI resolves the options twice.** `command.ts` resolves them with a `NoReporter` (`:122`), then
   `new Compiler({ ...options, reporter })` (`:147`) resolves them again from the first result. The command-line
   errors exist only in the first `parsedCommandLine` call. They reach the second resolution only through
   `options.cliArgs.errors`, which `:250` empties today.
4. **The webpack loader's `cliArgs.errors` carry spurious 6046s.** `packages/webpack/src/options.ts:18` calls the same
   `parsedCommandLine` with the loader options, whose `tsConfig` may hold numeric enum values. `createArgs` renders
   `moduleResolution: 100` as `--moduleResolution 100`, so `ts.parseCommandLine` returns TS6046. Checked: `--jsx 4`
   and `--lib lib.es2020.d.ts` do the same. Those results arrive in `ResolvedCompilerOptions` as the **second**
   constructor argument and are deep-merged into `cliArgs` (`:146`). **Take the command-line errors from the first
   argument only:** `options.cliArgs?.errors`, read before the merge at `:119-150`. The loader's base options carry
   `errors: []` (`packages/webpack/src/compiler-instances.ts:36`).

### The work

The plan's Design → "Option errors (item 1)" is the spec: a `configErrors` field on `ResolvedCompilerOptions`, set
from the one parse of the CLI's tsconfig, reported once at the start of `compile()` and `watch()`, while the emit
continues. The plan names only the tsconfig parse. **This brief adds the command-line errors to the same field**
(the #181 brief already deferred `--target foo` here), and the JSON syntax errors of trap 2.

Write the failing tests first (below), then:

1. **`parsedCommandLine`** (`parsed-command-line.ts`):
   - strip the keys of trap 1 before `createArgs` (`:69`);
   - in both tsconfig branches, return
     `errors: [...tscArgs.errors, ...ts.getConfigFileParsingDiagnostics(<raw result>)]` instead of the spread's
     `errors` (`:96-107`, `:125-135`);
   - the branch without a tsconfig keeps `errors: tscArgs.errors` (`:142`).
2. **`ResolvedCompilerOptions`**:
   - add `public readonly configErrors: ts.Diagnostic[]` next to the other fields (`:89-110`), with a doc comment;
   - fill it at the end of the constructor, from `options.cliArgs?.errors ?? []` (the first argument, trap 4) followed
     by the `errors` of `parsedTsConfig` (`:220-221`);
   - deduplicate by file name, start, code and flattened message, the key `Compiler.getDiagnosticKey` uses
     (`Compiler.ts:695-697`). In the CLI the tsconfig's errors arrive twice: once through `options.cliArgs.errors`
     from step 1, and once from the parse at `:221`;
   - drop TS18003 (see Settled decisions);
   - replace `errors: []` at `:250` with the deduplicated list, so the second resolution (trap 3) receives the
     command-line errors;
   - do **not** collect from `getTsConfig`'s parse (`:348`): it runs once per profile, and the plan says "not the
     profile re-parses".
3. **`Compiler`**:
   - report `this.options.configErrors` through `this.reporter` at the start of `compile()`, once before the profile
     loop (after `:145`, before the debug block);
   - do the same as the first statement of `watch()` (`:219-220`);
   - a watch rebuild runs neither, so it reports nothing again;
   - do not add them to `compile()`'s returned `EmitResult` (see Settled decisions);
   - do not route them through `report()`.
4. **Fix the compiler-test fixture helper** (see Prototype evidence): in `compile-websmith.test.ts:1349-1350`, write
   `ScriptTarget.ESNext` (99) as `"esnext"` before the reverse map, e.g.
   `value === ts.ScriptTarget.ESNext ? "esnext" : ts.ScriptTarget[value]?.toLowerCase() || value`. Do not import
   core's `scriptTargetToString` into the test. Keep the change in its own `t` commit and name the 16 cases in the PR.
   Do not change their assertions. If one of them then fails on its output, report it rather than adjusting the
   expectation: the test was compiling with a different `target` than it meant.
5. **The loader and the Vite plugin**: in `ModuleCompiler.getConfigErrors` (`:208-211`), return the collected config
   errors, then `this.getOptions().configErrors`, then the file-less errors. Update its doc comment (`:204-207`).
   Leave the class comment (`:137-144`) alone: it still holds, and `bug/loader-unknown-profile-error` owns it. Both
   hosts then report tsconfig errors through #181's once-per-compilation path, and through
   `takeUnreportedConfigErrors` without compilation hooks. Nothing else in `ModuleCompiler` changes.
6. **Docs and release notes**, see below.

### Settled decisions — do not re-derive them

- **Emit continues** (plan Design). For tsconfig errors that is `tsc`'s behaviour (exit 2 with output). For
  command-line errors `tsc` stops before emitting (exit 1, no output), but websmith follows its one rule: report, emit,
  exit 1. State the difference in the PR and in the README line.
- **Exit 1, not 2** (plan Open Point "Exit code"). The README line below states it.
- **TS18003 ("No inputs were found") is not a config error here.** It is about file discovery, not options:
  - websmith compiles CLI file arguments with a tsconfig whose `include` may match nothing (`parsed-command-line.ts:78`);
  - the loader and the Vite plugin compile modules their bundler chooses, not the tsconfig's file list;
  - an empty project still exits 0 in websmith. Name that in the PR as a remaining `tsc` difference.
- **Unknown flags are not checked.** commander accepts them (`command.ts:79`) and passes them to addons as
  `additionalArguments` (`:142`). They never reach `ts.parseCommandLine`, so `websmith --bogusFlag` stays exit 0
  (`tsc`: TS5023). Do not change that.
- **Not in the returned `EmitResult`.** `@quatico/websmith-node`'s `compile` reports everything in
  `results.diagnostics` a second time (`packages/node/src/websmith/compile.ts:54-58`), so adding them there prints them
  twice. The reporter is the CLI's exit code (`command.ts:170-171`).
- **No change to `packages/api`.** `configErrors` lives on the core class only. `cliArgs.errors` is already part of
  `ts.ParsedCommandLine`. Addons that read `ctx.getCliArgs().errors` now see the errors instead of `[]`; say so in the
  PR.
- **Once per build, not per process.** Each `compile()` call is a build and reports again, as `report()` does.

### Found while writing this brief — report, do not fix

- `websmith --moduleResolution bundler --module commonjs` exits 0, where `tsc` reports TS5095. `--moduleResolution`
  is not a declared commander option, so it lands in `additionalArguments` and never reaches TypeScript: the flag is
  silently ignored. The same holds for every `tsc` flag `command.ts:26-77` does not declare. Name it in the PR as a
  follow-up.
- `websmith --strict maybe` wrote `out/maybe` and exited 0 (`tsc`: TS6231, exit 2). Not investigated.

### Prototype evidence (scratch only, not committed)

The design above was prototyped on `fa114cbe`: steps 1 to 5, about 20 lines, built with `pnpm build`.

- **CLI:** every row of the table exits 1, with the TypeScript message once, and writes `out/a.js`. A tsconfig
  `bogusOption` is reported once with a type-information addon (Program path), with `declaration: true`, with a
  two-profile `depends` chain, and in `--watch` across a rebuild. `websmith` without arguments, `--addonEmitOnly`, a
  file argument, `-o --debug`, `-b`, `--init` and `--showConfig` stay exit 0 with no error. An empty project stays
  exit 0.
- **Unit:** `@quatico/websmith-core` 1292/1292 and `websmith-loader` 197/197 green. In `@quatico/websmith-compiler`,
  one test fails: `command.spec.ts:50` ("should yield default options w/o config and w/o CLI arguments"). Its
  `toEqual` now sees `configErrors: []`. Add it to the expectation; that is the only expected edit to an existing unit
  test.
- **E2E (`pnpm test:e2e --skip-nx-cache`):** core 8, `websmith-loader` 38, examples 11, `bin.test.ts` 95,
  `websmith-loader-test` 104 (+1 skipped, as on `develop`) and `websmith-vite-test` 8, all green.
  `@quatico/websmith-compiler-test` failed **16 of 61**, all in `tests/compile-websmith.test.ts`, and all with
  `<test dir>/tsconfig.json (6,15)` or `(7,15): Argument for '--target' option must be: …`.
- **Cause of the 16:** the test's own helper writes an invalid `tsconfig.json`. `convertTsCompilerOptionsToJson`
  (`packages/compiler-test/tests/compile-websmith.test.ts:1339-1377`) renders `target` through the reverse map
  (`:1349-1350`). `ts.ScriptTarget[99]` is `"Latest"`, so the file gets `"target": "latest"`, which `tsc` rejects
  with TS6046. That is the reverse-map bug #168 fixed in core (`SCRIPT_TARGET_NAMES`, `parsed-command-line.ts:152-158`).
  Today the error is dropped and `target` silently falls back to the default. With `ESNext` written as `"esnext"` in
  that helper, all 37 cases of the file pass on the prototype. So this slice changes the fixture, as the plan expects
  ("every fixture run before and after, differences with `tsc` listed in the PR").
- **Other fixtures:** every tracked `tsconfig*.json` (35), parsed with `getParsedCommandLineOfConfigFile`, has no
  error, including TS18003.

### Tests

Follow `docs/rules/testing.md`: assemble / act / assert, no part comments, `testObj` and `actual`, no shared `testObj`.

**Unit, `packages/core/src/compiler/config/parsed-command-line.spec.ts`** (`describe("parsedCommandLine w/ extra
args")` `:169`, on a virtual system). Give each tsconfig a source file it includes; otherwise its `errors` also
hold TS18003, which only `ResolvedCompilerOptions` drops:

- `{ target: "foo" }` with an existing tsconfig: `errors` holds one 6046. Red today.
- `{ files: [], addonEmitOnly: true, build: true }` with an existing tsconfig: `errors` is `[]`. This is the
  regression guard for trap 1; it fails a naive fix.
- a tsconfig with a missing `}`: `errors` holds TS1005 with `file`. Red today.
- a tsconfig with `"bogusOption": true`: `errors` holds TS5023 with `file`. Green today; keeps it.

**Unit, `packages/core/src/compiler/options/ResolvedCompilerOptions.spec.ts`** (new `describe("configErrors")`, near
`describe("cliArgs")` `:777`):

- a tsconfig with `bogusOption` gives `configErrors` with TS5023 once, also when `options.cliArgs.errors` holds the
  same diagnostic (dedup);
- `options.cliArgs.errors` with a file-less 6046 is in `configErrors` and in `cliArgs.errors`;
- the same 6046 passed only in the **loader options'** `cliArgs.errors` is **not** in `configErrors` (trap 4);
- a tsconfig whose `include` matches nothing gives no TS18003;
- with two profiles, `getOptions("a")` / `getOptions("b")` add nothing to `configErrors` (no profile re-parse).

**Unit, `packages/core/src/compiler/Compiler.spec.ts`:**

- in `describe("compile")` (`:1031`), with `cliArgs.errors` holding a 6046 and a profile `b` depending on `a`, the
  reporter holds the message once and the output file is written. A naive report in `report()` prints it twice;
- `compile().diagnostics` does not contain it;
- in `describe("watch")` (`:2080`), the same input reports it once after `watch()` and a rebuild (pattern of
  `:2185-2206`).

**Unit, `packages/core/src/compiler/ModuleCompiler.spec.ts`** (`describe("ModuleCompiler option errors")` `:342`):

- a tsconfig with `bogusOption` gives TS5023 once in `getConfigErrors()`;
- `takeUnreportedConfigErrors` gives it to the first module only;
- after `updateLoaderConfig` with the tsconfig fixed, it is gone.

**Unit, `packages/compiler/src/command.spec.ts`:** update `:50` as described above. `command.spec.ts`'s injected
`Compiler` reports to its own reporter, whose `compile()` errors the exit code does not track (`command.ts:87`). Prove
the exit code end to end instead.

**e2e, `packages/compiler/src/bin.test.ts`**, next to "should exit with status 1 and report the TypeScript option
error once w/ several files on fast path" (`:564-584`):

- `--target foo`: status 1, `Argument for '--target' option must be` exactly once, and `getOutput("test.js")`
  defined. Red today (status 0).
- tsconfig `"bogusOption": true`, via `createTsConfig({ …, bogusOption: true } as TscArguments)`: status 1,
  `Unknown compiler option 'bogusOption'.` exactly once, output written. Red today.
- the same with a type-information addon (`createAddon("type-info-addon", "exports.activate = () => {};")`, as at
  `:597`): once.
- a `tsconfig.json` with a missing `}`, written directly: status 1, `'}' expected.` once.
- guard: `--addonEmitOnly` and a file argument with a valid project: status 0, and the output has no
  `Unknown compiler option`. Fails a naive fix.
- Assert messages and counts, not line/column: `createTsConfig` (`:1708`) pretty-prints the JSON.

**e2e, `packages/webpack-test/tests`:** one new file modelled on `webpack-loader-option-errors-once.test.ts` (its
`runWebpack` at `:79` and `countOf` at `:118`). Use a tsconfig with `"bogusOption": true` over at least two modules,
one loader rule: exit non-zero, `Unknown compiler option 'bogusOption'` exactly once. Red today: absent. Do not edit
#181's file; `bug/loader-unknown-profile-error` adds loader e2e cases too.

**Gates**, all green locally: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`,
`pnpm test:e2e --skip-nx-cache`. Run `pnpm build` before the e2e. State whether the advisory TS 6.0.3 cell is green:
TypeScript 6 changes some messages, so assert codes and stable message prefixes only.

### Release notes and docs

- **`Release-Notes.md`**, under `## [Unreleased]` / `### Changed`, after the `.d.ts` / JavaScript syntax-error entry.
  Do not repeat the lead sentence ("Builds that passed before can now fail …"); wave 1 added it. Follow the plan's
  Changelog:
  - "`websmith` reports invalid options once per build, also in watch mode, still writes the output, and exits 1:
    - options in `tsconfig.json`, such as an unknown option (TS5023) or an invalid value (TS6046);
    - a `tsconfig.json` that is no valid JSON, or whose `extends` target is missing;
    - invalid values of command-line flags, such as `--target foo`.

    Before, it printed nothing and exited 0. The webpack loader and the Vite plugin report the `tsconfig.json` errors
    once per compilation."
  - Add the exit-code difference: "`tsc` exits 2 when it reports errors but still emits, and 1 without output for
    command-line errors; websmith exits 1 and writes the output in both cases."
- **`packages/compiler/README.md`:** add the plan's exit-code paragraph after the TS5042 paragraph (`:86`). websmith
  exits 1 for every failure, including option and configuration errors after which it still writes the output.
  Scripts that test for `tsc`'s `2` must test for non-zero.
- **`packages/webpack/README.md`:** in the configuration-errors paragraph (`:99-109`), add that errors in
  `tsconfig.json` (unknown options, invalid values, invalid JSON) are configuration errors too.

### Done when

- Every row of the measured table except TS18003 exits 1 with its TypeScript code once, and writes the output.
- The guard tests pass: no TS5023 for `--files` / `--addonEmitOnly`, no TS6369 for `-b`, no loader 6046 from numeric
  enum options, and no TS18003.
- One report per `compile()` and per `watch()` session, regardless of the number of profiles and rebuilds.
- The loader reports a tsconfig error once per compilation (webpack-test e2e).
- `@quatico/websmith-compiler-test` is green with the helper fix of step 4, and no other existing e2e expectation was
  changed.
- The PR body lists: the four traps, the 16 `compile-websmith` cases and their `"latest"` cause, the TS18003 and emit decisions, the `--moduleResolution` finding, the
  `ctx.getCliArgs().errors` change for addons, and the before/after fixture run.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`, then give it a descriptive title.
- Append `→ #<number>` to the `bug/report-config-option-errors` line in the plan's `## Slices` (under "### Option
  errors"), before its `<!-- builds: -->` comment, and commit that on this branch.
- Commits use Arlo's notation without a colon (`commit-notation` skill), e.g.
  `B Reports tsconfig.json and command-line option errors once per build` and
  `B Passes only TypeScript flags to parseCommandLine`.

### Repo facts

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (put it first on `PATH`). The Homebrew pnpm 11 fails with
  E401. Set `NX_DAEMON=false` in agent shells.
- Install with `pnpm install --frozen-lockfile --offline`. Never edit `~/.npmrc`. This branch needs no new package.
- `bin.test.ts` and webpack-test run the built packages: `pnpm build` first.
- New files carry the MIT header (`pnpm license:add`). Do not add them to the `license:check` list.
- Use `trash`, never `rm`.

### Scope guard

This branch owns:

- `packages/core/src/compiler/config/parsed-command-line.ts`: `parsedCommandLine` only (`:18-150`); not `createArgs`
  or the target and module tables (`:152-223`);
- `packages/core/src/compiler/options/ResolvedCompilerOptions.ts`: the new field, the constructor lines that read
  `options.cliArgs?.errors` and `parsedTsConfig`, and `:250`;
- `packages/core/src/compiler/Compiler.ts`: one statement at the start of `compile()` (`:142-157`) and one as the first
  statement of `watch()` (`:219-220`);
- `packages/core/src/compiler/ModuleCompiler.ts`: `getConfigErrors` and its doc comment (`:204-211`) only;
- `packages/compiler-test/tests/compile-websmith.test.ts`: the `target` case of `convertTsCompilerOptionsToJson`
  (`:1349-1350`) only;
- the specs and e2e files named above, `Release-Notes.md`, `packages/compiler/README.md`, `packages/webpack/README.md`
  (`:99-109`), and the `→ #<PR>` on this slice's plan line.

Do not touch:

- **`Compiler.ts` below `watch()`'s first line** (`:221-253`), `registerWatch` (`:916-950`), `closeAllWatchers` and
  `CompilationContext.ts`. They belong to `bug/watch-generator-added-files`. Keep your `watch()` hunk to one line
  above theirs;
- `report()` (`:670-693`), `emitWatchedFile` (`:844-858`), `transpileSourceCode` and its 6046 filter (`:1436`), and
  `ModuleCompiler.takeFileLessErrors`. They belong to `bug/report-file-less-diagnostics`;
- in `ResolvedCompilerOptions.ts`, the profile lines (`:182-198`: `profiles` loader option, `convertProfileEnumOptions`,
  `resolveProfile`) and `resolve-profile.ts`; in `ModuleCompiler.ts`, `checkProfile` (`:435`) and
  `updateLoaderConfig` (`:236-244`), the class comment (`:137-144`) and the top of `build`;
  `packages/webpack/src/TsCompiler.ts`; `command.spec.ts:558-576` and `:614-638`. They belong to
  `bug/loader-unknown-profile-error` (brief: `.plot/briefs/loader-unknown-profile-error.md`, Scope guard);
- `defaults.ts` (`tsDefaults`), `options.ts`, `AddonRegistry.ts`, `check-esm.ts` (`bug/typescript-6-own-compilations`);
- `packages/node/**` (`bug/node-tsc-ignore-config`), `packages/api`, `packages/webpack/src`, `packages/vite/src`;
- `package.json` files, `pnpm-lock.yaml`, tsconfigs, `.github/`, snapshots.

**Real overlaps, all textual:**

- `Compiler.ts` `watch()`, `Compiler.spec.ts` `describe("watch")`, `bin.test.ts` and `Release-Notes.md` with
  `bug/watch-generator-added-files`. Both only add or edit separate hunks. Whoever merges second rebases.
- `ResolvedCompilerOptions.ts` (theirs `:28`, `:183-198`), `ResolvedCompilerOptions.spec.ts` (theirs
  `describe("profile")`), `ModuleCompiler.ts`, `ModuleCompiler.spec.ts` (theirs a new describe), `command.spec.ts`,
  `packages/compiler/README.md` (theirs `:80`) and `packages/webpack/README.md` (theirs `:78`, yours `:99-109`) with
  `bug/loader-unknown-profile-error`. Different methods and lines, but the same files. That slice reports profile errors through the reporter during option resolution, which
  `ConfigErrorReporter` collects. Your field does not replace that path; do not merge the two.
- `Release-Notes.md` with every branch in flight: append-only, keep all entries.

If you find something the plan did not anticipate beyond the items above, report it rather than improvising outside
scope.
