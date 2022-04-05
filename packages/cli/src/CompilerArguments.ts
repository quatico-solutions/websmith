export interface CompilerArguments {
    addons?: string;
    addonsDir?: string;
    buildDir?: string;
    config?: string;
    debug?: boolean;
    files?: string[];
    project?: string;
    sourceMap?: boolean;
    targets?: string;
    watch?: boolean;
}
