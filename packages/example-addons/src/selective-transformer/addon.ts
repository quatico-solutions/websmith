/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type AddonContext } from "@quatico/websmith-api";
import path from "node:path";
import ts from "typescript";

export interface SelectiveTransformerConfig {
    /**
     * Pattern to match in the filename (e.g., "service" will transform "user-service.ts")
     * If empty or undefined, all files will be transformed
     */
    filePattern?: string;
    /**
     * Comment to add to transformed functions (default: "TRANSFORMED")
     */
    transformMarker?: string;
}

/**
 * Example addon that conditionally transforms files based on filename patterns.
 *
 * This demonstrates the proper use of Transformers for selective AST modification:
 * - Transformers operate on the TypeScript AST during compilation
 * - Framework automatically detects when transformers modify the output
 * - Files that don't match the pattern are not transformed
 * - Perfect for addonEmitOnly mode where only transformed files should be emitted
 *
 * @param ctx The addon context for the compilation.
 */
export const activate = (ctx: AddonContext<SelectiveTransformerConfig>): void => {
    const profileConfig = ctx.getProfileConfig();

    // Handle both flat config and nested config with addon name as key
    const addonConfig = (profileConfig as Record<string, SelectiveTransformerConfig>)?.["selective-transformer"] ?? profileConfig;

    const filePattern = addonConfig?.filePattern;
    const transformMarker = addonConfig?.transformMarker ?? "TRANSFORMED";

    const transformer: ts.TransformerFactory<ts.SourceFile> = _context => {
        return sourceFile => {
            // If filePattern is specified, only transform files matching the pattern
            if (filePattern) {
                const basename = path.basename(sourceFile.fileName);
                if (!basename.includes(filePattern)) {
                    return sourceFile; // Return unchanged - won't be marked as addon-processed
                }
            }

            const transformedStatements: ts.Statement[] = [];

            // Transform all function declarations and variable declarations with arrow functions
            // by adding a marker variable before them
            const createMarkerVariable = (): ts.VariableStatement => {
                return ts.factory.createVariableStatement(
                    undefined,
                    ts.factory.createVariableDeclarationList(
                        [ts.factory.createVariableDeclaration(
                            ts.factory.createIdentifier(`__${transformMarker}_MARKER`),
                            undefined,
                            undefined,
                            ts.factory.createStringLiteral(transformMarker)
                        )],
                        ts.NodeFlags.None
                    )
                );
            };

            // Process each statement in the source file
            sourceFile.statements.forEach(statement => {
                // Transform function declarations by adding a marker variable before them
                if (ts.isFunctionDeclaration(statement) && statement.name) {
                    transformedStatements.push(createMarkerVariable());
                    transformedStatements.push(statement);
                }
                // Transform variable declarations with arrow function initializers
                else if (ts.isVariableStatement(statement)) {
                    const declaration = statement.declarationList.declarations[0];
                    if (declaration?.initializer && ts.isArrowFunction(declaration.initializer)) {
                        transformedStatements.push(createMarkerVariable());
                        transformedStatements.push(statement);
                    } else {
                        transformedStatements.push(statement);
                    }
                } else {
                    transformedStatements.push(statement);
                }
            });

            const result = ts.factory.updateSourceFile(sourceFile, transformedStatements);

            // Framework automatically detects changes by comparing output with/without transformers
            // No need to explicitly mark files - detection happens automatically

            return result;
        };
    };

    ctx.registerTransformer({ before: [transformer] });
};
