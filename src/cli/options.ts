import ts from "typescript";
import { AddonRegistry, NoReporter, resolveTargets } from "../compiler";
import { resolveProjectConfig as resolveTsConfig } from "../compiler/config";
import { resolveCompilationConfig } from "../compiler/config/resolve-compiler-config";
import { CompilerOptions, Reporter } from "../model";
import { CompilerArguments } from "./CompilerArguments";

const DEFAULTS = {
    addonsDir: "./addons",
    config: "./websmith.config.json",
    debug: false,
    outDir: "./lib",
    project: "./tsconfig.json",
    sourceMap: false,
    targets: "*",
    watch: false,
};

export const createOptions = (args: CompilerArguments, reporter: Reporter = new NoReporter(), system: ts.System = ts.sys): CompilerOptions => {
    const tsconfig = resolveTsConfig(args.project ?? DEFAULTS.project, system);
    const compilationConfig = resolveCompilationConfig(args.config ?? DEFAULTS.config, reporter, system);

    tsconfig.options.outDir = args.buildDir ?? tsconfig.options.outDir ?? DEFAULTS.outDir;

    if (args.sourceMap !== undefined) {
        tsconfig.options.sourceMap = args.sourceMap;
        if (tsconfig.options.sourceMap === false) {
            tsconfig.options.inlineSources = undefined;
        }
    }

    return {
        addons: new AddonRegistry({ addonsDir: args.addonsDir ?? DEFAULTS.addonsDir, config: compilationConfig, reporter, system }),
        buildDir: args.buildDir ?? system.getCurrentDirectory(),
        config: compilationConfig,
        debug: args.debug ?? DEFAULTS.debug,
        // FIXME: Do we need lib files, or is injecting them into the system sufficient?
        // files?: Record<string, string>;
        tsconfig,
        project: tsconfig.options,
        reporter,
        sourceMap: args.sourceMap ?? DEFAULTS.sourceMap,
        targets: resolveTargets(args.targets || DEFAULTS.targets, compilationConfig, reporter),
        watch: args.watch ?? DEFAULTS.watch,
    };
};
