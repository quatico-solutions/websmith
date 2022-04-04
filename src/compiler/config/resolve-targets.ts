import { Reporter, WarnMessage } from "../reporting";
import { CompilationConfig } from "./CompilationConfig";

// TODO: Target resolution: Passed targets in CLI vs. specified targets in CompilationConfig
//  Passed target this args.target
//  Specified targets in CompilationConfig
export const resolveTargets = (targets: string, config: CompilationConfig | undefined, reporter: Reporter) => {
    const passedTargets = targets
        .split(",")
        .map(it => it.trim())
        .filter(it => it.length > 0);
    const expectedTargets = Object.keys(config?.targets ?? {});
    const missingTargets = passedTargets.filter(cur => expectedTargets.length > 0 && !expectedTargets.includes(cur));
    if (missingTargets.length > 0) {
        reporter.reportDiagnostic(
            new WarnMessage(`Missing targets: The following targets are passed but not configured "${missingTargets.join(", ")}"`)
        );
    }
    return passedTargets;
};
