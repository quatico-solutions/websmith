/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import {
    AddonRegistry,
    type CompilationConfig,
    type CompileFragment,
    Compiler,
    type CompilerOptions,
    resolveCompilationConfig,
} from "@quatico/websmith-core";
import ts from "typescript";
import { WebpackError } from "webpack";
import { Upath as uPath } from "./Upath";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

export class TsCompiler extends Compiler {
    public fragment?: CompileFragment;
    public loaderConfig: WebsmithLoaderConfig;
    public targets: string[];
    public webpackTarget: string;

    constructor(options: CompilerOptions, dependencyCallback: (filePath: string) => void, loaderConfig: WebsmithLoaderConfig = {}) {
        const system = ts.sys;
        const { addons, targets: targetsMap, addonsDir } = loadCompilationConfig(loaderConfig, options, system);
        const targetNames = loaderConfig.targets ?? [];
        const addonsMerged = addons?.length
            ? addons
            : Object.entries(targetsMap ?? {})
                  .filter(([target]) => targetNames.includes(target))
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  .map(([_, value]) => value.addons ?? [])
                  .flat();
        super(
            options,
            system,
            addonsMerged.length
                ? new AddonRegistry({
                      addons: addonsMerged,
                      addonsDir: addonsDir ?? options.config?.addonsDir ?? "./addons",
                      reporter: options.reporter,
                      system,
                  })
                : undefined,
            dependencyCallback
        );
        this.loaderConfig = loaderConfig;
        super.createTargetContextsIfNecessary();
        this.targets = targetNames.length ? targetNames : (options.targets ?? []);
        this.webpackTarget = this.getFragmentTarget(loaderConfig.webpackTarget ?? "*");
    }

    public getProgram(): ts.Program | undefined {
        return this.program;
    }

    public build(resourcePath: string): CompileFragment {
        if (this.getSystem() !== ts.sys) {
            throw new Error("TsCompiler.build() not called with ts.sys as the active ts.System");
        }

        const fileName = uPath.normalize(resourcePath);

        const result = this.emitSourceFile(fileName, this.webpackTarget, false);

        if (result.diagnostics?.length) {
            result.diagnostics.forEach((diagnostic: ts.Diagnostic) => {
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");

                if (typeof this.loaderConfig?.error === "function") {
                    this.loaderConfig.error(new WebpackError(message));
                } else {
                    // eslint-disable-next-line no-console
                    console.error(message);
                }
            });
        }
        super
            .getWritingTargets()
            .filter((target: string) => target !== this.webpackTarget)
            .forEach((target: string) => {
                this.emitSourceFile(fileName, target, true);

                // TODO: We cannot apply the resultProcessors to the resulting fragment, because webpack has not written the file yet.
                this.contextMap
                    .get(target)
                    ?.getResultProcessors()
                    .forEach(cur => cur([fileName]));
            });

        this.fragment = result;
        return result;
    }

    protected emitSourceFile(fileName: string, target: string, writeFile: boolean): CompileFragment {
        return super.emitSourceFile(fileName, target, writeFile, true);
    }

    private getFragmentTarget(webpackTarget: string): string {
        const fragmentTargets = super.getNonWritingTargets();
        if (fragmentTargets.length === 0) {
            const error = `No writeFile: false targets found for "${webpackTarget}"`;
            this.loaderConfig.warn?.(new WebpackError(error));

            const writingTargets = super.getWritingTargets();
            if (writingTargets.includes(webpackTarget) || webpackTarget == "*") {
                return writingTargets.length > 0 ? writingTargets[0] : webpackTarget;
            }
            const noTargetError = `No target found for "${webpackTarget}"`;
            if (this.loaderConfig.error) {
                this.loaderConfig.error?.(new WebpackError(noTargetError));
            }
            throw new Error(noTargetError);
        }

        const target = fragmentTargets.length === 0 || fragmentTargets.includes(webpackTarget) ? webpackTarget : fragmentTargets[0];
        fragmentTargets
            .filter((cur: string) => cur !== target)
            .forEach((target: string) => {
                this.loaderConfig.warn?.(new WebpackError(`Target "${target}" is not used by the WebsmithPlugin.`));
            });

        return target;
    }
}

const loadCompilationConfig = (loaderConfig: WebsmithLoaderConfig, options: CompilerOptions, system: ts.System): CompilationConfig => {
    // Prefer config values from webpack loaderConfig, but fallback to values from websmith.config.json
    const {
        addons = options.config?.addons ?? [],
        addonsDir = options.config?.addonsDir,
        configFile = options.configFile,
        transpileOnly,
    } = loaderConfig;
    let results: CompilationConfig = {
        addons,
        addonsDir,
        ...(!!transpileOnly && { transpileOnly }),
    };
    if (configFile) {
        results = { ...resolveCompilationConfig(configFile, options.reporter, system), ...results };
    }
    return results;
};
