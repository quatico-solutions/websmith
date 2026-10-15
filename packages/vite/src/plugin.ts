/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createFilter, type Plugin, type ViteDevServer } from "vite";
import { createWebsmithHooks } from "./hooks";
import { createHostCheck } from "./host-check";
import { createHookFilter, type WebsmithViteOptions } from "./options";
import { createVirtualFileMiddleware } from "./virtual-file-middleware";

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
 * - The dev server raises module diagnostics the same way. Its configuration errors go to Vite's logger once, when the
 *   environment starts (`client` at server start, any other environment on its first module), and fail every module
 *   of that environment as the error overlay, without stopping the server. TypeScript's errors without a file join
 *   the errors of every module, with `transpileOnly` only: without it, core does not report an option error such as
 *   TS5053, and the module is served.
 *
 * Addons activate once for every module of a build and, under `vite build --watch`, again only after an edit of their
 * files or of the configuration; the files an addon adds or watches in `activate` apply to every rebuild until then.
 * The addons of the profile receive an `AddonContext` whose methods map to Vite:
 * - `addInputFile` adds a code file to the compilation and watches it; `addAssetDependency` watches a non-code file,
 *   so that editing it rebuilds under `vite build --watch`.
 * - `addVirtualFile` adds a file of any extension to the bundle as an asset, and `removeOutputFile` deletes a file
 *   from the bundle, e.g. an asset Vite emits itself; both apply in `generateBundle`. Their paths are relative to
 *   `build.outDir`, or absolute inside it; a path outside it fails the build. Removing a file the bundle does not
 *   hold is a warning. The dev server serves the virtual files of environment `client` from memory, at `base` + their
 *   bundle path, in front of any real file at that URL, and only to a host `server.allowedHosts` allows, as Vite does.
 * - A file an addon writes through `getSystem().writeFile` goes to disk only, not into the bundle. A rebuild by the
 *   same plugin instance does not rewrite a file with the same text, e.g. the output of a profile in `depends`.
 * - The result processors of the profile run once per environment of a `vite build`, in `buildEnd` and only for a
 *   build without errors, with the output files of every module of the environment's bundle. The dev server runs
 *   them after each transform without errors, with that module's output files.
 * - The profiles in `depends` keep the CLI's context: their files go to their own `outDir`, not into the bundle.
 *
 * The dev server uses the build's profile and does not set `transpileOnly`. With an explicit `transpileOnly`, it warns
 * once per environment and names the addons of the profile that need type information.
 */
export const websmith = (options: WebsmithViteOptions = {}): Plugin => {
    const hooks = createWebsmithHooks(options, { createFilter });
    return {
        name: "websmith",
        enforce: "pre",
        configResolved: hooks.configResolved,
        // Without a returned function, the middleware runs before Vite's own, so a virtual file shadows a real one
        configureServer(server: ViteDevServer) {
            server.middlewares.use(createVirtualFileMiddleware(hooks.findVirtualFile, server.config.base, createHostCheck(server.config)));
        },
        buildStart: hooks.buildStart,
        transform: { filter: { id: createHookFilter(options) }, handler: hooks.transformHandler },
        buildEnd: hooks.buildEnd,
        // In the dev server only: reloads with the new configuration, and sends no reload for the plugin's own writes
        hotUpdate: hooks.hotUpdate,
        // After Vite's own plugins, so a removal sees the assets they emit there, e.g. the CSS of the bundle
        generateBundle: { order: "post", handler: hooks.generateBundle },
    };
};
