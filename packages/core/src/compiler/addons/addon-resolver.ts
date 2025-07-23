/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type ts from "typescript";
import { type Reporter, WarnMessage } from "@quatico/websmith-api";
import type { CompilerAddon } from "./CompilerAddon";

export const ADDONS_FOLDER_NAME = `/addons`;

export type Resolver = (names: string[]) => Promise<CompilerAddon[]>;

/**
 * Resolver to lookup addon names in "addons" folder, and return found addons
 */
export const createResolver =
    (reporter: Reporter, system: ts.System): Resolver =>
    async (names: string[]): Promise<CompilerAddon[]> => {
        const results: CompilerAddon[] = [];

        for (const name of names) {
            const addon = await resolveName(name, `${ADDONS_FOLDER_NAME}/${name}`, system);
            if (addon) {
                results.push(addon);
            } else {
                reporter.reportDiagnostic(new WarnMessage(`Couldn't find addon with name "${name}".`));
            }
        }

        return results;
    };

export const resolveName = async (name: string, localPath: string, system: ts.System): Promise<CompilerAddon | undefined> => {
    try {
        const compilerPath = __dirname ? `${__dirname}/..` : "";
        const addonPath = system.resolvePath(`${compilerPath}${localPath}/addon`);

        const addonModule = await import(addonPath);
        return {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            activate: addonModule.activate,
            getName: () => name,
        } as CompilerAddon;
    } catch (_ignored) {
        return undefined;
    }
};
