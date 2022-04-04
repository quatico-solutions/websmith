/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import ts from "typescript";
import { Reporter, WarnMessage } from "../reporting";
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
        const addonModule = require(system.resolvePath(`${compilerPath}${localPath}/addon`));
        return {
            activate: addonModule.activate,
            name,
        } as CompilerAddon;
    } catch (ignored) {
        return undefined;
    }
};
