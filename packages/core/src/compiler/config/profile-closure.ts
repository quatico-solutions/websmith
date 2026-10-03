/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationConfig } from "@quatico/websmith-api";

/**
 * The order of a profile closure: "dependencies-first" yields every profile after the profiles it depends on and the
 * target last, "dependents-first" yields the target first and every profile before the profiles it depends on.
 */
export type ProfileClosureOrder = "dependencies-first" | "dependents-first";

export interface ProfileClosure {
    /** The configured profiles of the closure, each once, in the requested order. */
    profiles: string[];
    /** The `depends` targets that are not configured, each once, in walk order. */
    missing: string[];
}

/**
 * Returns the given profile and the profiles it depends on, directly or transitively. Visits each profile once, so a
 * `depends` cycle ends the walk without error. An unknown target profile yields an empty closure.
 */
export const getProfileClosure = (
    profileName: string | undefined,
    config: Pick<CompilationConfig, "profiles"> | undefined,
    order: ProfileClosureOrder
): ProfileClosure => {
    const profiles = config?.profiles ?? {};
    const result: ProfileClosure = { profiles: [], missing: [] };
    const visited = new Set<string>();

    const visit = (name: string): void => {
        visited.add(name);
        if (order === "dependents-first") {
            result.profiles.push(name);
        }
        for (const dep of profiles[name].depends ?? []) {
            if (!Object.hasOwn(profiles, dep)) {
                if (!result.missing.includes(dep)) {
                    result.missing.push(dep);
                }
            } else if (!visited.has(dep)) {
                visit(dep);
            }
        }
        if (order === "dependencies-first") {
            result.profiles.push(name);
        }
    };

    if (profileName && Object.hasOwn(profiles, profileName)) {
        visit(profileName);
    }
    return result;
};
