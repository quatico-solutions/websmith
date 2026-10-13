/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage, type CompilationConfig, type Reporter } from "@quatico/websmith-api";
import { getProfileClosure } from "./profile-closure";

/**
 * Reports a profile `name` that is not configured, and every `depends` target of its closure that is not, as
 * configuration errors. `location` names where the profiles are configured, e.g. "'./websmith.config.json'" or
 * "the loader options"; without it no profiles are configured anywhere.
 */
export const validateProfile = (
    name: string | undefined,
    config: Pick<CompilationConfig, "profiles"> | undefined,
    location: string | undefined,
    reporter: Reporter
): void => {
    if (!name) {
        return;
    }
    const profiles = config?.profiles ?? {};
    const configured = Object.keys(profiles);
    if (!location && configured.length === 0) {
        reporter.reportDiagnostic(new ErrorMessage(`Profile '${name}' is passed but no websmith.config.json was found.`));
        return;
    }
    const available = configured.length ? configured.join(", ") : "none";
    if (!Object.hasOwn(profiles, name)) {
        reporter.reportDiagnostic(new ErrorMessage(`Profile '${name}' is not configured in ${location}. Available profiles: ${available}.`));
        return;
    }
    getProfileClosure(name, config, "dependents-first").missing.forEach(dep =>
        reporter.reportDiagnostic(new ErrorMessage(`Unknown profile '${dep}' in 'depends' of ${location}. Available profiles: ${available}.`))
    );
};
