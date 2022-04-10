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
import { join } from "path";
import ts from "typescript";

/**
 * Gets the output file path for the given output directory.
 *
 * @param outputDirectory The output directory for the generated files.
 * @returns The output file path.
 */
export const getOutputFilePath = (outputDirectory: string) => join(outputDirectory, "annotatedFunctions.yaml");

/**
 * Create a transformer that collects all functions and arrow functions with a // @service() comment.
 *
 * @param sys The ts.System for the transformation.
 * @param outputDirectory The output directory for the generated files.
 * @returns A TS TransformerFactory.
 */
export const createTransformerFactory = (sys: ts.System, outputDirectory: string): ts.TransformerFactory<ts.SourceFile> => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => {
            const outputNames = readOutputNames(sys, outputDirectory);

            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                // Visit child nodes of source files
                if (ts.isSourceFile(node)) {
                    ts.visitEachChild(node, visitor, ctx);
                }

                if (isAnnotated(node, sf)) {
                    addFunctionNameToOutput(node, outputNames, sf);
                }

                return node;
            };

            sf = ts.visitNode(sf, visitor);

            sys.writeFile(getOutputFilePath(outputDirectory), `${outputNames.join("\n")}`);
            return sf;
        };
    };
};

/**
 * Checks if the given node is annotated with a // @annotated() comment.
 *
 * @param node The node to check.
 * @param sf The source file that contains the node.
 * @returns True if the node is annotated with a @annotated() comment.
 */
const isAnnotated = (node: ts.Node, sf: ts.SourceFile) => {
    return node.getFullText(sf).match(/\/\/.*@annotated\(.*\)/gi);
};

/**
 * Gets the name of the given variable statement.
 *
 * @param variableStatement The TS VariableStatement to get the name from.
 * @param sf The TS SourceFile that contains this variable statement.
 * @returns The name of the variable in the given statement.
 */
const getVariableName = (variableStatement: ts.VariableStatement, sf: ts.SourceFile): string => {
    return variableStatement.declarationList.declarations[0].name.getText(sf);
};

/**
 * Gets the name of the given function node and adds it to the output name array.
 *
 * @param node The node to get the name from.
 * @param outputNames The outputNames array to add the name to.
 * @param sf The source file that contains the node.
 */
const addFunctionNameToOutput = (node: ts.Node, outputNames: string[], sf: ts.SourceFile) => {
    if (ts.isFunctionDeclaration(node)) {
        outputNames.push(`- ${node.name?.getText(sf) ?? "unknown"}`);
    } else if (ts.isVariableStatement(node)) {
        outputNames.push(`- ${getVariableName(node, sf)}`);
    }
};

/**
 * Reads the output names from the given output file in the output directory.
 *
 * @param sys The ts.System for the file system access.
 * @param outputDirectory The output directory for the generated files.
 * @returns The output names array read from the output file if it exists.
 */
function readOutputNames(sys: ts.System, outputDirectory: string): string[] {
    return (
        sys
            .readFile(getOutputFilePath(outputDirectory))
            ?.split("\n")
            .filter(line => line !== undefined && line.length > 0) ?? []
    );
}
