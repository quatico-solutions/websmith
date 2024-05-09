import { LoaderContext } from "webpack";
import { initializeInstance, setInstanceInCache } from "./instance-cache";
import { getLoaderOptions, PluginOptions } from "./loader-options";
import { processResultAndFinish } from "./result-handling";
import { TsCompiler } from "./TsCompiler";

export function loader(this: LoaderContext<PluginOptions>): void {
    this.cacheable && this.cacheable();
    const loaderOptions = getLoaderOptions(this);
    const instance = initializeInstance(this, loaderOptions, (path: string) => {
        this.addDependency(path);
    });
    const fragment = buildTargets(instance, this.resourcePath);

    this.version = instance.version;

    setInstanceInCache(this._compiler, this, instance);

    processResultAndFinish(this, fragment, instance.targets);
}
const buildTargets = (compiler: TsCompiler, resourcePath: string) => {
    return compiler.build(resourcePath);
};
