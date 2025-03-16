import { type WebpackError } from "webpack";
import { type WebpackLoaderOptions } from "@quatico/websmith-core";

export type WebsmithLoaderConfig = WebpackLoaderOptions & {
    warn?: (err: WebpackError) => void;
    error?: (err: WebpackError) => void;
    instanceName?: string;
};
