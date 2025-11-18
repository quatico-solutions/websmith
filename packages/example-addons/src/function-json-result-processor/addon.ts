/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type AddonContext, InfoMessage } from "@quatico/websmith-api";
import path from "node:path";
import ts from "typescript";

/**
 * Example addon with a result processor that creates JSON data with found
 * function names.
 *
 * This addon consumes all emitted source files to find function declarations
 * and arrow functions to extract their names into a JSON file.
 *
 * When addonEmitOnly is enabled, only files that were actually emitted
 * (processed by addons) are analyzed.
 *
 * @param ctx The compilation context for this addon.
 */
export const activate = (ctx: AddonContext) => {
    ctx.registerResultProcessor((emittedFiles: string[], processorCtx: AddonContext): void => {
        const result: Record<string, string[]> = {};
        const compilerOptions = processorCtx.getCompilerOptions();

        // Get all source file names from the compilation
        const sourceFiles = processorCtx.getFileNames();

        emittedFiles.forEach(emittedPath => {
            // Find the corresponding source file for this emitted file
            // Remove the output extension and directory to match with source file
            const baseName = path.basename(emittedPath, path.extname(emittedPath));

            // Find matching source file
            const sourceFile = sourceFiles.find(src => {
                const srcBaseName = path.basename(src, path.extname(src));
                return srcBaseName === baseName;
            });

            if (!sourceFile) {
                return; // Skip if no matching source file found
            }

            const content = processorCtx.getFileContent(sourceFile);
            const target = compilerOptions.target ?? ts.ScriptTarget.Latest;

            ts.transform(
                ts.createSourceFile(sourceFile, content, target),
                [
                    (context: ts.TransformationContext) =>
                        (curFile: ts.SourceFile): ts.SourceFile => {
                            const funcNames: string[] = [];

                            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                                if (ts.isFunctionDeclaration(node) && node.name?.text) {
                                    funcNames.push(node.name.text);
                                } else if (ts.isVariableStatement(node)) {
                                    const decl = node.declarationList.declarations[0];
                                    if (ts.isArrowFunction(decl)) {
                                        funcNames.push(node.declarationList?.declarations[0]?.name?.getText(curFile));
                                    }
                                }
                                return ts.visitEachChild(node, visitor, context);
                            };

                            curFile = ts.visitNode(curFile, visitor, ts.isSourceFile);
                            // Use the base name from the emitted file for the result key
                            result[baseName] = funcNames;

                            return curFile;
                        },
                ],
                compilerOptions
            );
            // Report info message to the console.
            processorCtx.getReporter().reportDiagnostic(new InfoMessage(`Example result processor: processed "${emittedPath}" (source: "${sourceFile}")"`));
        });

        // Write the result to the output JSON file.
        processorCtx.getSystem().writeFile(path.join(processorCtx.getCompilerOptions().outDir ?? "", "named-functions.json"), JSON.stringify(result));
    });
};
