import { type WebpackError } from "webpack";
import { type WebsmithLoaderOptions } from "./WebsmithLoaderOptions";

export type WebsmithLoaderConfig = WebsmithLoaderOptions & {
    warn?: (err: WebpackError) => void;
    error?: (err: WebpackError) => void;
    instanceName?: string;
};
