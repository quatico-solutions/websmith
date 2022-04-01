import ts from "typescript";
import { Reporter, WarnMessage } from "../../model";
import { CompilerConfig } from "./CompilerConfig";

export const resolveCompilerConfig = (configFilePath: string, reporter: Reporter, system: ts.System): CompilerConfig | undefined => {
    if (configFilePath) {
        const resolvedPath = system.resolvePath(configFilePath);
        if (!system.fileExists(resolvedPath)) {
            reporter.reportDiagnostic(new WarnMessage(`No magellan configuration found at ${resolvedPath}.`));
        } else {
            const content = system.readFile(resolvedPath);
            if (content) {
                const config = JSON.parse(content ?? "{}");

                // TODO: Do we need further validation for the config per target?
                return { ...config, configFilePath: resolvedPath };
            }
        }
    }
    return undefined;
};
