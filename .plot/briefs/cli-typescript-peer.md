<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — typescript-6-support (slice: cli-typescript-peer)

- **Plan (canonical):** `docs/plans/2026-10-02-typescript-6-support.md` on `develop` (slice line `:332`, heading
  "CLI peer"; Design: the TypeScript 7 guard `:111`–`:122`, the CLI's own `typescript` `:137`–`:141`; open points 2
  and 10 at `:258` and `:285`; Changelog `:34`–`:37` and `:57`–`:58`)
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #144 merged
- **Branch:** `feature/cli-typescript-peer` (base: `develop` at `6c986bb0`, the merge of #203)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH); the implementer never merges it
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

**Ordering.** The plan orders this slice after module kinds and before the peer range. Everything it builds on has
merged: toolchain #166, CI leg #171, websmith-node #184 and module kinds #203 (`6c986bb0`).
`feature/typescript-6-peer-range` waits for this branch. Open beside you:
- **#205** (`feature/vite-plugin-dev-server`) edits `Release-Notes.md`. You add other entries. Whoever merges second
  rebases.
- **Dependabot #185, #186 and #195** edit `pnpm-lock.yaml` and every `package.json`. #185 moves every `typescript`
  pin from 5.7.3 to 5.9.3, including the CLI's line. If one of them merges first, rebase and redo the lockfile
  procedure below on top of it. Never resolve conflict markers in `pnpm-lock.yaml` by hand. The CLI's new
  `typescript` devDependency always equals the other packages' devDependency.

### What changed on `develop` since the plan was approved

Every line number below is from `6c986bb0`.

- **The CLI's `typescript` is unchanged.** It is still a `dependency` pinned to 5.7.3
  (`packages/compiler/package.json:49`). The bundle still keeps `typescript` external
  (`packages/compiler/webpack.config.js:48`–`:51`; the plan cites `:47`). `typescript` is the bundle's only runtime
  `require` besides Node built-ins. `@quatico/websmith-core` is aliased to `../core/src` (`:25`–`:28`) and bundled.
  The CLI's `@quatico/websmith-core`/`-api` dependencies serve only `lib/index.js`, the programmatic entry.
- **The installed TypeScript 7 does not throw on `require`.** The plan says "a 7.x `typescript` has no `main`, so
  `import ts from "typescript"` throws". `typescript@7.0.2`, `latest` on npm, has no `main`, but it does have
  `"exports": { ".": "./lib/version.cjs", "./package.json": "./package.json", … }` and `"type": "module"`.
  `lib/version.cjs` exports only `version` and `versionMajorMinor`, so `require("typescript")` succeeds. The bundle
  then dies at load with `TypeError: Cannot read properties of undefined (reading 'EqualsEqualsEqualsToken')` (exit
  1, measured with the real 7.0.2 tarball).
  **Resolution:** the guard stays as the plan designs it: it reads `typescript/package.json` before anything requires
  `typescript`. 7.0.2 exports `./package.json`, and 5.7.3/6.0.3 have no `exports`. The e2e's 7.x stub mirrors 7.0.2's
  manifest (below), not "no `main`" alone.
- **websmith-node already imports core.** The plan duplicates the check in websmith-node "which must not import
  core". `packages/node/src/websmith/compile.ts:8` imports `AddonRegistry` and `Compiler` from
  `@quatico/websmith-core`, as it already did at `cfb284cc`, and `@quatico/websmith-core` is a node peer.
  **Resolution:** no copy. websmith-node calls core's `checkTypeScript` through the same typescript-free module path
  as the loader and the testing package.
  - *Rejected: the copy.* It gives two implementations of the same two messages and two test sets, and the reason for
    it does not hold.
- **Core's index loads `typescript`, and so does api's.** `packages/core/src/index.ts:7` re-exports `./compiler`,
  whose modules import `typescript` at load. `packages/api/src/diagnostic/DiagnosticMessage.ts:7` (and `ErrorMessage`,
  `InfoMessage`, `WarnMessage`) import it at runtime too. `packages/testing/src/compilation/environment.ts:7` imports
  `ErrorMessage` from api before core. So the check cannot be exported from core's index, and it cannot run inside
  `environment.ts`: `typescript` is loaded by then. Each entry must import the check from a module without
  `typescript` as its **first** import (measured, below).
- **The Vite plugin is new and already has the peer.** `packages/vite/package.json` declares `typescript: ">=5.7 <7"`.
  The plan's list of guarded entry points predates it. **Resolution:** this slice does not guard it (see Not in this
  slice).
- **#184 added `readTscVersion`.** `packages/node/src/websmith/find-tsc.ts:50`–`:62` reads the spawned binary's
  version, and `websmith/Compiler.ts:56`–`:57` uses it. `findTsc` (`:16`–`:47`) is unchanged. Its candidates are:
  1. `path.join(__dirname, "..", "typescript", "bin", "tsc")` (`:18`), i.e. `…/websmith-node/lib/typescript/bin/tsc`;
  2. `<cwd>/node_modules/typescript/bin/tsc`;
  3. `require.resolve("typescript")`'s `../bin/tsc`;
  4. the nvm-global `tsc`.
- **The two #184 follow-ups assigned here are real (measured):**
  - *`findTsc`'s first candidate never exists.* `lib/` holds only compiled output. In the workspace it is
    `packages/node/lib/typescript/bin/tsc` (missing). In an npm install it is
    `node_modules/@quatico/websmith-node/lib/typescript/bin/tsc` (missing).
  - *The specs and e2e assume that the imported `ts` is the spawned `tsc`.* In an npm project with `typescript`
    6.0.3 and a `sub/` folder with its own 5.7.3, `findTsc` run from `sub/` spawns 5.7.3 (the cwd candidate), while
    websmith-node imports 6.0.3. The tests:
    - `packages/compiler-test/tests/tsc-ignore-config.test.ts:52` predicts the spawned `tsc`'s behaviour from
      compiler-test's own `ts.versionMajorMinor`;
    - `packages/node/src/websmith/Compiler.spec.ts:57` expects `Version ${ts.version}` from the spawned `tsc`.

    Both pass today only because the workspace gives every package the same `typescript`.
- **The CI override cell exists** (#171, `.github/workflows/pull-request.yml:48`–`:52`). Its assertion
  (`:54`–`:72`) requires every workspace package to resolve the matrix version. The lockfile cells run
  `pnpm install --frozen-lockfile` on pnpm 9 (`:40`–`:46`).
- **npm and pnpm install a missing peer themselves.** The plan's e2e installs "the packed CLI … into a project without
  `typescript`" and expects "none was found". With the peer in place, npm 11 and pnpm 10 (`autoInstallPeers`) install
  `typescript` for such a project (measured, below). The message shows only with `--legacy-peer-deps`,
  `auto-install-peers=false`, Yarn 1, or a removed `typescript`. **Resolution:** the e2e extracts the packed tarball
  into a project's `node_modules` without a package manager (offline too).
- **Core and api still declare `typescript: "5.x"`**, and they are dependencies of the CLI. Until the peer-range slice
  widens them, a TypeScript 6 project that installs the peer-CLI gets peer warnings (measured, below). Widening them
  is the peer-range slice's job.
  **Resolution:** leave them. State in the PR that the 0.11.0 release must not be cut between this PR and the peer
  range. The Release-Notes entry describes the final state.
- **Line moves since the plan:** `packages/compiler/README.md:23` is still the "add typescript" sentence. The root
  README has the same sentence at `:31`. The plan's "README line 69" (addons resolve `typescript` from the project) is
  now `README.md:108`.

### Current behaviour, reproduced

**Evidence.** A detached worktree of `6c986bb0`, built with pnpm 10.8.0 on Node 22.17.0. `pnpm pack` was run for
`compiler`, `core`, `api` and `node`. The consumer projects were in the scratchpad, outside any workspace. They were
installed with npm 11.19.0 or pnpm 10.8.0 from registry.npmjs.org. "packed develop" means the develop tarballs, with
core/api fed through npm `overrides` or `file:` specs. "published" is `@quatico/websmith-compiler@0.10.0` from npm,
which has the same `typescript` dependency. "after (simulated)" is the packed manifest edited the way this slice edits
it (`typescript` moved to `peerDependencies: ">=5.7 <7"`), with core/api left at `5.x`. Each project is `src/a.ts`
plus a tsconfig. The `es2025` probe uses `"target": "es2025"`, which 5.7.3 rejects (TS6046) and 6.0.3 accepts. The
scripts and logs are not committed.

| Scenario | Today (develop / published) | After (simulated or prototyped) |
|---|---|---|
| npm, project `typescript` 5.7.3, add the CLI | one `typescript` 5.7.3, deduped, no warning | same, no warning |
| npm, project `typescript` 6.0.3, add the CLI | exit 0, no warning; **two copies**: `node_modules/typescript` 6.0.3 and `node_modules/@quatico/websmith-compiler/node_modules/typescript` 5.7.3 | one `typescript` 6.0.3; **2× `npm warn ERESOLVE overriding peer dependency`**, `npm ls` exits 1 (`ELSPROBLEMS`, invalid: `"5.x"` from core/api) |
| same, which `typescript` the CLI loads | the nested **5.7.3** (`require.resolve` from `bin/`) | the project's 6.0.3 |
| same, `es2025` probe | `tsc` exit 0; packed develop `websmith` **exit 1**, `Argument for '--target' option must be: … 'es2024', 'esnext'` (5.7.3's TS6046); published 0.10.0 exit 0 (it predates fail-on-option-error) | (follows the project's TypeScript) |
| pnpm, project 6.0.3, add published CLI | `.pnpm` holds `typescript@5.7.3` and `@6.0.3`, no warning | one `typescript@6.0.3`, `WARN Issues with peer dependencies`: 3× `unmet peer typescript@5.x: found 6.0.3` |
| npm / pnpm, project without `typescript`, add the CLI | the CLI's own 5.7.3 (by the manifest) | **`typescript@5.9.3` auto-installed** (newest version in `>=5.7 <7` ∩ `5.x`); no message |
| packed CLI extracted into `node_modules`, no `typescript` | `Error: Cannot find module 'typescript'` + stack, exit 1 | `websmith needs typescript >=5.7 <7; none was found. Add typescript to your project.`, exit 1 |
| same with a 7.0.2 stub (7.0.2's `exports`, `version.cjs`) or the real 7.0.2 tarball | `TypeError: Cannot read properties of undefined (reading 'EqualsEqualsEqualsToken')`, exit 1 | `websmith needs typescript >=5.7 <7; found 7.0.2. For TypeScript 7, keep typescript@6 …`, exit 1 |
| same with a 5.7.3 or 6.0.3 `typescript` | exit 0, writes `dist/a.js` | exit 0, writes `dist/a.js` |
| `findTsc()` in the workspace (`packages/node`) | candidate 1 `packages/node/lib/typescript/bin/tsc` missing → `packages/node/node_modules/typescript/bin/tsc`, 5.7.3 | — |
| `findTsc()`, npm project 6.0.3, cwd = project / cwd = `sub/` with its own 5.7.3 | spawns 6.0.3 / **spawns 5.7.3 while websmith-node imports 6.0.3** | — |

Lockfile and CI facts measured on the same worktree with the manifest change applied:
- `pnpm install --no-frozen-lockfile --offline` (10.8.0) rewrites **7 hunks**. Two are the change: `typescript`
  moves from `dependencies` to `devDependencies` in `importers: packages/compiler`. Five are noise:
  - `libc: [glibc]`/`[musl]` lines dropped from the nx/rollup entries;
  - `@types/estree` 1.0.9 → 1.0.6;
  - `acorn` 8.18.0 → 8.14.0.
- The two-hunk lockfile (3 lines out, 3 lines in) passes `pnpm install --frozen-lockfile --offline` on 10.8.0. It
  also passes `corepack pnpm@9.15.5 install --frozen-lockfile --lockfile-only --offline` (CI is pnpm 9). The
  unchanged lockfile against the new manifest fails the same pnpm 9 command with `ERR_PNPM_OUTDATED_LOCKFILE`.
- No `peerDependencies` entry appears in the lockfile. The devDependency satisfies the peer.
- The override (`pnpm pkg set pnpm.overrides.typescript=6.0.3` + `pnpm install --no-frozen-lockfile`, Node 24) makes
  all 12 resolutions (root plus 11 packages) 6.0.3, with no peer warning for the CLI.
- A prototype of the design below built (`pnpm build` of core and compiler; the webpack bundle shows the same 2
  warnings as develop) and gave the "After" rows of the CLI. `eslint` was clean on `bin.ts` and `check-typescript.ts`
  (warnings only, as on develop). The loader's `lib/index.js` emitted `require("./typescript-guard")` before
  `require("@quatico/websmith-core")`. The ordering spec described below was red without the guard import and green
  with it.

### What to build

Line numbers are from `6c986bb0`. Commit the red e2e first, then each item as its own commit.

1. **`checkTypeScript` in core.**
   - New `packages/core/src/check-typescript.ts`, with the MIT header. It must import only `node:fs`, `node:module`
     and `node:path`, never `typescript`, `@quatico/websmith-api` or another core module.
   - Signature: `checkTypeScript(fromDir: string): string`. It returns the found version, or throws an `Error` with
     exactly the plan's messages:
     - not resolvable: `websmith needs typescript >=5.7 <7; none was found. Add typescript to your project.`
     - out of range: `websmith needs typescript >=5.7 <7; found <version>. For TypeScript 7, keep typescript@6 as the
       project's typescript and run 7.x through its own binary (see README).`
   - Resolve with `createRequire(path.join(fromDir, "noop.js")).resolve("typescript/package.json")`. Then read
     `version` with `fs.readFileSync` + `JSON.parse`.
     - Do not use `require.resolve`: webpack processes it at build time in the CLI bundle. The prototype used
       `createRequire`, and it resolved from the user's project at runtime.
     - Do not `require` the `package.json`, so that no module cache is involved.
   - In range means `<major>.<minor>.` with major 5 and minor ≥ 7, or major 6. Prerelease suffixes follow their
     major.minor.
   - A missing, non-string or unparseable `version` (and an unreadable or invalid `package.json`) is out of range.
     The message then says `found <String(value)>`. That is the plan's "malformed version".
   - Do not add a `semver` dependency.
   - Do not export it from `packages/core/src/index.ts`. Consumers import `@quatico/websmith-core/lib/check-typescript`
     (core has no `exports` map, so the deep path resolves on node10 and bundler resolution alike).
2. **CLI: guard first, core lazily.** In `packages/compiler/src/bin.ts` (`:8`–`:9`):
   - Import `checkTypeScript` from `@quatico/websmith-core/lib/check-typescript`. Add
     `import type * as CommandModule from "./command"`.
   - Call `checkTypeScript(__dirname)` in a `try`. On error, `process.stderr.write(`${message}\n`)` and
     `process.exit(1)` (no `console`; ESLint errors on it).
   - Then `const { addCompileCommand } = require("./command") as typeof CommandModule;`, with a one-line comment
     saying why it is lazy and an `eslint-disable-next-line @typescript-eslint/no-require-imports,
     @typescript-eslint/no-var-requires`. `typeof import("./command")` is rejected by
     `consistent-type-imports` (measured).
   - `__dirname` is the bundle's real directory (`node.__dirname: false`, `webpack.config.js:52`–`:57`).
   - In `packages/compiler/webpack.config.js:26`, add `"@quatico/websmith-core/lib": path.resolve(__dirname,
     "../core/src")` as the **first** alias, before `@quatico/websmith-core`. Check that `bin/` still holds only
     `bin.js`.
   - Keep the `typescript` external.
3. **Library entries: a guard module as the first import.** In each package, add `src/typescript-guard.ts` with the
   MIT header: `import { checkTypeScript } from "@quatico/websmith-core/lib/check-typescript";
   checkTypeScript(__dirname);`. Then make `import "./typescript-guard";` the first statement after the header in:
   - `packages/webpack/src/index.ts` (before `:9`);
   - `packages/testing/src/index.ts` (before `:7`; the plan says "the environment", see above);
   - `packages/node/src/index.ts` (before `:7`).

   Libraries throw the error; they do not exit.
4. **The CLI's `typescript` becomes a peer.** In `packages/compiler/package.json`:
   - remove `"typescript": "5.7.3"` from `dependencies` (`:49`);
   - add it to `devDependencies` in alphabetical order (after `ts-loader`, before `typescript-eslint`), with the same
     version the other packages' devDependency has;
   - add `"peerDependencies": { "typescript": ">=5.7 <7" }` after `devDependencies`. No `peerDependenciesMeta`: the
     peer is required.
   - Then follow the lockfile procedure under Repo mechanics.
   - Do not touch any other `package.json`.
5. **websmith-node spawns the `tsc` it imports** (the #184 follow-ups). In `packages/node/src/websmith/find-tsc.ts`:
   - Give `findTsc` a second parameter `fromDir = __dirname`.
   - Replace candidate 1 (`:17`–`:18`, which never exists) with `path.join(path.dirname(createRequire(path.join(fromDir,
     "noop.js")).resolve("typescript/package.json")), "bin", "tsc")`. Catch "not found" as `:25`–`:29` does. This is
     the `typescript` websmith-node imports, since every import resolves from its `lib/`.
   - Keep cwd, `require.resolve("typescript")` and nvm-global as fallbacks, in that order. Update the error listing
     (`:39`–`:44`) and the comment.
   - `readTscVersion` stays.
6. **Jest mappers.** Each package's `jest.config.ts` maps `@quatico/websmith-core` to `core/src` (`:12`), and that
   unanchored key also matches the deep path. Add `"^@quatico/websmith-core/lib/(.*)$": "<rootDir>/../core/src/$1"`
   as the **first** `moduleNameMapper` entry in `compiler`, `webpack`, `testing` and `node`.
7. **Docs.**
   - `packages/compiler/README.md` "Installation" (`:15`–`:23`) and `README.md` (`:23`–`:31`):
     - the command becomes `pnpm add -D typescript @quatico/websmith-compiler`;
     - replace the "If you don't have added the "typescript" dependency yet" sentence: `typescript` `>=5.7 <7` is a
       peer dependency; `websmith` compiles with the project's `typescript`, the same one its addons use; npm 7+ and
       pnpm install a missing peer themselves, but with Yarn 1 or `--legacy-peer-deps` you add it yourself;
     - quote both messages.
   - The TypeScript 7 how-to, which the message's "(see README)" points to, is the peer-range slice's
     ("supported-versions text with the TypeScript 7 guidance"). Do not write it here, and say so in the PR.
   - `packages/node/README.md:40`: "runs the project's `tsc`" becomes "runs the `tsc` of the `typescript` that
     websmith-node resolves, normally the project's".

**Unit tests** (assemble / act / assert, `testObj`, `actual`, no shared `testObj`; MIT header on new files):
- `packages/core/src/check-typescript.spec.ts`, against real temp dirs:
  - Create each one with `fs.mkdtempSync(path.join(os.tmpdir(), …))`, outside the repo, so resolution cannot reach
    the workspace's `typescript`. Write `node_modules/typescript/package.json` there and remove the dir in
    `afterEach`.
  - Cases (the plan's list):
    - 5.7.3 and 6.0.3 return the version (`it.each` with a non-empty table);
    - an empty dir throws the exact "none was found" text;
    - a 7.0.2 manifest copied from 7.0.2 (`"type": "module"`, `"exports": { ".": "./lib/version.cjs",
      "./package.json": "./package.json" }`, no `main`) throws the exact "found 7.0.2" text;
    - 5.6.3 throws "found 5.6.3";
    - malformed: `"version": "next"` throws "found next", and no `version` throws "found undefined".
  - Write the expected messages as literals in the spec. Never import them from the code under test.
- **Entry ordering**, one `index.spec.ts` each in `webpack`, `testing` and `node`:
  - `jest.doMock("@quatico/websmith-core/lib/check-typescript", () => ({ checkTypeScript: () => { throw new
    Error("checked first"); } }))`;
  - `jest.doMock("typescript", () => { throw new Error("typescript loaded first"); })`;
  - `const actual = () => jest.isolateModules(() => require("./index"));`;
  - `expect(actual).toThrow("checked first")`.

  Prototyped in `packages/webpack`: red ("typescript loaded first") without the guard import, green with it.
- `packages/node/src/websmith/find-tsc.spec.ts`, new `findTsc` cases on temp layouts:
  - with `<tmp>/node_modules/typescript/{package.json,bin/tsc}` and `fromDir` =
    `<tmp>/node_modules/@quatico/websmith-node/lib/websmith`, it returns `<tmp>/node_modules/typescript/bin/tsc`;
  - with `jest.spyOn(process, "cwd")` pointing at a second temp dir with its own `typescript`, it still returns the
    resolved one (red on develop: cwd wins);
  - with nothing resolvable from `fromDir`, it falls back to cwd.
- `packages/node/src/websmith/Compiler.spec.ts:57`: no change. Imported and spawned `typescript` now both resolve from
  `packages/node`. Add a comment saying so.

**No version-dependent literals.**
- The fixtures are fake manifests, so these specs are the same on 5.7.3 and 6.0.3.
- Any expectation about the running TypeScript comes from the `typescript/package.json` that the code path in
  question resolves. Never compare against a value that `checkTypeScript`, `findTsc` or `readTscVersion` computes.
- `it.each([])` throws in Jest. Gate a `describe`, never pass an empty table. `it`-level skips trip
  `jest/no-standalone-expect`.
- The TS6 specs that compare against code-under-test values are the peer-range slice's. Do not retrofit them here.

**E2E, each shown red on develop first** (write and commit the `t` commit before the product change; put the red run
in the PR). New `packages/compiler-test/tests/cli-typescript-peer.test.ts`:
- **Setup.**
  - `beforeAll`: `execFileSync("pnpm", ["pack", "--pack-destination", <tmp>], { cwd: <repo>/packages/compiler })`
    with a 60 s timeout.
  - Each case makes `fs.mkdtempSync(path.join(os.tmpdir(), "websmith-cli-peer-"))`. Extract the tarball into
    `node_modules/@quatico/websmith-compiler` with `tar -xzf <tgz> -C <dir> --strip-components 1`, and write
    `src/a.ts` (`export const a = 1;`) and a tsconfig with `module: "commonjs"`, `target: "es2020"`,
    `rootDir: "src"`, `outDir: "dist"`, `types: []`.
  - Spawn `process.execPath <dir>/node_modules/@quatico/websmith-compiler/bin/bin.js -p .` with `cwd: <dir>` and the
    environment without `NODE_PATH`.
  - No `npm install`: a package manager would install the peer (see above), and the suite must run offline.
- **Cases:**
  - "exits 1 w/ 'none was found' without typescript": status 1; stdout+stderr contain the exact message. Red: `Cannot
    find module 'typescript'`.
  - "exits 1 w/ 'found 7' for TypeScript 7": add `node_modules/typescript/package.json` with 7.0.2's manifest (as in
    the unit test) and `lib/version.cjs` (`exports.version = "7.0.2"; exports.versionMajorMinor = "7.0";`). Status
    1, output contains `websmith needs typescript >=5.7 <7; found 7.0.2.`. Red: the `TypeError` above.
  - "compiles w/ the project's typescript": symlink `node_modules/typescript` to
    `path.dirname(require.resolve("typescript/package.json"))` (the cell's TypeScript). Expect status 0 and
    `dist/a.js`. Green before and after; it guards the lazy `require`. Say so in the PR.
  - "declares typescript only as a peer": in the packed `package.json`, `dependencies?.typescript` is undefined and
    `peerDependencies.typescript` is `">=5.7 <7"`. Red on develop.
- **`packages/compiler-test/tests/tsc-ignore-config.test.ts:52`:** derive the major from
  `require.resolve("typescript/package.json", { paths: [path.dirname(require.resolve("@quatico/websmith-node"))] })`,
  not from compiler-test's `ts`. That is the `typescript` whose `tsc` websmith-node now spawns. Keep the `import ts`
  the test needs for `ts.findConfigFile`/`ModuleKind`.

### Done when

The plan's slice line is the specification, with the resolutions above.

- **Guard:** the CLI `bin`, the loader entry, websmith-node and `@quatico/websmith-testing` check
  `typescript/package.json` before the first `require("typescript")`. Both messages appear verbatim. The CLI exits 1;
  the libraries throw.
- **Peer:** `@quatico/websmith-compiler` has `typescript` only in `peerDependencies` (`>=5.7 <7`) and
  `devDependencies`. Core is loaded lazily behind the check, and `bin/bin.js` is still one file.
- **Lockfile:** `pnpm-lock.yaml` differs from `develop` by exactly 6 lines in `importers: packages/compiler`.
  `pnpm install --frozen-lockfile` passes on pnpm 10.8.0 locally and on pnpm 9 in CI.
- **websmith-node** spawns the `tsc` of the `typescript` it resolves, and `findTsc` has no never-existing candidate.
- **Unit tests:** resolvable 5.x and 6.x, not resolvable, 7.x present, malformed version, entry ordering, `findTsc`
  order.
- **e2e:** the packed CLI without `typescript` exits 1 with "none was found", and with the 7.x stub exits 1 with
  "found 7". Both are red on develop and green after.
- **Every other test:** no change on either cell. List every snapshot hunk (expect none).
- **Gates, on both versions, before opening the PR:**
  - 5.7.3 (lockfile, Node 22 or 24): `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache` and
    `pnpm test:e2e --skip-nx-cache`;
  - the same four on 6.0.3 (override, Node 24), recipe below.

  Paste the summary lines of both into the PR.

**`Release-Notes.md`**, under `## [Unreleased]`:
- `### Changed` (`:31`), a `**Breaking:**` item (open point 11's format):
  - `@quatico/websmith-compiler` no longer installs its own `typescript` 5.7.3; `typescript` `>=5.7 <7` is now a peer
    dependency, and the `websmith` command compiles with the project's `typescript`, the one its addons already use.
  - Projects on TypeScript 6 therefore build with TypeScript 6 and its defaults (point to the `strict` and
    `target`/`esModuleInterop` entries).
  - npm 7+ and pnpm install a missing `typescript` themselves; with Yarn 1 or `--legacy-peer-deps`, add it.
  - Without `typescript`, `websmith` exits 1 with "websmith needs typescript >=5.7 <7; none was found. …"; with
    TypeScript 7 it exits 1 with "… found 7.x. …".
  - The webpack loader, `@quatico/websmith-node` and `@quatico/websmith-testing` throw the same errors when they are
    loaded.
- `### Fixed` (`:158`): extend the websmith-node entry (`:197`) or add one. `@quatico/websmith-node` spawns the `tsc`
  of the `typescript` it imports. Before, a `typescript` in the working directory's `node_modules` took precedence,
  so it could spawn another version than the one it imports.

**README:** item 7 above.

### Repo mechanics

- **pnpm:** use the corepack-cached pnpm 10.8.0 through a PATH shim. pnpm 10.34 fails the frozen install, and CI is
  pnpm 9:
  ```sh
  mkdir -p "$S/pnpm-shim" && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > "$S/pnpm-shim/pnpm" && chmod +x "$S/pnpm-shim/pnpm"
  export PATH="$S/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm --version   # 10.8.0
  pnpm install --frozen-lockfile --offline && pnpm build --skip-nx-cache
  ```
- **Lockfile procedure (this slice only; the "never edit the lockfile" rule otherwise stands).** After item 4's
  `package.json` edit, on your branch checkout with the shim:
  ```sh
  pnpm install --no-frozen-lockfile --offline
  git diff -U3 pnpm-lock.yaml > "$S/lock-full.patch"
  python3 - "$S" <<'EOF'
  import re, sys
  s = sys.argv[1]
  head, *hunks = re.split(r'(?m)^(?=@@ )', open(f"{s}/lock-full.patch").read())
  keep = [h for h in hunks if re.search(r'(?m)^[-+]\s+typescript:\s*$', h) and 'specifier:' in h]
  open(f"{s}/lock-min.patch", "w").write(head + "".join(keep))
  print(f"{len(hunks)} hunks, kept {len(keep)}")
  EOF
  git checkout -- pnpm-lock.yaml && git apply "$S/lock-min.patch"
  git diff -U0 pnpm-lock.yaml | grep '^[-+] '      # exactly 6 lines: -/+ "typescript:", "specifier: 5.7.3", "version: 5.7.3"
  pnpm install --frozen-lockfile --offline          # must exit 0 and leave pnpm-lock.yaml unchanged
  ```
  - The noise hunks pnpm 10.8.0 writes elsewhere (`libc:` lines, `@types/estree`, `acorn`) are never committed.
  - If the kept diff is not exactly those 6 lines (for example after a rebase onto #185), stop and report it rather
    than committing a larger lockfile change.
  - **pnpm 9 check (what CI runs).** Copy only the manifests and the lockfile, and run pnpm 9's frozen check:
    ```sh
    D="$S/p9" && mkdir -p "$D" && git ls-files -z | grep -zE '(^|/)package\.json$|^pnpm-lock\.yaml$|^pnpm-workspace\.yaml$|(^|/)\.npmrc$' \
      | xargs -0 -I{} sh -c 'mkdir -p "$1/$(dirname "{}")" && cp "{}" "$1/{}"' _ "$D"
    (cd "$D" && CI=true corepack pnpm@9.15.5 install --frozen-lockfile --lockfile-only --offline)   # exit 0
    ```
    It fails with `ERR_PNPM_OUTDATED_LOCKFILE` when the lockfile does not match. `trash "$D"` afterwards.
  - The CI lockfile cells then stay green with `pnpm install --frozen-lockfile`.
- **TypeScript 6.0.3, as CI's `dist (24, typescript 6.0.3)` cell does it** (`pull-request.yml:48`–`:72`). Run it only
  in a detached scratch worktree of your committed branch:
  ```sh
  git worktree add --detach "$S/wt6" HEAD && cd "$S/wt6"
  export PATH="$S/pnpm-shim:$HOME/.nvm/versions/node/v24.21.0/bin:$PATH" COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline
  pnpm pkg set pnpm.overrides.typescript=6.0.3
  : > "$S/empty.npmrc"
  NPM_CONFIG_USERCONFIG="$S/empty.npmrc" pnpm install --no-frozen-lockfile --config.registry=https://registry.npmjs.org/
  pnpm -r exec node -p "require('typescript/package.json').version"    # every line 6.0.3
  pnpm build --skip-nx-cache && pnpm lint && pnpm test --skip-nx-cache && pnpm test:e2e --skip-nx-cache
  cd - && git worktree remove --force "$S/wt6"
  ```
  - The override rewrites the CLI's `typescript` devDependency to 6.0.3 like every other one. 6.0.3 satisfies the
    peer `>=5.7 <7`, so the cell shows no peer warning for the CLI (measured).
  - The peer range must keep including both matrix versions: 5.7.3 now, and 5.7.3 as the override after the peer
    range flips the pin.
  - Never commit the override or the lockfile it rewrites.
- **Never commit** a `pnpm.overrides` entry, any other lockfile hunk, or a root `package.json` change. Never edit
  `~/.npmrc` (the Artifactory login in it is expired). e2e runs can leave `test-output-*` importers in the lockfile:
  check `git status` before every commit, and restore those with `git checkout -- pnpm-lock.yaml` followed by
  `git apply "$S/lock-min.patch"`.
- Use `git -c rerere.enabled=false` for any merge or rebase.
- `test:e2e` needs `pnpm build` first: the new e2e packs `packages/compiler` with `bin/bin.js` in it.
- Do not run two full suites in parallel on one machine: concurrent `test:e2e` runs cut `websmith-loader-test`
  short.
- New files need the MIT header (`pnpm license:add`); never add them to the `license:check` list.
- Commits use Arlo's notation without a colon (`commit-notation` skill), e.g.:
  - `t Covers the CLI without typescript and with TypeScript 7`
  - `F Checks the installed typescript before loading it`
  - `E Makes typescript a peer dependency of the CLI`
  - `B Spawns the tsc of the typescript websmith-node imports`
  - `d Documents typescript as the CLI's peer dependency`
- Use `trash`, never `rm`.

### Bookkeeping

- Push the `t` commit early, so the PR's 6.0.3 cell shows the red-before.
- Open the PR with `plot-open-pr.sh`, not `gh pr create`.
- Add the `→ #<PR>` suffix to the plan's slice line (`docs/plans/2026-10-02-typescript-6-support.md:332`, before the
  `<!-- builds: -->` comment) and commit it on this branch. Edit nothing else in the plan; it is frozen.
- The PR body carries:
  - the before/after CLI outputs (none, 7.x stub, 5.7.3, 6.0.3);
  - the 6-line lockfile diff and the pnpm 9 frozen-check output;
  - the gate summaries of both versions;
  - the red-before runs;
  - the plan resolutions under "What changed on develop":
    - TypeScript 7.0.2 loads but has no API, so the guard reads `package.json`;
    - no websmith-node copy;
    - the testing guard sits in `index.ts`;
    - the e2e extracts instead of installing;
    - the interim core/api `5.x` peer warnings, so no release between this PR and the peer range;
    - the TypeScript 7 README how-to is left to the peer range;
  - the follow-ups below.

### Scope guard

This branch owns:
- `packages/core/src/check-typescript.ts` (new) and its spec;
- `packages/compiler/src/bin.ts`, the alias line in `packages/compiler/webpack.config.js`, and the `typescript` lines
  of `packages/compiler/package.json`;
- `src/typescript-guard.ts` (new), the first import of `src/index.ts` and `src/index.spec.ts` (new) in `webpack`,
  `testing` and `node`;
- `packages/node/src/websmith/find-tsc.ts`, its spec, and the comment at `Compiler.spec.ts:57`;
- the first `moduleNameMapper` entry in the `jest.config.ts` of `compiler`, `webpack`, `testing` and `node`;
- `packages/compiler-test/tests/cli-typescript-peer.test.ts` (new) and `tsc-ignore-config.test.ts:52`;
- the 6 lockfile lines;
- `packages/compiler/README.md` Installation, `README.md:23`–`:31`, `packages/node/README.md:40`;
- its `Release-Notes.md` entries and its plan suffix.

Do not touch:
- the `typescript` peers and devDependencies of `api`, `core`, `node`, `testing`, `example-addons`, `vite`; the
  loader's missing peer (row 17); the pin (all `feature/typescript-6-peer-range`);
- `.github/workflows/*`, the root `package.json`, `pnpm-workspace.yaml`, tsconfigs;
- `packages/vite/**`;
- `packages/node/src/compiler-options.ts` and `compiler-arguments.ts` (#184's tables);
- the TS6 specs that compare against code-under-test values (`feature/typescript-6-peer-range`);
- core's `index.ts` exports.

If a cell shows a failure this brief does not name, triage it by error code and report it in the PR rather than
improvising outside scope.

### Not in this slice (open follow-ups, verified on `6c986bb0`)

- **The interim peer conflict.** Until the peer range widens core/api to `>=5.7 <7`, a TypeScript 6 project that
  installs the CLI gets npm `ERESOLVE overriding peer dependency` warnings (`npm ls` exits 1) or pnpm "unmet peer
  typescript@5.x". A project without `typescript` gets 5.9.3 auto-installed, not 6.x. The plan's "npx and global
  installs resolve the peer to the newest match (6.x)" holds only after the peer range. Owner:
  `feature/typescript-6-peer-range`, which must merge before 0.11.0 is released.
- **The Vite plugin has no guard.** With TypeScript 7, `@quatico/websmith-vite` fails at load like the CLI did (it
  imports core, which loads `typescript`). Its CommonJS (`index.ts`) and ES module (`index.mts`) entries both need
  the first-import guard. Owner: the maintainer files an issue for the Vite plugin plan.
- **The TypeScript 7 README how-to** ("keep typescript@6 … run 7.x through its own binary"), which the guard's message
  points to. Owner: `feature/typescript-6-peer-range` (its README task).
- **Undeclared `tslib`.** The packed `core`, `api` and `node` libraries `require("tslib")` (`importHelpers`), but only
  the CLI declares it. websmith-node's `lib/` failed with `Cannot find module 'tslib'` in an npm project without
  `tslib` (measured). The CLI bundle is not affected. Owner: a small bug issue outside this plan.
- **#185 (Dependabot)** moves the repo pin 5.7.3 → 5.9.3. That would leave the `>=5.7` floor without a CI cell. Owner:
  the maintainer, against the plan's "the floor is what CI proves".
