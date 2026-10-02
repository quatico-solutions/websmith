<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — cli-error-exit-gaps (wave 2: websmith.config.json and addonsDir)

- **Plan (canonical):** `docs/plans/2026-10-02-cli-error-exit-gaps.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #136 merged
- **Branch:** `bug/cli-config-parse-and-addons-dir` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on `PATH`); the implementer never merges it
- **Review of the code:** independent review, plus uncached gates run by the maintainer's session before merge

Wave 2 of 7. It waits on wave 1, `bug/cli-project-directory`, which merged as #147 today, so nothing blocks it.
The plan's waves are sequential, so `bug/emit-skipped-rule` comes next. The plan calls the two "independent and
small", and they share no source file; only `Release-Notes.md` and `bin.test.ts` overlap.

### What to build

Two CLI defects, items 4 and 5 of the plan. The plan and the panel ran both on `develop`.

**Item 4: a malformed `websmith.config.json` ends in a stack trace.** `websmith -c websmith.config.json` with the
content `{` prints `SyntaxError: Unexpected end of JSON input` with a Node stack and exits 1 (`tsc-parity.md`,
`ci-user.md`). The exit code is already a failure, so CI is not fooled. The problem is the message: no file name,
no position, a stack. Root cause: `parse(content ?? "{}")` from `comment-json` at
`packages/core/src/compiler/config/resolve-compiler-config.ts:166` is not caught. On the CLI the throw comes from
the first, silent resolution pass (`createOptions` with a `NoReporter`, `packages/compiler/src/command.ts:108-124`).
That pass calls `resolveCompilationConfig` through `ResolvedCompilerOptions.ts:105` → `loadCompilationConfig`
(`:415`).

Checked here with `comment-json` 4.2.5, the version in core: the thrown `SyntaxError` carries `line` (1-based) and
`column` (0-based) properties. Two examples:
- `{` gives `Unexpected end of JSON input`, line 1, column 1.
- `{"a": 1,,}` gives `Unexpected token ,`, line 1, column 8.

`{"a": }` parses without an error, so do not use it as a fixture.

**Item 5: a missing `--addonsDir` warns twice.** `websmith --addonsDir <missing> -p tsconfig.json` prints
`Addons directory "<abs>" does not exist.` twice. The first warning comes from `addonConfig` in `command.ts:185-188`
(the plan says `:183-185`; the lines have moved since). The second comes from `AddonRegistry.loadAddonsSync`
(`packages/core/src/compiler/addons/AddonRegistry.ts:355-357`), which the registry's constructor runs when
`command.ts:162` creates it.

The plan is canonical; this brief is orientation.

### Settled decisions — do not re-derive them

**Catch the parse error in `resolveCompilationConfig` and report it there.** Put the try/catch around the `parse`
call only. Report one `ErrorMessage` and return `{}`, as the missing-file branch at `:161-162` already does.

The rejected alternative is catching in the CLI (`command.ts`) or relying on the outer handler. That would fix only
the CLI. It would also leave the webpack loader, which calls the same function (`packages/webpack/src/options.ts:54`),
depending on a throw. The plan puts the fix in core (`resolveCompilationConfig`), and core already reports every
other configuration error as an `ErrorMessage` (missing file `:162`, unknown `depends` `:178`, `esm` validation
`:105-135`).

**What the message contains.** It is one line, with no stack and no `SyntaxError` name. It contains:
- the resolved absolute path (`resolvedPath`, as the "No configuration file found" message uses it);
- the parser's message;
- the position when `comment-json` provides it, as 1-based line and column, so print `column + 1`.

A suggested wording: `Invalid JSON in configuration file "<abs>" (line 1, column 9): Unexpected token ,.` The exact
wording is your choice; the content above is not. Read `line` and `column` defensively, because they are untyped,
own properties of the error. When they are missing, omit the position rather than printing `undefined`.

**Absolute path, not the raw argument.** The other configuration errors in this file quote `configFilePath` as the
user passed it. For this error, use `resolvedPath`: CI logs are read without the working directory (`ci-user.md`,
the same reason slice 1 used the absolute path for 5058 and 5057). Do not change the wording of the other messages.

**Exit code: no new code.** `ErrorMessage` has category `Error`. `ErrorTrackingReporter` therefore marks the run,
and `command.ts:170-172` sets `process.exitCode = 1`. Do not add any exit-code handling.

**It is reported once on the real CLI, and that falls out without extra code.** The first pass (`createOptions` with
a `NoReporter`) now completes instead of throwing. The second pass (`new Compiler(...)` → `setOptions` →
`resolveCompilerOptions`) reports with the real reporter. The e2e must still assert exactly one `Error` line. If it
shows two, a caller outside the two passes resolves the config again, so find that caller rather than deduplicate.

With an injected `Compiler` (`command.spec.ts`), `createOptions` gets the real reporter and `setOptions` resolves
again. The existing "No configuration file found" spec (`command.spec.ts:140-152`) therefore uses
`toHaveBeenNthCalledWith(1, …)`. Mirror it; do not assert a call count there.

**Keep the empty-file behaviour.** `if (content)` at `:165` skips an empty file and returns `{}` without an error. A
spec pins this (`resolve-compiler-config.spec.ts:30-36`, "existing path but invalid config file", content `""`).
The plan names only malformed content, so do not widen the slice to empty files.

**No config discovery. Decided.** Only a file passed with `--configFile` is read (`README.md:57`). A malformed
`websmith.config.json` that is not passed is not read, so it is not an error. The panel raised this (`panel.md`
row "only discovered (no `-c`)"), and the plan's Open Points close it as out of scope.

**The `addonsDir` warning stays only in the `AddonRegistry`. Decided.** Delete the `directoryExists` check and its
`WarnMessage` in `addonConfig` (`command.ts:185-188`). Keep `resolvedAddonsDir` and its use in the returned config.

The rejected alternative is keeping the CLI's warning and silencing the registry's. The registry is the only place
that also warns for the node API, `packages/testing` and the `addonsDir` from `websmith.config.json`, and the plan
says "the `AddonRegistry` (drop `command.ts:183-185`)".

Check that every CLI case which warned before still warns. The registry is created or reconfigured only when
`shouldLoadAddons` (`command.ts:153-155`) holds. That requires `options.config.addonsDir`, which `createOptions`
fills from `--addonsDir` (`options.ts:25`, `:55`). The e2e below proves it.

**A second duplicate source, not in this slice.** `Compiler.setOptions` calls `this.addons.setConfig(...).refresh()`
(`packages/core/src/compiler/Compiler.ts:330-338`). `setConfig` already calls `refresh()`, so a registry that exists
before `setOptions` loads twice and warns twice. On the real CLI the registry is created after `setOptions`
(`command.ts:144-163`), so the e2e is not affected. It is visible with an injected registry, as in
`command.spec.ts:353-369`, the node API and `packages/testing`.

Do not edit `Compiler.ts`: #161 and later slices of this plan own it. Name the double `refresh()` in the PR as a
follow-up. For the same reason, write the "warns once" unit assertion against the test without an injected registry
(`command.spec.ts:371-381`), not against the one with an injected registry.

**Leave the loader's own parse alone.** `packages/webpack/src/webpack-hooks.ts:172-207` parses the config per module
and `console.warn`s a `SyntaxError`. `bug/loader-resolve-options-once` removes that tap, so do not touch
`packages/webpack/src`.

### Done when

- **e2e in `packages/compiler/src/bin.test.ts`.** Each assertion below catches what a naive fix lets through:
  - Malformed config: write `websmith.config.json` with content `{` and a valid `tsconfig.json` and source, then run
    `--project tsconfig.json --configFile websmith.config.json`.
    - Status is 1.
    - The output contains `path.join(testDirs.PROJECT_DIR, "websmith.config.json")`, so a relative path fails.
    - The output contains no `SyntaxError` and no line matching `/^\s+at /`, so a rethrow or a printed stack fails.
    - Exactly one line matches `/Error/`, and it names the file, so double reporting fails. The existing test at
      `:676-691` shows the pattern.

    Write the file with `fs.writeFileSync`: `createWebsmithConfig` (`:1199`) serialises valid JSON.
  - Missing `--addonsDir`: extend the existing test at `:560-572` (the plan cites `:455`; it has moved). Keep status 0
    and `does not exist`. Add a count: exactly one line contains `Addons directory "<abs>" does not exist.` A count
    of 2 is the bug.
- **Unit tests**, AAA with `testObj` / `actual`, no shared `testObj`, virtual system, and a `jest.fn()` reporter as
  `target`:
  - `resolve-compiler-config.spec.ts`:
    - Content `{` reports one `ErrorMessage` whose text contains the resolved absolute path, `line 1` and the
      parser's message. The call returns `{}` and does not throw.
    - Content `{"a": 1,,}` reports column 9, which catches the 0-based column.
    - A malformed config with `profileName` set reports no profile errors.
    - The empty-content case still returns `{}` and reports nothing.
  - `command.spec.ts`:
    - A malformed `--configFile` gives `config` `{}`, and the reporter's first call is the parse `ErrorMessage`.
    - `--addonsDir ./unknown` without an injected registry reports the "does not exist" warning exactly once. Count
      only that message; the reporter may get other calls.
- **Loader.** `packages/webpack/src/webpack.test.ts:1209-1222` ("should handle configuration file loading errors",
  `{ invalid json syntax`) must stay green. After this change the failure reaches webpack as a reported
  configuration error (`webpack-hooks.ts:120-130`, `reportedConfigErrors`) instead of a throw. State this change in
  the loader's output in the PR, as the plan's Open Point "Webpack loader" requires. Run `packages/webpack-test` as
  well.
- **Gates**, all green locally: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`,
  `pnpm test:e2e --skip-nx-cache`. Run `pnpm build` before the e2e, because `bin.test.ts` runs `bin/bin.js`.
- **`Release-Notes.md`**, under `## [Unreleased]` / `### Changed`, appended after the existing entries. Do not repeat
  the lead sentence: wave 1 added it. Add two entries:
  - A malformed `websmith.config.json` passed with `--configFile` is reported as a configuration error naming the
    file and the position, with exit code 1, instead of a `SyntaxError` stack trace. The webpack loader reports it
    the same way.
  - A missing `--addonsDir` directory is warned about once instead of twice.
- **README.** The plan names no README duty for this slice: no CLI flag, config key or API changes.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh` (on `PATH`). Do not use `gh pr create`.
- Once the PR exists, append `→ #<number>` to the `bug/cli-config-parse-and-addons-dir` line in the plan's
  `## Slices`, and commit that on this branch.
- Commits use Arlo's notation without a colon, for example
  `B Reports a malformed websmith.config.json as a configuration error` and
  `B Warns about a missing addonsDir once`. See the `commit-notation` skill.

### Repo facts

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (put it first on `PATH`). The Homebrew pnpm 11 fails with
  E401.
- Install with `--offline`. The Artifactory login in `~/.npmrc` has expired; never edit `~/.npmrc`. If you need a
  registry package, use an empty `NPM_CONFIG_USERCONFIG` file plus `--config.registry=https://registry.npmjs.org/`.
- For Node 24 runtime checks, use `$HOME/.nvm/versions/node/v24.21.0/bin/node`.
- Use `trash`, never `rm`.

### Scope guard

This branch owns:
- `packages/core/src/compiler/config/resolve-compiler-config.ts` and its spec
- `packages/compiler/src/command.ts` (the `addonConfig` warning only) and `command.spec.ts`
- `packages/compiler/src/bin.test.ts`
- `Release-Notes.md`
- the `→ #<PR>` on this slice's line in the plan

Do not touch:
- `Compiler.ts`, `AddonRegistry.ts`, `ResolvedCompilerOptions.ts`
- anything under `packages/webpack/src`

Other branches in flight or starting now, checked against `develop`, their plans and their open PRs:
- `bug/tsc-default-target-interop` (#161, merging soon) edits `command.spec.ts` (hunks near `:84` and `:113`, the
  project tests), `bin.spec.ts`, `Compiler.ts`, `config/index.ts` and `Release-Notes.md` (`### Changed`).
  - Its `command.spec.ts` hunks are far from the `addCompileCommand#addons` block (`:353`); expect at most a trivial
    merge there.
  - `Release-Notes.md` gets an append conflict in `### Changed`.
  - If it merges first, rebase and rerun the gates: it changes resolved defaults.
- `bug/esm-check-import-misses` (#160, merging soon) adds cases to `bin.test.ts` and an entry to `Release-Notes.md`.
  These are append conflicts only. Its other files (the ESM check, the README ESM section, webpack-test) do not
  overlap.
- `bug/loader-resolve-options-once` (docs/plans/2026-10-02-loader-options-once.md, starting now) removes the
  per-module `loader` tap in `webpack-hooks.ts`, including its own `comment-json` parse. Its slice adds the e2e
  "break `websmith.config.json` under watch, error shown, fix, clean".
  - No shared file.
  - It is a semantic collision: after this slice, the "error shown" for a malformed config in the loader is this
    slice's `ErrorMessage` from `resolveCompilationConfig`, not a thrown `SyntaxError`. Whichever lands second asserts
    against the other's behaviour. Name the message text in your PR so that branch can match it.
  - It may also edit `webpack.test.ts:1209`; you only need that test to stay green, not to edit it.
- `bug/trim-runtime-dependencies` (docs/plans/2026-10-01-dependency-updates.md, starting now) touches
  `browser-system.ts`, `packages/core/package.json` (drops `path`; `comment-json` stays), the node and compiler-test
  `package.json`, `pnpm-lock.yaml` and `Release-Notes.md`. Only `Release-Notes.md` overlaps, as an append conflict.
  If it merges first, rerun `pnpm install --offline`.
- `infra/typescript-6-toolchain` (docs/plans/2026-10-02-typescript-6-support.md, in progress) touches the repo
  tsconfigs, `package.json`, `pnpm-lock.yaml`, the ts-loader, ts-jest and typescript-eslint versions, and
  `fusion-fs.ts`. No file overlaps. If it merges first, rerun `pnpm install --offline` and the gates.

If you find something the plan did not anticipate, report it rather than improvising outside scope.
