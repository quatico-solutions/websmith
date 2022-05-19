/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { createOptions } from "@quatico/websmith-cli";
import { CompileFragment, CompilerOptions } from "@quatico/websmith-compiler";
import ts from "typescript";
import webpack from "webpack";
import { getInstanceFromCache, setInstanceInCache } from "./instance-cache";
import type { PluginOptions } from "./plugin";
import { WebsmithLoaderContext } from "./plugin";
import { TsCompiler } from "./TsCompiler";

export default function loader(this: WebsmithLoaderContext): void {
    const compilerOptions: CompilerOptions = createOptions(this.pluginConfig);
    // const module = this._module;
    const instance = initializeInstance(this, compilerOptions);

    // const diagnostics = instance.getProgram()?.getOptionsDiagnostics();
    // if (diagnostics && diagnostics.length > 0 && module) {
    //     diagnostics.map(cur => module.addError(new WebpackError(cur.messageText.toString())));
    //     this.callback(new Error("Compiler options error detected"));
    // }

    const fragment = buildTargets(compilerOptions, instance, this.resourcePath);

    this.version = instance.version;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    setInstanceInCache(this._compiler!, this, instance);

    processResultAndFinish(this, fragment, compilerOptions);
}

export const initializeInstance = (loader: webpack.LoaderContext<PluginOptions>, options: CompilerOptions): TsCompiler => {
    const compiler = loader._compiler || ({} as webpack.Compiler);
    let instance = getInstanceFromCache(compiler, loader);
    if (!instance) {
        instance = new TsCompiler(options);
        setInstanceInCache(compiler, loader, instance);
    }

    return instance;
};

export const makeSourceMap = (outputText: string, sourceMapText?: string) => {
    return {
        output: outputText.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ""),
        ...(sourceMapText && { sourceMap: JSON.parse(sourceMapText) }),
    };
};

export const processResultAndFinish = (loader: webpack.LoaderContext<PluginOptions>, fragment: CompileFragment, compilerOptions: CompilerOptions) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const outputText = fragment.files.find((cur: ts.OutputFile) => cur.name.match(/\.jsx?$/i))?.text;
    const sourceMapText = fragment.files.find((cur: ts.OutputFile) => cur.name.match(/\.jsx?\.map$/i))?.text;

    if (!outputText) {
        return loader.callback(
            new Error(`No processed output found for "${loader.resourcePath}" with targets "${compilerOptions.targets.join(",")}"`)
        );
    } else {
        const { output, sourceMap } = makeSourceMap(outputText, sourceMapText);
        loader.callback(undefined, output, sourceMap);
    }
};

const buildTargets = (_compilerOptions: CompilerOptions, compiler: TsCompiler, resourcePath: string) => {
    return compiler.build(resourcePath);
};
