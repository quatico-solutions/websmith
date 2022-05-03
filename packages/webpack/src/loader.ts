/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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

import { createOptions } from "@websmith/cli";
import { CompileFragment, CompilerOptions } from "@websmith/compiler";
import ts from "typescript";
import webpack, { WebpackError } from "webpack";
import { getInstanceFromCache, setInstanceInCache } from "./instance-cache";
import type { PluginOptions } from "./plugin";
import { WebsmithLoaderContext, WebsmithPlugin } from "./plugin";
import { TsCompiler } from "./TsCompiler";

function loader(this: WebsmithLoaderContext): void {
    const compilerOptions: CompilerOptions = createOptions(this.pluginConfig);
    const module = this._module;
    const instance = initializeInstance(this, compilerOptions);

    const diagnostics = instance.getProgram()?.getOptionsDiagnostics();
    if (diagnostics && diagnostics.length > 0 && module) {
        diagnostics.map(cur => module.addError(new WebpackError(cur.messageText.toString())));
        this.callback(new Error("Compiler options error detected"));
    }

    const fragment = buildTargets(compilerOptions, instance, this.resourcePath);

    this.version = instance.version;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    setInstanceInCache(this._compiler!, this, instance);

    processResultAndFinish(this, fragment, compilerOptions);
}

const initializeInstance = (loader: webpack.LoaderContext<PluginOptions>, options: CompilerOptions): TsCompiler => {
    const compiler = loader._compiler || ({} as webpack.Compiler);
    let instance = getInstanceFromCache(compiler, loader);
    if (!instance) {
        instance = new TsCompiler(options);
        setInstanceInCache(compiler, loader, instance);
        if (loader._compiler) {
            loader._compiler.hooks.afterCompile.tap(WebsmithPlugin.PLUGIN_NAME, handleAfterCompile(instance));
        }
    }

    return instance;
};

const handleAfterCompile = (instance: TsCompiler) => {
    return (compilation: webpack.Compilation): void => {
        if (!compilation.compiler.isChild()) {
            instance.provideDeclarationFilesToWebpack(compilation);
        }
    };
};

const makeSourceMap = (outputText: string, sourceMapText?: string) => {
    if (sourceMapText === undefined) {
        return { output: outputText, sourceMap: undefined };
    }

    return {
        output: outputText.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ""),
        sourceMap: JSON.parse(sourceMapText),
    };
};

const processResultAndFinish = (loader: webpack.LoaderContext<PluginOptions>, fragment: CompileFragment, compilerOptions: CompilerOptions) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const outputText = fragment.files.find((cur: ts.OutputFile) => cur.name.match(/\.jsx?$/i))?.text;
    const sourceMapText = fragment.files.find((cur: ts.OutputFile) => cur.name.match(/\.jsx?\.map$/i))?.text;

    if (!outputText) {
        return loader.callback(new Error(`No processed output found for ${loader.resourcePath} with targets ${compilerOptions.targets.join(",")}`));
    } else {
        const { output, sourceMap } = makeSourceMap(outputText, sourceMapText);
        loader.callback(undefined, output, sourceMap);
    }
};

const buildTargets = (_compilerOptions: CompilerOptions, compiler: TsCompiler, resourcePath: string) => {
    return compiler.build(resourcePath);
};

module.exports = loader;
