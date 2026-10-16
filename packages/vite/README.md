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
- **A `node16`, `node18`, `node20` or `nodenext` profile** emits CommonJS for a `.cts` module and for a `.ts` module whose nearest
  `package.json` has no `"type": "module"`. Vite cannot bundle CommonJS, so such a module fails the build: set
  `"type": "module"`, use the `.mts` extension, or use `module: "ESNext"`. With `esm` set, the profile's ESM check
  reports the case instead.

## Dev server

`vite dev` compiles with the plugin as `vite build` does, with the same profile per environment.

- **Configuration errors**, e.g. an unconfigured profile, a missing or invalid `websmith.config.json`, a throwing
  `activate` or a profile that emits CommonJS, go to Vite's logger once when the environment starts: `client` at server
  start, `ssr` on its first module. They do not stop the server: every module of that environment fails with them, as
  the error overlay, until the configuration is fixed.
  TypeScript's errors without a file, e.g. an option error, exist only after a module was emitted; they join the errors
  of every module. This holds with `transpileOnly` only: without it, websmith does not report an option error such as
  TS5053 at all, so the dev server serves the module and logs nothing, and `vite build` passes as well.
- **An edit of `websmith.config.json`, the `tsconfig.json`** (and a file it `extends`) **or a file in `addonsDir`**
  reloads the page. The environment's compiler starts again with the new configuration on its next module, and its
  configuration errors are logged again and replace the overlay, or clear it. Only an addon's entry file is loaded
  again; modules it requires keep Node's cache. On a `tsconfig.json` edit, Vite reloads the page as well.
- **An edit of a `package.json`** checks the module format of the modules below it again.
- **Files the plugin writes**: a file whose text on disk is unchanged is not rewritten. A file the plugin writes and
  watches, e.g. a generator's output that an addon reads through `addAssetDependency`, does not trigger a second
  reload. A module a generator writes and the page imports reloads as usual.
- **Module diagnostics** show as the error overlay of the module, as Vite's own errors do.
- **`addVirtualFile`** files are served from memory at `base` + their bundle path, e.g. `/virt/data.json` for
  `addVirtualFile("virt/data.json", …)`, and shadow a real file at the same URL. The server serves those of environment
  `client`, and only to a host that `server.allowedHosts` allows, as Vite does for its modules. A virtual file is
  replaced when its module is transformed again, and dropped when its module's file is deleted. A module that is no
  longer imported but still exists keeps its virtual files, as Vite keeps it in its module graph.
- **Result processors** run after each transform without errors, with that module's output files.
- **`transpileOnly`** is never set automatically. An explicit `transpileOnly` warns once per environment and names the
  addons of the profile that need type information; set `needsTypeInfo` to `false` in an addon that needs none.
- **An edit to a type-only import**, e.g. `import type { Props } from "./types"`, does not reload its importer. An edit
  to a value import reloads it through Vite's module graph. An edit of a file an addon reads through
  `addAssetDependency` reloads the module, but the served output can keep the old text.

## Addon context

The addons of the selected profile receive an `AddonContext` whose file methods map to Vite. The other methods,
`getReporter`, `getSystem` and the `register…` methods, behave as in the `websmith` CLI and the webpack loader.

| `AddonContext` method | Webpack loader | Vite plugin |
|-----------------------|----------------|-------------|
| `addInputFile` | `loaderContext.addDependency` | adds the code file to the compilation and watches it (`this.addWatchFile`) |
| `addAssetDependency` | `loaderContext.addDependency` (child) | watches the child (`this.addWatchFile`); editing it rebuilds under `vite build --watch` |
| `addVirtualFile` | `compilation.emitAsset` | `vite build`: an asset of the bundle (`this.emitFile` in `generateBundle`), any extension; dev server: served from memory |
| `removeOutputFile` | asset removed | `vite build`: deleted from the bundle in `generateBundle`; dev server: dropped from memory |

- **Paths of `addVirtualFile` and `removeOutputFile`** are bundle file names: a relative path is relative to Vite's
  `build.outDir`, and an absolute path must be inside `build.outDir`. A path outside it, including a relative path
  that leaves it with `../`, is an error that fails the build and names the method and the addon.
- **Removals** apply after the virtual files are emitted and after Vite's own plugins, so an addon can remove a
  virtual file or an asset Vite emits, such as the bundle's CSS. Removing a file the bundle does not hold is a warning.
- **Files an addon writes** through `getSystem().writeFile` go to disk only, not into the bundle.
- **Result processors** of the profile run once per environment of a `vite build`, in `buildEnd` and only for a
  build without errors, with the output files of every module of the environment's bundle.
- **Profiles in `depends`** keep the CLI's context: their files go to their own `outDir`, not into the bundle. A file
  whose text on disk is unchanged is not rewritten.
- Addons activate once for every module of a build. **Known limit:** under `vite build --watch`, addons do not
  activate again after an edit of their files, and an edit of `websmith.config.json` or `tsconfig.json` leaves the
  modules Rollup does not transform again with their old output; restart the build. The files an addon adds or
  watches in `activate` apply to every rebuild.

The options and the remaining documentation follow with the plugin's release.
