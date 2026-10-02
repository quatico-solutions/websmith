<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# package-consumer

Executed: `npm view <pkg>@0.10.0 dependencies` against the npm registry for api, core, compiler, node and
websmith-loader; `npm view` for create-hash, sha.js, lodash; `git show`/`git grep` on `origin/develop`
(package.json files, `pnpm-lock.yaml`, `packages/core/src`). Only read, not built: the plan's alert counts (I did not
call the Dependabot API) and the nx upgrade itself.

## Findings that change the plan

1. **Two of the four critical alerts ship to users, and the plan files them under "dev tooling".**
   The plan's table lists `sha.js (critical)` and `cipher-base (critical)` under "ajv and other dev tooling". On
   develop they come from `create-hash@1.2.0` (`pnpm-lock.yaml:2845`, `:7405-7411`), which is a runtime
   `dependencies` entry of `@quatico/websmith-core` (`packages/core/package.json:42`, published as
   `"create-hash": "1.2.0"` in 0.10.0). Every user of `@quatico/websmith-compiler` and `websmith-loader` installs
   create-hash, cipher-base, sha.js, md5.js and ripemd160 transitively.
2. **That dependency looks unused.** `git grep createHash packages/*/src` finds only `system.createHash`
   (`Compiler.ts:1126-1128`, `check-esm.ts:165`), which is `ts.sys.createHash`, not the npm package. Nothing imports
   `create-hash`. Dropping it from `packages/core/package.json` removes the critical alerts from the consumer tree
   entirely. A `pnpm.overrides` entry (the plan's only tool for this) cannot do that: overrides live in the
   workspace root and are not published.
3. **The "no change for published packages" claim holds only for the overrides, not for the whole plan.**
   Overrides and lockfile bumps are invisible to users, as the open point says. But consumers resolve the published
   ranges fresh, not our lockfile. Where the range already admits the fix, users get it today and our lockfile
   change protects nobody but CI: `sha.js ^2.4.0` (inside create-hash) admits 2.4.12, `lodash ^4.17.21` admits
   4.18.1, `cross-spawn ^7.0.6`, `minimist ^1.2.8`. Where a range pins exactly (`create-hash 1.2.0`, `path 0.12.7`,
   `tslib 2.8.1`, `typescript 5.7.3` in compiler), the only fix is a published-package change. So the plan needs a
   fourth, consumer-facing item: "runtime dependency hygiene", which does change `package.json` of published
   packages and therefore needs a Release-Notes entry under `## [Unreleased]` and a release (Definition of Done).
4. **Runtime vs dev split the plan should state.** Runtime `dependencies` of published packages (0.10.0): core:
   path, lodash, deepmerge, create-hash, comment-json, resolve.exports, cjs-module-lexer; compiler: tslib, minimist,
   commander, typescript; node: lodash, tildify, cross-spawn, path-exists; loader: comment-json; testing: memfs,
   require-from-string (develop manifest; I did not `npm view` testing). Of the alert groups in the plan, only
   lodash (3, runtime, via core and node) and sha.js/cipher-base (via create-hash) reach users. nx, axios, tar,
   form-data, tmp, ESLint toolchain, fast-uri, shell-quote, serialize-javascript, webpack (peer `5.x`, the user's own
   copy), babel, glob, braces are dev-only. The Motivation should say so; it changes how urgent the slices are for
   users (only the non-nx part touches them).
5. **The ESLint open point rests on stale versions.** The plan says "compatible with ESLint 8 and typescript-eslint
   7", but the lockfile resolves `eslint@9.19.0` and `@typescript-eslint/parser@8.22.0` (`pnpm-lock.yaml:6307`).
   Correct the premise before approval; the "leave ESLint upgrade out" decision may still stand.

## Smaller points

- `@nrwl/nx-cloud: 18.0.1` is a root devDependency (`package.json:42`); `nx.json` and `.github` contain no
  `nxCloud`/`accessToken` reference, so the plan's "confirm" resolves to "remove". Recommend deciding it now.
- The `path` npm package (`path@0.12.7`, exact, in core `dependencies`) shadows nothing: Node built-in `path` wins.
  It is the same class as create-hash: an unused runtime dependency that installs `util` and `inherits` for users.
  Check and drop it in the same consumer-facing slice.
- The Changelog line ("no change to the published packages' behaviour") is fine for the nx and Dependabot slices.
  If item 3 is added, the Changelog must say which runtime dependencies were removed or raised.
- Dependabot config: grouping production dependencies is good for this repo because those are what users receive;
  add `ignore` or a note for deliberately exact pins (typescript 5.7.3) so weekly PRs do not fight the TS 5.x
  peer range policy and the ts7-rearchitecture story.

## Slices (from this lens)

- `infra/upgrade-nx`: dev-only, safe for users. One PR, fine. Test that fails before: none beyond CI; acceptable for
  infra, but record `pnpm audit --prod` before and after as the plan says.
- `infra/fix-transitive-alerts`: contains both dev-only overrides and the user-facing sha.js/lodash items; split it.
  Suggested: (a) dev-only overrides, (b) new `fix/trim-runtime-dependencies` removing create-hash and path, raising
  the lodash floor to `^4.18.1` in core and node, with `pnpm audit --prod` and a published-tree check
  (`pnpm pack` then install in a scratch dir and `npm ls sha.js`) as the test that fails before.
- `infra/dependabot-config`: fine, independent; can go first.

## Overlap

No duplicate with the other five plans. Mild adjacency to the ts7-rearchitecture story only through the exact
`typescript 5.7.3` pin in compiler: the Dependabot config must not propose bumping it.

## Open points to decide before approval

- Add the consumer-facing slice (recommended: yes, remove create-hash and path after a grep/test proof they are
  unused, raise lodash floor).
- nx-cloud: remove.
- nx target: newest major that supports Node 22.12 and jest 29 executors (as the plan frames it); state the choice.
- Fix the ESLint version premise.

Verdict: amend
