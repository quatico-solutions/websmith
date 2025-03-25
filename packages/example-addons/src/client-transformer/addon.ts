/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type AddonContext } from "@quatico/websmith-api";
import { createReplaceIdentifierTransformer } from "../foobar-replace-transformer";

/**
 * Example addon with a transformer that modifies the source code inside a
 * module.
 *
 * This addon finds all "foobar" identifiers in the source file and
 * replaces them with the string "CLIENT".
 *
 * @param ctx The compilation context for this addon.
 */
export const activate = (ctx: AddonContext): void => {
    ctx.registerTransformer({
        before: [createReplaceIdentifierTransformer(/foobar/gi, "CLIENT")],
    });
};
