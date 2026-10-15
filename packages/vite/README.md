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
- **Result processors** of the profile run once per `vite build`, in `buildEnd` and only for a build without errors,
  with the output files of every module of the bundle.
- **Profiles in `depends`** keep the CLI's context: their files go to their own `outDir`, not into the bundle. A rebuild
  by the same plugin instance does not rewrite a file whose text did not change.
- Addons activate once per build; under `vite build --watch` they activate again after an edit of their files, of
  `websmith.config.json` or of `tsconfig.json`.

The options, environments, the dev server and the remaining documentation follow with the plugin's release.
