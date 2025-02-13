import {
    type CompilerOptions as WebsmithOptions,
    AddonRegistry,
    DefaultReporter,
    Compiler as WebsmithCompiler,
    resolveCompilationConfig,
    resolveProjectConfig,
} from "@quatico/websmith-core";
import path from "node:path";
import ts from "typescript";
import { Compiler as TscCompiler } from "./Compiler";

const ADDONS_DIR = path.join(__dirname, "..", "..", "..", "sandbox-addons", "lib");

const defaultWebsmithConfig = (options?: ts.CompilerOptions): WebsmithOptions => {
    const system = ts.sys;
    const reporter = new DefaultReporter(system);
    return {
        buildDir: "../src",
        debug: false,
        tsConfig: options ?? {},
        reporter,
        targets: [],
        cliArgs: resolveProjectConfig(options?.project ?? path.join(__dirname, "..", "tsconfig.json"), system),
        watch: false,
    };
};

export const compile = async (files: string[], config?: { tsConfig?: ts.CompilerOptions; websmith?: Partial<WebsmithOptions> }): Promise<string> => {
    const { tsConfig, websmith } = config ?? {};
    if (websmith) {
        const system = ts.sys;
        const reporter = new DefaultReporter(system);
        let websmithConfig: WebsmithOptions = { ...websmith } as unknown as WebsmithOptions;
        if (files && files.length > 0) {
            websmithConfig.cliArgs = { ...(websmithConfig.cliArgs ?? {}), fileNames: files };
        }
        if (websmithConfig.configFile) {
            const config = resolveCompilationConfig(websmithConfig.configFile, reporter, system);
            websmithConfig.config = { ...websmithConfig.config, ...config };
        }
        websmithConfig = { ...defaultWebsmithConfig(tsConfig), ...(tsConfig ? { tsConfig } : {}), ...websmithConfig };

        const { targets } = websmithConfig;
        const { addons, targets: targetsMap, addonsDir } = websmithConfig.config ?? {};
        const addonsMerged = addons?.length
            ? addons
            : Object.entries(targetsMap ?? {})
                  .filter(([target]) => targets?.includes(target))
                  .map(([_, value]) => value.addons ?? [])
                  .flat();
        let addonRegistry: AddonRegistry | undefined = undefined;
        if (addonsMerged.length) {
            addonRegistry = new AddonRegistry({
                addons: addonsMerged,
                addonsDir: addonsDir ?? ADDONS_DIR,
                reporter,
                system: system,
            });
        }

        const results = new WebsmithCompiler(websmithConfig, system, addonRegistry).compile();

        const output = results.diagnostics;
        const reporter2 = new ReporterMock(ts.sys);
        output.forEach(diagnostic => reporter2.reportDiagnostic(diagnostic));
        return Promise.resolve(reporter2.message);
    } else {
        return await new TscCompiler(tsConfig).compile(files);
    }
};

export class ReporterMock extends DefaultReporter {
    public message = "";

    public reportWatchStatus(_diagnostic: ts.Diagnostic, _newLine = ""): void {
        // do nothing
    }

    protected logProblem(message: string, _category: ts.DiagnosticCategory): void {
        this.message += `${message ?? ""}\n`;
    }
}
