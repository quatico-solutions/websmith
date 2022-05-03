/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */

// import { ErrorMessage } from "@websmith/addon-api";
import { CompileFragment, Compiler, CompilerOptions } from "@websmith/compiler";
import ts from "typescript";
import webpack, { sources, WebpackError } from "webpack";
import { PluginOptions } from "./plugin";
import uPath from "./Upath";

export class TsCompiler extends Compiler {
    public fragment?: CompileFragment;
    public pluginConfig: PluginOptions;

    constructor(options: CompilerOptions, protected webpackTarget: string = "*") {
        super(options, ts.sys);
        this.pluginConfig = { config: "", webpackTarget };
        super.createTargetContextsIfNecessary();
    }

    public getProgram(): ts.Program | undefined {
        return this.program as any;
    }

    public build(resourcePath: string): CompileFragment {
        if (this.getSystem() !== ts.sys) {
            throw new Error("TsCompiler.build() not called with ts.sys as the active ts.System");
        }

        const fileName = uPath.normalize(resourcePath);

        const result = this.emitSourceFile(fileName, this.getFragmentTarget(this.webpackTarget), false);

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

    public provideDeclarationFilesToWebpack(compilation: webpack.Compilation): void {
        if (!this.fragment) {
            return;
        }
        this.outputFilesToAsset(this.fragment.files, compilation, (file: ts.OutputFile) => !file.name.match(/\.d.ts$/i));
    }

    protected emitSourceFile(fileName: string, target: string, writeFile: boolean): CompileFragment {
        return super.emitSourceFile(fileName, target, writeFile);
    }

    private getFragmentTarget(webpackTarget: string): string {
        const fragmentTargets = super.getNonWritingTargets();
        const target = fragmentTargets.length === 0 || fragmentTargets.includes(webpackTarget) ? webpackTarget : fragmentTargets[0];
        fragmentTargets
            .filter((cur: string) => cur !== target)
            .forEach((target: string) => {
                this.pluginConfig.warn?.(new WebpackError(`Target ${target} is not used by the WebsmithPlugin.`));
            });

        return target;
    }

    private outputFileToAsset(outputFile: ts.OutputFile, compilation: webpack.Compilation) {
        const assetPath = uPath.relative(compilation.compiler.outputPath, outputFile.name);
        compilation.assets[assetPath] = new sources.RawSource(outputFile.text);
    }

    private outputFilesToAsset<T extends ts.OutputFile>(
        outputFiles: T[] | IterableIterator<T>,
        compilation: webpack.Compilation,
        skipOutputFile?: (outputFile: T) => boolean
    ) {
        for (const outputFile of outputFiles) {
            if (!skipOutputFile || !skipOutputFile(outputFile)) {
                this.outputFileToAsset(outputFile, compilation);
            }
        }
    }
}
