/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type AddonContext } from "@quatico/websmith-api";
import { createReplaceIdentifierTransformer } from "../foobar-replace-transformer/replace-identifier-transformer";

/**
 * Example addon with a transformer that modifies the source code inside a
 * module.
 *
 * This addon finds all "CLIENT" identifiers in the source file and
 * replaces them with the string "SERVER".
 *
 * @param ctx The compilation context for this addon.
 */
export const activate = (ctx: AddonContext): void => {
    ctx.registerTransformer({
        before: [createReplaceIdentifierTransformer(/CLIENT/, "SERVER")],
    });
};
