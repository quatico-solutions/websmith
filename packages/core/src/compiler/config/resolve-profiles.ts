/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter, WarnMessage } from "@quatico/websmith-api";
import { type CompilationConfig } from "./CompilationConfig";

// TODO: Profile resolution: Passed profiles in CLI vs. specified profiles in CompilationConfig
//  Passed profile this args.profile
//  Specified profiles in CompilationConfig
export const resolveProfiles = (names: string[] | undefined, config: CompilationConfig | undefined, reporter: Reporter) => {
    const passedProfiles = names ?? [];
    if (passedProfiles.length > 0 && passedProfiles[0] !== "*") {
        const configured = Object.keys(config?.profiles ?? {});
        const missingProfiles = passedProfiles.filter(passed => configured[0] !== "*" && !configured.includes(passed));
        if (missingProfiles.length > 0) {
            reporter.reportDiagnostic(
                new WarnMessage(`Missing profiles: The following profiles are passed but not configured "${missingProfiles.join(", ")}"`)
            );
        }
    }
    return passedProfiles;
};
