import type { BaseOptions } from "./BaseOptions";

export type WebpackLoaderOptions = BaseOptions & {
    /**
     * Whether to only transpile the code without emitting any output.
     * Overrides the `transpileOnly` specified in the `config`.
     */
    transpileOnly?: boolean;
};
