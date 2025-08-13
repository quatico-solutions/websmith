/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type WebpackLoaderOptions } from "@quatico/websmith-api";
import { createHash } from "node:crypto";
import { type LoaderContext } from "webpack";
import { createOptions } from "./options";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

const loaderOptionsCache: {
    [name: string]: WeakMap<WebsmithLoaderConfig, WebsmithLoaderConfig>;
} = {};

/**
 * either retrieves loader options from the cache
 * or creates them, adds them to the cache and returns
 */
export const getLoaderOptions = (context: LoaderContext<WebsmithLoaderConfig>): WebsmithLoaderConfig => {
    const options = context.getOptions();

    // If no instance name is given in the options, use the hash of the loader options
    // In this way, if different options are given the instances will be different
    const instanceName = getOptionsHash(options);

    // eslint-disable-next-line no-prototype-builtins
    if (!loaderOptionsCache.hasOwnProperty(instanceName)) {
        loaderOptionsCache[instanceName] = new WeakMap();
    }

    const cache = loaderOptionsCache[instanceName];
    if (cache.has(options)) {
        const retrievedOptions = cache.get(options);
        if (retrievedOptions) {
            return retrievedOptions;
        }
    }

    const resolvedOptions = resolveLoaderOptions(instanceName, options, context);

    cache.set(options, resolvedOptions);

    return resolvedOptions;
};

const resolveLoaderOptions = (
    instanceName: string,
    options: WebsmithLoaderConfig,
    context: LoaderContext<WebsmithLoaderConfig>
): WebsmithLoaderConfig => {
    const hasForkTsCheckerWebpackPlugin = context._compiler?.options.plugins.some(
        plugin => plugin && typeof plugin === "object" && plugin.constructor?.name === "ForkTsCheckerWebpackPlugin"
    );

    // TODO: Resolve compiler options
    return Object.assign({}, createOptions(options), {
        instanceName,
        // Set default transpileOnly to true if there is an instance of ForkTsCheckerWebpackPlugin
        ...(hasForkTsCheckerWebpackPlugin && { transpileOnly: hasForkTsCheckerWebpackPlugin }),
    });
};

export const getOptionsHash = (options: WebsmithLoaderConfig) => {
    const hash = createHash("sha256");
    Object.keys(options).forEach(key => {
        const value = options[key as keyof WebpackLoaderOptions];
        if (value !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            const valueString = isFunction(value) ? value.toString() : JSON.stringify(value);
            hash.update(key + valueString, "utf-8");
        }
    });
    return hash.digest("hex");
};

const isFunction = (value: unknown): value is object => typeof value === "function";
