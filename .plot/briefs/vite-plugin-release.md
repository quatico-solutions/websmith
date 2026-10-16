<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — vite-plugin (slice: Release)

- **Plan (canonical):** `docs/plans/2026-10-01-vite-plugin.md` on `develop`. Read the slice line (`:236`), the
  Changelog (`:27-35`), the **Package** bullet (`:53-58`), the "first `pre` plugin" sentence (`:82-83`) and the
  open point **Supported Vite majors** (`:179-182`). This brief turns them into docs, one metadata change and one e2e
  fixture.
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #132 merged
- **Branch:** `docs/vite-plugin-release` (base: `develop`; `develop` was at `aec431d3` when this brief was written,
  and the branch must contain the merge of #209, see Ordering)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the result:** an independent review of the docs against the code, plus uncached gates run by the
  maintainer's session before merge. **The maintainer releases.** You never publish to npm, push a tag or create a
  GitHub release.

**Ordering.** This is the plan's eighth and last slice. `## Slices` runs one branch per `###` heading, in heading
order (plan Notes: "headings run in order"), and no slice line carries a `<!-- waits: -->`. "Neutral module
compiler" merged as #174, "Tracer" as #182 (`fa114cbe`), "Diagnostics" as #193 (`80a247bb`), "Addon outputs and
context" as #198 (`c2622c3f`), "Environments" as #202 (`61fedf42`) and "Dev server" as #205 (`4c713396`). "Dev
invalidation" is **#209, open** when this was written (head `d235187e`, mergeable, CI pending). **Start only after #209
is merged into `develop`.** If it is not, stop and report blocked: this slice documents #209's behaviour and edits the
same README and Release-Notes lines. After this slice the maintainer runs `/plot-deliver` and `/plot-release`.

Line numbers are from `develop` at `aec431d3`, plus #209's head `d235187e` where marked "(#209)". After #209 merges,
the `Release-Notes.md` lines after `:33` move down by 3 and the `packages/vite/README.md` lines after `:64` move down.
If lines have moved, find the text by name.

### What changed on `develop` since the plan was approved (verified 2026-10-16)

- **The package exists and is private.** `packages/vite/package.json`:
  - `"name": "@quatico/websmith-vite"`, `"version": "0.10.0"` (lockstep with every other package),
    **`"private": true` (`:7`)**, `"engines": { "node": ">=22.12" }`;
  - `main`/`types` `lib/index.js`/`lib/index.d.ts`; `exports` `.` with `import` → `lib/index.mjs` / `index.d.mts`
    and `require` → `lib/index.js` / `index.d.ts`, plus `./package.json`;
  - `"files": ["README.md", "lib"]`; `repository.url` `git+https://github.com/quatico-solutions/websmith.git`, the
    same as every published package;
  - `dependencies`: `@quatico/websmith-api` and `-core` as `workspace:*`, `tslib ^2.8.1` (the Tracer's "missing
    `tslib`" note from #182 is resolved);
  - `peerDependencies` (`:54-57`): `typescript ">=5.7 <7"` (#210) and `vite "^6.3.0 || ^7.0.0"`;
  - no `publishConfig`. No published package has one: the workflow passes `--access public`.
- **How packages publish.** `.github/workflows/release-and-publish.yml` runs on a `v*` tag (or `workflow_dispatch`
  with an existing tag):
  - lint, test, build and e2e from the tag; then a GitHub release from `Release-Notes.md`;
  - for a tag without `-` only, it runs `pnpm pack` in every `./packages/*` whose `private` is not `true` (`:85-87`),
    and `npm publish <tarball> --access public` for each tarball whose `name@version` is not on npm yet (`:88-94`);
  - trusted publishing (OIDC) with npm ≥ 11.5.1, no npm token (`:1-3`, `:44-46`); npm adds provenance itself.

  So **removing `"private": true` is the only change that puts `@quatico/websmith-vite` into the next release.** No
  workflow edit is needed for that.
- **Trusted publishing cannot publish a package that does not exist yet.** `npm view @quatico/websmith-vite` gives
  404 (checked 2026-10-16). A trusted publisher is configured in the package's settings on npmjs.com, and npm's docs
  assume the package already exists there (several project guides state it). The tag's OIDC publish of a new name
  therefore fails, and the `run:` block stops at the first failing `npm publish` (Actions runs it with `bash -e`). The
  tarballs are published in glob order (`quatico-websmith-api…`, `…-compiler`, `…-core`, `…-examples`, `…-node`,
  `…-testing`, `…-vite`, `websmith-loader…`), so **a failed `@quatico/websmith-vite` publish would also skip
  `websmith-loader`.** This is a maintainer prerequisite for the release, not your work; put it in the PR body (see
  Bookkeeping).
- **Vite 8 is `latest` on npm and outside the peer range.** dist-tags on 2026-10-16: `latest` `8.3.4`, `previous`
  `6.4.4`. `npm install vite@8 <packed plugin>` fails with `ERESOLVE`. The plan says "8 (Rolldown) best-effort"
  (`:179`), and the peer range admits only 6.3+ and 7. With `--legacy-peer-deps`, build and dev worked on 8.3.4 (see
  Current state). Dependabot **#211** (open) bumps the dev dependency `vite` to `^8.3.4` in `packages/vite` and
  `packages/vite-test`. Do not change the peer range here; document Vite 8 as outside it, and name the decision in the
  PR.
- **The plugin requires a `websmith.config.json`; the loader and the CLI do not look one up.**
  - `resolveViteOptions` (`packages/vite/src/options.ts:80-84`) defaults `configFile` to `<root>/websmith.config.json`,
    and core reports `No configuration file found at "…"` (`packages/core/src/compiler/config/resolve-compiler-config.ts:136-139`)
    when it is missing. There is no way to turn the file off: `configFile` is a string, and `""` resolves to `root`.
  - The root `README.md:81` and `:104` say the CLI and the loader have "no automatic lookup", and
    `packages/webpack/README.md:69-72` says "Without it, only the loader options apply".
  - Verified with the packed plugin: an inline `config` only fails `vite build` in `buildStart` with that error. With
    a `{}` `websmith.config.json` in `root`, the same inline `config` (`addonsDir`, `profiles`) works, also when the
    working directory is not `root`.
  - The plan's option list (`:71-72`) names this default, so this is not a bug for this slice. Document it as a
    difference from the loader. A `configFile: false` option is out of scope (see Not in this slice).
- **Issue #60's example is not the plugin's option shape.** It passes `addonsDir`, `targets` (now `profiles`, in the
  config) and Vite's `include`/`exclude` straight to `websmith()`. The working form is: `addonsDir` and `profiles` in
  `websmith.config.json` (or inline in `config`, with a config file present), `profile: { client: "client", ssr:
  "server" }` because Vite names the server environment `ssr`, and `include`/`exclude` as plugin options. The issue
  also mentions React Router v7; that is not part of the fixture.
- **`packages/vite/README.md` on `develop`** (106 lines): an intro with a minimal `vite.config.mjs` (`:8-21`),
  "Environments" (`:23-56`), "Dev server" (`:58-78`), "Addon context" (`:80-104`), and the placeholder line **"The
  options and the remaining documentation follow with the plugin's release." (`:106`)**. #209 rewrites "Dev server"
  bullets (`:62-88` (#209)) and the last bullets of "Addon context" (`:110-115` (#209)), including the
  `vite build --watch` known limit. There is no install section, no options list, no requirements, no plugin order
  and no diagnostics section; the diagnostics rules live only in the `websmith()` JSDoc
  (`packages/vite/src/plugin.ts:15-61`), e.g. "Type errors are not checked … run `tsc --noEmit`" (`:36`).
- **Root `README.md`** mentions no Vite plugin. "Supported TypeScript versions" (`:38-43`) lists every package that
  declares the `typescript` peer, without `@quatico/websmith-vite`. "Use websmith with webpack" is `:83-118`.
- **`Release-Notes.md` `## [Unreleased]`** has these Vite lines:
  - `### Added` `:16-18`: the `AddonContext` docs per host, including the Vite plugin (#198). Keep it.
  - `### Added` `:26-29` (#202) and `:30-33` (#205), each "The Vite plugin (`@quatico/websmith-vite`, not yet
    published) …", plus `:34-36` (#209) for the dev-server reload. These three are what this slice consolidates.
  - `### Changed` `:39-43`: "under `module: node18` or `node20`, the `websmith` command's fast path,
    `--transpileOnly`, the webpack loader and the Vite plugin emit … Before, they emitted CommonJS". The Vite plugin
    was never published, so it has no "before".
  - `### Fixed` (`:169-170`): "The webpack loader and the Vite plugin report the `tsconfig.json` errors once per
    compilation." A present-tense fact; keep it.
  - #182 and #193 added no bullet (private package), #198 only `:16-18`.
- **Other open PRs** (2026-10-16): #211 and #207 (Dependabot) edit every `package.json`, including
  `packages/vite/package.json`, and `pnpm-lock.yaml`; #195 edits the lockfile. #209 edits `packages/vite/**`,
  `packages/vite-test/**`, `packages/vite/README.md`, `Release-Notes.md` and the plan's `:232` line.

### Current state (packaging check, 2026-10-16)

I built `develop` at `aec431d3` in a detached worktree (pnpm 10.8.0 shim, Node 22.17.0, `pnpm build --skip-nx-cache`
green, 10 projects), ran `pnpm pack` in `packages/vite`, `packages/core` and `packages/api`, and installed the three
tarballs with npm 10.9.2 (empty user config, registry.npmjs.org) into scratch projects next to `vite` and
`typescript@6.0.3`. For the dev-server reload I packed `packages/vite` from #209's head `d235187e` as well.

**The tarball** (`quatico-websmith-vite-0.10.0.tgz`, 80 KB):

- contains `package.json`, `README.md`, `LICENSE` (pnpm adds the root one), `lib/*.js`, `lib/index.mjs`, the
  `.d.ts`/`.d.mts` files, their `.map` files and `lib/tsconfig.tsbuildinfo`. No spec files. The maps point to `../src`,
  which is not packed; `@quatico/websmith-core`'s tarball has the same shape. Leave both as they are;
- rewrites `workspace:*` to `0.10.0`. **Note for the release:** the published `@quatico/websmith-core@0.10.0` has no
  `ModuleCompiler`, so the plugin works only with the core of the same release. Lockstep versioning covers this;
- keeps `"private": true` today, which only blocks `npm publish`, not installation.

**The scratch matrix.** Fixture: `client`/`ssr` environments through `builder: {}`, profile map
`{ client: "client", ssr: "server" }`, a processor plus a result processor that calls `addVirtualFile` in `client`, a
generator plus a result processor in `server`, a `vite.config.mjs` with the default import. Each cell ran `vite build`
through the CLI, `createServer` + `transformRequest` for `client` and `ssr`, `require()` and `import()` of the
package, and a `tsc --noEmit --skipLibCheck` of a typed `vite.config.ts`.

| Vite | Node | TypeScript | install | build | dev | types |
|------|------|------------|---------|-------|-----|-------|
| 6.3.0 (the peer floor) | 22.12.0 and 22.17.0 | 6.0.3; 5.7.3 on 22.17.0 | ok | ok | ok | ok |
| 6.4.4 | 22.12.0 and 22.17.0 | 6.0.3 | ok | ok | ok | ok |
| 7.3.7 | 22.12.0 and 22.17.0 | 6.0.3 | ok | ok | ok | ok |
| 8.3.4 | 22.17.0 | 6.0.3 | **`ERESOLVE`**; ok with `--legacy-peer-deps` | ok | ok | ok |

- "build ok": the `client` bundle has the processor's output, the `ssr` bundle does not; the virtual file is in
  `dist/client`; the server generator wrote its file; both result processors ran once. So `this.environment` in
  `buildEnd` and `generateBundle` works on 6.3.0 (#202's open check).
- **#209 on the edges:** with #209's tarball, an addon edit in `vite dev` logged `[plugin websmith] … changed:` and the
  next transform used the edited addon, on Vite 6.3.0 and 7.3.7, each on Node 22.12.0 and 22.17.0. So `hotUpdate`'s
  `this.environment`, `moduleGraph.invalidateAll` and `logger.info` work at the peer floor and the engines floor.
- `require("@quatico/websmith-vite")` gives the module object with `websmith` and `default`; `import` gives the
  function as `default`.
- Not checked: Node 24 with the tarball (CI's `dist (24)` runs the workspace suite), Windows, `server.middlewareMode`,
  and an addon written in TypeScript in `vite dev`.

### Known limits: verified, and where each goes

All of these are documented, not fixed. "README" means `packages/vite/README.md`; the new "Known limits" section is
item 3.8 below.

| # | Limit | Source | Verified 2026-10-16 | Where it goes |
|---|-------|--------|---------------------|---------------|
| 1 | A dependent profile's result processor runs once per module, with the **source** path, plus once more in the target's `buildEnd` | #198, #202 | yes: `dep` result processor got `["main.ts"]`, `["b.ts"]`, then `["main.js.map","main.js","b.js.map","b.js"]` (Vite 6.4.4). Cause: `ModuleCompiler.ts:447` (`TODO`), shared with the loader | README Known limits; PR "Found, not built" as a core+loader issue to file |
| 2 | The host profile writes its own output to disk (the tsconfig's `outDir`, or next to the source without one) | #198, #209 | yes: `tsc-out/main.js`, `server.js` and maps after `vite build` | README Known limits, with "set `outDir`" advice |
| 3 | Type errors do not fail `vite build`, with or without `transpileOnly` (by design, loader parity) | #193, `plugin.ts:36` | yes: `const greeting: number = "…"` built with exit 0, no diagnostic | README "Diagnostics": run `tsc --noEmit` |
| 4 | Vite 7 on exactly Node 22.12.0 | #182, #193, #209 | **now checked**: build, dev and #209's reload pass | README requirements table; no limit |
| 5 | Vite 6.3.0, `this.environment` in `buildEnd`/`generateBundle` (and #209's `hotUpdate`) | #202, #205, #209 | **now checked**: pass | README requirements table; no limit |
| 6 | Two `websmith()` plugins do not chain | #202 | already in README `:51-52` and JSDoc `:26` | keep; link it from Known limits |
| 7 | File-less option errors (e.g. TS5053) reach the overlay, and fail `vite build`, only with `transpileOnly` (core gap) | #205 | already in README `:65-67` (`:66-68` (#209)) | keep; repeat one line in Known limits; PR "Found, not built" as a core issue |
| 8 | A type-only import does not reload its importer | #205, #209 | in README `:77-78` (`:85-86` (#209)) | Known limits; open issue (core+loader) |
| 9 | An edit of a file an addon reads through `addAssetDependency` reloads, but the module keeps the old output (dev and `vite build --watch`; `FileCache.updateSource`) | #209 | in README `:86-88` (#209) | Known limits; open issue (core) |
| 10 | `vite build --watch` does not re-activate edited addons, and keeps old output of unchanged modules after a config edit | #209 | in README `:112-115` (#209) | Known limits; open issue (`packages/vite`) |
| 11 | `noEmit: true` in `tsconfig.json` silently drops every addon's output (dev and build) | #209 | yes: bundle kept `MARK_IN`, no warning, exit 0. A profile `tsConfig: { noEmit: false }` restores it (checked) | **README Requirements/Configuration, prominently** (a typical Vite tsconfig sets `noEmit`); Known limits; open issue (no owner yet) |
| 12 | `watchFiles` and the `WriteRecord` only grow in a long dev session | #209 | by reading | Known limits, one line |
| 13 | The plugin needs a `websmith.config.json` (default `<root>/websmith.config.json`); inline `config` alone fails | this brief | yes, see "What changed" | README Configuration, and "Differences from the webpack loader" |
| 14 | A non-string value in the `profile` map is passed on unchecked | #202 nit | by reading | PR "Found, not built" only |

None of the four bug slices proposed by the dev-invalidation brief (rows 8-11) has a GitHub issue (`gh issue list`,
2026-10-16; only #60 is open for Vite). Do not file them; list them in the PR so the maintainer can.

### What to do

1. **Set up** (the worktree is yours; never build in the main checkout):

   ```sh
   mkdir -p "$TMPDIR/pnpm-shim" && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > "$TMPDIR/pnpm-shim/pnpm" && chmod +x "$TMPDIR/pnpm-shim/pnpm"
   export PATH="$TMPDIR/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
   pnpm install --frozen-lockfile --offline && pnpm build --skip-nx-cache
   ```

   First check that `git log --oneline origin/develop | grep -m1 "#209"` finds the merge.

2. **`packages/vite/package.json`: remove `"private": true` (`:7`). That is the only metadata change.**
   - Keep `version` `0.10.0`: the maintainer bumps all packages together in `/plot-release`.
   - Keep both peer ranges, `engines`, `files` and `exports`. Add no `publishConfig`: no package has one, and the
     workflow passes `--access public`.
   - Leave `packages/vite-test/package.json` private.
   - Verify: `cd packages/vite && pnpm pack --pack-destination "$TMPDIR/vite-pack"` and
     `tar -xOzf …/quatico-websmith-vite-0.10.0.tgz package/package.json` has no `private` and
     `"@quatico/websmith-core": "0.10.0"`. Then simulate the workflow's filter:
     `pnpm --recursive --filter "./packages/*" exec node -p 'require("./package.json").private === true ? "" : require("./package.json").name'`
     lists `@quatico/websmith-vite`. Remove the tarball afterwards.
   - Commit it alone: `E Makes @quatico/websmith-vite publishable`.

3. **`packages/vite/README.md`: complete it.** Keep the existing sections and #209's text; restructure only by adding
   sections and moving the intro example. Replace the placeholder line (`:106`). Write for users, in English, in the
   style of the existing sections. Target order:
   1. **Title and one-paragraph intro** (keep `:8-10`).
   2. **Installation:** `pnpm add -D @quatico/websmith-vite typescript vite` (npm/yarn equivalents optional). Say that
      `typescript` and `vite` are peer dependencies.
   3. **Requirements** as a support matrix:

      | | Supported | Tested in CI |
      |---|---|---|
      | Node.js | `>=22.12` | 22 and 24 |
      | Vite | `^6.3.0` or `^7.0.0` | 7 (all e2e), 6 (`vite6` alias, every e2e case) |
      | TypeScript | `>=5.7 <7` | 6.0.3; 5.7.3 in the override cell |

      Then: Vite 8 is outside the peer range, so npm refuses to install the plugin next to it (`ERESOLVE`); it built
      and served in a manual check with `--legacy-peer-deps`, but it is not supported. TypeScript 7 is not supported;
      link the root README's "Supported TypeScript versions". Verify the "Tested in CI" column against
      `.github/workflows/pull-request.yml` and `packages/vite-test/tests/*` before you write it; if #211 has merged
      and moved the e2e to Vite 8, say what CI then runs.
   4. **Usage:** the minimal example (from `:12-21`) and the **plugin order** rule from the plan (`:82-83`): the plugin
      runs with `enforce: "pre"` and must see the TypeScript source, so list `websmith()` first in `plugins`, before
      any other plugin that transforms `.ts`/`.tsx` with `enforce: "pre"`. `.tsx` is compiled with `jsx: "preserve"`,
      so Vite's JSX handling (and React Fast Refresh) still applies.
   5. **Configuration:**
      - the plugin reads `websmith.config.json` from Vite's `root` by default and **requires it** (row 13): a missing
        file is a configuration error. `config` overrides the keys of that file; `addonsDir` and `addons` belong in the
        config, not in the plugin options;
      - **`noEmit`** (row 11): with `"noEmit": true` in `tsconfig.json`, as many Vite templates set it, websmith emits
        nothing and the bundle silently has no addon output. Set `"noEmit": false` in the profile's `tsConfig` in
        `websmith.config.json`. Give a short example;
      - set `outDir` in the profile (row 2), since the host profile writes its own output to disk.
   6. **Options:** one bullet per option of `WebsmithViteOptions` (`options.ts:13-27`), in the style of
      `packages/webpack/README.md:64-81`: `configFile` (default `<root>/websmith.config.json`, relative to `root`),
      `config`, `tsConfigFile` (relative to `root`; default: the `tsconfig.json` next to the config file — check
      `options.ts:69-73` and core before you write it), `tsConfig`, `profile` (string or environment map; link
      Environments), `transpileOnly` (never set automatically; link Dev server), `addonEmitOnly`, `debug`, `include`
      (default `/\.(c|m)?tsx?$/`), `exclude` (default `/node_modules/`). For `include`/`exclude`: ids with a query
      (`?raw`, `?url`, `?worker`, `?inline`, `?vue&type=…`) and `\0` virtual ids are never compiled; relative globs
      are relative to `root` (`options.ts:22-24`, `:97-115`; Vite's hook filter uses only the RegExp patterns,
      `createHookFilter`). Say that the loader's `instanceName`, `error`/`warn`
      callbacks and ForkTsChecker detection do not exist here. Every statement must match `options.ts`; read it, do
      not copy the plan.
   7. **Diagnostics:** lift `plugin.ts:31-47` into prose: module errors fail the transform with a position, warnings
      go to `this.warn`, addon throws are errors (the loader only warns: a stated difference), configuration errors
      fail `vite build` in `buildStart` once, and **type errors are not checked: run `tsc --noEmit`** (row 3).
   8. Keep **Environments**, **Dev server** and **Addon context** as they are after #209.
   9. **Differences from the webpack loader:** a short list: config file required (row 13); addon throws are errors;
      `profile` as an environment map; no `instanceName`/callbacks; `include`/`exclude` instead of webpack rules; the
      `AddonContext` table already covers the file methods.
   10. **Known limits:** one bullet each for rows 1, 2, 7, 8, 9, 10, 11, 12, linking to the section that already
       explains it rather than repeating it. Phrase them as current behaviour, without issue numbers (none exist).
   - Keep the license header first. Run `pnpm license:add` and check that it changed nothing else.
   - Commit: `d Documents the options, requirements and known limits of the Vite plugin`.

4. **Root `README.md`.**
   - Add `@quatico/websmith-vite` to the package list in "Supported TypeScript versions" (`:40-43`).
   - Add a section **"Use websmith with Vite"** after "Use websmith with webpack" (after `:118`): the install command,
     the minimal `vite.config.mjs`, one sentence that it reads `websmith.config.json` from Vite's `root` (unlike the
     loader), and a link to `packages/vite/README.md`. At most ~15 lines.
   - Commit: `d Introduces the Vite plugin in the README`.

5. **`Release-Notes.md`: consolidate.**
   - Replace the three "The Vite plugin (`@quatico/websmith-vite`, not yet published) …" bullets (`:26-29`, `:30-33`,
     and #209's `:34-36`) with **one** bullet at the top of `### Added`, built from the plan's Changelog (`:28-34`) but
     true on `develop`:
     - "New package `@quatico/websmith-vite`: a Vite plugin for Vite 6.3+ and 7 that compiles `.ts`, `.tsx`, `.mts`
       and `.cts` modules with websmith in `vite build` and the Vite dev server …";
     - environments with a profile map; diagnostics through Vite and a failing `vite build` on errors, **but not on
       type errors** (run `tsc --noEmit`); addon outputs (`addVirtualFile` as bundle assets, result processors once per
       environment); dev-server overlay and reload on config, tsconfig, addon and `package.json` edits;
     - "Requires TypeScript `>=5.7 <7`, Node.js 22.12+ and a `websmith.config.json` in Vite's `root`."
       (The plan says "TypeScript 5.x or 6.x"; #210 narrowed it.)
     - "See `packages/vite/README.md`, including its known limits."
     Keep it to one bullet of at most ~10 lines, or a lead line with up to 5 sub-bullets, matching the file's style.
   - Keep `:16-18` (the `AddonContext` docs).
   - In `### Changed` `:39-43`, drop "and the Vite plugin" (and adjust "they"), since the plugin has no earlier
     behaviour. Leave `:169-170` as it is.
   - Do not add a version heading or a date. The `[Unreleased]` heading stays.
   - Commit: `d Consolidates the Vite plugin release notes`.

6. **The issue #60 example as a working fixture**, new `packages/vite-test/tests/vite-issue-60.test.ts`. It runs Vite
   **from a real `vite.config.mjs` through the Vite CLI**, as a user does, which no existing e2e does (every runner in
   `tests/vite-project.ts` passes `configFile: false`).
   - Use `createProject`, `writeFile`, `writeTsConfig` and `removeProject` from `tests/vite-project.ts`. Do not change
     the existing runners.
   - Fixture, the issue's example translated (say so in a one-line comment above the fixture):
     - `websmith.config.json`: `{ "addonsDir": "./addons", "profiles": { "client": { "addons": ["client-function-transform"] }, "server": { "addons": ["service-function-generate"] } } }`;
     - `addons/client-function-transform/addon.js`: a processor that replaces a marker; plain CommonJS
       (`exports.activate = …`), as the other e2e addons. The test project has no `package.json`, so `.js` is
       CommonJS;
     - `addons/service-function-generate/addon.js`: a generator that writes `gen/<file>.txt`;
     - `src/main.ts` and `src/server.ts`, both importing `src/shared.ts`;
     - `vite.config.mjs`:

       ```js
       import websmith from "@quatico/websmith-vite";

       export default {
           plugins: [websmith({ profile: { client: "client", ssr: "server" }, include: /\.tsx?$/, exclude: /node_modules/ })],
           builder: {},
           environments: {
               client: { build: { outDir: "dist/client", rollupOptions: { input: "src/main.ts" } } },
               ssr: { build: { outDir: "dist/server", ssr: "src/server.ts" } },
           },
       };
       ```

       No `defineConfig` import, so the same file works under `vite` and `vite6`.
   - Run `vite build` in a child process: `spawnSync(process.execPath, [path.join(path.dirname(require.resolve(`${vite}/package.json`)), "bin/vite.js"), "build"], { cwd: projectDir, encoding: "utf-8" })`
     for `it.each(["vite", "vite6"])`. Assert exit status 0; `dist/client` has the replaced marker; `dist/server` (the
     file is `server.mjs` on Vite 7.3.7) does not; `gen/server.ts.txt` and `gen/shared.ts.txt` exist and
     `gen/main.ts.txt` does not; stderr has no `[plugin websmith]`.
   - One dev case per Vite: in a child `.mjs` script, `createServer({ root, configFile: "<abs>/vite.config.mjs", logLevel: "silent", server: { port: 0 } })`,
     `listen()`, `transformRequest` of `/src/main.ts` in `client` and `/src/server.ts` in `ssr`, print a JSON result,
     `close()`. Assert the client code has the replaced marker and the ssr code does not.
   - It is a **guard**: it passes on `develop` (I ran the same shape against the packed plugin). Prove it is not
     vacuous by deleting `websmith.config.json` once locally: the build must fail with `No configuration file found`.
     Say so in the PR.
   - Show the same configuration in `packages/vite/README.md` (Environments already has a near copy at `:29-40`;
     align the two so the README example is the tested one), and say in the PR which README block the test mirrors.
   - Name the tests "should …", 60 s Jest timeout, remove the project in `afterEach`. License header first.
     Assemble/act/assert does not apply to e2e in the same way, but keep the act (the spawn) before every `expect`.
   - Commit: `t Covers the Vite example of issue #60 end to end`.

7. **Gates, all green:** `pnpm lint`, `pnpm build --skip-nx-cache`, `pnpm test --skip-nx-cache` and
   `pnpm test:e2e --skip-nx-cache`. The shared `.nx-cache` replays outputs from other worktrees, so skip it. The e2e
   gates can leave `test-output-*` importers in `pnpm-lock.yaml`; restore it with `git checkout -- pnpm-lock.yaml`.
   - Run `vite-issue-60.test.ts` 5 times (`pnpm --filter websmith-vite-test exec jest tests/vite-issue-60.test.ts --runInBand`)
     and report "5/5 green, N tests each".
   - Run the whole `packages/vite-test` suite once under Node 24 (`$HOME/.nvm/versions/node/v24.21.0/bin`).
   - **Known flaky test, not yours:** `packages/webpack-test/tests/webpack-loader-resolve-once.test.ts`, "emits output
     of edited tsconfig.json". Re-run it; if it fails twice, report it. Do not change it.

### Done when

The slice line is the specification (`:236`):

- "`packages/vite/README.md` (options, environments, addon-context table, TypeScript 5/6, first `pre` plugin)":
  item 3. "TypeScript 5/6" means the peer range `>=5.7 <7` on `develop`; write that, and name the difference in the
  PR;
- "root `README.md` mention": item 4;
- "`Release-Notes.md` entry under `## [Unreleased]`": item 5, as one consolidated entry;
- "publish configuration for `@quatico/websmith-vite` checked against the npm trusted-publishing workflow from
  0.10.0": item 2 plus the PR's "Maintainer actions before the release";
- "the example from issue #60 as a working fixture in `packages/vite-test`": item 6.

A naive result would pass without these:

- **Every option, default and limit in the README matches the code** on the branch, not the plan: `options.ts`,
  `plugin.ts`, `hooks.ts`. The reviewer will diff them. In particular `configFile`'s default and requirement,
  `include`/`exclude` defaults, `transpileOnly` never set automatically, and type errors not checked.
- **The `noEmit` warning is in the Configuration section**, not only in Known limits.
- **The support matrix states Vite 8 as outside the peer range**, not as "best-effort supported".
- **The Release-Notes entry is one entry**, says TypeScript `>=5.7 <7`, and no "not yet published" remains in
  `[Unreleased]`.
- **The tarball check is in the PR:** `pnpm pack` output without `private`, and the workflow filter listing the
  package.
- **License header** on the new test file and on every edited `.md` (unchanged where present).
- **Nothing else changes:** `git diff origin/develop --stat` shows only the Scope-guard files;
  `git diff origin/develop -- packages/vite/src packages/core packages/webpack pnpm-lock.yaml .github` is empty.

### Repo mechanics

- **pnpm:** 10.34.1 refuses frozen installs here; use the corepack-cached 10.8.0 through the shim above. Never edit
  `pnpm-lock.yaml`, `~/.npmrc` or the root `package.json`.
- **Merges:** `git -c rerere.enabled=false merge origin/develop` if you need newer `develop` in your branch.
- **Network:** the e2e needs none. If you repeat the packaging check with npm, use an empty user config
  (`NPM_CONFIG_USERCONFIG=<empty file>`) and `--registry=https://registry.npmjs.org/`, in a scratch directory outside
  the repository, and remove it afterwards.
- **Fixtures by hand:** under `packages/vite-test/test-output-<name>` (git-ignored; bare `vite`, `vite6` and
  `@quatico/websmith-vite` resolve there). Do not put a `package.json` in it: `pnpm-workspace.yaml` globs
  `packages/**`, and the next `pnpm install` would add it to the lockfile. Remove it with `trash`.
- **Never** `npm publish`, `npm login`, `git tag`, `gh release create`, or `workflow_dispatch` the release workflow.
- **`.github/workflows/` is not edited in this slice.** The `gh` token lacks the `workflow` scope, so a push with a
  workflow change is rejected. The optional workflow changes below are the maintainer's.
- **Commits:** Arlo's notation **without a colon** (`commit-notation` skill), ending with the attribution lines your
  session gives you. The suggested split is in items 2-6, plus the bookkeeping commit below.
- **Deleting files:** `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Its title comes from the wave heading, "Release".
- Append ` → #<PR>` to the `docs/vite-plugin-release` line (`:236`), just before its `<!-- builds: … -->` comment, as
  #209 did on `:232`, and commit `d Links the Vite release slice to its pull request`. Change
  nothing else in the plan.
- **PR body sections:**
  - "What changes for users": the README sections, the root README section, the consolidated release note, and that
    `@quatico/websmith-vite` is no longer private;
  - "Packaging check": your `pnpm pack` result and the workflow-filter output, plus this brief's matrix (cite it as
    checked on 2026-10-16 against `aec431d3` and #209's `d235187e`, unless you re-ran it);
  - **"Maintainer actions before the release"**, verbatim in substance:
    1. `@quatico/websmith-vite` does not exist on npm, and trusted publishing is configured per existing package.
       Before tagging, publish it once by hand (e.g. the packed tarball of the release commit, or a `0.0.0`
       placeholder) and add the trusted publisher on npmjs.com (repository `quatico-solutions/websmith`, workflow
       `release-and-publish.yml`). Otherwise the tag's publish fails at `@quatico/websmith-vite` and, because the loop
       stops at the first failure, also skips `websmith-loader`. If that happens, re-run with `workflow_dispatch`
       after fixing it: already published versions are skipped.
    2. Optional, needs a credential with the `workflow` scope: let the publish loop continue past one failed package
       and fail at the end; add `packages/vite` to the "check packed types" step.
    3. Decide the Vite 8 peer range (Vite 8 is npm `latest`; #211 bumps the dev dependency). Not changed here.
    4. Version bump with `/plot-release`, as for every package.
  - "Plan vs. `develop`": TypeScript `>=5.7 <7` instead of "5.x/6.x"; Vite 8 outside the peer range although "best
    effort"; the required `websmith.config.json` (unlike the loader); issue #60's option shape translated; "fails
    `vite build` on any error" does not hold for type errors (by design).
  - "Found, not built": rows 1, 7, 8, 9, 10, 11, 12 and 14 of the Known limits table, each with its proposed owner
    (core, core+loader, or `packages/vite`), for the maintainer to file as issues.
  - "How it was verified": gates, the 5× run, Node 24, the vacuity check of the fixture.
  - A sentence that no unit test is added because no production code changes; the fixture is the slice's test.

### Scope guard / Not in this slice

This branch owns:

- `packages/vite/package.json`: the removal of `"private": true`, nothing else;
- `packages/vite/README.md`, the root `README.md` (one package-list entry and one new section) and `Release-Notes.md`
  (`[Unreleased]` only);
- the new `packages/vite-test/tests/vite-issue-60.test.ts`;
- the ` → #<PR>` suffix on the plan's `:236` line.

Do not touch:

- `packages/vite/src/**`, including the `websmith()` JSDoc, `packages/vite-test/tests/vite-project.ts` and the other
  e2e files;
- `packages/core/**`, `packages/api/**`, `packages/webpack*/**`, `packages/compiler*/**`, other packages' manifests;
- `.github/**`, the root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `license-config.json`;
- the plan's body (frozen) and `docs/stories/**`.

Not in this slice (each needs its own owner; mention any you trip over in the PR):

- fixing any Known limit: the dependent-profile result processor, the host profile's own writes, type-only import
  reload, the `FileCache.updateSource` stale output, `vite build --watch` re-activation and Rollup's cache, `noEmit`
  dropping output (a diagnostic or an automatic `noEmit: false`), file-less option errors without `transpileOnly`,
  the growing `watchFiles`/`WriteRecord`, the `profile` map value check;
- a `configFile: false` (no config file) option for the plugin;
- widening the `vite` peer range to `^8`, or any dependency bump (#211, #207, #195 are Dependabot's);
- workflow edits, the npm bootstrap publish, the trusted-publisher setup, the version bump, tags and releases;
- React Router v7 integration (issue #60's "Final goal"); closing issue #60 (the maintainer closes it on release).

Concurrent work, checked 2026-10-16:

- **#209** must be merged before you start (Ordering).
- **#211/#207 (Dependabot)** edit `packages/vite/package.json` and the lockfile. If one merges first, merge
  `develop` in, keep your one-line removal of `private`, and take `develop`'s lockfile. If #211 moves the e2e to Vite
  8, the new test still runs on `vite` and `vite6`; report a Vite 8-only failure instead of fixing it.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside scope. Check
in particular:

- whether `tsConfigFile`'s default really is the `tsconfig.json` next to the config file, as `options.ts:70-71` says;
- whether an addon `addon.js` written as CommonJS fails in a project whose `package.json` has `"type": "module"`
  (it did in my scratch run: "exports is not defined in ES module scope"). If so, one README sentence in
  Configuration is enough; it is general websmith behaviour, not the plugin's.
