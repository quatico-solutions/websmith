import { Reporter } from "../model";

export interface CompilerArguments {
    addons?: string;
    buildDir?: string;
    config?: string;
    debug?: boolean;
    files?: string[];
    project?: string;
    reporter?: Reporter;
    sourceMap?: boolean;
    target?: string;
    watch?: boolean;
}
