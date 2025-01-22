/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Reporter, WarnMessage } from "@quatico/websmith-api";
import { CompilationConfig } from "./CompilationConfig";

// TODO: Target resolution: Passed targets in CLI vs. specified targets in CompilationConfig
//  Passed target this args.target
//  Specified targets in CompilationConfig
export const resolveTargets = (targets: string | undefined, config: CompilationConfig | undefined, reporter: Reporter) => {
    const passedTargets =
        targets
            ?.split(",")
            .map(it => it.trim())
            .filter(it => it.length > 0) ?? [];
    if (passedTargets.length > 0 && passedTargets[0] !== "*") {
        const configured = Object.keys(config?.targets ?? {});
        const missingTargets = passedTargets.filter(passed => configured[0] !== "*" && !configured.includes(passed));
        if (missingTargets.length > 0) {
            reporter.reportDiagnostic(
                new WarnMessage(`Missing targets: The following targets are passed but not configured "${missingTargets.join(", ")}"`)
            );
        }
    }
    return passedTargets;
};
