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
 * This demonstrates the recommended approach for pure AST manipulation: using registerTransformer().
 * This is simpler than the processor-based approach because:
 * - The transformer is executed during TypeScript compilation as part of the standard pipeline
 * - No need to manually call ts.transform() or handle compiler options
 * - Error handling is managed by the compiler
 * - No need to convert AST back to source code with ts.createPrinter()
 *
 * When to use Processors instead:
 * - When you need to modify imports/exports before compilation (TypeScript can resolve these changes)
 * - When you need explicit control over error handling and diagnostics
 * - When you need to modify source files before the TypeScript compilation step
 * - When you need to chain multiple transformations with custom error recovery
 *
 * For the processor-based pattern that manually invokes ts.transform() with explicit error handling,
 * see the client-processor and server-processor examples.
 *
 * @param ctx The addon context for the compilation.
 */
export const activate = (ctx: AddonContext): void => {
    ctx.registerTransformer({
        before: [createReplaceIdentifierTransformer(/foobar/gi, "barfoo")],
    });
};
