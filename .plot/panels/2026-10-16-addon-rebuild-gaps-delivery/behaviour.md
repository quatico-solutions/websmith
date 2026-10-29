# Behaviour lens — 2026-10-16-addon-rebuild-gaps (delivery)

Position: refuted
Evidence: executed

Juror tree: detached worktree at origin/develop a8844130 (it contains #214, #215, #216 and #218). pnpm 10.8.0 via corepack
shim; `pnpm install --frozen-lockfile --offline` and `pnpm build` both passed. I built the hand repros under
`packages/{vite,webpack}-test/test-output-panelrepro*` and in the scratchpad (`cli-watch`).

## Behaviours

B-1 Stale output, loader watch mode: REFUTED (only the first edit works)
- e2e `webpack-loader-resolve-once.test.ts` "emits new processor output of edited asset dependency": passed. It checks only one edit.
- Hand repro with the e2e's own shape: addon `datap` calls `ctx.addAssetDependency(data, file)` inside its processor,
  `transpileOnly: false`, a plain tsconfig with outDir, and `compiler.watch`. data.txt was edited DATA1 → DATA2 → DATA3:
  ```
  main.ts file deps: ["src/main.ts","data.txt","websmith.config.json","tsconfig.json"]
  [initial] built=["src/main.ts"]  bundle: const greeting = "DATA1";
  main.ts file deps: ["src/main.ts","websmith.config.json","tsconfig.json"]     <- data.txt gone
  [DATA2]   built=["src/main.ts"]  bundle: const greeting = "DATA2";
  TIMEOUT at DATA3                                                               <- no rebuild, bundle stays DATA2
  ```
  The same happens with the Vite-template tsconfig, with a needsTypeInfo addon, and with or without noEmit (four variants).
  After the first rebuild, data.txt drops out of the module's webpack file dependencies, so any later edit leaves the
  previous text in place. That is the defect the plan's Changelog says is fixed for the loader. I did not check whether this
  predates #214. The likely seat is the dependency registration on rebuild (WebpackAddonContext.addAssetDependency →
  loaderContext), not FileCache.
- The same three-edit repro passes in the other hosts (see B-2).

B-2 Stale output, CLI watch / Vite dev / vite build --watch: SUPPORTED
- Unit: `FileCache.spec.ts` (same mtime with new content → new version; same content → same version; "new version per
  update w/ different content") and `ModuleCompiler.spec.ts` "version bumped twice w/ two rebuilds…": passed.
- e2e: bin.test.ts "--watch and processor reading an asset dependency"; vite-dev-invalidation "serve new processor
  output w/ edit of asset dependency" (vite and vite6); vite-addon-outputs "bundle new processor output … under watch"
  (vite and vite6): all passed.
- Hand repros with three edits each:
  - CLI `bin.js --watch`: dist/a.js went DATA1 → DATA2 → DATA3 → DATA4.
  - Vite dev `transformRequest`: DATA_V1 → V2 → V3 → V4.
  - `vite build --watch`: bundles DATA_V1 → V2 → V3 → V4.

B-3 noEmit in bundler hosts, addon output in bundle, no .js beside sources: SUPPORTED
- e2e `vite-no-emit.test.ts`: 13/13 passed, covering dev and build, vite and vite6, extends, emitDeclarationOnly,
  dependent profile outDir, and profile noEmit:false with outDir. `webpack-loader-no-emit.test.ts`: 7/7 passed.
- Hand repro with Vite: create-vite options (noEmit, allowImportingTsExtensions, verbatimModuleSyntax, no outDir),
  `.ts` imports, and the replacer addon on both the fast path and the needsTypeInfo path:
  `const main = "MARK_OUT main DATA_V1 " + dep;`, WARNINGS: [], SRC FILES: dep.ts,main.ts,types.ts.
- Hand repro with webpack, same tsconfig: `bundle: const main = "MARK_OUT main DATA_V1 "…`, errors=[], src holds only .ts files.

B-4 No TS5096: SUPPORTED, with a caveat for Vite
- Unit: ModuleCompiler "yields JavaScript w/o TS5096 w/ noEmit, allowImportingTsExtensions, declaration and .ts import": passed.
- Webpack, with a positive control: the template tsconfig plus declaration gives `errors=[]`. The same setup with profile
  `noEmit:false, outDir, rootDir` gives `errors=["Option 'allowImportingTsExtensions' can only be used when one of 'noEmit'…"]`.
  So the loader does report TS5096 when it applies, and the override removes it.
- Vite: in the same control (profile noEmit:false, with and without declaration), Vite also printed no TS5096, although
  `tsc -p` on that shape exits 2 with TS5096. The missing TS5096 in Vite therefore proves nothing either way. The Vite
  plugin seems to swallow TS5096 in general. That is outside this plan, but I report it.

B-5 Type-only import, Vite dev reload: SUPPORTED
- e2e vite-dev-server "should reload the importer w/ edit of a type-only import" (vite and vite6) and "write declarations
  of the edited type-only import": passed.
- Hand repro with Vite dev and a type-info addon: the module graph for main.ts lists `[ 'dep.ts', 'data.txt', 'types.ts' ]`.
  Editing types.ts sent `{"payload":"full-reload","triggeredBy":"types.ts"}`. With transpileOnly as a control, the graph
  lacks types.ts and nothing was sent, which matches the plan's statement that no Program means no deps.

B-6 Type-only import, loader watch: SUPPORTED, scope narrower than the plan's wording
- e2e `webpack-loader-type-only-import.test.ts`: 5/5 passed (declaration error appears, then clears on revert; barrel;
  none under transpileOnly; no node_modules or lib files).
- Hand repro with webpack, noEmit, `.ts` imports and declaration:true: main.ts deps include src/types.ts, and the types.ts
  edit gave `built=["src/main.ts"]`.
- Observation: without `declaration`, a needsTypeInfo addon in the loader does not produce type deps. Main.ts deps had no
  types.ts, and the types.ts edit timed out with no rebuild. Webpack-loaded addons never select the Program path
  (Compiler.anyAddonNeedsTypeInfo reads only the AddonRegistry), so this is consistent with "compiled with type
  information", and the webpack README states "With `declaration: true`". The plan's "or an addon with needsTypeInfo"
  does not hold in the loader.

B-7 vite build --watch picks up addon, config and tsconfig edits: SUPPORTED
- e2e `vite-build-watch.test.ts`: 8/8 passed (addon edit, config drops addon, broken then fixed config, source edit; vite and vite6).
- Hand repro (`vite build --watch`, template tsconfig), events in order:
  ```
  [initial] MARK_OUT … DATA_V1
  [edit addon -> MARK_NEW]        BUNDLE: MARK_NEW dep / MARK_NEW main
  [config drops addon]            BUNDLE: MARK_IN dep / MARK_IN main DATA_IN
  [config broken JSON]            ERROR: [websmith] Invalid JSON in configuration file …  (then END, watcher alive)
  [config fixed, addon back]      BUNDLE: MARK_NEW … DATA_V2
  [tsconfig edit (removeComments)] START … BUNDLE
  [edit extended tsconfig.base.json] START … BUNDLE   (extends chain is watched)
  ```

B-8 Unit tests named by the slices: SUPPORTED
- core FileCache, ModuleCompiler and type-dependencies specs: 137/137 passed. vite hooks.spec: 161/161 passed. webpack
  TsCompiler.spec: 48/48 passed. compiler bin.test: 107 passed and 1 skipped (the skipped test is the pre-existing
  per-file declaration Program option-error case, unrelated to this plan).

## Executed vs read
Executed:
- `pnpm install --frozen-lockfile --offline` and `pnpm build`.
- `npx jest` on the unit and e2e files above.
- Hand repros: vite build, vite build --watch (three scripts), vite dev (two scripts), webpack watch (six variants),
  CLI --watch, and `tsc -p` for the TS5096 control.

Read only:
- Status and slice text of the plan.
- The merge diffstats of #214, #215, #216 and #218.
- Compiler.ts fast-path selection, ModuleCompiler.onTypeCheckProgram, WebpackAddonContext.addAssetDependency, and the
  webpack/vite READMEs.

Not checked (outside this lens): the 5% esm-watch-bench gate, README and Release-Notes wording, and the PR descriptions.
