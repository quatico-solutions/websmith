<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# @quatico/websmith-vite

A Vite plugin that compiles the TypeScript modules of a Vite bundle with websmith and runs the addons of a websmith
profile on them: generators, processors, transformers and result processors.

```js
// vite.config.mjs
import { defineConfig } from "vite";
import websmith from "@quatico/websmith-vite";

export default defineConfig({
    plugins: [websmith({ profile: "app" })],
});
```

## Environments

`profile` is a profile name, which applies to every Vite environment, or a map from environment name to profile. A
Magellan-shaped app transforms its client modules with one profile and generates from its server modules with another:

```js
// vite.config.mjs
import { defineConfig } from "vite";
import websmith from "@quatico/websmith-vite";

export default defineConfig({
    plugins: [websmith({ profile: { client: "client", ssr: "server" } })],
    builder: {},
    environments: {
        client: { build: { outDir: "dist/client", rollupOptions: { input: "src/main.ts" } } },
        ssr: { build: { outDir: "dist/server", ssr: "src/server.ts" } },
    },
});
```

- **An environment the map does not name** fails that environment's build with an error that names the environment
  and the environments the map names. The other environments build.
- **Each environment has its own compiler**, whether Vite shares the plugin object between environments or not. The
  addons of its profile activate once per environment, its result processors run once per environment, and the paths
  of `addVirtualFile` and `removeOutputFile` are relative to **that environment's** `build.outDir`.
- **A worker** that `worker.plugins` bundles with the same plugin object builds as environment `client`, with the
  profile selected for `client`, and has its own compiler: its addons activate and its result processors run once per
  worker bundle, with the worker's modules only.
- **Two `websmith()` plugins do not chain**: each compiles the TypeScript source, so the second never sees the output
  of the first. Use one plugin with a profile map instead of one plugin per environment or profile.
- **A `node16` or `nodenext` profile** emits CommonJS for a `.cts` module and for a `.ts` module whose nearest
  `package.json` has no `"type": "module"`. Vite cannot bundle CommonJS, so such a module fails the build: set
  `"type": "module"`, use the `.mts` extension, or use `module: "ESNext"`. With `esm` set, the profile's ESM check
  reports the case instead.

## Addon context

The addons of the selected profile receive an `AddonContext` whose file methods map to Vite. The other methods,
`getReporter`, `getSystem` and the `register…` methods, behave as in the `websmith` CLI and the webpack loader.

| `AddonContext` method | Webpack loader | Vite plugin |
|-----------------------|----------------|-------------|
| `addInputFile` | `loaderContext.addDependency` | adds the code file to the compilation and watches it (`this.addWatchFile`) |
| `addAssetDependency` | `loaderContext.addDependency` (child) | watches the child (`this.addWatchFile`); editing it rebuilds under `vite build --watch` |
| `addVirtualFile` | `compilation.emitAsset` | `vite build`: an asset of the bundle (`this.emitFile` in `generateBundle`), any extension; dev server: kept in memory |
| `removeOutputFile` | asset removed | `vite build`: deleted from the bundle in `generateBundle`; dev server: dropped from memory |

- **Paths of `addVirtualFile` and `removeOutputFile`** are bundle file names: a relative path is relative to Vite's
  `build.outDir`, and an absolute path must be inside `build.outDir`. A path outside it, including a relative path
  that leaves it with `../`, is an error that fails the build and names the method and the addon.
- **Removals** apply after the virtual files are emitted and after Vite's own plugins, so an addon can remove a
  virtual file or an asset Vite emits, such as the bundle's CSS. Removing a file the bundle does not hold is a warning.
- **Files an addon writes** through `getSystem().writeFile` go to disk only, not into the bundle.
- **Result processors** of the profile run once per environment of a `vite build`, in `buildEnd` and only for a
  build without errors, with the output files of every module of the environment's bundle.
- **Profiles in `depends`** keep the CLI's context: their files go to their own `outDir`, not into the bundle. A rebuild
  by the same plugin instance does not rewrite a file whose text did not change.
- Addons activate once for every module of a build. Under `vite build --watch` they stay active across rebuilds and
  activate again only after an edit of their files, of `websmith.config.json` or of `tsconfig.json`. The files an
  addon adds or watches in `activate` apply to every rebuild until it activates again.

The options, the dev server and the remaining documentation follow with the plugin's release.
