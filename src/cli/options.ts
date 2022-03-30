import { resolve } from "path";
import ts from "typescript";
import { AddonRegistry, DefaultReporter } from "../compiler";
import { CompilerConfig, parseProjectConfig } from "../compiler/config";
import { CompilerOptions, WarnMessage } from "../model";
import { CompilerArguments } from "./CompilerArguments";

export const createOptions = (args: CompilerArguments, system: ts.System = ts.sys): CompilerOptions => {
    const configPath = args.project ?? "./tsconfig.json";
    const parsedProjectConfig = parseProjectConfig(configPath, system);
    const reporter = args.reporter ?? new DefaultReporter(system);

    parsedProjectConfig.options.outDir = args.buildDir ?? parsedProjectConfig.options.outDir ?? "./lib";

    if (args.sourceMap !== undefined) {
        parsedProjectConfig.options.sourceMap = args.sourceMap;
        if (parsedProjectConfig.options.sourceMap === false) {
            parsedProjectConfig.options.inlineSources = undefined;
        }
    }

    const compilerConfig = resolveCompilerConfig(args.config ?? "./websmith.config.json", system);

    // TODO: Target resolution: Passed targets in CLI vs. specified targets in CompilerConfig
    //  Passed target this args.target
    //  Specified targets in CompilerConfig
    const passedTargets = (args.target ?? "").split(",").filter(cur => cur.length > 0);
    const expectedTargets = Object.keys(compilerConfig.targets ?? {});
    const missingTargets = passedTargets.filter(cur => !expectedTargets.includes(cur));
    if (missingTargets.length > 0) {
        reporter.reportDiagnostic(
            new WarnMessage(`Missing targets: The following targets are passed but not configured "${missingTargets.join(", ")}"`)
        );
    }

    return {
        addons: new AddonRegistry({ addonsDir: args.addons ?? "./addons", config: compilerConfig, reporter, system }),
        buildDir: args.buildDir ?? system.getCurrentDirectory(),
        config: compilerConfig,
        debug: args.debug ?? false,
        // FIXME: Do we need lib files, or is injecting them into the system sufficient?
        // files?: Record<string, string>;
        tsconfig: parsedProjectConfig,
        project: parsedProjectConfig.options,
        reporter,
        sourceMap: args.sourceMap ?? false,
        targets: passedTargets,
        watch: args.watch ?? false,
    };
};

const resolveCompilerConfig = (configFilePath: string, system: ts.System): CompilerConfig => {
    const config = JSON.parse(system.readFile(resolve(system.getCurrentDirectory(), configFilePath), "utf-8") ?? "{}");

    if (!system.fileExists(configFilePath)) {
        // eslint-disable-next-line no-console
        console.info(`No magellan configuration found at ${configFilePath}.`);
    }

    // TODO: Do we need further validation for the config per target?
    return config;
};
