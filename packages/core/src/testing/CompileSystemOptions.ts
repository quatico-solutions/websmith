import type { Reporter } from "@quatico/websmith-api";
import type { AddonConfig } from "../compiler";
import type { BrowserSystemOptions } from "../environment";

export type CompileSystemOptions = BrowserSystemOptions & {
    buildDir?: string;
    files?: Record<string, string>;
    addonConfig?: Partial<AddonConfig>;
    reporter?: Reporter;
};
