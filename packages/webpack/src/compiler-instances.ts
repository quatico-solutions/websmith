/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { DefaultReporter } from "@quatico/websmith-core";
import { type Compiler, type LoaderContext } from "webpack";
import { CompilationQueue } from "./CompilationQueue";
import { getInstanceFromCache, setInstanceInCache } from "./instance-cache";
import { createLoaderOptionsLoader } from "./loader-options";
import { TsCompiler } from "./TsCompiler";
import { addCompilationHooks } from "./webpack-hooks";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";
import ts from "typescript";

export const getCompilerInstance = (
    options: WebsmithLoaderConfig,
    context: LoaderContext<WebsmithLoaderConfig>,
    dependencyCallback?: (filePath: string) => void
): TsCompiler => {
    const compiler = context._compiler;
    let instance = getInstanceFromCache(compiler, options.instanceName);
    // The constructor resolves the options; afterwards only a change of their files does, once per compilation with hooks
    if (instance) {
        if (!instance.hasCompilationHooks()) {
            instance.refreshOptions(() => loadOptions(options, context)());
            if (isAddonsCheckDue(instance, compiler)) {
                instance.refreshAddons();
            }
        }
    } else {
        const system = ts.sys;
        instance = new TsCompiler(
            {
                cliArgs: { options: {}, fileNames: [], errors: [] },
                reporter: new DefaultReporter(system),
            },
            options,
            dependencyCallback,
            context // Pass the loader context
        );
        if (compiler) {
            addCompilationHooks(compiler, options, {
                websmithCompiler: instance,
                dependencyCallback,
                queue: new CompilationQueue(),
                loadOptions: loadOptions(options, context),
            });
        }
        setInstanceInCache(compiler, options.instanceName, instance);
        isAddonsCheckDue(instance, compiler);
    }
    return instance;
};

// Without compilation hooks, e.g. one instance per thread-loader worker, the addons are checked once per watch
// compilation, whose start time the compiler stub carries, else at most once per interval: the check lists the
// addons directory, which costs milliseconds
const ADDONS_CHECK_INTERVAL_MS = 1000;
const addonsChecks = new WeakMap<TsCompiler, { startTime?: number; checkedAt: number }>();

const isAddonsCheckDue = (instance: TsCompiler, compiler: Compiler | undefined): boolean => {
    const startTime = compiler?.fsStartTime;
    const now = Date.now();
    const last = addonsChecks.get(instance);
    const due = !!last && (startTime !== undefined ? startTime !== last.startTime : now - last.checkedAt >= ADDONS_CHECK_INTERVAL_MS);
    if (!last || due) {
        addonsChecks.set(instance, { startTime, checkedAt: now });
    }
    return due;
};

// Without the raw loader options, e.g. from a loader context stub, the resolved ones are resolved again
const loadOptions = (options: WebsmithLoaderConfig, context: LoaderContext<WebsmithLoaderConfig>): (() => WebsmithLoaderConfig) =>
    typeof context.getOptions === "function" ? createLoaderOptionsLoader(context) : () => options;
