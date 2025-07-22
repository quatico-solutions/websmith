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

export type Resolver = (names: string[]) => CompilerAddon[];

/**
 * Resolver to lookup addon names in "addons" folder, and return found addons
 */
export const createResolver =
    (reporter: Reporter, system: ts.System): Resolver =>
    (names: string[]): CompilerAddon[] => {
        return names.reduce((res: CompilerAddon[], name: string) => {
            const addon = resolveName(name, `${ADDONS_FOLDER_NAME}/${name}`, system);
            if (addon) {
                res.push(addon);
            } else {
                reporter.reportDiagnostic(new WarnMessage(`Couldn't find addon with name "${name}".`));
            }
            return res;
        }, []);
    };

export const resolveName = (name: string, localPath: string, system: ts.System): CompilerAddon | undefined => {
    try {
        const compilerPath = __dirname ? `${__dirname}/..` : "";
        const addonPath = system.resolvePath(`${compilerPath}${localPath}/addon`);

         
        // Use eval to prevent webpack from trying to bundle this dynamic require
        const addonModule = eval("require")(addonPath);
        return {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            activate: addonModule.activate,
            getName: () => name,
        } as CompilerAddon;
    } catch (_ignored) {
        return undefined;
    }
};
