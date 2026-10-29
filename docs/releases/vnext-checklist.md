<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Release Checklist — v0.11.0

RC: v0.11.0-rc.2 (2026-10-29), commit `aba6f0c`. Previous: v0.11.0-rc.1 (2026-10-29, `259c6de`), superseded before
any verification; rc.2 adds the 0.11.0 release notes (#226) and the `fast-uri` 3.1.9 override (#227).

No delivered plan carries a `Verified:` record yet, so every item below is unverified.

## Verification

- [ ] addon-rebuild-gaps — type-only imports and `addAssetDependency` files rebuild the module in loader, CLI and
      Vite watch modes; `vite build --watch` reloads addons and config on change
- [ ] cli-error-exit-gaps — `-p <directory>` compiles its `tsconfig.json`; missing paths (TS5058/TS5057), invalid
      `tsconfig.json` options and a malformed `--configFile` are reported and exit 1
- [ ] dependency-updates — `-core` hashes with `node:crypto` (no `create-hash`, `sha.js`, `cipher-base`);
      `lodash ^4.18.1`; runtime deps commander 15, comment-json 5, memfs 4.80, cjs-module-lexer 2.3, resolve.exports
      2.0.4
- [ ] esm-check-precision — no 91001/91002 inside guarded UMD wrappers; 91021 ignores same-name locals; specifiers
      with query, fragment or percent-encoding resolve as at runtime
- [ ] loader-asset-dep-and-cli-noemit — the loader rebuilds on every edit of an `addAssetDependency` file; `websmith`
      writes no JavaScript under `noEmit`
- [ ] loader-options-once — the loader resolves options, config and addons once per compilation; watch mode and the
      persistent cache follow `tsconfig.json` (incl. `extends`) and `websmith.config.json`
- [ ] tsc-option-parity — profile `lib` names convert as in `tsconfig.json` (unknown names are errors); **breaking:**
      no forced `target: "ES5"` / `esModuleInterop: false`, `tsc` defaults apply (affects `node16`, `nodenext`,
      `preserve`)
- [ ] typescript-6-support — `typescript >=5.7 <7` across packages; **breaking:** `websmith-compiler` takes
      `typescript` as a peer instead of shipping 5.7.3
- [ ] vite-plugin — new `@quatico/websmith-vite` (Vite 6/7, 8 best-effort): addons in `vite build` and the dev server,
      per-environment profiles, errors through Vite, HMR reload

## Automated Tests

- [ ] CI passes on RC tag

## Sign-off

- [ ] All items verified by: ___
- [ ] Final release approved by: ___
