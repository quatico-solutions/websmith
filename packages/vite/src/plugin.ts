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
 * Addons activate once per build. The addons of the profile receive an `AddonContext` whose methods map to Vite:
 * - `addInputFile` adds a code file to the compilation and watches it; `addAssetDependency` watches a non-code file,
 *   so that editing it rebuilds under `vite build --watch`.
 * - `addVirtualFile` adds a file of any extension to the bundle as an asset, and `removeOutputFile` deletes a file
 *   from the bundle, e.g. an asset Vite emits itself; both apply in `generateBundle`. Their paths are relative to
 *   `build.outDir`, or absolute inside it; a path outside it fails the build. Removing a file the bundle does not
 *   hold is a warning. The dev server keeps virtual files in memory and does not serve them yet.
 * - A file an addon writes through `getSystem().writeFile` goes to disk only, not into the bundle. A rebuild by the
 *   same plugin instance does not rewrite a file with the same text, e.g. the output of a profile in `depends`.
 * - The result processors of the profile run once per `vite build`, in `buildEnd` and only for a build without
 *   errors, with the output files of every module of the bundle.
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
