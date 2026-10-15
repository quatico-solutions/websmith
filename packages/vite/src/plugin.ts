/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createFilter, type Plugin } from "vite";
import { createWebsmithHooks } from "./hooks";
import { createHookFilter, type WebsmithViteOptions } from "./options";

export type { WebsmithViteOptions } from "./options";

/**
 * Creates the websmith Vite plugin: it compiles the TypeScript modules of the bundle with websmith and the addons of
 * the selected `profile`, and returns their JavaScript and source map to Vite.
 *
 * Each Vite environment, e.g. `client` and `ssr`, compiles with its own instance:
 * - `profile` is a profile name for every environment, or a map from environment name to profile, e.g.
 *   `{ client: "client", ssr: "server" }`. An environment the map does not name fails its own build with an error
 *   that names it; the other environments build.
 * - Every environment has its own compiler, addons, diagnostics and outputs, also when Vite shares one plugin object
 *   between environments. Paths of `addVirtualFile` and `removeOutputFile` are relative to the `build.outDir` of the
 *   environment. A worker that `worker.plugins` bundles with the same plugin object has its own as well.
 * - Two `websmith()` plugins do not chain: the second compiles the TypeScript source, not the first one's output.
 * - Under a node module kind (`node16`, `node18`, `node20`, `nodenext`), a module TypeScript emits as CommonJS fails its
 *   transform, before any addon runs on it: a `.cts` file, or a file whose nearest `package.json` has no
 *   `"type": "module"`. With `esm`, core's ESM check reports it instead.
 *
 * Diagnostics go through Vite, not to the console:
 * - The errors of a module fail its transform with one error, `file (line,column): message` per diagnostic, and
 *   the first position as `loc`. Its warnings go to `this.warn`, with their position when they have one; messages
 *   and suggestions only with `debug`. This covers syntax errors, declaration emit errors, the ESM check of the
 *   profile and of the profiles it depends on, and a throwing processor, generator or transformer.
 * - Type errors are not checked, as in the webpack loader and in Vite itself: run `tsc --noEmit` for them.
 * - Configuration errors fail a `vite build` in `buildStart`, once, before any module is compiled: an unconfigured
 *   profile, a missing config file, a missing `depends` target, a throwing `activate`, and a profile whose
 *   effective `module` emits CommonJS, which Vite cannot bundle. A `vite build --watch` resolves the options again
 *   when `websmith.config.json` or `tsconfig.json` changes. TypeScript's errors without a file, e.g. an option
 *   error, exist only after a module was emitted and fail the build in `buildEnd`, once.
 * - The dev server raises module diagnostics the same way; its configuration errors are not reported yet.
 *
 * Addons activate once for every module of a build and, under `vite build --watch`, again only after an edit of their
 * files or of the configuration; the files an addon adds or watches in `activate` apply to every rebuild until then.
 * The addons of the profile receive an `AddonContext` whose methods map to Vite:
 * - `addInputFile` adds a code file to the compilation and watches it; `addAssetDependency` watches a non-code file,
 *   so that editing it rebuilds under `vite build --watch`.
 * - `addVirtualFile` adds a file of any extension to the bundle as an asset, and `removeOutputFile` deletes a file
 *   from the bundle, e.g. an asset Vite emits itself; both apply in `generateBundle`. Their paths are relative to
 *   `build.outDir`, or absolute inside it; a path outside it fails the build. Removing a file the bundle does not
 *   hold is a warning. The dev server keeps virtual files in memory and does not serve them yet.
 * - A file an addon writes through `getSystem().writeFile` goes to disk only, not into the bundle. A rebuild by the
 *   same plugin instance does not rewrite a file with the same text, e.g. the output of a profile in `depends`.
 * - The result processors of the profile run once per environment of a `vite build`, in `buildEnd` and only for a
 *   build without errors, with the output files of every module of the environment's bundle.
 * - The profiles in `depends` keep the CLI's context: their files go to their own `outDir`, not into the bundle.
 */
export const websmith = (options: WebsmithViteOptions = {}): Plugin => {
    const hooks = createWebsmithHooks(options, { createFilter });
    return {
        name: "websmith",
        enforce: "pre",
        configResolved: hooks.configResolved,
        buildStart: hooks.buildStart,
        transform: { filter: { id: createHookFilter(options) }, handler: hooks.transformHandler },
        buildEnd: hooks.buildEnd,
        // After Vite's own plugins, so a removal sees the assets they emit there, e.g. the CSS of the bundle
        generateBundle: { order: "post", handler: hooks.generateBundle },
    };
};
