/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { WarnMessage, type CompilationConfig, type Reporter } from "@quatico/websmith-api";

export const resolveProfile = (name: string | undefined, config: CompilationConfig | undefined, reporter: Reporter) => {
    if (name) {
        const configured = Object.keys(config?.profiles ?? {});
        if (!configured.includes(name)) {
            reporter.reportDiagnostic(new WarnMessage(`Missing profile: The following profile is passed but not configured "${name}".`));
        }
    }
    return name;
};
