/* eslint-disable no-console */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { WebpackLoaderOptions } from "@quatico/websmith-core";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { HmrContext, ModuleNode, Plugin, ResolvedConfig } from "vite";
import { getCompilerInstance, processResult } from "./compiler-adapter";

export interface WebsmithPluginConfig extends WebpackLoaderOptions {
    configFile?: string;
    profile?: string;
    transpileOnly?: boolean;
}

interface PluginCache {
    options?: WebsmithPluginConfig;
}

const pluginCache: PluginCache = {};
const dependencyMap: Record<string, Set<string>> = {};

export function websmithPlugin(options: WebsmithPluginConfig = {}): Plugin {
    let config: ResolvedConfig;

    return {
        name: "vite-plugin-websmith",

        configResolved(resolvedConfig: ResolvedConfig) {
            config = resolvedConfig;

            // Initialize the options
            pluginCache.options = {
                configFile: options.configFile || path.resolve(process.cwd(), "websmith.config.json"),
                profile: options.profile,
                transpileOnly: options.transpileOnly ?? true,
                ...options,
            };
        },

        transform(code: string, id: string) {
            // Skip node_modules
            if (id.includes("node_modules")) {
                return null;
            }

            // Only process TypeScript files
            if (!/\.[jt]sx?$/.test(id)) {
                return null;
            }

            try {
                console.log(`Processing ${id} with profile: ${pluginCache.options?.profile || "default"}`);

                // Track dependencies
                const addDependency = (depPath: string) => {
                    if (!dependencyMap[id]) {
                        dependencyMap[id] = new Set();
                    }
                    dependencyMap[id].add(depPath);
                };

                // Get the options hash for instance caching
                const resolvedOptions = pluginCache.options || {};
                const instanceName = getOptionsHash(resolvedOptions);

                // Get compiler instance
                const instance = getCompilerInstance(resolvedOptions, instanceName, addDependency);

                // Build the file
                const result = instance.build(id);

                // Process result
                return processResult(result, id);
            } catch (error) {
                console.error(`Error processing file ${id}:`, error);
                return {
                    code,
                    map: null,
                };
            }
        },

        handleHotUpdate(ctx: HmrContext): ModuleNode[] | void {
            const { file, server } = ctx;

            // Check if the file is in our dependency map
            const affectedModules = new Set<string>();

            Object.entries(dependencyMap).forEach(([moduleId, deps]) => {
                if (deps.has(file)) {
                    affectedModules.add(moduleId);
                }
            });

            if (affectedModules.size > 0) {
                console.log(`Hot updating modules affected by ${file}`);
                // Return modules that should be invalidated
                return Array.from(affectedModules)
                    .map(id => server.moduleGraph.getModuleById(id))
                    .filter((module): module is ModuleNode => module !== null && module !== undefined);
            }

            return;
        },
    };
}

// Utility functions
export const getOptionsHash = (options: WebsmithPluginConfig) => {
    const hash = createHash("sha256");
    Object.keys(options).forEach(key => {
        const value = options[key as keyof WebsmithPluginConfig];
        if (value !== undefined) {
            const valueString = typeof value === "function" ? value.toString() : JSON.stringify(value);
            hash.update(key + valueString, "utf-8");
        }
    });
    return hash.digest("hex");
};

export const loadConfigFile = (configFilePath: string): any => {
    try {
        const content = readFileSync(configFilePath, "utf-8");
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error loading config file from ${configFilePath}:`, error);
        return {};
    }
};
