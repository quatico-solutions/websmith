/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type WebpackLoaderOptions } from "@quatico/websmith-api";
import path from "node:path";
import type { FilterPattern } from "vite";

/** The options of the websmith Vite plugin. */
export type WebsmithViteOptions = Pick<
    WebpackLoaderOptions,
    "configFile" | "config" | "tsConfigFile" | "tsConfig" | "debug" | "transpileOnly" | "addonEmitOnly"
> & {
    /** Name of the profile whose output Vite bundles. */
    profile?: string;
    /** The module ids websmith compiles, by default TypeScript files. */
    include?: FilterPattern;
    /** The module ids websmith does not compile, by default those in `node_modules`. */
    exclude?: FilterPattern;
};

/** The plugin options resolved against Vite's root: the compiler's loader options and the module id filter. */
export type ResolvedViteOptions = {
    loaderOptions: Partial<WebpackLoaderOptions>;
    include: FilterPattern;
    exclude: FilterPattern;
};

/** The module ids websmith compiles without `include`: TypeScript files. */
export const DEFAULT_INCLUDE = /\.(c|m)?tsx?$/;
/** The module ids websmith does not compile without `exclude`. */
export const DEFAULT_EXCLUDE = /node_modules/;

const PASS_THROUGH_KEYS = ["config", "tsConfig", "debug", "transpileOnly", "addonEmitOnly", "profile"] as const;

/**
 * Resolves `options` against Vite's `root`: `configFile` defaults to `websmith.config.json` in `root`, and a relative
 * `configFile` or `tsConfigFile` is relative to `root`. Without `tsConfigFile`, the compiler takes the `tsconfig.json`
 * next to the config file.
 */
export const resolveViteOptions = (options: WebsmithViteOptions, root: string): ResolvedViteOptions => {
    const { configFile = "websmith.config.json", tsConfigFile, include = DEFAULT_INCLUDE, exclude = DEFAULT_EXCLUDE } = options;
    const loaderOptions: Partial<WebpackLoaderOptions> = {
        configFile: path.resolve(root, configFile),
        ...(tsConfigFile && { tsConfigFile: path.resolve(root, tsConfigFile) }),
    };
    for (const key of PASS_THROUGH_KEYS) {
        if (options[key] !== undefined) {
            Object.assign(loaderOptions, { [key]: options[key] });
        }
    }
    return { loaderOptions, include, exclude };
};
