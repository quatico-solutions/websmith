/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type AddonContext } from "@quatico/websmith-api";
import { createReplaceIdentifierTransformer } from "../foobar-replace-transformer";

/**
 * Example addon that registers a TypeScript transformer to replace "foobar" identifiers with "barfoo".
 *
 * This demonstrates the correct pattern for AST manipulation:
 * - Use registerTransformer() for AST-based transformations
 * - The transformer is executed during TypeScript compilation
 * - No need to manually call ts.transform() or handle compiler options
 *
 * @param ctx The addon context for the compilation.
 */
export const activate = (ctx: AddonContext): void => {
    ctx.registerTransformer({
        before: [createReplaceIdentifierTransformer(/foobar/gi, "barfoo")],
    });
};
