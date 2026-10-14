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
    };
};
