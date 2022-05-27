/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { CompileFragment, Compiler, CompilerOptions } from "@quatico/websmith-compiler";
import ts from "typescript";
import { WebpackError } from "webpack";
import { PluginOptions } from "./plugin";
import uPath from "./Upath";

export class TsCompiler extends Compiler {
    public fragment?: CompileFragment;
    public pluginConfig: PluginOptions;

    constructor(options: CompilerOptions, pluginOptions?: PluginOptions, protected webpackTarget: string = "*") {
        super(options, ts.sys);
        this.pluginConfig = pluginOptions ?? { config: "", webpackTarget };
        super.createTargetContextsIfNecessary();
        this.webpackTarget = this.getFragmentTarget(this.webpackTarget);
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

        if (result.diagnostics && result.diagnostics.length > 0) {
            result.diagnostics.forEach((diagnostic: ts.Diagnostic) => {
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                // eslint-disable-next-line no-console
                this.pluginConfig?.error?.(new WebpackError(message)) ?? console.error(message);
            });
        }
        super
            .getWritingTargets()
            .filter((target: string) => target !== this.webpackTarget)
            .forEach((target: string) => {
                super.emitSourceFile(fileName, target, true);
            });

        this.fragment = result;
        return result;
    }

    protected emitSourceFile(fileName: string, target: string, writeFile: boolean): CompileFragment {
        return super.emitSourceFile(fileName, target, writeFile);
    }

    private getFragmentTarget(webpackTarget: string): string {
        const fragmentTargets = super.getNonWritingTargets();
        if (fragmentTargets.length === 0) {
            const error = `No writeFile: false targets found for "${webpackTarget}"`;
            // eslint-disable-next-line no-console
            this.pluginConfig.warn?.(new WebpackError(error));

            const writingTargets = super.getWritingTargets();
            if (writingTargets.includes(webpackTarget) || webpackTarget == "*") {
                return writingTargets.length > 0 ? writingTargets[0] : webpackTarget;
            }
            const noTargetError = `No target found for "${webpackTarget}"`;
            if (this.pluginConfig.error) {
                this.pluginConfig.error?.(new WebpackError(noTargetError));
            }
            throw new Error(noTargetError);
        }

        const target = fragmentTargets.length === 0 || fragmentTargets.includes(webpackTarget) ? webpackTarget : fragmentTargets[0];
        fragmentTargets
            .filter((cur: string) => cur !== target)
            .forEach((target: string) => {
                this.pluginConfig.warn?.(new WebpackError(`Target "${target}" is not used by the WebsmithPlugin.`));
            });

        return target;
    }
}
