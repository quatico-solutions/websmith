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
    public pluginConfig?: PluginOptions;

    constructor(options: CompilerOptions) {
        super(options, ts.sys);
        super.createTargetContextsIfNecessary();
    }

    public getProgram(): ts.Program | undefined {
        return this.program as any;
    }

    public buildClient(resourcePath: string): CompileFragment {
        if (this.getSystem() !== ts.sys) {
            throw new Error("TsCompiler.buildClient() called with wrong system");
        }

        const fileName = uPath.normalize(resourcePath);
        const result = super.emitSourceFile(fileName, "client", false);
        if (result.files.length === 0) {
            this.langService
                .getSemanticDiagnostics(fileName)
                .forEach(cur => this.pluginConfig?.error?.(new WebpackError(cur.messageText.toString())));
        }
        return result;
    }

    public buildServer(resourcePath: string): CompileFragment {
        const fileName = uPath.normalize(resourcePath);
        const result = super.emitSourceFile(fileName, "server", true);
        if (result.files.length === 0) {
            this.langService
                .getSemanticDiagnostics(fileName)
                .forEach(cur => this.pluginConfig?.error?.(new WebpackError(cur.messageText.toString())));
        }
        return result;
    }

    public provideDeclarationFilesToWebpack(compilation: webpack.Compilation): void {
        if (!this.fragment) {
            return;
        }
        this.outputFilesToAsset(this.fragment.files, compilation, (file: ts.OutputFile) => !file.name.match(/\.d.ts$/i));
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
