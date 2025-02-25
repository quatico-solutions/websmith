import { type CompilerOptions } from "./CompilerOptions";
import { type WebpackLoaderOptions } from "./WebpackLoaderOptions";

export class ResolvedCompilerOptions {
    constructor(
        private options: CompilerOptions,
        private addons?: string[],
        private loaderOptions?: WebpackLoaderOptions
    ) {}

    public getOptions(): CompilerOptions {
        return { ...this.options, ...this.loaderOptions };
    }

    public getAddons(): string[] {
        return this.addons ?? [];
    }
}
