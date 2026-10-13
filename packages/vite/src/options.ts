/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type WebpackLoaderOptions } from "@quatico/websmith-api";
import path from "node:path";
import type { createFilter, FilterPattern } from "vite";

/** The options of the websmith Vite plugin. */
export type WebsmithViteOptions = Pick<
    WebpackLoaderOptions,
    "configFile" | "config" | "tsConfigFile" | "tsConfig" | "debug" | "transpileOnly" | "addonEmitOnly"
> & {
    /** Name of the profile whose output Vite bundles. */
    profile?: string;
    /** The module ids websmith compiles, by default TypeScript files. A relative glob is relative to Vite's root. */
    include?: FilterPattern;
    /** The module ids websmith does not compile, by default those in `node_modules`. A relative glob is relative to Vite's root. */
    exclude?: FilterPattern;
};

/** The plugin options resolved against Vite's root: the compiler's loader options and the module id filter. */
export type ResolvedViteOptions = {
    loaderOptions: Partial<WebpackLoaderOptions>;
    filter: (id: string) => boolean;
};

/** The module ids websmith compiles without `include`: TypeScript files. */
export const DEFAULT_INCLUDE = /\.(c|m)?tsx?$/;
/** The module ids websmith does not compile without `exclude`. */
export const DEFAULT_EXCLUDE = /node_modules/;

const PASS_THROUGH_KEYS = ["config", "tsConfig", "debug", "transpileOnly", "addonEmitOnly", "profile"] as const;

const isRegExp = (pattern: string | RegExp): pattern is RegExp => pattern instanceof RegExp;

const toPatterns = (pattern: FilterPattern): Array<string | RegExp> =>
    pattern === null ? [] : typeof pattern === "string" || pattern instanceof RegExp ? [pattern] : [...pattern];

/**
 * Resolves `options` against Vite's `root`: `configFile` defaults to `websmith.config.json` in `root`, and a relative
 * `configFile` or `tsConfigFile` is relative to `root`. Without `tsConfigFile`, the compiler takes the `tsconfig.json`
 * next to the config file. The module id filter comes from Vite's `createFilter`, resolving relative globs of `include`
 * and `exclude` against `root`; a `null` `include` or `exclude` takes the default, as in `createHookFilter`.
 */
export const resolveViteOptions = (options: WebsmithViteOptions, root: string, create: typeof createFilter): ResolvedViteOptions => {
    const { configFile = "websmith.config.json", tsConfigFile } = options;
    const loaderOptions: Partial<WebpackLoaderOptions> = {
        configFile: path.resolve(root, configFile),
        ...(tsConfigFile && { tsConfigFile: path.resolve(root, tsConfigFile) }),
    };
    for (const key of PASS_THROUGH_KEYS) {
        if (options[key] !== undefined) {
            Object.assign(loaderOptions, { [key]: options[key] });
        }
    }
    return { loaderOptions, filter: create(options.include ?? DEFAULT_INCLUDE, options.exclude ?? DEFAULT_EXCLUDE, { resolve: root }) };
};

/**
 * Returns the module id filter for Vite's hook filter, which Vite creates with the plugin, before `root` is known, and
 * which resolves relative globs against the working directory. It takes the RegExp patterns only: with a glob in
 * `include` it accepts every id, and it drops the globs of `exclude`. The filter of `resolveViteOptions` then decides.
 */
export const createHookFilter = (options: WebsmithViteOptions): { include?: RegExp[]; exclude: RegExp[] } => {
    const include = toPatterns(options.include ?? DEFAULT_INCLUDE);
    return {
        ...(include.length > 0 && include.every(isRegExp) && { include }),
        exclude: toPatterns(options.exclude ?? DEFAULT_EXCLUDE).filter(isRegExp),
    };
};
