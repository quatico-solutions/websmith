/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Plugin } from "vite";

export function plugin(): Plugin {
    return {
        name: "websmith-vite",
        enforce: "pre",

        // transform hook for processing TypeScript files
        transform(code, id) {
            if (!id.match(/\.(jsx?)$/)) {
                return null;
            }

            // TODO: use WebsmithCompiler to transform the code
            return null;
        },

        // provide HMR support
        handleHotUpdate({ file, server }) {
            if (file.match(/\.(jsx?)$/)) {
                // invalidate the module to trigger a rebuild
                const mod = server.moduleGraph.getModuleById(file);
                if (mod) {
                    server.moduleGraph.invalidateModule(mod);
                }

                return [];
            }

            return undefined;
        },
    };
}
