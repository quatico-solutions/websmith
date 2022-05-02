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
import type { PluginArguments } from "./plugin";
import { WebsmithPlugin, WebsmithLoaderContext } from "./plugin";
import { TsCompiler } from "./TsCompiler";

// TODO: Add content: string parameter and use that to update the cache
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

    if (!fragment) {
        this.callback(new Error(`No valid target "client" or "server" found for ${this.resourcePath}`));
        return;
    }

    this.version = instance.version;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    setInstanceInCache(this._compiler!, this, instance);

    processResultAndFinish(this, fragment, compilerOptions);
}

const initializeInstance = (loader: webpack.LoaderContext<PluginArguments>, options: CompilerOptions): TsCompiler => {
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

const processResultAndFinish = (loader: webpack.LoaderContext<PluginArguments>, fragment: CompileFragment, compilerOptions: CompilerOptions) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const outputText = fragment.files.find((cur: ts.OutputFile) => cur.name.match(/\.jsx?$/i))?.text;
    const sourceMapText = fragment.files.find((cur: ts.OutputFile) => cur.name.match(/\.jsx?\.map$/i))?.text;

    // TODO: If we find files added in root files we do not have in webpack, we must handle the addition and emission of these dependencies
    if (!outputText) {
        return loader.callback(
            compilerOptions.targets.includes("client")
                ? new Error(`No processed and compiled output found for ${loader.resourcePath} and target "client"`)
                : new Error(`No processed output found for ${loader.resourcePath} in targets ${compilerOptions.targets}`)
        );
    } else {
        const { output, sourceMap } = makeSourceMap(outputText, sourceMapText);
        loader.callback(undefined, output, sourceMap);
    }
};

const buildTargets = (compilerOptions: CompilerOptions, compiler: TsCompiler, resourcePath: string) => {
    const fragment = compilerOptions.targets.includes("client") ? compiler.buildClient(resourcePath) : { files: [], version: 0 };
    if (compilerOptions.targets.includes("server")) {
        compiler.buildServer(resourcePath);
    }
    return fragment;
};

module.exports = loader;
