<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — typescript-6-support (slice: typescript-6-peer-range)

- **Plan (canonical):** `docs/plans/2026-10-02-typescript-6-support.md` on `develop` (slice line `:336`, heading
  "Peer range"; Design: supported range `:108`–`:110`, pinned dev version `:123`–`:131`, published artifacts
  `:132`–`:136`, CI matrix `:145`–`:160`; open points 1, 4 and 8 at `:254`, `:265` and `:278`; Changelog `:32`–`:38`
  and `:57`–`:58`)
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #144 merged
- **Branch:** `feature/typescript-6-peer-range` (base: `develop` at `d53a1d4f`, the merge of #206)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH); the implementer never merges it
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

**Ordering.** This is the plan's last slice. Everything it builds on has merged: toolchain #166, CI leg #171,
fixtures #183, websmith-node #184, bench #190, measurement #199, own compilations #189, TS5011 once #200, module kinds
#203 and CLI peer #206 (`d53a1d4f`). After this PR the plan can be delivered. Open beside you:
- **Dependabot #186** (development group: eslint 10, typescript-eslint 8.71.1, jest 30 types) and **#195**
  (handlebars) edit `pnpm-lock.yaml` and most `package.json` files. #186 is `CONFLICTING` today. Neither touches a
  `typescript` line. If one merges first, rebase and redo the lockfile procedure below on top of it. Never resolve
  conflict markers in `pnpm-lock.yaml` by hand.
- **`feature/vite-plugin-dev-invalidation`** has a brief on `develop` (`d6219930`) and may run beside you. It edits
  `packages/vite/src/**` and `Release-Notes.md`. You touch only two lines of `packages/vite/package.json` and add your
  own Release-Notes entries. Whoever merges second rebases.
- **Ends #206's release warning.** #206's PR body says: "do not release 0.11.0 between this PR and
  `feature/typescript-6-peer-range`". That warning lives only in #206's body, not in a repo file. This PR ends the
  interim state, and its body says so with the evidence below.

### What changed on `develop` since the plan was approved

Every line number below is from `d53a1d4f`.

- **The `typescript` lines today** (measured in every manifest and in the packed tarballs):

  | Package (published name) | `peerDependencies.typescript` | `devDependencies.typescript` | `tslib` dependency | lib files that `require("tslib")` |
  |---|---|---|---|---|
  | root (`private`) | — | `5.7.3` (`package.json:74`) | devDependency `2.8.1` (`:73`) | — |
  | `@quatico/websmith-api` | `5.x` (`packages/api/package.json:38`) | `5.7.3` (`:64`) | none (no `dependencies` block) | 7 |
  | `@quatico/websmith-core` | `5.x` (`packages/core/package.json:47`) | `5.7.3` (`:75`) | none | 35 |
  | `@quatico/websmith-node` | `5.x` (`packages/node/package.json:46`) | `5.7.3` (`:81`) | none | 7 |
  | `@quatico/websmith-testing` | `5.x` (`packages/testing/package.json:44`) | `5.7.3` (`:70`) | none | 4 |
  | `websmith-loader` | **none** (peers `webpack` only, `packages/webpack/package.json:41`–`:43`) | `5.7.3` (`:68`) | none | 8 |
  | `@quatico/websmith-examples` | `5.x` (`packages/example-addons/package.json:39`) | `5.7.3` (`:68`) | none (no `dependencies` block) | 15 |
  | `@quatico/websmith-compiler` | `>=5.7 <7` (`packages/compiler/package.json:83`–`:85`, #206) | `5.7.3` (`:78`) | `2.8.1` (`:48`) | 3 (bundle: none) |
  | `@quatico/websmith-vite` (`private`) | `>=5.7 <7` (`packages/vite/package.json:54`) | `5.7.3` (`:80`) | none | 8 |
  | `@quatico/websmith-compiler-test`, `websmith-loader-test`, `websmith-vite-test` (`private`) | — | `5.7.3` (`:47`, `:52`, `:38`) | — | — |

- **The compiler and the Vite plugin already have the range.** The plan lists `api`, `core`, `node`, `testing`,
  `example-addons` and `websmith-loader`. **Resolution:** change exactly those six; leave `compiler` and `vite`
  peers as they are.
- **The root `package.json` carries the pin too** (`:74`). #206's brief forbade root `package.json` changes.
  **Resolution:** "dev pin 6.0.3 in every manifest" includes the root's `devDependencies.typescript`. That one line is
  the only root `package.json` change this slice commits.
- **Every package `require`s `tslib`, only the CLI declares it.** The root `tsconfig.json:18` sets `importHelpers`.
  This is the case since the first commit, and published 0.10.0 has it too (`websmith-loader@0.10.0`,
  `@quatico/websmith-core@0.10.0` from npm: no `tslib`, 8 and 28 requiring files). Measured, below: with the
  loader, websmith-node or api installed without the CLI, `require` fails with `Cannot find module 'tslib'`, in npm
  and pnpm projects alike. That includes #206's guard: `typescript-guard.js` loads core's `check-typescript.js`, which
  `require`s `tslib` first, so its messages never show. The plan's own e2e ("pnpm strict resolution … loads
  `typescript` through the loader's own peer") cannot pass without it (measured).
  **Resolution:** in scope, as its own `B` commit. This slice already edits these manifests' dependency sections and
  the lockfile importers, and the plan's e2e needs it.
  - *Rejected: a separate bug issue.* The e2e this slice must add stays red until it lands, and a second lockfile PR
    would touch the same importer blocks.
  - *Rejected: drop `importHelpers`.* It changes the emitted JS of every package and the CLI bundle. Declaring the
    dependency is the conventional fix and matches the CLI.
- **The loader's peer only matters in workspace layouts (measured).** In a single pnpm project, Node's lookup from
  `node_modules/.pnpm/<pkg>/node_modules/<pkg>/lib` walks up to `<project>/node_modules`, so the project's own
  `typescript` is found even with `hoist=false` and without a loader peer. The difference shows in a pnpm workspace
  whose app has `typescript` and whose root does not: with `hoist=false` and no loader peer, the loader's guard throws
  "none was found"; with the peer, it loads the app's 6.0.3. **Resolution:** the e2e models exactly that layout.
- **The e2e must run offline**, as #206's does. A real `pnpm install` needs the registry for comment-json, webpack and
  the rest. **Resolution:** the e2e builds the strict layout by hand from the packed manifests (each package sees
  exactly its `dependencies` and `peerDependencies`). The prototype (below) gives the same three outcomes as real
  pnpm 10.8.0.
- **The packed types need `esModuleInterop` on 5.x.** Every published `.d.ts` that uses `typescript` starts with
  `import ts from "typescript"`. A 5.7.3 consumer without `esModuleInterop` gets one TS1259 per such file (47 in api,
  core and testing). This happens with today's 5.7.3-built packs too, and 6.x defaults `esModuleInterop` to true.
  **Resolution:** the CI fixture sets `"esModuleInterop": true`, as nearly every consumer does. The default-import
  shape is a follow-up (Not in this slice).
- **There are no required status checks.** `gh api …/branches/develop/protection` gives `required_status_checks`
  with `contexts: []` (and `main` has `contexts: []` with `strict: true`). The plan's "the override cell added to the
  required checks" is a branch-protection setting, not a repo file. **Resolution:** remove `continue-on-error` so the
  cell fails the run. The required-check setting is the maintainer's after merge. Do not call the branch-protection
  API. Say so in the PR.
- **CI today** (`.github/workflows/pull-request.yml`): matrix `:19`–`:31` with `advisory` keys; `continue-on-error:
  ${{ matrix.advisory }}` at `:14`; comments `:17`–`:18`; install steps `:44`–`:52` keyed on `matrix.advisory`; the
  version assertion `:54`–`:72` reads `matrix.typescript`; lint/test/build/e2e `:74`–`:88`. CI runs pnpm 9
  (`pnpm/action-setup@v6`, `version: 9`, `:40`–`:42`). `docs/rules/workflow.md:16`–`:17` describes "an advisory
  TypeScript 6.0.3 cell".
- **The TypeScript 7 how-to does not exist.** #206's messages say "(see README)", and `README.md:31`–`:36` and
  `packages/compiler/README.md:23`–`:28` quote them, but no README section explains the setup. The side-by-side
  recipe was measured (below). One fact shapes it: `node_modules/.bin/tsc` is ambiguous with an alias. npm links the
  `typescript` package's `tsc` (6.0.3), and pnpm links the alias's (7.0.2). So the how-to runs 7.x by path.
- **The TS6 specs that compare against code-under-test values** (#183/#189 reviews, assigned here by #206's brief).
  They are on `develop`:
  - `packages/core/src/compiler/Compiler.spec.ts:6011`–`:6015`, `:6025`–`:6029`, `:6041`–`:6045`: expected targets
    are `getEffectiveTarget({ module })` (`:15` imports it from `./config`; the subject reads `target` through it)
    and `ts.getDefaultCompilerOptions().target`.
  - `Compiler.spec.ts:5185`: the expected message embeds `scriptTargetToString(ts.getDefaultCompilerOptions().target!)`,
    a product function.
  - `packages/core/src/compiler/esm/check-esm.spec.ts:730`–`:734`: `getEmittedModuleKind({})` is expected to equal
    `getEmittedModuleKind({ target: getEffectiveTarget({}) })`, so the subject is compared with itself.
  - `packages/core/src/compiler/config/effective-options.spec.ts:41`–`:49` and `:52`–`:61`: expected
    `ts.getDefaultCompilerOptions().target`, which is the very value `effective-options.ts:21`/`:30` returns. These
    are tautologies.
  - `packages/core/src/environment/system.spec.ts:69` and `:88`–`:97`: same.

  Not affected: `tsc-root-dir.test.ts` and the `emitWithTsc` comparisons (they compare with real `tsc`), and
  `packages/node/src/websmith/Compiler.spec.ts:58` (`ts.version` is the imported `typescript`, independent of the
  subject; #206 settled it).
- **A global `typescript` leaks into #206's e2e (measured).** Node appends `$HOME/.node_modules` and
  `$HOME/.node_libraries` to every lookup (`require('module').globalPaths`). With a fake
  `~/.node_modules/typescript` (version 5.8.2), `checkTypeScript(<empty dir>)` returns `5.8.2`, and
  `packages/compiler-test/tests/cli-typescript-peer.test.ts` "exits 1 w/ 'none was found' without typescript" fails.
  With `env.HOME`/`env.USERPROFILE` set to the case's temp dir it passes (4/4). `check-typescript.spec.ts` is
  unaffected: it resolves through Jest's resolver, so it passes 7/7 with the same fake `HOME`. This machine has no
  `~/.node_modules`. **Resolution:** in scope, small: isolate `HOME` in the spawned children of both e2e files.

### Current behaviour, reproduced

**Evidence.** A detached worktree of `d53a1d4f`, built with pnpm 10.8.0 on Node 22.17.0, and a second one with the
6.0.3 override (CI recipe, Node 24.21.0). `pnpm pack` was run for `api`, `core`, `node`, `testing`, `webpack`,
`compiler`, `example-addons` and `vite`. Consumers were scratch projects outside any workspace, installed with npm
11.19.0 or pnpm 10.8.0 (Node 24.21.0) from registry.npmjs.org. Workspace packages came in as `file:` tarballs through
`overrides` (npm) or `pnpm.overrides`. "After (simulated)" uses the same tarballs with their manifests edited the way
this slice edits them: peers `>=5.7 <7` in the six packages, the loader's new peer, and `tslib` `^2.8.1` in seven
packages. "Loads" is `require.resolve("typescript/package.json")` from each package's real directory, plus a
`require` of the package. The scripts and logs are not committed.

| Consumer (direct dependencies besides `typescript`) | develop, TS 5.7.3 | develop, TS 6.0.3 | after (simulated), 5.7.3 and 6.0.3 |
|---|---|---|---|
| npm, CLI | one 5.7.3; no warning | exit 0, **2× `npm warn ERESOLVE overriding peer dependency`**; one 6.0.3; CLI loads 6.0.3 | one copy of the project's version, no warning; CLI, api and core load it |
| npm, CLI, no `typescript` | **5.9.3** auto-installed | — | **6.0.3** auto-installed |
| npm, `websmith-loader` | one 5.7.3; `require` → **`Cannot find module 'tslib'`** | exit 0, no warning, **two copies**: `node_modules/typescript` 6.0.3 and `node_modules/websmith-loader/node_modules/typescript` **5.9.3** (auto-installed for api/core's `5.x`); the loader resolves **5.9.3**; `require` → `tslib` error | one copy; `require` ok, loads the project's version |
| npm, `websmith-loader`, no `typescript` | 5.9.3; `tslib` error | — | 6.0.3; `require` ok |
| npm, `@quatico/websmith-node` | `tslib` error | **`npm error ERESOLVE unable to resolve dependency tree`, exit 1** (`peer typescript@"5.x" from @quatico/websmith-api`) | installs; `require` ok |
| npm, `@quatico/websmith-testing` | installs (jest's tree brings `tslib`) | **ERESOLVE, exit 1** | installs; `require` ok |
| npm, `@quatico/websmith-api` (addon author) | `tslib` error | **ERESOLVE, exit 1** | installs; `require` ok |
| npm, all five published entry packages | one 5.7.3 | **ERESOLVE, exit 1** | one copy; all seven packages resolve it |
| pnpm, CLI | no warning | `WARN Issues with peer dependencies`: 2× `unmet peer typescript@5.x: found 6.0.3` | no warning |
| pnpm, CLI / loader, no `typescript` | 5.9.3 | — | 6.0.3 |
| pnpm, loader / node / testing / api / all | `tslib` error for loader, node, api | 2 / 4 / 3 / 1 / 7 `unmet peer typescript@5.x` lines; `tslib` error for loader and node | no warning from the packed packages¹; `require` ok |
| pnpm **workspace**, app has `typescript` 6.0.3 + loader, root has none, `hoist=false` | — | `Cannot find module 'tslib'` (also with `hoist=true`) | ok, loads the app's 6.0.3. **Without the loader peer** (tslib fixed): `websmith needs typescript >=5.7 <7; none was found. Add typescript to your project.`; with `hoist=true`: ok |
| hand-built strict layout (the e2e prototype, same workspace shape) | — | `Cannot find module 'tslib'` | ok, loads the app's `typescript`. Without the loader peer: "none was found" |
| packed `api`/`core`/`testing` + 5.7.3 consumer, `tsc --noEmit`, `skipLibCheck: false` | 5.7.3-built packs: exit 0 with `esModuleInterop`; **47× TS1259** without it | 6.0.3-built packs: **exit 0** (with `esModuleInterop`) | plus a throwaway `export type OnlyOnTypeScript6 = ts.ModuleKind.Node20;` in api: **exit 2**, `TS2694: Namespace 'ts.ModuleKind' has no exported member 'Node20'` |
| TypeScript 7 how-to (`typescript@^6.0.3` + `typescript-7@npm:typescript@^7.0.2` + CLI) | — | npm: `.bin/tsc` → 6.0.3; pnpm: `.bin/tsc` → **7.0.2**; `node node_modules/typescript-7/bin/tsc -v` → 7.0.2 in both; `websmith -p .` exit 0 (6.0.3), `node node_modules/typescript-7/bin/tsc --noEmit -p .` exit 0 | — |
| `cli-typescript-peer.test.ts` with a fake `~/.node_modules/typescript` | "none was found" case **fails** | — | passes with `HOME` set to the case dir |

¹ In the pnpm "node" and "all" consumers, pnpm auto-installed websmith-node's `@quatico/websmith-api`/`-core` peers
from the registry (published 0.10.0, `5.x`) instead of through `pnpm.overrides`. Those two warnings, and one `require`
failure on the registry core without `lib/check-typescript`, come from the harness, not from the slice.

Lockfile and CI facts, measured on the worktree with the simulated manifest change:
- `pnpm install --no-frozen-lockfile --offline` (10.8.0) exits 0. `git diff -U0` gives **244 hunks**:
  - **224 are the change:** importers' `typescript` `specifier`/`version` 5.7.3 → 6.0.3 (12 importers); 7 new `tslib`
    importer entries (2 with a new `dependencies:` header); `typescript@5.7.3` → `typescript@6.0.3` in `packages:`
    with its integrity; and every `(typescript@5.7.3)` peer suffix → `(typescript@6.0.3)` (ts-jest, ts-loader,
    typescript-eslint, `@typescript-eslint/*`, ts-node, jest-config …).
  - **20 are noise:** `libc: [glibc]`/`[musl]` lines dropped, `@types/estree` 1.0.9 → 1.0.6, `acorn` 8.18.0 →
    8.14.0. With `-U3`, the `acorn` line shares a hunk with a `typescript` line, so the filter needs `-U0`.
- The 224-hunk lockfile (269 lines in, 246 out) passes `pnpm install --frozen-lockfile --offline` (10.8.0). It also
  passes `corepack pnpm@9.15.5 install --frozen-lockfile --lockfile-only --offline` (CI is pnpm 9; exit 0). Develop's
  lockfile against the new manifests fails the same pnpm 9 command with `ERR_PNPM_OUTDATED_LOCKFILE`. pnpm 9.15.5
  cannot regenerate the lockfile offline (no cached metadata), so 10.8.0 writes it and pnpm 9 checks it.
- 10.8.0 prints `unmet peer typescript@">=4.8.4 <5.8.0": found 6.0.3` for `@typescript-eslint/*@8.22.0`, a transitive
  toolchain package. The 6.0.3 override cell shows the same today. It is a warning, not a slice failure.
- No `peerDependencies` block appears in the lockfile. The 6.0.3 devDependencies satisfy every `>=5.7 <7` peer.
- `typescript@5.7.3` leaves the lockfile, so a local 5.7.3 override install needs the registry, as the 6.0.3 one
  does today.
- **Override against the new lockfile** (`pnpm pkg set pnpm.overrides.typescript=5.7.3` + `pnpm install
  --no-frozen-lockfile`, registry, Node 24): root plus 11 packages all report 5.7.3, no `unmet peer typescript` line,
  and `pnpm build --skip-nx-cache` is green (10 projects).
- The current override cell (6.0.3 on `develop`'s lockfile, Node 24) installs and builds green with all 12 resolutions
  at 6.0.3.
- Version-dependent values the specs need, computed with the built core on both versions:

  | | 5.7.3 | 6.0.3 |
  |---|---|---|
  | `ts.getDefaultCompilerOptions().target` | 1 (ES5) | 12 (ES2025) |
  | `getEffectiveTarget({ module: Node16 })` / `NodeNext` / `{}` | 9 (ES2022) / 99 (ESNext) / 1 | 12 / 12 / 12 |
  | `scriptTargetToString(<default target>)` | `es5` | `es2025` |
  | `getEmittedModuleKind({})` | 1 (CommonJS) | 5 (ES2015) |

### What to build

Line numbers are from `d53a1d4f`. Commit the red tests first, then each item as its own commit.

1. **`tslib` where it is required** (`B` commit, with its own lockfile procedure run):
   - add `"tslib": "^2.8.1"` to `dependencies` of `api`, `core`, `node`, `testing`, `webpack`, `example-addons` and
     `vite`, in alphabetical order inside the block;
   - `api` and `example-addons` have no `dependencies` block: add one directly before `peerDependencies`;
   - leave the CLI's own `"tslib": "2.8.1"` (`packages/compiler/package.json:48`) as it is;
   - `^2.8.1`, not an exact pin: these are libraries, and an exact pin forces a second `tslib` copy on consumers.
     The lockfile keeps `version: 2.8.1`.
2. **Peers and pin** (`E` commit, with its own lockfile procedure run):
   - `peerDependencies.typescript` → `">=5.7 <7"` in `api` (`:38`), `core` (`:47`), `node` (`:46`), `testing` (`:44`)
     and `example-addons` (`:39`);
   - `websmith-loader`: add `"typescript": ">=5.7 <7"` to `peerDependencies` (`:41`–`:43`), before `webpack`. No
     `peerDependenciesMeta`: the peer is required;
   - `devDependencies.typescript` `5.7.3` → `6.0.3` in the root (`:74`) and in every package that has it: `api`,
     `compiler`, `compiler-test`, `core`, `example-addons`, `node`, `testing`, `vite`, `vite-test`, `webpack`,
     `webpack-test`. That is 12 lines;
   - no other `package.json` line changes. In particular, no `pnpm.overrides` entry, and the compiler and vite peers
     stay.
3. **CI matrix flip**, `.github/workflows/pull-request.yml`:
   - drop `continue-on-error` (`:14`);
   - rename the matrix key `advisory` to `override`, and set `typescript` to `6.0.3` / `6.0.3` / `5.7.3` with
     `override` `false` / `false` / `true`. Names: `dist (22)`, `dist (24)`, `dist (24, typescript 5.7.3)`;
   - update the comments `:17`–`:18`: 6.0.3 comes from the lockfile, and the override cell runs 5.7.3, the floor of
     the peer range, on Node 24;
   - the install steps (`:44`–`:52`) key on `matrix.override`. The assertion step stays as it is: it already reads
     `matrix.typescript`;
   - give the build step `id: build`.
4. **Packed-artifact step** (`pull-request.yml`, after `build`, before `E2E tests`), on the lockfile cells only:
   - `if: ${{ !cancelled() && !matrix.override && steps.build.outcome == 'success' }}`, with `env:
     OTHER_TYPESCRIPT: 5.7.3`;
   - `pnpm pack --pack-destination "$RUNNER_TEMP/packed-types/packs"` in `packages/api`, `packages/core` and
     `packages/testing`;
   - copy `.github/packed-types/tsconfig.json` and `.github/packed-types/consumer.ts` into `$RUNNER_TEMP/packed-types`.
     It lies outside the checkout, so no workspace, `.npmrc` or `node_modules` of the repo is involved;
   - there, `npm install --no-audit --no-fund --legacy-peer-deps "typescript@$OTHER_TYPESCRIPT" @types/node@22
     ./packs/*.tgz`. `--legacy-peer-deps` keeps npm from installing `jest` for testing's peer;
   - then `npx tsc -v` and `npx tsc -p .`.
   - New files:
     - `.github/packed-types/tsconfig.json`: `{ "compilerOptions": { "strict": true, "noEmit": true, "module":
       "commonjs", "target": "es2022", "types": ["node"], "skipLibCheck": false, "esModuleInterop": true },
       "files": ["consumer.ts"] }`;
     - `.github/packed-types/consumer.ts`, with the MIT header:
       ```ts
       import * as api from "@quatico/websmith-api";
       import * as core from "@quatico/websmith-core";
       import * as testing from "@quatico/websmith-testing";

       export const all = [api, core, testing];
       ```
       `skipLibCheck: false` makes `tsc` check every `.d.ts` these reach.
   - Measured locally: green for 6.0.3-built packs, and exit 2 with TS2694 for the throwaway type (table above).
5. **TS6 specs: independent expectations** (`t` commit). Replace each value computed by code under test, or by the
   same TypeScript call the subject makes, with literals per major:
   - one constant per spec file, beside its `isTs5`: `const DEFAULT_TARGET = isTs5 ? ts.ScriptTarget.ES5 : (12 as
     ts.ScriptTarget);` with the comment `// ES2025; ts.ScriptTarget.ES2025 is undefined on TypeScript 5`;
   - `ts.ScriptTarget.ES2025` must not appear: ts-jest runs with `diagnostics: false`
     (`jest-base.config.ts`), so on the 5.7.3 cell it is `undefined` at runtime. The precedent is
     `parsed-command-line.spec.ts:826`;
   - `Compiler.spec.ts:6011`–`:6015`, `:6025`–`:6029`, `:6041`–`:6045`: `node16` → `isTs5 ? ts.ScriptTarget.ES2022 :
     DEFAULT_TARGET`, `nodenext` → `isTs5 ? ts.ScriptTarget.ESNext : DEFAULT_TARGET`, `nothing` → `DEFAULT_TARGET`.
     Then drop the `getEffectiveTarget` import (`:15`) if nothing else uses it;
   - `Compiler.spec.ts:5185` (inside `describeOnTs5`): the literal `'es5'`. Drop the `scriptTargetToString` import if
     unused;
   - `check-esm.spec.ts:730`–`:734`: expect `isTs5 ? ts.ModuleKind.CommonJS : ts.ModuleKind.ES2015`, add the file's
     `isTs5`, and drop the `getEffectiveTarget` import (`:10`) if unused;
   - `effective-options.spec.ts:48` and `:60`: `DEFAULT_TARGET`;
   - `system.spec.ts:69` and `:95`: `DEFAULT_TARGET`;
   - test titles that say "the TypeScript default target" stay.
6. **Global `typescript` isolation** (`t` commit). In `packages/compiler-test/tests/cli-typescript-peer.test.ts`
   `runCli` (`:52`–`:61`), after `delete env.NODE_PATH;`, set `env.HOME = projectDir; env.USERPROFILE = projectDir;`.
   The new e2e (below) does the same for its child.
7. **Docs** (`d` commit):
   - root `README.md`, new `### Supported TypeScript versions` after "Installation" (`:23`–`:36`):
     - websmith supports `typescript` `>=5.7 <7`;
     - every package that loads `typescript` declares that range as a peer: the CLI, the webpack loader, `-api`,
       `-core`, `-node`, `-testing` and the examples;
     - the CLI, the loader and the addons all use the project's `typescript`;
     - TypeScript 7 (`typescript@7`) has no JavaScript compiler API, which websmith and its addons need, so websmith
       stops with the "found 7.x" message;
     - the how-to (measured above):
       ```bash
       pnpm add -D typescript@^6.0.3 typescript-7@npm:typescript@^7
       node node_modules/typescript-7/bin/tsc --noEmit -p .
       ```
       Explain why it runs by path: `node_modules/.bin/tsc` can be either version (npm links 6.x, pnpm links 7.x);
     - this is the section that the messages' "(see README)" points to.
   - `packages/compiler/README.md` (`:23`–`:28`): link "see README" to that section.
   - `packages/api`, `core`, `node`, `testing`, `webpack` and `example-addons` READMEs: one sentence at their
     installation text (`api:25`–`:31`, `node:13`–`:17`, `testing:22`–`:30`, `webpack:17`–`:23`; `core` and
     `example-addons` at the top). It says `typescript` `>=5.7 <7` is a peer dependency and links the root section.
   - `docs/rules/workflow.md:16`–`:17`: "plus an advisory TypeScript 6.0.3 cell" becomes "with TypeScript 6.0.3 from
     the lockfile, plus a TypeScript 5.7.3 override cell on Node 24".
   - Do not change the guard messages: their text is the plan's.

**E2E, each shown red on develop first** (write and commit the `t` commit before the product changes, and put the red
run in the PR):
- **New `packages/webpack-test/tests/webpack-loader-typescript-peer.test.ts`**, with the MIT header. The plan's
  "pnpm strict resolution (no hoisting) loads `typescript` through the loader's own peer".
  - **Setup.**
    - `beforeAll`: `pnpm pack --pack-destination <tmp>` in `packages/webpack`, `packages/core` and `packages/api`,
      each with `execFileSync` and a 60 s timeout, as in `cli-typescript-peer.test.ts:25`–`:30`.
    - Each case gets `fs.mkdtempSync(path.join(os.tmpdir(), "websmith-loader-peer-"))` as `<ws>`, with the layout of
      a pnpm workspace with `hoist=false`:
      - each websmith package is extracted (`tar -xzf <tgz> -C <dir> --strip-components 1`) into
        `<ws>/node_modules/.pnpm/<name with "/"→"+">/node_modules/<name>`;
      - next to it, in that same `node_modules`, it gets a symlink for each name in its packed `dependencies` and
        `peerDependencies`, **and nothing else**:
        - a websmith package links to that package's `.pnpm` entry;
        - `typescript` links to the app's `typescript` (below);
        - any other name links to `fs.realpathSync` of the first existing `<dir>/node_modules/<name>` among
          `packages/webpack`, `packages/core` and the repo root. Use no `require.resolve("<name>/package.json")`:
          `cjs-module-lexer` has an `exports` map without `./package.json` (`ERR_PACKAGE_PATH_NOT_EXPORTED`,
          measured);
      - `<ws>/app/node_modules/websmith-loader` links to the loader's `.pnpm` entry;
      - `<ws>/app/node_modules/typescript` links to `path.dirname(require.resolve("typescript/package.json"))`, the
        cell's `typescript`;
      - `<ws>/node_modules` has no `typescript`.
    - Spawn `process.execPath -e "<script>"` with `cwd: <ws>/app` and an env without `NODE_PATH`, with `HOME` and
      `USERPROFILE` = `<ws>`. The script does `require("websmith-loader")`, then prints the keys of `require.cache`
      that end in `typescript/lib/typescript.js` as JSON. On a throw, it prints the message and exits 1.
    - No package manager: the suite must run offline.
  - **Cases:**
    - "loads the app's typescript through the loader's peer": status 0. The single printed path equals
      `fs.realpathSync(path.join(<cell typescript dir>, "lib", "typescript.js"))`. Red on develop: `Cannot find
      module 'tslib'` (measured with the prototype).
    - "declares typescript >=5.7 <7 as a peer": in the packed `package.json` of each of the three,
      `peerDependencies.typescript` is `">=5.7 <7"`. Red: the loader has none, core/api have `5.x`.
    - "declares tslib as a dependency": in each of the three packed manifests, `dependencies.tslib` is defined. Red.
  - The red-before for the peer alone is in the table above ("Without the loader peer"). After the `B` commit, the
    first case still fails with "none was found" until the `E` commit adds the peer. Show that run in the PR too.
- **`packages/compiler-test/tests/cli-typescript-peer.test.ts`:** item 6. Its red is environment-only (a global
  `~/.node_modules/typescript`), so show the fake-`HOME` run in the PR. Do not commit a fake `HOME` setup.

**Unit tests** (assemble / act / assert with one blank line between the parts and no comments on them, `testObj`,
`actual`, no shared `testObj`, the MIT header on new files):
- Item 5 changes expectations only, not subjects or structure.
- Every expectation is a literal that holds on 5.7.3 and on 6.0.3 (table above). Never compare against a value that
  `getEffectiveTarget`, `scriptTargetToString`, `getEmittedModuleKind`, `checkTypeScript`, `findTsc`,
  `readTscVersion` or `ts.getDefaultCompilerOptions()` computes for the case.
- `it.each([])` throws in Jest. Gate a `describe` (`describeOnTs5`/`describeOnTs6`), never pass an empty table.
  `it`-level skips trip `jest/no-standalone-expect`.
- No new unit specs are needed for manifest-only changes. The e2e covers them.

### Done when

The plan's slice line is the specification, with the resolutions above.

- **Peers:** `api`, `core`, `node`, `testing` and `example-addons` declare `typescript` `>=5.7 <7`;
  `websmith-loader` gains that peer; the compiler and vite peers are unchanged.
- **Pin:** every `typescript` devDependency, the root's included (12 lines), is `6.0.3`, and the lockfile resolves
  6.0.3.
- **`tslib`:** declared in the seven packages that `require` it.
- **Lockfile:** only the hunks the two manifest commits cause (the whitelist check below prints nothing).
  `pnpm install --frozen-lockfile` passes on pnpm 10.8.0 locally and on pnpm 9 in CI.
- **Matrix:** `dist (22)` and `dist (24)` run 6.0.3 from the lockfile; `dist (24, typescript 5.7.3)` runs the
  override. No `continue-on-error`. The assertion step reports 6.0.3 / 6.0.3 / 5.7.3 in the PR's own run.
- **Packed-artifact step:** green on both lockfile cells. A throwaway commit adding
  `export type OnlyOnTypeScript6 = ts.ModuleKind.Node20;` (with `import type ts from "typescript";`) to
  `packages/api/src/index.ts` makes it fail with TS2694 in CI. Revert it in the next commit, and link both runs in the
  PR.
- **e2e:** the strict-layout loader case is red on develop (`tslib`), red with only the `B` commit ("none was
  found"), and green after.
- **Specs:** no expectation in the listed sites is computed by the code under test. They are green on both cells.
- **Every other test:** no change on any cell. List every snapshot hunk (expect none).
- **Gates, before opening the PR, recipes below:**
  - 6.0.3 (lockfile, Node 22): `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache` and
    `pnpm test:e2e --skip-nx-cache`;
  - the same four on 5.7.3 (override, Node 24).

  Paste the summary lines of both into the PR. If `webpack-loader-resolve-once.test.ts` "emits output of edited
  tsconfig.json" fails, re-run that suite alone and report it. It is a known flaky e2e (seen on #191, #205 and a
  Dependabot PR). Do not fix it here.

**`Release-Notes.md`**, under `## [Unreleased]`:
- `### Changed` (`:35`), a `**Breaking:**` item next to the CLI's (`:89`–`:96`):
  - `@quatico/websmith-api`, `-core`, `-node`, `-testing` and `-examples` accept `typescript` `>=5.7 <7`, where they
    declared `5.x`. TypeScript 5.0–5.6 is no longer supported.
  - `websmith-loader` now declares `typescript` `>=5.7 <7` as a peer dependency, so pnpm workspaces and strict
    layouts give it the project's `typescript`.
  - TypeScript 6 projects install without peer warnings, and npm no longer refuses them (ERESOLVE).
  - Without a `typescript`, npm 7+ and pnpm now install 6.x.
  - TypeScript 7 is not supported. The new README section "Supported TypeScript versions" describes how to keep 6.x
    for websmith and run 7.x by its own binary.
- `### Changed`: websmith's packages are built with TypeScript 6.0.3. CI checks their type declarations against
  TypeScript 5.7.3, and runs the whole suite on 5.7.3 as well.
- `### Fixed` (`:170`): `@quatico/websmith-api`, `-core`, `-node`, `-testing`, `-examples` and `websmith-loader`
  declare `tslib`, which they load. Before, installing them without the `websmith` CLI failed with
  `Cannot find module 'tslib'` (also in 0.10.0).
- Leave the CLI's Breaking entry (`:89`–`:96`) as it is, except to point its "found 7.x" sentence to the README
  section.

### Repo mechanics

- **pnpm:** use the corepack-cached pnpm 10.8.0 through a PATH shim. pnpm 10.34 fails the frozen install, and CI is
  pnpm 9:
  ```sh
  mkdir -p "$S/pnpm-shim" && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > "$S/pnpm-shim/pnpm" && chmod +x "$S/pnpm-shim/pnpm"
  export PATH="$S/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm --version   # 10.8.0
  pnpm install --frozen-lockfile --offline && pnpm build --skip-nx-cache
  ```
- **Lockfile procedure (this slice only; the "never edit the lockfile" rule otherwise stands).** Run it once after
  item 1's manifest edit and once after item 2's, on your branch checkout with the shim. Commit each result with its
  manifests:
  ```sh
  pnpm install --no-frozen-lockfile --offline       # 6.0.3 and tslib 2.8.1 are in the local store
  git diff -U0 pnpm-lock.yaml > "$S/lock-full.patch"
  python3 - "$S" <<'EOF'
  import re, sys
  s = sys.argv[1]
  head, *hunks = re.split(r'(?m)^(?=@@ )', open(f"{s}/lock-full.patch").read())
  NOISE = re.compile(r"^[-+]\s+(libc: \[(glibc|musl)\]|'@types/estree': \S+|acorn: \S+)\s*$")
  keep = [h for h in hunks if not all(NOISE.match(l) for l in h.splitlines()[1:] if l[:1] in "+-")]
  open(f"{s}/lock-min.patch", "w").write(head + "".join(keep))
  print(f"{len(hunks)} hunks, kept {len(keep)}")
  EOF
  git checkout -- pnpm-lock.yaml && git apply --unidiff-zero "$S/lock-min.patch"
  # whitelist: must print nothing
  git diff -U0 develop -- pnpm-lock.yaml | grep '^[-+] ' \
    | grep -vE "typescript|tslib|^[-+] +(specifier|version): (5\.7\.3|6\.0\.3|\^2\.8\.1|2\.8\.1)$|^\+ +dependencies:$|^[-+] +resolution: "
  pnpm install --frozen-lockfile --offline          # must exit 0 and leave pnpm-lock.yaml unchanged
  ```
  - Use `-U0`, not `-U3`: with context, the `acorn` noise line shares a hunk with a `typescript` line (measured).
  - Expected after both commits: about 224 hunks against `develop` (+269/−246 lines, the simulation's numbers). The
    `B` run alone gives 27 hunks and keeps 7: 23 added lines (7 `tslib:` entries with `specifier: ^2.8.1` and
    `version: 2.8.1`, 2 `dependencies:` headers). Both its frozen checks pass (10.8.0 and pnpm 9; measured).
  - The noise hunks pnpm 10.8.0 writes (`libc:` lines, `@types/estree`, `acorn`) are never committed.
  - If the whitelist check prints anything, or a hunk outside `importers:`/`packages:`/`snapshots:` entries for
    `typescript`, `tslib` or a `(typescript@…)` suffix appears (for example after a rebase onto #186), stop and report
    it rather than committing a larger lockfile change.
  - **pnpm 9 check (what CI runs).** Copy only the manifests and the lockfile, and run pnpm 9's frozen check:
    ```sh
    D="$S/p9" && mkdir -p "$D" && git ls-files -z | grep -zE '(^|/)package\.json$|^pnpm-lock\.yaml$|^pnpm-workspace\.yaml$|(^|/)\.npmrc$' \
      | xargs -0 -I{} sh -c 'mkdir -p "$1/$(dirname "{}")" && cp "{}" "$1/{}"' _ "$D"
    (cd "$D" && CI=true corepack pnpm@9.15.5 install --frozen-lockfile --lockfile-only --offline)   # exit 0
    ```
    It fails with `ERR_PNPM_OUTDATED_LOCKFILE` when the lockfile does not match. Corepack has 9.15.5 cached
    (`~/.cache/node/corepack/v1/pnpm/`: 9.1.3, 9.14.2, 9.14.4, 9.15.0, 9.15.5, 10.6.x, 10.8.0, 10.34.1, 11.21.0).
    pnpm 9 cannot regenerate the lockfile offline; it only checks. `trash "$D"` afterwards.
- **How the CI override interacts with the new ranges:**
  - The override cell runs `pnpm pkg set pnpm.overrides.typescript=5.7.3` and then `pnpm install
    --no-frozen-lockfile`. That rewrites every `typescript`, the 6.0.3 devDependencies included, to 5.7.3. 5.7.3
    satisfies every peer `>=5.7 <7`, so the cell shows no `unmet peer typescript` line for a websmith package
    (measured: 12 resolutions at 5.7.3, and the build is green).
  - The lockfile cells use the frozen 6.0.3 lockfile, which satisfies the same peers.
  - The peer range must keep including both matrix versions. Its floor, 5.7, is the override cell's version: that is
    what "the floor is what CI proves" (open point 4) means now.
  - `@typescript-eslint/*@8.22.0` (transitive) warns `<5.8.0` on 6.0.3. That is a warning in the lockfile cells now,
    and it is not a failure.
- **TypeScript 5.7.3, as CI's new `dist (24, typescript 5.7.3)` cell does it.** Run it only in a detached scratch
  worktree of your committed branch. 5.7.3 is no longer in the lockfile, so the install needs the registry:
  ```sh
  git worktree add --detach "$S/wt5" HEAD && cd "$S/wt5"
  export PATH="$S/pnpm-shim:$HOME/.nvm/versions/node/v24.21.0/bin:$PATH" COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline
  pnpm pkg set pnpm.overrides.typescript=5.7.3
  : > "$S/empty.npmrc"
  NPM_CONFIG_USERCONFIG="$S/empty.npmrc" pnpm install --no-frozen-lockfile --config.registry=https://registry.npmjs.org/
  node -p "require('typescript/package.json').version"; pnpm -r exec node -p "require('typescript/package.json').version"   # every line 5.7.3
  pnpm build --skip-nx-cache && pnpm lint && pnpm test --skip-nx-cache && pnpm test:e2e --skip-nx-cache
  cd - && git worktree remove --force "$S/wt5"
  ```
  Never commit the override or the lockfile it rewrites.
- **Packed-artifact check locally** (the same as the CI step, on your 6.0.3 build):
  `pnpm pack --pack-destination "$S/packs"` in `packages/{api,core,testing}`. Then, in `$S/packed-types` with the two
  `.github/packed-types` files: `NPM_CONFIG_USERCONFIG="$S/empty.npmrc" npm install --registry=https://registry.npmjs.org/
  --no-audit --no-fund --legacy-peer-deps typescript@5.7.3 @types/node@22 "$S"/packs/*.tgz && npx tsc -p .` (exit 0).
- **Never commit** a `pnpm.overrides` entry, any root `package.json` change other than the `typescript` devDependency
  line, or a lockfile hunk outside the procedure. Never edit `~/.npmrc` (the Artifactory login in it is expired). e2e
  runs can leave `test-output-*` importers in the lockfile. Check `git status` before every commit, and restore with
  `git checkout -- pnpm-lock.yaml` followed by `git apply --unidiff-zero "$S/lock-min.patch"` (the last run's patch,
  if the commit is not yet made).
- Use `git -c rerere.enabled=false` for any merge or rebase.
- `test:e2e` needs `pnpm build` first: the e2e files pack built packages.
- Do not run two full suites in parallel on one machine: concurrent `test:e2e` runs cut `websmith-loader-test`
  short.
- New files need the MIT header (`pnpm license:add`); never add them to the `license:check` list.
  `.github/packed-types/tsconfig.json` is JSON and needs none.
- Commits use Arlo's notation without a colon (`commit-notation` skill), e.g.:
  - `t Covers the loader's typescript peer in a strict pnpm layout`
  - `B Declares tslib in every package that requires it`
  - `E Moves the typescript pin to 6.0.3 and the peers to >=5.7 <7`
  - `t Compares the TypeScript-dependent specs with literal expectations`
  - `t Isolates the CLI peer e2e from a global typescript`
  - `e Runs TypeScript 6.0.3 from the lockfile and 5.7.3 as the override cell`
  - `e Checks the packed types against TypeScript 5.7.3`
  - `t Adds a TypeScript 6-only type to the api` / `t Removes the TypeScript 6-only type` (the throwaway pair)
  - `d Documents the supported TypeScript versions and TypeScript 7`
- Use `trash`, never `rm`.

### Bookkeeping

- Push the red `t` commit early, so the PR's cells show the red-before.
- Open the PR with `plot-open-pr.sh`, not `gh pr create`.
- Add the `→ #<PR>` suffix to the plan's slice line (`docs/plans/2026-10-02-typescript-6-support.md:336`, before the
  `<!-- builds: -->` comment) and commit it on this branch. Edit nothing else in the plan; it is frozen.
- The PR body carries:
  - **"Ends #206's release warning"**, with the before/after install table: npm ERESOLVE and warnings, duplicate
    copies, which `typescript` each package loads, and 5.9.3 → 6.0.3 for projects without `typescript`;
  - the lockfile numbers (hunks, lines, whitelist output) and the pnpm 9 frozen-check output;
  - the assertion step's output of all three cells;
  - the packed-artifact step's green run and the throwaway commit's red run;
  - the gate summaries of both versions;
  - the red-before runs: develop (`tslib`), `B` only ("none was found"), and the fake-`HOME` run;
  - the plan resolutions under "What changed on develop":
    - `compiler` and `vite` peers unchanged;
    - the root pin line;
    - `tslib` in scope;
    - the workspace layout;
    - the hand-built layout instead of a package manager;
    - `esModuleInterop` in the fixture;
    - no required checks exist, so the setting is the maintainer's;
  - the follow-ups below.

### Scope guard

This branch owns:
- the `typescript` and `tslib` lines (and the new `dependencies` blocks of `api` and `example-addons`) in the
  `package.json` of the root, `api`, `compiler`, `compiler-test`, `core`, `example-addons`, `node`, `testing`, `vite`,
  `vite-test`, `webpack` and `webpack-test`;
- the lockfile hunks of the procedure;
- `.github/workflows/pull-request.yml`, and `.github/packed-types/{tsconfig.json,consumer.ts}` (new);
- `packages/webpack-test/tests/webpack-loader-typescript-peer.test.ts` (new) and `runCli`'s env in
  `packages/compiler-test/tests/cli-typescript-peer.test.ts`;
- the expectations named in item 5 (`Compiler.spec.ts`, `check-esm.spec.ts`, `effective-options.spec.ts`,
  `system.spec.ts` in `packages/core`);
- the README texts of item 7, `docs/rules/workflow.md:16`–`:17`;
- its `Release-Notes.md` entries and its plan suffix.

Do not touch:
- any product source (`packages/*/src/**` other than the listed specs). The throwaway type is committed and reverted
  in the same PR;
- the guard and its messages (`packages/core/src/check-typescript.ts`, `typescript-guard.ts`, `bin.ts`);
- `release-and-publish.yml`, `protect-stable.yml`, `claude*.yml`, `.github/dependabot.yml`;
- tsconfigs (including `importHelpers`), `pnpm-workspace.yaml`, the root `pnpm` field;
- `packages/vite/**` beyond its two `package.json` lines;
- branch protection or any repository setting;
- `webpack-loader-resolve-once.test.ts` (known flaky).

If a cell shows a failure this brief does not name, triage it by error code and report it in the PR rather than
improvising outside scope.

### Not in this slice (open follow-ups, verified on `d53a1d4f`)

- **Required checks.** `develop` and `main` have no required status checks (`contexts: []`). Adding the three
  `dist` names is a repository setting. Owner: the maintainer, after merge.
- **Default-imported `typescript` in published `.d.ts`.** Consumers on 5.x without `esModuleInterop` get TS1259 per
  file (47 in api/core/testing). This is unchanged by this slice. Owner: a small bug issue (`import ts = require` or
  `import * as ts` in the declarations).
- **The Vite plugin has no guard** (from #206). Owner: the maintainer files an issue for the Vite plugin plan.
- **`@typescript-eslint/*@8.22.0`** (transitive) declares typescript `<5.8.0` and warns on the 6.0.3 lockfile.
  Owner: #186 or the next toolchain update.
- **The packed-artifact check covers `api`, `core` and `testing`** (the plan's list), not `node`, the loader or the
  examples. Owner: a later CI improvement if a declaration regression shows there.
- **`webpack-loader-resolve-once.test.ts` "emits output of edited tsconfig.json"** is flaky in CI. Owner: a separate
  determinism fix.
- **The global `typescript` in unit specs:** `check-typescript.spec.ts` resolves through Jest and is not affected
  (measured). No action.
