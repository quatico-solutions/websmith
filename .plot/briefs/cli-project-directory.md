<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — cli-error-exit-gaps (wave 1: Project resolution)

- **Plan (canonical):** `docs/plans/2026-10-02-cli-error-exit-gaps.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #136 merged
- **Branch:** `bug/cli-project-directory` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on `PATH`); the implementer never merges it
- **Review of the code:** independent review, plus uncached gates run by the maintainer's session before merge

Wave 1 of 7 and waits on nothing. The plan's waves are sequential, one branch each, so every other slice of this
plan waits on it: next come `bug/cli-config-parse-and-addons-dir` and `bug/emit-skipped-rule`. The plan puts `-p`
first and alone because it is the widest silent success, and a regression here breaks every user.

### What to build

`websmith --project <path>` resolves its path the way `tsc` does. Today any `--project` value that is not an
existing file compiles nothing, prints nothing and exits 0. The panel ran it on `develop` (`ci-user.md`,
`tsc-parity.md`, both executed):

| Case | `tsc` 5.7.3 | websmith on `develop` | After this branch |
|------|-------------|-----------------------|-------------------|
| `-p .` (syntax error in `a.ts`) | reports it, writes `a.js` | nothing, exit 0 | compiles `./tsconfig.json`, exit 1 |
| `-p ./tsconfig.json` (same project) | same | reports it, exit 1 | unchanged |
| `-p <absolute directory>` | compiles | nothing, exit 0 | compiles `<dir>/tsconfig.json` |
| `-p missing.json` | TS5058, exit 1 | nothing, exit 0 | error 5058 with the absolute path, exit 1 |
| `-p emptydir` | TS5057, exit 1 | nothing, exit 0 | error 5057 with the absolute path, exit 1 |
| `-p tsconfig.json src/a.ts` | TS5042, exit 1 | compiles `src/a.ts` | unchanged (deliberate difference) |

**Root cause.** `parsedCommandLine` takes the tsconfig branch only `if (tsConfigFile && system.fileExists(tsConfigFile))`
(`packages/core/src/compiler/config/parsed-command-line.ts:74`). A directory or a missing file fails that check
and falls through to `:136-147`, which returns no root files and no error. The same guard appears twice more:
`ResolvedCompilerOptions.ts:201`, the `parsedTsConfig` used for file discovery, and `:352`, the `tsConfigOptions` in
`getTsConfig`. So a directory also loses every tsconfig option. And `buildDir = path.dirname(this.tsConfigFile)`
(`:162-163`) becomes the directory's parent, which breaks every path resolved against `buildDir` (`addonsDir` `:171`,
CLI options `:182`, `outDir`/`rootDir` `:186-192`).

Note that the plan's citation `parsed-command-line.ts` has no `options/` directory: the file is under
`packages/core/src/compiler/config/`.

The plan is canonical; this brief is orientation.

### Settled decisions — do not re-derive them

**Normalise once, in one helper, before any of the three guards runs.** The plan puts the normalisation in
`resolvePathsWithRules` (`ResolvedCompilerOptions.ts:35-77`). The rejected alternative is a fix at
`parsed-command-line.ts:74` alone. It leaves `:201` and `:352` reading nothing, so `-p dir` would find the files but
lose the tsconfig options, and `buildDir` would still be the parent. The panel's compiler juror counted the
tsconfig parsed four times and the guard in three places (`panel.md`, difference 6).

**Ordering trap the plan does not spell out.** `createOptions` (`packages/core/src/compiler/options/options.ts:28-33`)
calls `parsedCommandLine(project, …)` *before* `resolveCompilerOptions` constructs `ResolvedCompilerOptions`. So if
you only change `resolvePathsWithRules`, the `:74` guard still receives the raw directory and still returns an
empty file list. Put one function in `config/` (beside `resolvePath`, exported from `config/index.ts`) that maps a
project path to the tsconfig file. A directory becomes `<dir>/tsconfig.json`, a file stays as it is, and the result
is idempotent. Call it in `resolvePathsWithRules` and on the `project` that `createOptions` passes to
`parsedCommandLine`. Because it is idempotent, calling it on an already-normalised file is harmless. Report the
error only in `ResolvedCompilerOptions`: it holds the reporter, and `parsedCommandLine` has none. Per the plan,
`command.ts:79` and `find-config.ts` use the same helper rather than their own logic.

**Do not build the helper on `ts.findConfigFile` / `find-config.ts`.** `ts.findConfigFile` walks *up* the parent
directories. That is `tsc`'s behaviour *without* `-p`, not with it. For `-p emptydir` it would silently pick up a
parent's `tsconfig.json`, and TS5057 would never fire. `findConfigFile` also has no production caller today (grep:
only `find-config.spec.ts`). The plan's "reuse" means that `find-config.ts` uses the new helper, not the other way
round.

**Report a diagnostic; do not throw.** `parsedCommandLine` throws for invalid arguments (`:24`, `:51`). An uncaught
throw on the CLI ends in a stack trace, which is item 4 of this plan (`SyntaxError` with stack, ran). Report a
`ts.Diagnostic` with `category: Error`, `code: 5058` or `5057`, `file: undefined`, and `tsc`'s message text:
`The specified path does not exist: '<abs>'.` / `Cannot find a tsconfig.json file at the specified directory: '<abs>'.`
`ErrorTrackingReporter` (`command.ts:78`) then sets `process.exitCode = 1` (`:155-157`). No exit-code code changes.
`DefaultReporter` prints a file-less diagnostic as `Error: 5058: …` (`DefaultReporter.ts:60`), without a `TS`
prefix, so assert on `5058`, not on `TS5058`.

**Name the resolved absolute path in the message.** CI logs are read without the working directory (`ci-user.md`
approach 4, adopted in the Changelog).

**TS5057 must survive the second resolution.** The CLI resolves the options twice: once in `createOptions` with a
`NoReporter` (`command.ts:107`), and again in `new Compiler(...)` → `setOptions` → `resolveCompilerOptions`
(`Compiler.ts:315`) with the real reporter. The `tsConfigFile` from the first pass flows into the second
(`command.ts:92-93`). If the first pass turns `emptydir` into `emptydir/tsconfig.json`, the second pass sees a
missing *file* and reports 5058. The e2e for `emptydir` must therefore assert `5057`, absence of `5058`, and
exactly one error. Either keep the original path visible to the reporting pass, or make the check recognise
`<dir>/tsconfig.json` where `<dir>` exists.

**Only an explicit `--project` can fail.** `command.ts:79` defaults `project` to `./tsconfig.json`, and so do
`createOptions` (`options.ts:28`) and the webpack loader (`packages/webpack/src/options.ts:16`). Once they reach
core, the explicit and the defaulted value look the same. Running `websmith` with no `-p` and no `tsconfig.json`
in the working directory must behave as today: no 5058. The plan does not say how to carry "explicit". Pick the
narrowest mechanism, and cover the default case with a test (see Done when).

**Exit 1, not `tsc`'s 2. Decided.** websmith exits 1 for every failure (`command.ts:156`), and CI scripts test zero
against non-zero. For this slice there is no gap anyway: `tsc` itself exits 1 for TS5058 and TS5057
(`tsc-parity.md` table). The README exit-code line belongs to slice 4 (`bug/report-config-option-errors`), not here.

**`-p` with file names (TS5042) keeps websmith's behaviour. Decided.** `tsc` refuses the combination; websmith
compiles the named files with the tsconfig's options. That was a deliberate fix (`a3e25466`, "B Fixes an issue
where CLI file names are not passed to the compiler", #84) with `bin.spec.ts` coverage (`:617`, `:681`). Turning it
into an error would break that fix's users. Leave the `tscArgs.fileNames.length > 0` branch at
`parsed-command-line.ts:76` as is, except that it now also receives a normalised directory. Document the
difference in `packages/compiler/README.md`.

**Unchanged invariants.**
- `--configFile` alone does not move the tsconfig. `packages/compiler/README.md:269` says the tsconfig stays
  `./tsconfig.json` unless `--project` is passed. Rule 4 in `resolvePathsWithRules` is never reached from the CLI,
  because `command.ts` always passes `project`. Keep it that way.
- No discovery: websmith does not look for `websmith.config.json` (plan Open Points), and this branch adds none for
  the tsconfig either.
- Do not change `reportedConfigErrors` or the `depends` closure; #134 owns them.

### Done when

The plan's slice line is the specification. These are the assertions that catch a naive fix:

- **CLI e2e in `packages/compiler/src/bin.test.ts`** (use `executeCompilerStatus`, which runs with
  `cwd: PROJECT_DIR`, and assert on `status`):
  - `-p .` on a clean project exits 0 **and writes the output file**. This catches a fix that only reports and
    still compiles nothing.
  - `-p .` with a syntax error in a source file exits 1 and reports the error. This catches a fix in
    `ResolvedCompilerOptions` only: without normalising before `parsedCommandLine` (`options.ts:33`), the file list
    is still empty and the exit is 0.
  - `-p <absolute PROJECT_DIR>` with a **relative** `outDir` in `tsconfig.json` writes the output under
    `<dir>/<outDir>`. This catches a `buildDir` that is still the parent directory.
  - `-p missing.json` exits 1, and the output contains `5058` and `path.join(PROJECT_DIR, "missing.json")`. This
    catches a relative path in the message.
  - `-p emptydir` (an existing directory without `tsconfig.json`) exits 1, the output contains `5057` and the
    absolute directory, contains no `5058`, and has exactly one `Error:` line for it. This catches the
    second-resolution trap and double reporting.
- **Unit tests**, AAA with `testObj` / `actual`, no shared `testObj`, virtual system:
  - `parsed-command-line.spec.ts`: a directory as `tsConfigFile` yields the tsconfig's `fileNames` and options.
  - `ResolvedCompilerOptions.spec.ts`: a directory gives `tsConfigFile = <dir>/tsconfig.json` and `buildDir = <dir>`.
    Missing path → one 5058; directory without tsconfig → one 5057; both with absolute paths. **No `--project`
    and no `tsconfig.json` reports nothing**, which catches erroring on the default `./tsconfig.json`.
  - `command.spec.ts`: the CLI passes the normalised project through.
  - The helper's own spec: file, directory, missing path, idempotence on an already-normalised file.
- Existing `bin.spec.ts` cases for `-p tsconfig.json <files>` stay green (TS5042 difference unchanged).
- `packages/webpack-test` stays green. `ResolvedCompilerOptions` is shared with the loader, so note any change in
  the loader's output in the PR.
- **Gates**, all green locally: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`,
  `pnpm test:e2e --skip-nx-cache`. Run `pnpm build` before the e2e, because `bin.test.ts` runs `bin/bin.js`. New
  files carry the license header (`pnpm license:add`).
- **`Release-Notes.md`**, under `## [Unreleased]` / `### Changed` (replace that section's `TBA`). As the plan's first
  slice, add the lead sentence that builds which passed before can now fail. Then add the entry: `-p <directory>`
  compiles `<directory>/tsconfig.json`; a missing path (5058) or a directory without `tsconfig.json` (5057) is an
  error naming the absolute path; before, all three compiled nothing and exited 0.
- **`packages/compiler/README.md`**: state that `--project` accepts a directory, and document the TS5042 difference
  (websmith compiles named files with the tsconfig's options where `tsc` refuses).

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh` (on `PATH`). Do not use `gh pr create`.
- Once the PR exists, append `→ #<number>` to the `bug/cli-project-directory` line in the plan's `## Slices`, and
  commit that on this branch.
- Commits use Arlo's notation without a colon (`B Resolves --project directories as tsc does`). See the
  `commit-notation` skill.

### Repo facts

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (put it first on `PATH`). The Homebrew pnpm 11 fails with
  E401.
- Install with `--offline`. The Artifactory login in `~/.npmrc` has expired; never edit `~/.npmrc`. If you need a
  registry package, use an empty `NPM_CONFIG_USERCONFIG` file plus `--config.registry=https://registry.npmjs.org/`.
- For Node 24 runtime checks, use `$HOME/.nvm/versions/node/v24.21.0/bin/node`.
- Use `trash`, never `rm`.

### Scope guard

This branch owns:
- `packages/core/src/compiler/config/parsed-command-line.ts`
- the new helper in `packages/core/src/compiler/config/`, plus its export in `config/index.ts`
- `packages/core/src/compiler/options/ResolvedCompilerOptions.ts`
- `packages/core/src/compiler/options/options.ts` (the `project` it hands to `parsedCommandLine`)
- `packages/compiler/src/command.ts`
- `packages/compiler/src/find-config.ts`
- their specs and `packages/compiler/src/bin.test.ts`
- `packages/compiler/README.md`
- `Release-Notes.md`

Do not touch `Compiler.ts` or `packages/webpack/src`.

Branches starting at the same time, checked against their plans on `develop`:
- `bug/tsc-default-target-interop` (#135): adds `config/effective-options.ts`, probably also exported from
  `config/index.ts` (a trivial conflict). It changes `tsDefaults`, so `ResolvedCompilerOptions.spec.ts`
  expectations on resolved defaults may move under you. It also adds a Breaking entry under `### Changed` in
  `Release-Notes.md`, which conflicts with replacing the same `TBA`.
- `bug/esm-check-false-positives` (#137): adds CLI e2e cases to `bin.test.ts`, edits the ESM-check section of
  `packages/compiler/README.md`, and adds a `Release-Notes.md` entry. Expect append conflicts only.
- `infra/typescript-6-toolchain` (#144): repo tsconfigs, `package.json`, `pnpm-lock.yaml`, ts-jest and
  typescript-eslint versions. No file overlap. If it merges first, rerun `pnpm install --offline` and the gates.
- `infra/dependabot-config` (#133, `.github/` only) and `infra/esm-bench-watchdog` (#134, the bench script only):
  no overlap.

If you find something the plan did not anticipate, report it rather than improvising outside scope.
