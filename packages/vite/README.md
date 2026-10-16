<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# @quatico/websmith-vite

A Vite plugin that compiles the TypeScript modules of a Vite bundle with websmith and runs the addons of a websmith
profile on them: generators, processors, transformers and result processors.

## Installation

```bash
pnpm add -D @quatico/websmith-vite typescript vite
```

With npm: `npm install --save-dev @quatico/websmith-vite typescript vite`. `typescript` and `vite` are peer
dependencies: the plugin compiles with the project's `typescript` and runs in the project's `vite`.

## Requirements

|            | Supported            | Tested in CI                                                     |
|------------|----------------------|------------------------------------------------------------------|
| Node.js    | `>=22.12`            | 22 and 24                                                        |
| Vite       | `^6.3.0` or `^7.0.0` | 7.3 (every e2e case); 6.4 (most e2e cases, through a `vite6` alias) |
| TypeScript | `>=5.7 <7`           | 6.0.3; 5.7.3 in the override cell                                |

- **Vite 8** is outside the peer range, so npm refuses to install the plugin next to it (`ERESOLVE`). It built and
  served in a manual check with `--legacy-peer-deps`, but it is not supported.
- **TypeScript 7** is not supported; see
  [Supported TypeScript versions](../../README.md#supported-typescript-versions).
- **A `websmith.config.json`** in Vite's `root` is required, see [Configuration](#configuration).

## Usage

```js
// vite.config.mjs
import { defineConfig } from "vite";
import websmith from "@quatico/websmith-vite";

export default defineConfig({
    plugins: [websmith({ profile: "app" })],
});
```

**List `websmith()` first in `plugins`.** The plugin runs with `enforce: "pre"` and must see the TypeScript source,
so it must come before any other plugin that transforms `.ts` or `.tsx` modules with `enforce: "pre"`. websmith
compiles `.tsx` with `jsx: "preserve"`, so Vite's JSX handling, and React Fast Refresh, still apply to its output.

## Configuration

The plugin reads `websmith.config.json` from Vite's `root`, or the file `configFile` names. **The file is required:**
without it, `vite build` fails with `No configuration file found at "…"`, and the dev server shows that error on every
module. An empty `{}` is enough when the plugin's `config` option holds the configuration; `config` overrides the keys
of the file. `addonsDir`, `addons` and `profiles` belong in the file or in `config`, not in the plugin options:

```json
{
    "addonsDir": "./addons",
    "profiles": {
        "app": { "addons": ["my-processor"], "tsConfig": { "noEmit": false, "outDir": "./websmith-out" } }
    }
}
```

- **`noEmit`:** with `"noEmit": true` in `tsconfig.json`, as many Vite templates set it, websmith emits nothing and the
  bundle silently has no addon output, without a warning. Set `"noEmit": false` in the profile's `tsConfig`, as above.
- **`outDir`:** the profile Vite bundles also writes its own output to disk, to the tsconfig's `outDir`, or next to
  each source file without one. Set an `outDir` in the profile's `tsConfig`, as above, and ignore it in git.
- **Addons in a `"type": "module"` project:** Node loads an `addon.js` there as an ES module, so a CommonJS
  `addon.js` (`exports.activate = …`) fails to load with "exports is not defined in ES module scope". Write the addon
  in TypeScript (`addon.ts`): websmith compiles it to CommonJS in its own cache directory.

## Options

- **configFile** (string): Path to the `websmith.config.json`, relative to Vite's `root`. Defaults to
  `websmith.config.json` in `root`. The file must exist; a missing file is a configuration error.
- **config** (object): websmith configuration (`addons`, `addonsDir`, `profiles`, `transpileOnly`,
  `addonEmitOnly`). It overrides the same keys of the config file.
- **tsConfigFile** (string): Path to the `tsconfig.json`, relative to Vite's `root`. Defaults to the `tsconfig.json`
  next to the config file.
- **tsConfig** (object): TypeScript compiler options. They override the options of the `tsconfig.json`.
- **profile** (string or object): The profile whose output Vite bundles. A string applies to every Vite environment;
  a map selects the profile by environment name, see [Environments](#environments). Without a profile, no profile
  addons apply.
- **transpileOnly** (boolean): Compile without type information. Never set automatically, also not in the dev
  server, see [Dev server](#dev-server). Defaults to `false`.
- **addonEmitOnly** (boolean): Only emit files that addons processed; all files are still compiled. Defaults to
  `false`.
- **debug** (boolean): Report messages and suggestions as warnings, in addition to errors and warnings. Defaults to
  `false`.
- **include** (RegExp, glob or array): The module ids websmith compiles. Defaults to `/\.(c|m)?tsx?$/`.
- **exclude** (RegExp, glob or array): The module ids websmith does not compile. Defaults to `/node_modules/`.

A relative glob in `include` or `exclude` is relative to Vite's `root`. Ids with a query, e.g. `?raw`, `?url`,
`?worker`, `?inline` or `?vue&type=…`, and virtual ids that start with `\0` are never compiled, whatever the filter.
The webpack loader's `instanceName`, `error` and `warn` options and its `ForkTsCheckerWebpackPlugin` detection do not
exist in the plugin.

## Diagnostics

Diagnostics go through Vite, not to the console.

- **The errors of a module** fail its transform with one error, `file (line,column): message` per diagnostic, and
  the first position as the error's location: syntax errors, declaration emit errors, the ESM check of the profile
  and of the profiles it depends on, and **a throwing processor, generator or transformer**.
- **Warnings** go to Vite's warnings (`this.warn`), with their position when they have one. Messages and suggestions
  are reported only with `debug`.
- **Configuration errors** fail `vite build` once, in `buildStart`, before any module is compiled: an unconfigured
  profile, a missing config file, a missing `depends` target, a throwing `activate`, and a profile whose `module`
  emits CommonJS. In the dev server they go to Vite's logger instead, see [Dev server](#dev-server).
- **Type errors are not checked**, as in the webpack loader and in Vite itself: `vite build` passes with a type
  error. Run `tsc --noEmit` for them, e.g. in a `typecheck` script or in CI.

## Environments

`profile` is a profile name, which applies to every Vite environment, or a map from environment name to profile. A
Magellan-shaped app transforms its client modules with one profile and generates from its server modules with another:

```js
// vite.config.mjs
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

```json
{
    "addonsDir": "./addons",
    "profiles": {
        "client": { "addons": ["client-function-transform"] },
        "server": { "addons": ["service-function-generate"] }
    }
}
```

Vite names its server environment `ssr`, so the map selects the `server` profile for `ssr`. `builder: {}` makes
`vite build` build both environments.

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

## Differences from the webpack loader

- **The config file is required.** The plugin reads `websmith.config.json` from Vite's `root` by default; the loader
  reads a config file only when `configFile` names one.
- **A throwing processor, generator or transformer is an error** that fails the module; the loader only warns.
- **`profile` takes a map** from Vite environment to profile, see [Environments](#environments).
- **No `instanceName`, `error` or `warn` options**, and no `ForkTsCheckerWebpackPlugin` detection.
- **`include` and `exclude`** select the modules, instead of webpack's `rules`.
- **The file methods of the `AddonContext`** map to Vite, see [Addon context](#addon-context).

## Known limits

- **Result processors of a profile in `depends`** run once per module, with the source path, and once more with the
  output files when the environment's build ends.
- **The profile Vite bundles writes its own output to disk**, see [Configuration](#configuration).
- **`"noEmit": true`** in `tsconfig.json` drops every addon's output without a warning, see
  [Configuration](#configuration).
- **TypeScript's errors without a file**, e.g. the option error TS5053, reach the error overlay and fail `vite build`
  only with `transpileOnly`, see [Dev server](#dev-server).
- **An edit to a type-only import** does not reload its importer, see [Dev server](#dev-server).
- **An edit of a file an addon reads through `addAssetDependency`** reloads the module, but its output can keep the
  old text, in the dev server and under `vite build --watch`.
- **Under `vite build --watch`**, edited addons do not activate again, and a configuration edit leaves the modules
  Rollup does not transform again with their old output; restart the build, see [Addon context](#addon-context).
- **The watched files and the record of written files** only grow during a long dev server session.
- **Two `websmith()` plugins do not chain**, see [Environments](#environments).
