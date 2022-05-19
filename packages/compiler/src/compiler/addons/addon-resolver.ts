/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { Reporter, WarnMessage } from "@quatico/websmith-api";
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
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const addonModule = require(system.resolvePath(`${compilerPath}${localPath}/addon`));
        return {
            activate: addonModule.activate,
            name,
        } as CompilerAddon;
    } catch (ignored) {
        return undefined;
    }
};
