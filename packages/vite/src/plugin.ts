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
